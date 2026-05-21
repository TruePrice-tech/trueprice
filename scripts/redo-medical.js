// Comprehensive Medical REDO harness — captures all 6-step artifacts at depth.
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL_ANALYZE = "https://woogoro.com/medical-bill-analyzer.html";
const URL_COMPARE = "https://woogoro.com/compare-medical-quotes.html";

const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const FIX_HVAC = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
const FIX_AUTO = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "auto-equinox-quote.jpeg");

const OUT = path.resolve(__dirname, "..", "output", "audits", "medical-2026-04-30");
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
    const seoVisible = Array.from(document.querySelectorAll("h2")).filter(h => /What to look for|Red flags|Common hidden|How to compare|Most important/i.test(h.innerText)).map(h => h.offsetParent !== null);
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

  // ===== ANALYZE Step 2: HVAC reject =====
  console.log("Step 2 HVAC...");
  await gotoSafe(page, URL_ANALYZE);
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  await $w(2000);
  let inp = await page.$('input[type=file]');
  await inp.uploadFile(FIX_HVAC);
  try {
    await page.waitForFunction(() => Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText)), { timeout: 75000 });
  } catch (e) { console.log("HVAC waitFn timeout"); }
  await $w(2000);
  states.hvac = await rejectState(page);
  console.log("HVAC:", JSON.stringify(states.hvac));
  await snapshot(page, "analyze/redo-04-precta-hvac-rejected.png");

  // ===== ANALYZE Step 2: AUTO reject =====
  console.log("Step 2 AUTO...");
  await gotoSafe(page, URL_ANALYZE);
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  await $w(2000);
  inp = await page.$('input[type=file]');
  await inp.uploadFile(FIX_AUTO);
  try {
    await page.waitForFunction(() => Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText)), { timeout: 75000 });
  } catch (e) { console.log("AUTO waitFn timeout"); }
  await $w(2000);
  states.auto = await rejectState(page);
  console.log("AUTO:", JSON.stringify(states.auto));
  await snapshot(page, "analyze/redo-04-precta-auto-rejected.png");

  // ===== ANALYZE Step 5a: refresh during analysis =====
  console.log("Step 5 refresh...");
  await gotoSafe(page, URL_ANALYZE);
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  await $w(2000);
  inp = await page.$('input[type=file]');
  await inp.uploadFile(FIX_ROOF);
  await $w(3000);  // catch mid-OCR
  await snapshot(page, "analyze/redo-05-during-analysis.png");
  await page.reload({ waitUntil: "domcontentloaded" });
  await $w(4000);
  await snapshot(page, "analyze/redo-05-after-refresh.png");

  // ===== COMPARE Step 1: initial =====
  console.log("Compare Step 1...");
  await gotoSafe(page, URL_COMPARE);
  await snapshot(page, "compare/redo-01-initial.png");

  // ===== COMPARE Step 3: wrong-vertical reject (per-upload) =====
  console.log("Compare Step 3 reject...");
  // Upload roofing fixture to slot 0
  const cmpInputs = await page.$$('input[type=file]');
  if (cmpInputs.length >= 1) {
    await cmpInputs[0].uploadFile(FIX_ROOF);
    try {
      await page.waitForFunction(() => Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText)), { timeout: 75000 });
    } catch (e) { console.log("Compare reject waitFn timeout"); }
    await $w(2000);
    states.compareReject = await rejectState(page);
    console.log("CMP reject:", JSON.stringify(states.compareReject));
    await snapshot(page, "compare/redo-03-results.png");
  } else {
    console.log("Compare: no file inputs found");
  }

  // ===== COMPARE Step 5b: refresh =====
  await page.reload({ waitUntil: "domcontentloaded" });
  await $w(4000);
  await snapshot(page, "compare/redo-05-after-refresh.png");

  fs.writeFileSync(path.join(OUT, "redo-states.json"), JSON.stringify(states, null, 2));
  console.log("=== DONE ===");
  console.log(JSON.stringify(states, null, 2));
  await browser.close();
})();
