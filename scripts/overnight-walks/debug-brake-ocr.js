// Debug the $12,000 brake fixture — capture OCR text + parse output to
// see why warranty_mileage filter isn't catching it.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const FIX = path.join(ROOT, "test-quotes", "auto-images", "comparison-brake-02-shop-b-mid.png");
const OUT = path.join(ROOT, "output", "overnight-walks-2026-04-28", "auto-repair");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  await page.goto("https://woogoro.com/compare-auto-quotes.html", { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);

  // Stub-listen for engine activity
  await page.evaluate(() => {
    window.__DBG_PARSED = null;
    window.__DBG_OCR = null;
    const orig = window.TP_Engine && window.TP_Engine.analyzeQuote;
    if (orig) {
      window.TP_Engine.analyzeQuote = async function(...args) {
        const r = await orig.apply(this, args);
        window.__DBG_OCR = r.ocrText || "";
        window.__DBG_PARSED = r.parsed || null;
        window.__DBG_PRICE = r.price;
        window.__DBG_SOURCE = r.source;
        return r;
      };
    }
  });

  const fileInput = await page.$("#file0");
  await fileInput.uploadFile(FIX);
  await sleep(15000);

  const debug = await page.evaluate(() => ({
    price: window.__DBG_PRICE,
    source: window.__DBG_SOURCE,
    ocr: window.__DBG_OCR || "",
    parsedKeys: window.__DBG_PARSED ? Object.keys(window.__DBG_PARSED) : null,
    candidates: window.__DBG_PARSED && window.__DBG_PARSED.priceCandidates ? window.__DBG_PARSED.priceCandidates.slice(0,10).map(c => ({ value: c.value, score: Math.round(c.score), sourceType: c.sourceType })) : null,
    finalBest: window.__DBG_PARSED ? (window.__DBG_PARSED.finalBestPrice || window.__DBG_PARSED.price) : null,
    parsedPrice: window.__DBG_PARSED ? window.__DBG_PARSED.price : null,
    parsedFinal: window.__DBG_PARSED ? window.__DBG_PARSED.finalBestPrice : null,
  }));
  fs.writeFileSync(path.join(OUT, "debug-brake-ocr.json"), JSON.stringify(debug, null, 2));
  console.log("price:", debug.price, "source:", debug.source);
  console.log("finalBest:", debug.finalBest);
  console.log("Top candidates:");
  (debug.candidates || []).forEach(c => console.log(" -", c.value, "score=" + c.score, "type=" + c.sourceType));
  console.log("--- OCR (first 1500 chars) ---");
  console.log(debug.ocr.slice(0, 1500));

  await browser.close();
})();
