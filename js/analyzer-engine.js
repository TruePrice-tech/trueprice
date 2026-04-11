// analyzer-engine.js
// Shared quote analysis engine for all verticals, both single-quote and compare paths.
//
// Architecture:
//   1. Client-side image resize (normalize large phone photos)
//   2. Tesseract OCR (browser-side, no server cost)
//   3. Regex parser (analyzer-parser.js parseExtractedText)
//   4. AI backup ONLY when regex fails to find a price (cost-controlled)
//   5. Daily AI call counter by vertical (Redis via /api/ai-counter)
//
// Usage:
//   const result = await TP_Engine.analyzeQuote(file, { vertical: "plumbing", apiEndpoint: "/api/plumbing-estimate" });
//   result = { price, contractor, material, scope, source, ocrText, ocrConfidence, aiData, ... }
//
// For compare path:
//   const result = await TP_Engine.analyzeQuote(file, { vertical: "roofing", apiEndpoint: "/api/parse-quote" });
//   // Same result shape, compare page just uses multiple results side-by-side

(function () {
  "use strict";

  // ── Config ──
  var MAX_IMAGE_DIMENSION = 2000;    // px - resize large images before OCR
  var JPEG_QUALITY = 0.82;           // compression for resized images
  var MAX_API_PAYLOAD_KB = 3500;     // max base64 image size to send to AI backup
  var OCR_TIMEOUT_MS = 60000;        // 60s max for Tesseract
  var AI_CONFIDENCE_THRESHOLD = 40;  // regex confidence below this triggers AI backup

  // ── Image resize ──
  // Normalizes phone photos (often 4000x3000+) to a manageable size.
  // Improves Tesseract accuracy (smaller, cleaner image) and keeps AI payload under limits.
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width;
          var h = img.height;
          var longest = Math.max(w, h);

          // Skip resize if already small enough
          if (longest <= MAX_IMAGE_DIMENSION && file.size < MAX_API_PAYLOAD_KB * 1024) {
            resolve({ dataUrl: reader.result, width: w, height: h, resized: false });
            return;
          }

          var scale = MAX_IMAGE_DIMENSION / longest;
          var nw = Math.round(w * scale);
          var nh = Math.round(h * scale);

          var canvas = document.createElement("canvas");
          canvas.width = nw;
          canvas.height = nh;
          var ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, nw, nh);

          var dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
          resolve({ dataUrl: dataUrl, width: nw, height: nh, resized: true });
        };
        img.onerror = function () { reject(new Error("Failed to load image for resize")); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error("Failed to read file")); };
      reader.readAsDataURL(file);
    });
  }

  // ── Image preprocessing for OCR ──
  function preprocessForOCR(imageDataUrl, mode) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement("canvas");
        var scale = Math.max(1.5, Math.min(2.5, 2400 / Math.max(img.width, img.height)));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var data = imageData.data;

        if (mode === "strong") {
          for (var i = 0; i < data.length; i += 4) {
            var gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            gray = (gray - 128) * 1.6 + 128;
            gray = gray > 170 ? 255 : gray < 85 ? 0 : gray;
            gray = Math.max(0, Math.min(255, gray));
            data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
          }
        } else {
          // "soft" - light grayscale + contrast
          for (var j = 0; j < data.length; j += 4) {
            var g = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
            g = (g - 128) * 1.3 + 128;
            g = Math.max(0, Math.min(255, g));
            data[j] = g; data[j + 1] = g; data[j + 2] = g;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = function () { reject(new Error("Preprocess failed")); };
      img.src = imageDataUrl;
    });
  }

  // ── Tesseract OCR with multi-pass ──
  var _tesseractWorker = null;

  function ensureTesseract() {
    return new Promise(function (resolve, reject) {
      if (typeof Tesseract !== "undefined") { resolve(); return; }
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Failed to load Tesseract.js")); };
      document.head.appendChild(script);
    });
  }

  // Multi-pass OCR: runs soft + strong preprocessing, picks best result.
  // "Best" = has dollar signs and longest text (most content extracted).
  async function runOCR(imageDataUrl, onProgress) {
    await ensureTesseract();

    var worker = await Tesseract.createWorker("eng");
    var passes = [
      { mode: "soft", psm: 6, label: "1/3" },
      { mode: "strong", psm: 6, label: "2/3" },
      { mode: "soft", psm: 3, label: "3/3" }
    ];

    var best = "";
    var bestConf = 0;
    var bestHasDollar = false;

    for (var p = 0; p < passes.length; p++) {
      var pass = passes[p];
      try {
        if (onProgress) onProgress(30 + Math.round((p / passes.length) * 20),
          "Reading text (" + pass.label + ")...");
        try { await worker.setParameters({ tessedit_pageseg_mode: String(pass.psm) }); } catch (e) {}
        var preprocessed = await preprocessForOCR(imageDataUrl, pass.mode);
        var res = await worker.recognize(preprocessed);
        var t = (res && res.data && res.data.text || "").trim();
        var conf = (res && res.data && res.data.confidence) || 0;
        var hasDollar = /\$/.test(t);

        if (hasDollar && !bestHasDollar) {
          best = t; bestConf = conf; bestHasDollar = true;
        } else if (hasDollar === bestHasDollar && t.length > best.length) {
          best = t; bestConf = conf;
        }
      } catch (passErr) {
        console.warn("[TP_Engine] OCR pass failed", pass.label, passErr.message);
      }
    }

    try { await worker.terminate(); } catch (e) {}
    try { window.__TP_LAST_OCR_TEXT = best; } catch (e) {}

    return {
      text: best,
      confidence: bestConf
    };
  }

  // ── PDF text extraction ──
  function ensurePdfjs() {
    return new Promise(function (resolve, reject) {
      if (typeof pdfjsLib !== "undefined") { resolve(); return; }
      var script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = function () {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve();
      };
      script.onerror = function () { reject(new Error("Failed to load PDF.js")); };
      document.head.appendChild(script);
    });
  }

  async function extractPdfText(file) {
    await ensurePdfjs();
    var arrayBuffer = await file.arrayBuffer();
    var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    var text = "";
    for (var i = 1; i <= Math.min(pdf.numPages, 5); i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      text += content.items.map(function (item) { return item.str; }).join(" ") + "\n";
    }
    return text;
  }

  // ── AI backup call ──
  // Only called when regex parser fails to find a price.
  async function callAIBackup(text, imageDataUrl, options) {
    var endpoint = options.apiEndpoint;
    if (!endpoint) return null;

    var body = {};
    if (text && text.length > 50) {
      body.text = text.substring(0, 8000);
    }
    if (imageDataUrl) {
      // Check payload size - skip if image is too large
      var base64Size = imageDataUrl.length * 0.75; // approximate decoded size
      if (base64Size < MAX_API_PAYLOAD_KB * 1024) {
        body.images = [imageDataUrl];
      }
    }

    try {
      var resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        console.warn("[TP_Engine] AI backup HTTP " + resp.status);
        return null;
      }
      var json = await resp.json();
      if (json.success && json.data) {
        // Increment daily counter
        incrementAICounter(options.vertical || "unknown");
        return json.data;
      }
      return json.data || null;
    } catch (e) {
      console.warn("[TP_Engine] AI backup error:", e.message);
      return null;
    }
  }

  // ── Daily AI counter ──
  function incrementAICounter(vertical) {
    try {
      fetch("/api/ai-counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical: vertical, action: "increment" })
      }).catch(function () { /* silent */ });
    } catch (e) { /* silent */ }
  }

  // ── Normalize OCR text ──
  function normalizeWhitespace(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // ── Main analysis function ──
  // Called by both single-quote analyzers and compare pages.
  //
  // options:
  //   vertical: string ("plumbing", "roofing", etc.)
  //   apiEndpoint: string ("/api/plumbing-estimate", etc.)
  //   onProgress: function(percent, message) - optional progress callback
  //   skipAI: boolean - force regex-only (default false)
  //   forceAI: boolean - always call AI even if regex succeeds (default false, should stay false)
  //
  async function analyzeQuote(file, options) {
    options = options || {};
    var onProgress = options.onProgress || function () {};
    var result = {
      price: null,
      contractor: null,
      material: null,
      materialLabel: null,
      city: null,
      stateCode: null,
      warranty: null,
      warrantyYears: null,
      roofSize: null,
      scope: {},
      scopeItems: [],
      lineItems: [],
      redFlags: [],
      confidence: "low",
      confidenceScore: 0,
      source: "none",       // "regex", "ai", "manual"
      ocrText: "",
      ocrConfidence: 0,
      ocrElapsed: 0,
      aiCalled: false,
      aiData: null,
      parsed: null,          // full regex parser output
      imageDataUrl: null,    // resized image for AI backup
      fileName: file ? file.name : ""
    };

    if (!file) return result;

    var t0 = Date.now();

    // Step 1: Image resize (or PDF text extract)
    var imageDataUrl = null;
    var ocrInput = null;

    if (file.type === "application/pdf") {
      onProgress(15, "Extracting text from PDF...");
      try {
        var pdfText = await extractPdfText(file);
        result.ocrText = normalizeWhitespace(pdfText);
        result.ocrConfidence = 90; // PDF text extraction is high confidence
      } catch (e) {
        console.warn("[TP_Engine] PDF extraction failed:", e.message);
        return result;
      }
    } else {
      onProgress(10, "Preparing image...");
      try {
        var resized = await resizeImage(file);
        imageDataUrl = resized.dataUrl;
        result.imageDataUrl = imageDataUrl;
        ocrInput = imageDataUrl;
      } catch (e) {
        console.warn("[TP_Engine] Image resize failed:", e.message);
        // Fall back to original file
        ocrInput = file;
      }

      // Step 2: Tesseract OCR (multi-pass with preprocessing)
      onProgress(25, "Reading text from image...");
      try {
        var ocrResult = await runOCR(imageDataUrl || ocrInput, onProgress);
        result.ocrText = normalizeWhitespace(ocrResult.text);
        result.ocrConfidence = ocrResult.confidence;
        result.ocrElapsed = Date.now() - t0;
      } catch (e) {
        console.warn("[TP_Engine] OCR failed:", e.message);
      }
    }

    // Step 3: Regex parser
    onProgress(55, "Analyzing quote...");
    if (result.ocrText && typeof parseExtractedText === "function") {
      try {
        var parsed = parseExtractedText(result.ocrText, {});
        result.parsed = parsed;

        // Extract fields from regex result
        var regexPrice = parsed.finalBestPrice || parsed.price || null;
        if (regexPrice) regexPrice = Number(String(regexPrice).replace(/[$,]/g, ""));
        if (regexPrice && regexPrice >= 10 && regexPrice <= 500000) {
          result.price = regexPrice;
          result.source = "regex";
        }

        result.contractor = parsed.contractor || null;
        result.material = parsed.material || null;
        result.materialLabel = parsed.materialLabel || null;
        result.city = parsed.city || null;
        result.stateCode = parsed.stateCode || null;
        result.warranty = parsed.warranty || null;
        result.warrantyYears = parsed.warrantyYears || null;
        result.roofSize = parsed.roofSize || null;
        result.confidence = parsed.confidenceLabel || "low";
        result.confidenceScore = parsed.confidenceScore || 0;
        result.scope = parsed.signals || {};
      } catch (e) {
        console.warn("[TP_Engine] Parser error:", e.message);
      }
    }

    // Scope detection (analyzer-scope.js)
    if (result.ocrText && typeof detectScopeItems === "function") {
      try {
        result.scopeItems = detectScopeItems(result.ocrText);
      } catch (e) { /* silent */ }
    }

    // Step 4: AI backup (ONLY when regex failed to find a price)
    var shouldCallAI = !options.skipAI &&
                       !result.price &&
                       options.apiEndpoint;

    if (shouldCallAI) {
      onProgress(70, "Getting a second opinion...");
      result.aiCalled = true;

      var aiData = await callAIBackup(result.ocrText, imageDataUrl, options);
      if (aiData) {
        result.aiData = aiData;

        // Extract price from AI result
        var aiPrice = aiData.totalPrice || aiData.price || aiData.total || null;
        if (aiPrice && Number(aiPrice) >= 10 && Number(aiPrice) <= 500000) {
          result.price = Number(aiPrice);
          result.source = "ai";
        }

        // AI enrichment: fill in fields regex missed
        if (aiData.contractor && !result.contractor) result.contractor = aiData.contractor;
        if (aiData.material && !result.material) result.material = aiData.material;
        if (aiData.materialLabel && !result.materialLabel) result.materialLabel = aiData.materialLabel;
        if (aiData.city && !result.city) result.city = aiData.city;
        if (aiData.stateCode && !result.stateCode) result.stateCode = aiData.stateCode;
        if (aiData.warranty && !result.warranty) result.warranty = aiData.warranty;
        if (aiData.lineItems) result.lineItems = aiData.lineItems;
        if (aiData.redFlags) result.redFlags = aiData.redFlags;
        if (aiData.confidence) result.confidence = aiData.confidence;

        // Merge AI scope items
        if (aiData.scopeItems) {
          Object.entries(aiData.scopeItems).forEach(function (entry) {
            var key = entry[0], status = entry[1];
            if (status === "included" || status === "yes") {
              if (!result.scope[key] || result.scope[key].status === "unclear") {
                result.scope[key] = { label: key, status: "included", evidence: "ai" };
              }
            }
          });
        }
      }
    }

    onProgress(95, "Finalizing...");

    // Log for debugging
    console.log("[TP_Engine] vertical=" + (options.vertical || "?") +
      " price=" + (result.price || "NONE") +
      " source=" + result.source +
      " ocrChars=" + result.ocrText.length +
      " ocrConf=" + Math.round(result.ocrConfidence) + "%" +
      " aiCalled=" + result.aiCalled);

    onProgress(100, "Done");
    return result;
  }

  // ── Public API ──
  window.TP_Engine = {
    analyzeQuote: analyzeQuote,
    resizeImage: resizeImage,
    runOCR: runOCR,
    normalizeWhitespace: normalizeWhitespace,
    VERSION: "1.0.0"
  };

})();
