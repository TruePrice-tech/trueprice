// Diagnose why plumbing hard-reject isn't firing
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400 });

  // Hook console messages
  page.on("console", (m) => console.log(`[browser ${m.type()}]`, m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  await page.goto("https://woogoro.com/plumbing-quote-analyzer.html", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 3000));

  // Inject a wrapper that logs whenever renderPriceConfirmation is called
  await page.evaluate(() => {
    if (typeof window !== "undefined") {
      const orig = window.renderPriceConfirmation;
      console.log("[diagnostic] renderPriceConfirmation defined?", typeof orig);
      console.log("[diagnostic] detectVerticalFromText defined?", typeof window.detectVerticalFromText);
    }
  });

  const inputs = await page.$$('input[type="file"]');
  if (inputs.length === 0) { console.log("no input"); await browser.close(); return; }

  const fixturePath = path.join(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
  await inputs[0].uploadFile(fixturePath);
  console.log("[node] uploaded fixture");

  // Wait until OCR is set, polling every 2s
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const state = await page.evaluate(() => {
      const t = window.__TP_LAST_OCR_TEXT || "";
      const detect = typeof window.detectVerticalFromText === "function" ? window.detectVerticalFromText(t) : null;
      const h1 = document.querySelector("h1")?.textContent || "";
      return {
        hasOcr: t.length > 0,
        ocrLen: t.length,
        ocrSample: t.slice(0, 120),
        detect: detect ? { vertical: detect.vertical, score: detect.score, all: detect.all.slice(0, 5) } : null,
        h1: h1,
      };
    });
    console.log(`[node poll ${i+1}]`, JSON.stringify(state));
    if (state.h1.includes("This is not") || state.h1.includes("We found") || state.h1.includes("Quote Analysis")) {
      console.log("[node] terminal state reached");
      break;
    }
  }

  await page.screenshot({ path: path.join(__dirname, "..", "output", "debug-plumbing.png"), fullPage: false });
  await browser.close();
  console.log("done");
})();
