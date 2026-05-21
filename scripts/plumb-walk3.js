// One more analyze walk: click "Yes, analyze this price" after the confirmation step
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
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|TP_Engine|verdict|fair|above|below|red flag/i.test(t)) {
      console.log("  [console]", m.type(), t.substring(0, 240));
    }
  });
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

  console.log("=== ANALYZE — click through confirm + capture final analysis ===");
  await page.goto(`${BASE}/plumbing-quote-analyzer.html`, { waitUntil: "networkidle2" });
  await sleep(1500);

  const fixture = path.join(ROOT, "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg");
  await (await page.$('input[type="file"]')).uploadFile(fixture);
  console.log("  uploaded:", path.basename(fixture));

  // Wait for the confirmation step ("Yes, analyze this price")
  const start1 = Date.now();
  let confirmReady = false;
  while (Date.now() - start1 < 90000) {
    await sleep(2000);
    confirmReady = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
      return !!(target && !target.disabled && target.offsetParent !== null);
    });
    if (confirmReady) break;
  }
  console.log("  confirm button ready:", confirmReady, "after", Math.round((Date.now() - start1) / 1000) + "s");
  await shot(page, "22c-confirm-step");

  if (confirmReady) {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
      if (target) target.click();
    });
    console.log("  clicked confirm");

    // Wait for the verdict to appear (analysis result)
    const start2 = Date.now();
    let analysisDone = false;
    while (Date.now() - start2 < 90000) {
      await sleep(2500);
      analysisDone = await page.evaluate(() => {
        const txt = document.body.innerText;
        const stillLoading = /Analyzing|Reading text|Building analysis|Calculating verdict/i.test(txt);
        const hasVerdict = /(Fair price|Above average|Higher than expected|Below average|Overpriced|Unusually low|Quote total|Verdict)/i.test(txt);
        return !stillLoading && hasVerdict;
      });
      if (analysisDone) break;
    }
    console.log("  full analysis rendered:", analysisDone, "after", Math.round((Date.now() - start2) / 1000) + "s");
    await sleep(2000);
    await shot(page, "23c-analysis-result-top");
    await shot(page, "23c-analysis-result-full", true);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(800);
    await shot(page, "23c-analysis-result-bottom");
  }

  await browser.close();
  console.log("DONE");
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
