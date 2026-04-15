// Test a single image through the plumbing analyzer and extract ALL parsed data
const puppeteer = require("puppeteer");
const path = require("path");

const IMAGE = path.resolve("test-quotes/messy/plumbing--06-help-me-understand-the-invoicenote-from-a-plumber.jpeg");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-http-cache"] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  console.log("Loading plumbing analyzer...");
  await page.goto("https://truepricehq.com/plumbing-quote-analyzer.html?_cb=" + Date.now(), { waitUntil: "networkidle2", timeout: 30000 });

  const input = await page.$("#fileInput");
  if (!input) { console.log("NO FILE INPUT"); await browser.close(); return; }

  console.log("Uploading Roto-Rooter invoice...");
  await input.uploadFile(IMAGE);

  // Wait for processing to complete
  let done = false;
  for (let w = 0; w < 40; w++) {
    await new Promise(r => setTimeout(r, 3000));
    const state = await page.evaluate(() => {
      var body = document.body ? document.body.innerText : "";
      var cb = document.getElementById("confirmPriceBtn") || document.getElementById("tpConfirmPriceBtn");
      var mb = document.getElementById("manualPriceBtn") || document.getElementById("tpManualPriceBtn");
      var hasVerdict = /Fair Price|Overpriced|Below Average|Above Average|Unusually Low/.test(body);
      return { cb: !!cb, mb: !!mb, hasVerdict: hasVerdict, processing: body.includes("Scanning") || body.includes("Processing") || body.includes("Extracting") || body.includes("Loading") };
    });
    if (state.cb || state.mb || state.hasVerdict) { done = true; break; }
    if (!state.processing && w > 5) { done = true; break; }
    process.stdout.write(".");
  }
  console.log("");

  // Extract ALL parsed data
  const data = await page.evaluate(() => {
    // Get the OCR text
    var ocrText = window.__TP_LAST_OCR_TEXT || "";

    // Get the parser confidence
    var confidence = window.__TP_LAST_CONFIDENCE || "";

    // Try to get the full parsed result from the plumbing page's internal state
    // The plumbing page stores parsed data in its local 'parsed' variable
    // but we can check what the parser extracted by looking at the page state
    var body = document.body ? document.body.innerText : "";

    // Check for price on confirmation screen
    var priceEl = body.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
    var prices = priceEl.map(function(p) { return parseFloat(p.replace(/[$,]/g, "")); }).filter(function(v) { return v >= 50 && v <= 50000; });

    // Get confirmation screen text
    var confirmBtn = document.getElementById("confirmPriceBtn") || document.getElementById("tpConfirmPriceBtn");
    var manualBtn = document.getElementById("manualPriceBtn") || document.getElementById("tpManualPriceBtn");

    return {
      ocrTextLength: ocrText.length,
      ocrTextFirst500: ocrText.slice(0, 500),
      ocrTextLast500: ocrText.slice(-500),
      confidence: confidence,
      pricesFound: prices,
      hasConfirmBtn: !!confirmBtn,
      hasManualBtn: !!manualBtn,
      pageText: body.slice(0, 1000)
    };
  });

  console.log("=== OCR TEXT (first 500 chars) ===");
  console.log(data.ocrTextFirst500);
  console.log("\n=== OCR TEXT (last 500 chars) ===");
  console.log(data.ocrTextLast500);
  console.log("\n=== PARSER RESULTS ===");
  console.log("OCR text length:", data.ocrTextLength);
  console.log("Confidence:", data.confidence);
  console.log("Prices found:", data.pricesFound);
  console.log("Has confirm button:", data.hasConfirmBtn);
  console.log("Has manual button:", data.hasManualBtn);

  // Now run the parser directly on the OCR text to get full details
  if (data.ocrTextLength > 0) {
    const parsed = await page.evaluate((text) => {
      if (typeof parseExtractedTextMultiStrategy === "function") {
        var result = parseExtractedTextMultiStrategy(text, "plumbing");
        return {
          finalPrice: result.finalPrice,
          priceConfidence: result.priceConfidence,
          strategiesAgreed: result.strategiesAgreed,
          strategyResults: result.strategyResults,
          contractor: result.contractor || null,
          location: result.location || null,
          serviceType: result.serviceType || null,
          brand: result.brand || null,
          scopeSignals: result.scopeSignals || null,
          material: result.material || null,
          priceCandidates: (result.priceCandidates || []).slice(0, 10).map(function(c) {
            return { value: c.value, score: c.score, strategy: c.strategy, context: (c.context || "").slice(0, 60) };
          })
        };
      }
      return { error: "parseExtractedTextMultiStrategy not found" };
    }, data.ocrTextFirst500 + data.ocrTextLast500);

    console.log("\n=== FULL PARSER OUTPUT ===");
    console.log(JSON.stringify(parsed, null, 2));
  }

  // Also try running vertical-specific detectors
  const verticalData = await page.evaluate((text) => {
    var results = {};
    if (typeof detectPlumbingServiceType === "function") {
      try { results.serviceType = detectPlumbingServiceType(text); } catch(e) { results.serviceType = "error: " + e.message; }
    }
    if (typeof detectPlumbingBrand === "function") {
      try { results.brand = detectPlumbingBrand(text); } catch(e) { results.brand = "error: " + e.message; }
    }
    if (typeof detectPlumbingScopeSignals === "function") {
      try { results.scopeSignals = detectPlumbingScopeSignals(text); } catch(e) { results.scopeSignals = "error: " + e.message; }
    }
    if (typeof detectLocation === "function") {
      try { results.location = detectLocation(text); } catch(e) { results.location = "error: " + e.message; }
    }
    return results;
  }, data.ocrTextFirst500 + data.ocrTextLast500);

  console.log("\n=== VERTICAL-SPECIFIC DETECTORS ===");
  console.log(JSON.stringify(verticalData, null, 2));

  await browser.close();
})();
