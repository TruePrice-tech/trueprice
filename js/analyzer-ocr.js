async function detectDarkBackground(imageDataUrl) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement("canvas");
      var size = 100; // Sample at small size for speed
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);
      var data = ctx.getImageData(0, 0, size, size).data;
      var darkPixels = 0;
      var totalPixels = size * size;
      for (var i = 0; i < data.length; i += 4) {
        var brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (brightness < 80) darkPixels++;
      }
      // If more than 40% of pixels are dark, it's a dark background
      resolve(darkPixels / totalPixels > 0.4);
    };
    img.onerror = function() { resolve(false); };
    img.src = imageDataUrl;
  });
}

async function fileToImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function preprocessImageForOcr(imageSource, mode = "soft") {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");

      // Higher target DPI for better OCR accuracy (especially phone photos)
      const maxDimension = 2400;
      const longestSide = Math.max(img.width, img.height);
      const upscaleRatio = longestSide < maxDimension ? maxDimension / longestSide : 1;
      const scale = Math.max(1.5, Math.min(2.5, upscaleRatio));

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create canvas context for OCR preprocessing."));
        return;
      }

      // Use better image smoothing for upscaled images
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      if (mode === "soft") {
        // Gentle contrast enhancement — good for clean documents
        for (let i = 0; i < data.length; i += 4) {
          let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray = (gray - 128) * 1.3 + 128;
          gray = Math.max(0, Math.min(255, gray));
          data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
        }
      } else if (mode === "strong") {
        // Strong binarization — good for blurry/dark images
        for (let i = 0; i < data.length; i += 4) {
          let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray = (gray - 128) * 1.6 + 128;
          gray = gray > 170 ? 255 : gray < 85 ? 0 : gray;
          gray = Math.max(0, Math.min(255, gray));
          data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
        }
      } else if (mode === "inverted") {
        // Invert colors then binarize — for white text on dark backgrounds
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        // Then apply soft contrast
        for (let i = 0; i < data.length; i += 4) {
          let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray = (gray - 128) * 1.3 + 128;
          gray = Math.max(0, Math.min(255, gray));
          data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
        }
      } else if (mode === "adaptive") {
        // Adaptive thresholding — best for uneven lighting (phone photos)
        // First pass: convert to grayscale
        const grayArr = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
          grayArr[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        // Second pass: local mean thresholding (block size ~31px)
        const blockSize = 31;
        const halfBlock = Math.floor(blockSize / 2);
        const offset = 12;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let sum = 0, count = 0;
            const y0 = Math.max(0, y - halfBlock);
            const y1 = Math.min(height - 1, y + halfBlock);
            const x0 = Math.max(0, x - halfBlock);
            const x1 = Math.min(width - 1, x + halfBlock);
            // Sample every 3rd pixel for speed
            for (let sy = y0; sy <= y1; sy += 3) {
              for (let sx = x0; sx <= x1; sx += 3) {
                sum += grayArr[sy * width + sx];
                count++;
              }
            }
            const localMean = sum / count;
            const idx = (y * width + x) * 4;
            const val = grayArr[y * width + x] > localMean - offset ? 255 : 0;
            data[idx] = val; data[idx + 1] = val; data[idx + 2] = val;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = reject;
    img.src = imageSource;
  });
}

// pdfjs worker is now initialized by loadVendorLibs() in the HTML

async function runOcrOnImageSource(imageSource, progressCallback, options = {}) {
  const result = await Tesseract.recognize(imageSource, "eng", {
    logger: message => {
      if (typeof progressCallback === "function" && message.status === "recognizing text") {
        progressCallback(message.progress || 0);
      }
    },
    tessedit_pageseg_mode: options.psm || 6,
    preserve_interword_spaces: "1",
    tessedit_char_whitelist: "",
    tessjs_create_hocr: "0",
    tessjs_create_tsv: "0"
  });

  return (result && result.data && result.data.text ? result.data.text : "").trim();
}

async function createImageRegionsForOcr(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = async () => {
      const fullCanvas = document.createElement("canvas");
      const fullCtx = fullCanvas.getContext("2d");

      if (!fullCtx) {
        reject(new Error("Could not create canvas context for OCR regions."));
        return;
      }

      fullCanvas.width = img.width;
      fullCanvas.height = img.height;
      fullCtx.drawImage(img, 0, 0);

      function cropRegion(x, y, width, height) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));

        ctx.drawImage(
          fullCanvas,
          Math.round(x),
          Math.round(y),
          Math.round(width),
          Math.round(height),
          0,
          0,
          canvas.width,
          canvas.height
        );

        return canvas.toDataURL("image/png");
      }

      const w = img.width;
      const h = img.height;

      resolve([
        { label: "full page", src: imageSource, psm: 6 },
        { label: "top half", src: cropRegion(0, 0, w, h * 0.55), psm: 6 },
        { label: "middle body", src: cropRegion(w * 0.08, h * 0.20, w * 0.84, h * 0.42), psm: 6 },
        { label: "right info panel", src: cropRegion(w * 0.50, h * 0.18, w * 0.42, h * 0.28), psm: 6 },
        { label: "description block", src: cropRegion(w * 0.08, h * 0.22, w * 0.84, h * 0.30), psm: 6 },
        { label: "bottom total area", src: cropRegion(w * 0.48, h * 0.48, w * 0.44, h * 0.22), psm: 6 }
      ].filter(region => region.src));
    };

    img.onerror = reject;
    img.src = imageSource;
  });
}

async function extractTextFromPdfNative(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Smart text reconstruction using x/y coordinates
    // Detects line breaks (y changes) and kerning splits (x gap < threshold)
    let lastY = null;
    let lastX = null;
    let lastWidth = null;
    let pageText = "";

    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;

      const x = item.transform ? item.transform[4] : null;
      const y = item.transform ? item.transform[5] : null;
      const fontSize = item.transform ? Math.abs(item.transform[0]) : 12;
      const itemWidth = item.width || (item.str.length * fontSize * 0.5);

      if (lastY !== null && y !== null && Math.abs(y - lastY) > fontSize * 0.4) {
        // Y changed more than 40% of font size — new line
        pageText += "\n";
      } else if (lastX !== null && x !== null && lastWidth !== null) {
        // Same line — check x gap to decide space vs. kerning join
        const gap = x - (lastX + lastWidth);
        const spaceThreshold = fontSize * 0.25;

        if (gap > spaceThreshold) {
          // Real word gap — add space
          if (!pageText.endsWith(" ") && !pageText.endsWith("\n")) {
            pageText += " ";
          }
        }
        // else: kerning split — join without space (this fixes "Ar chitectur al")
      } else if (pageText.length > 0 && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
        // Fallback when no position data
        pageText += " ";
      }

      pageText += item.str;
      lastY = y;
      lastX = x;
      lastWidth = itemWidth;
    }

    fullText += "\n" + pageText;
  }

  // Aggressive text repair for pdfjs split-character extraction
  // pdfjs often splits words at ligature/kerning boundaries: "Ar chitectur al" "Roo fi ng"

  // Step 1: Specific roofing term repairs FIRST (before generic collapse)
  fullText = fullText
    .replace(/Roo\s*fi\s*ng/gi, "Roofing")
    .replace(/Ar\s*chitectur\s*al/gi, "Architectural")
    .replace(/under\s*la\s*y\s*ment/gi, "underlayment")
    .replace(/Underla\s*yment/gi, "Underlayment")
    .replace(/v\s*entila\s*tion/gi, "ventilation")
    .replace(/syn\s*thetic/gi, "synthetic")
    .replace(/Cer\s*tain\s*T\s*eed/gi, "CertainTeed")
    .replace(/Ice and W\s*ater/gi, "Ice and Water")
    .replace(/ice and w\s*ater/gi, "ice and water")
    .replace(/ridge\s+v\s*ent/gi, "ridge vent")
    .replace(/Ridge\s+v\s*ent/gi, "Ridge vent")
    .replace(/fl\s*ashing/gi, "flashing")
    .replace(/v\s*alle\s*ys/gi, "valleys")
    .replace(/penetr\s*ations/gi, "penetrations")
    .replace(/warr\s*anty/gi, "warranty")
    .replace(/T\s*O\s*T\s*AL/g, "TOTAL")
    .replace(/drip\s+metal/gi, "drip edge")
    .replace(/Drip\s+metal/gi, "Drip edge");

  // Step 2: Rejoin ligature fragments: "fi ng" -> "fing", "fl ow" -> "flow"
  fullText = fullText.replace(/\bfi ([a-z])/g, 'fi$1');
  fullText = fullText.replace(/\bfl ([a-z])/g, 'fl$1');
  fullText = fullText.replace(/\bff ([a-z])/g, 'ff$1');

  // Step 3: Collapse single-letter + space fragments aggressively
  // "E v ans" -> "Evans", "Gr o v et own" -> "Grovetown"
  // Run multiple passes: each pass joins a single-char fragment to its neighbor
  for (let i = 0; i < 5; i++) {
    // Join single lowercase letter to next word: "v ans" -> "vans"
    fullText = fullText.replace(/ ([a-z]) ([a-z])/g, ' $1$2');
    // Join single uppercase letter to next lowercase: "E vans" -> "Evans"
    fullText = fullText.replace(/\b([A-Z]) ([a-z])/g, '$1$2');
  }


  return fullText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeOcrWhitespace(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scoreOcrTextQuality(text) {
  const cleaned = normalizeWhitespace(String(text || ""));
  if (!cleaned) return 0;

  let score = 0;

  score += Math.min(cleaned.length, 1500) * 0.02;

  const strongSignals = [
    "roofing estimate",
    "roof estimate",
    "total estimated cost",
    "total",
    "roof size",
    "sq ft",
    "asphalt shingles",
    "material",
    "description of work",
    "flashing",
    "ventilation",
    "warranty",
    "property information",
    "customer information"
  ];

  strongSignals.forEach(signal => {
    if (cleaned.toLowerCase().includes(signal)) score += 18;
  });

  const moneyMatches = cleaned.match(/\$\s?\d[\d,.\s]{2,}/g) || [];
  score += moneyMatches.length * 12;

  const numericRoofSizeMatch = cleaned.match(/\b\d{3,5}\s*(sq\.?\s*ft|sqft|square feet|squares?)\b/i);
  if (numericRoofSizeMatch) score += 25;

  const weirdGlyphPenalty = (cleaned.match(/[{}[\]|\\^~]/g) || []).length;
  score -= weirdGlyphPenalty * 4;

  const alphaNumNoisePenalty = (cleaned.match(/[A-Z]{2,}[0-9]{1,}|[0-9]{1,}[A-Z]{2,}/g) || []).length;
  score -= alphaNumNoisePenalty * 3;

  return score;
}

function shouldAcceptFastOcrText(text) {
  const cleaned = normalizeWhitespace(String(text || ""));
  if (!cleaned) return false;

  const hasStrongPrice =
    /\$\s?\d[\d,]{2,}(\.\d{2})?\b/.test(cleaned) ||
    /total estimated cost\s*\$?\s?\d[\d,]{2,}/i.test(cleaned) ||
    /grand total\s*[:\-]?\s*\$?\s?\d[\d,]{2,}/i.test(cleaned);

  const roofingSignals = [
    "roof",
    "roofing",
    "estimate",
    "proposal",
    "total",
    "material",
    "warranty",
    "shingles"
  ];

  const signalHits = roofingSignals.filter(term =>
    cleaned.toLowerCase().includes(term)
  ).length;

  const score = scoreOcrTextQuality(cleaned);

  if (score >= 70) return true;
  if (hasStrongPrice && signalHits >= 2) return true;

  return false;
}

async function runBestOcrFromVariants(
  imageVariants,
  progressLabel = "Running OCR",
  progressOptions = {}
) {
  const candidates = [];
  const startPercent =
  typeof progressOptions.startPercent === "number" ? progressOptions.startPercent : 35;
  const endPercent =
     typeof progressOptions.endPercent === "number" ? progressOptions.endPercent : 70;

  const totalVariants = Math.max(imageVariants.length, 1);
  for (let i = 0; i < imageVariants.length; i++) {
    const variant = imageVariants[i];

    const text = await runOcrOnImageSource(
      variant.src,
      progress => {
    const variantBaseStart =
      startPercent + ((endPercent - startPercent) * i) / totalVariants;

    const variantBaseEnd =
      startPercent + ((endPercent - startPercent) * (i + 1)) / totalVariants;

    const mappedProgress =
      variantBaseStart + (variantBaseEnd - variantBaseStart) * (progress || 0);

    if (typeof setSmartUploadStatus === "function") {
      setSmartUploadStatus("identify", Math.round(mappedProgress));
    } else {
      setUploadStatus("Identifying key details from your quote...", "info");
    }
  },
      { psm: variant.psm || 6 }
    );

    candidates.push({
      label: variant.label,
      text,
      score: scoreOcrTextQuality(text)
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const mergedText = normalizeWhitespace(
    candidates
      .map(candidate => candidate.text || "")
      .filter(Boolean)
      .join("\n")
  );

  return {
    best: candidates[0] || { text: "", score: 0, label: "none" },
    mergedText,
    candidates
  };
}

function isWeakExtractedText(text) {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned || cleaned.length < 120) return true;

  const signals = [
    "roof",
    "roofing",
    "shingle",
    "estimate",
    "proposal",
    "total",
    "price",
    "cost",
    "warranty",
    "flashing",
    "underlayment",
    "tear off",
    "square",
    "sq ft",
    "contractor"
  ];

  const hits = signals.filter(term => cleaned.toLowerCase().includes(term)).length;
  return hits < 2;
}

async function renderPdfPagesToImages(file, scale = 2.5) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    images.push(canvas.toDataURL("image/png"));
  }

  return images;
}

async function extractTextFromPdfWithOcrFallback(file) {
  if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("extract", 25);
  } else {
    setUploadStatus("Extracting text from your quote...", "info");
  }

  const nativeText = await extractTextFromPdfNative(file);

  if (!isWeakExtractedText(nativeText)) {
    return {
      text: nativeText,
      method: "pdf_text"
    };
  }

  if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("identify", 45);
  } else {
    setUploadStatus("Identifying key details from your quote...", "info");
  }

  const pageImages = await renderPdfPagesToImages(file);
  const ocrPages = [];

  for (let i = 0; i < pageImages.length; i++) {
    const pageImage = pageImages[i];

    const softPageImage = await preprocessImageForOcr(pageImage, "soft");
    const strongPageImage = await preprocessImageForOcr(pageImage, "strong");
    const adaptivePageImage = await preprocessImageForOcr(pageImage, "adaptive");

    const originalRegions = await createImageRegionsForOcr(pageImage);
    const softRegions = await createImageRegionsForOcr(softPageImage);
    const adaptiveRegions = await createImageRegionsForOcr(adaptivePageImage);
    const totalPages = Math.max(pageImages.length, 1);
const pageStartPercent = 45 + Math.round((35 * i) / totalPages);
const pageEndPercent = 45 + Math.round((35 * (i + 1)) / totalPages);
const ocrResult = await runBestOcrFromVariants(
  [
    { label: `page ${i + 1} original`, src: pageImage, psm: 6 },
    { label: `page ${i + 1} enhanced`, src: softPageImage, psm: 6 },
    { label: `page ${i + 1} high contrast`, src: strongPageImage, psm: 6 },
    { label: `page ${i + 1} adaptive`, src: adaptivePageImage, psm: 6 },
    ...originalRegions.map(region => ({
      label: `page ${i + 1} original ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    })),
    ...softRegions.map(region => ({
      label: `page ${i + 1} enhanced ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    })),
    ...adaptiveRegions.map(region => ({
      label: `page ${i + 1} adaptive ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    }))
  ],
  "Identifying key details from your quote",
  { startPercent: pageStartPercent, endPercent: pageEndPercent }
);
    const bestPageText = normalizeOcrWhitespace(
      ocrResult.mergedText || ocrResult.best.text || ""
    );

    if (bestPageText) {
      ocrPages.push(bestPageText);
    }
  }

  const mergedText = normalizeWhitespace(
    [nativeText, ...ocrPages].filter(Boolean).join("\n\n")
  );

  return {
    text: mergedText,
    method: "pdf_ocr_fallback"
  };
}

async function extractTextFromUploadedFile(file) {
  const name = String(file.name || "").toLowerCase();
  const mimeType = String(file.type || "").toLowerCase();

  const isPdf = mimeType === "application/pdf" || name.endsWith(".pdf");
  const isImage =
    mimeType.startsWith("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".bmp") ||
    name.endsWith(".gif");

  if (isPdf) {
    if (typeof setSmartUploadStatus === "function") {
      setSmartUploadStatus("upload", 10); 
    }
    return await extractTextFromPdfWithOcrFallback(file);
  }

  if (isImage) {
    if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("upload", 10);
    setSmartUploadStatus("extract", 25);
  } else {
    setUploadStatus("Uploading your quote...", "info");
  }

    const imageDataUrl = await fileToImageDataUrl(file);

    // Auto-detect dark background and add inverted variant
    const isDarkBg = await detectDarkBackground(imageDataUrl);
    const softImageDataUrl = await preprocessImageForOcr(imageDataUrl, "soft");
    const strongImageDataUrl = await preprocessImageForOcr(imageDataUrl, "strong");
    const invertedImageDataUrl = isDarkBg ? await preprocessImageForOcr(imageDataUrl, "inverted") : null;
    const originalRegions = await createImageRegionsForOcr(imageDataUrl);
const softRegions = await createImageRegionsForOcr(softImageDataUrl);

const fastOriginalRegions = originalRegions.filter(region =>
  region.label === "middle body" || region.label === "bottom total area"
);

const fastSoftRegions = softRegions.filter(region =>
  region.label === "middle body" || region.label === "bottom total area"
);

const fastOcrResult = await runBestOcrFromVariants(
  [
    { label: "original image", src: imageDataUrl, psm: 6 },
    { label: "enhanced image", src: softImageDataUrl, psm: 6 },
    ...(invertedImageDataUrl ? [{ label: "inverted image", src: invertedImageDataUrl, psm: 6 }] : []),
    ...fastOriginalRegions.map(region => ({
      label: `original ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    })),
    ...fastSoftRegions.map(region => ({
      label: `enhanced ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    }))
  ],
  "Identifying key details from your quote",
  { startPercent: 35, endPercent: 68 }
);

const fastBestText = normalizeOcrWhitespace(
  fastOcrResult.best.text || fastOcrResult.mergedText || ""
);

if (shouldAcceptFastOcrText(fastBestText)) {
  return {
    text: fastBestText,
    method: "image_ocr"
  };
} 

const rescueOcrResult = await runBestOcrFromVariants(
  [
    { label: "high contrast image", src: strongImageDataUrl, psm: 6 },
    ...originalRegions
      .filter(region => region.label !== "middle body" && region.label !== "bottom total area")
      .map(region => ({
        label: `original ${region.label}`,
        src: region.src,
        psm: region.psm || 6
      })),
    ...softRegions
      .filter(region => region.label !== "middle body" && region.label !== "bottom total area")
      .map(region => ({
        label: `enhanced ${region.label}`,
        src: region.src,
        psm: region.psm || 6
      }))
  ],
  "Identifying key details from your quote",
  { startPercent: 68, endPercent: 78 }
);

const finalText = normalizeOcrWhitespace(
  rescueOcrResult.best.text ||
  fastBestText ||
  rescueOcrResult.mergedText ||
  fastOcrResult.mergedText ||
  ""
);

return {
  text: finalText,
  method: "image_ocr",
  images: [imageDataUrl] // Include original image for Claude Vision
};

  }

  throw new Error("Unsupported file type. Please upload a PDF or image.");
}

  async function parseUploadedComparisonFile(file) {
    if (!file) return null;

    // Lazy-load vendor libs (pdfjs, tesseract, html2canvas) on first upload
    if (typeof loadVendorLibs === "function") {
      await loadVendorLibs();
    }

    const extractionResult = await extractTextFromUploadedFile(file);
    const rawText = extractionResult && extractionResult.text ? extractionResult.text : "";
    const normalizedText = normalizeWhitespace(rawText);
    const parsed = parseExtractedText(normalizedText || "", {
      extractionMethod: extractionResult ? extractionResult.method : "ocr_cache"
    });

    // Try Claude AI enhancement (non-blocking — falls back to regex if fails)
    try {
      const images = extractionResult && Array.isArray(extractionResult.images) ? extractionResult.images : [];
      const aiResult = await callClaudeParseQuote(normalizedText, images);
      if (aiResult && aiResult.success && aiResult.data) {
        const ai = aiResult.data;
        // AI overrides regex when AI has a value and regex doesn't (or regex has low confidence)
        if (ai.price && (!parsed.price || parsed.confidenceScore < 60)) {
          parsed.price = String(ai.price);
          parsed.finalBestPrice = String(ai.price);
        }
        if (ai.material && ai.material !== "null") {
          parsed.material = ai.material;
          parsed.materialLabel = ai.materialLabel || ai.material;
        }
        if (ai.contractor) parsed.contractor = ai.contractor;
        if (ai.city) parsed.city = ai.city;
        if (ai.stateCode) parsed.stateCode = ai.stateCode;
        if (ai.roofSize) parsed.roofSize = String(ai.roofSize);
        if (ai.warrantyYears) parsed.warrantyYears = String(ai.warrantyYears);
        if (ai.warranty) parsed.warranty = ai.warranty;
        // Merge scope items — AI overrides "unclear" with "included" or "excluded"
        if (!parsed.signals) parsed.signals = {};
        if (ai.scopeItems) {
          Object.entries(ai.scopeItems).forEach(function(entry) {
            var key = entry[0], status = entry[1];
            if (status === "included" || status === "excluded") {
              if (!parsed.signals[key] || parsed.signals[key].status === "unclear") {
                parsed.signals[key] = { label: key, status: status, evidence: "AI detected" };
              }
            }
          });
        }
        // Also store scopeItems directly for compare page access
        if (ai.scopeItems) parsed.scopeItems = ai.scopeItems;
        parsed.aiEnhanced = true;
      }
    } catch (aiErr) {
      console.warn("AI parse enhancement failed (using regex fallback):", aiErr.message);
    }

    return {
      fileName: file.name || "",
      method: extractionResult ? extractionResult.method : "",
      rawText: rawText || "",
      normalizedText: normalizedText || "",
      parsed: parsed || {}
    };
  }

  async function callClaudeParseQuote(text, images) {
    try {
      const body = { text: (text || "").substring(0, 8000) };
      // Include up to 2 page images for vision
      if (images && images.length > 0) {
        body.images = images.slice(0, 2);
      }
      const res = await fetch("/api/parse-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

async function parseQuote() {
  const fileInput = document.getElementById("quoteFile");
  const output = document.getElementById("analysisOutput");
  const aiOutput = document.getElementById("aiAnalysisOutput");

  if (!fileInput.files.length) {
    output.innerHTML = "Please upload a roofing quote file first.";
    aiOutput.innerHTML = "Upload a quote or run the manual analysis to receive an expert explanation.";
    setUploadStatus("No file selected yet.", "error");
    return;
  }

  const file = fileInput.files[0];

  try {
    if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("upload", 10);
  } else {
    setUploadStatus("Uploading your quote...", "info");
  }

    const extractionResult = await extractTextFromUploadedFile(file);
    const parsedText = normalizeWhitespace(extractionResult.text || "");


    if (!parsedText) {
      throw new Error("We could not read usable text from that file.");
    }

    analyzeParsedText(parsedText, extractionResult.method);
  } catch (error) {
    console.error(error);
    output.innerHTML = "Unable to read this file. Please try a clearer PDF, screenshot, photo, or use manual analysis below.";
    aiOutput.innerHTML = "The uploaded file could not be parsed. Enter the key quote numbers manually to receive an expert explanation.";
    setUploadStatus(error.message || "Unable to parse uploaded file.", "error");
  }
}

window.parseUploadedComparisonFile = parseUploadedComparisonFile;