// Comprehensive Legal full-audit harness
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL_ANALYZE = "https://woogoro.com/legal-fee-analyzer.html";
const URL_COMPARE = "https://woogoro.com/compare-legal-quotes.html";

const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const FIX_HVAC = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
const FIX_AUTO = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "auto-equinox-quote.jpeg");

const OUT = path.resolve(__dirname, "..", "output", "audits", "legal-2026-04-30");
fs.mkdirSync(path.join(OUT, "analyze"), { recursive: true });
fs.mkdirSync(path.join(OUT, "compare"), { recursive: true });

function $w(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gotoSafe(page, url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("body", { timeout: 30000 });
      await $w(4000);
      return;
    } catch (e) {
      console.log(`goto attempt ${attempt + 1} failed:`, e.message);
      await $w(3000);
    }
  }
  throw new Error("gotoSafe failed for " + url);
}

async function snapshot(page, file) {
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
}

async function rejectState(page) {
  return await page.evaluate(() => {
    const banner = Array.from(document.querySelectorAll("div")).find(el => /No email.*No phone.*No signup.*never sell/i.test(el.innerText || ""));
    const bannerVisible = banner ? (banner.offsetParent !== null && banner.offsetHeight > 0) : false;
    const h = Array.from(document.querySelectorAll("h1")).find(el => /This is not/i.test(el.innerText));
    const bodyP = Array.from(document.querySelectorAll("p")).find(el => /document you uploaded looks like/i.test(el.innerText));
    const seoVisible = Array.from(document.querySelectorAll("h2")).filter(h => /What to look for|Red flags|Common hidden|How to compare|Most important|Helpful Legal/i.test(h.innerText)).map(h => h.offsetParent !== null);
    return {
      h1: h ? h.innerText : "(none)",
      bodyText: bodyP ? bodyP.innerText : "(none)",
      trustBannerVisible: bannerVisible,
      seoAnyVisible: seoVisible.some(v => v === true),
      seoCount: seoVisible.length,
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  const states = {};

  // ANALYZE 02 rejects
  for (const [name, fix] of [["roof", FIX_ROOF], ["hvac", FIX_HVAC], ["auto", FIX_AUTO]]) {
    console.log(`Analyze ${name}...`);
    await gotoSafe(page, URL_ANALYZE);
    await page.waitForSelector('input[type=file]', { timeout: 30000 });
    await $w(2000);
    const inp = await page.$('input[type=file]');
    await inp.uploadFile(fix);
    try {
      await page.waitForFunction(() => Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText)), { timeout: 75000 });
    } catch (e) { console.log(`${name} waitFn timeout`); }
    await $w(2000);
    states["analyze_" + name] = await rejectState(page);
    console.log(`${name}:`, JSON.stringify(states["analyze_" + name]));
    await snapshot(page, `analyze/redo-04-precta-${name}-rejected.png`);
  }

  // ANALYZE 05 unhappy
  console.log("Analyze 05...");
  await gotoSafe(page, URL_ANALYZE);
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  await $w(2000);
  const ainp = await page.$('input[type=file]');
  await ainp.uploadFile(FIX_ROOF);
  await $w(3000);
  await snapshot(page, "analyze/redo-05-during-analysis.png");
  await page.reload({ waitUntil: "domcontentloaded" });
  await $w(4000);
  await snapshot(page, "analyze/redo-05-after-refresh.png");

  // COMPARE
  console.log("Compare...");
  await gotoSafe(page, URL_COMPARE);
  await snapshot(page, "compare/redo-01-initial.png");
  const cmpInputs = await page.$$('input[type=file]');
  if (cmpInputs.length >= 1) {
    await cmpInputs[0].uploadFile(FIX_ROOF);
    try {
      await page.waitForFunction(() => Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText)), { timeout: 75000 });
    } catch (e) { console.log("Compare reject waitFn timeout"); }
    await $w(2000);
    states.compareReject = await rejectState(page);
    console.log("Compare reject:", JSON.stringify(states.compareReject));
    await snapshot(page, "compare/redo-03-results.png");
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await $w(4000);
  await snapshot(page, "compare/redo-05-after-refresh.png");

  fs.writeFileSync(path.join(OUT, "redo-states.json"), JSON.stringify(states, null, 2));
  console.log("=== DONE ===");
  console.log(JSON.stringify(states, null, 2));
  await browser.close();
})();
