// Debug why Jeep displays as $855 in compare path when engine returns 732.39
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const FIX = path.join(ROOT, "test-quotes", "auto-images", "07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg");
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

  await page.evaluate(() => {
    window.__DBG_ENGINE = null;
    window.__DBG_OCR = "";
    window.__DBG_PARSED = null;
    const orig = window.TP_Engine && window.TP_Engine.analyzeQuote;
    if (orig) {
      window.TP_Engine.analyzeQuote = async function(...args) {
        const r = await orig.apply(this, args);
        window.__DBG_ENGINE = { price: r.price, source: r.source, aiCalled: r.aiCalled, aiData: r.aiData ? { totalPrice: r.aiData.totalPrice, partsTotal: r.aiData.partsTotal, laborTotal: r.aiData.laborTotal, repairs_count: (r.aiData.repairs||[]).length } : null };
        window.__DBG_OCR = r.ocrText || "";
        window.__DBG_PARSED = r.parsed ? { finalBestPrice: r.parsed.finalBestPrice, totalLinePrice: r.parsed.totalLinePrice, candidates: (r.parsed.priceCandidates||[]).slice(0,8).map(c => ({value: c.value, score: Math.round(c.score), sourceType: c.sourceType})) } : null;
        return r;
      };
    }
  });

  const fileInput = await page.$("#file0");
  await fileInput.uploadFile(FIX);
  // Wait for slot to mark as uploaded (regardless of compare button state)
  try {
    await page.waitForFunction(() => {
      var slot = document.getElementById("slot0");
      return slot && (slot.classList.contains("uploaded") || slot.querySelector(".slot-error"));
    }, { timeout: 180000 });
  } catch (e) { console.log("upload wait err:", e.message); }
  await sleep(2000);

  const everything = await page.evaluate(() => {
    return {
      engine: window.__DBG_ENGINE,
      parsed: window.__DBG_PARSED,
      ocr: window.__DBG_OCR,
    };
  });
  console.log("ENGINE:", JSON.stringify(everything.engine, null, 2));
  console.log("PARSED:", JSON.stringify(everything.parsed, null, 2));
  console.log("OCR (first 1500):", everything.ocr.slice(0, 1500));
  // Search OCR for 855 / 8.55 / occurrences of the offending number
  const re = /(.{0,40})855(.{0,40})/g;
  let m;
  while ((m = re.exec(everything.ocr)) !== null) {
    console.log("CONTEXT-855:", m[0].replace(/\n/g, " | "));
  }

  await browser.close();
})();
