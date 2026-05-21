// Re-walk analyze + compare with proper waits
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "plumb-walk-2026-04-26");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── ANALYZE — wait for analysis to finish ──────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("console", (m) => {
      const t = m.text();
      if (/error|fail|TP_Engine|verdict|result/i.test(t)) {
        console.log("  [console]", m.type(), t.substring(0, 220));
      }
    });
    page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

    console.log("\n=== ANALYZE (real Reddit fixture, proper wait) ===");
    await page.goto(`${BASE}/plumbing-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    const fixture = path.join(ROOT, "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg");
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(fixture);
    console.log("  uploaded:", path.basename(fixture));

    // Wait for the "Analyzing your plumbing quote..." progress text to disappear
    const start = Date.now();
    let done = false;
    while (Date.now() - start < 120000) {
      await sleep(2500);
      const state = await page.evaluate(() => {
        const txt = document.body.innerText;
        const isAnalyzing = /Analyzing your plumbing quote|Reading text|Building analysis/i.test(txt);
        // Look for verdict-style content
        const hasResult = /(Fair price|Above average|Higher than expected|Below average|Overpriced|Unusually low|Estimated cost|Quote total|Verdict)/i.test(txt);
        return { isAnalyzing, hasResult };
      });
      if (!state.isAnalyzing && state.hasResult) { done = true; break; }
    }
    console.log("  analyze done:", done, "after", Math.round((Date.now() - start) / 1000) + "s");

    await sleep(1500); // settle render
    await shot(page, "22b-analyze-result-top");
    await shot(page, "23b-analyze-result-full", true);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(600);
    await shot(page, "24b-analyze-result-bottom");
    await page.close();
  }

  // ─── COMPARE — wait for OCR, then click "Compare N quotes" ──────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("console", (m) => {
      const t = m.text();
      if (/error|fail|TP_Engine|verdict|winner/i.test(t)) {
        console.log("  [console]", m.type(), t.substring(0, 220));
      }
    });
    page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

    console.log("\n=== COMPARE (3 fixtures, wait for button + result) ===");
    await page.goto(`${BASE}/compare-plumbing-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    const fixtures = [
      path.join(ROOT, "test-quotes/plumbing-images/comparison-wh-01-low.png"),
      path.join(ROOT, "test-quotes/plumbing-images/comparison-wh-02-mid.png"),
      path.join(ROOT, "test-quotes/plumbing-images/comparison-wh-03-high.png"),
    ];
    const fileInputs = await page.$$('input[type="file"]');
    console.log("  found file inputs:", fileInputs.length);
    for (let i = 0; i < Math.min(fixtures.length, fileInputs.length); i++) {
      await fileInputs[i].uploadFile(fixtures[i]);
      console.log("  upload", i, ":", path.basename(fixtures[i]));
      await sleep(700);
    }

    // Wait until the "Compare 3 quotes" button appears (all 3 OCR done).
    const start1 = Date.now();
    let buttonReady = false;
    while (Date.now() - start1 < 120000) {
      await sleep(2000);
      buttonReady = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /^Compare\s+3\s+quotes?/i.test((b.textContent || "").trim()));
        return !!(target && !target.disabled && target.offsetParent !== null);
      });
      if (buttonReady) break;
    }
    console.log("  Compare-N-quotes button ready:", buttonReady, "after", Math.round((Date.now() - start1) / 1000) + "s");
    await shot(page, "31b-compare-after-ocr");

    if (buttonReady) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /^Compare\s+\d+\s+quotes?/i.test((b.textContent || "").trim()));
        if (target) target.click();
      });
      console.log("  clicked Compare button");

      // Wait for the comparison result page/section
      const start2 = Date.now();
      let resultDone = false;
      while (Date.now() - start2 < 60000) {
        await sleep(2000);
        const txt = await page.evaluate(() => document.body.innerText);
        if (/(Recommended|Cheapest|Best value|Winner|Side by side|Lowest price)/i.test(txt) ||
            /Compare your plumbing quotes/i.test(txt) === false) { // page changed
          resultDone = true;
          break;
        }
      }
      console.log("  compare result rendered:", resultDone, "after", Math.round((Date.now() - start2) / 1000) + "s");
      await sleep(1500);
      await shot(page, "32b-compare-result-top");
      await shot(page, "33b-compare-result-full", true);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(600);
      await shot(page, "34b-compare-result-bottom");
    }
    await page.close();
  }

  await browser.close();
  console.log("\nDONE");
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
