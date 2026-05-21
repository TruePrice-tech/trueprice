// Generic vertical REDO harness — parameterized.
// Usage: node scripts/redo-vertical.js <vertical>
// Where <vertical> is plumbing|electrical|solar|windows|painting|siding|fencing|concrete|landscaping
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const vertical = process.argv[2];
if (!vertical) { console.error("Usage: node redo-vertical.js <vertical>"); process.exit(1); }

const URL_ANALYZE_MAP = {
  plumbing: "plumbing-quote-analyzer.html",
  electrical: "electrical-quote-analyzer.html",
  solar: "solar-quote-analyzer.html",
  windows: "window-quote-analyzer.html",
  painting: "painting-quote-analyzer.html",
  siding: "siding-quote-analyzer.html",
  fencing: "fencing-quote-analyzer.html",
  concrete: "concrete-quote-analyzer.html",
  landscaping: "landscaping-quote-analyzer.html",
  kitchen: "kitchen-quote-analyzer.html",
  insulation: "insulation-quote-analyzer.html",
  "auto-repair": "auto-repair.html?path=quote",
  moving: "moving-quote-analyzer.html",
  medical: "medical-bill-analyzer.html",
  legal: "legal-fee-analyzer.html",
};
const URL_COMPARE_MAP = {
  plumbing: "compare-plumbing-quotes.html",
  electrical: "compare-electrical-quotes.html",
  solar: "compare-solar-quotes.html",
  windows: "compare-windows-quotes.html",
  painting: "compare-painting-quotes.html",
  siding: "compare-siding-quotes.html",
  fencing: "compare-fencing-quotes.html",
  concrete: "compare-concrete-quotes.html",
  landscaping: "compare-landscaping-quotes.html",
  kitchen: "compare-kitchen-quotes.html",
  insulation: "compare-insulation-quotes.html",
  "auto-repair": "compare-auto-quotes.html",
  moving: "compare-moving-quotes.html",
  medical: "compare-medical-quotes.html",
  legal: "compare-legal-quotes.html",
};
const URL_ANALYZE = "https://woogoro.com/" + URL_ANALYZE_MAP[vertical];
const URL_COMPARE = "https://woogoro.com/" + URL_COMPARE_MAP[vertical];

const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const FIX_HVAC = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "hvac-coil-quote.jpeg");
const FIX_AUTO = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "auto-equinox-quote.jpeg");

// Auto-repair, Insulation, Kitchen audit folders use 2026-04-29 date suffix.
// Allow OUT_DATE override for re-tests on existing folders.
const OUT_DATE = process.argv[3] || "2026-04-30";
const OUT = path.resolve(__dirname, "..", "output", "audits", vertical + "-" + OUT_DATE);
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
    const seoVisible = Array.from(document.querySelectorAll("h2")).filter(h => /What to look for|Red flags|Common hidden|How to compare|Most important|Helpful/i.test(h.innerText)).map(h => h.offsetParent !== null);
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
  page.setDefaultTimeout(120000);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  // Deploy-poll: wait until live HTML contains the per-vertical hardReject button id.
  // This catches Vercel deploy timing races where the harness hits pre-fix code.
  const REJECT_ID_MAP = {
    plumbing: "plumbHardRejectStartOver",
    electrical: "elecHardRejectStartOver",
    solar: "solarHardRejectStartOver",
    windows: "winHardRejectStartOver",
    painting: "paintHardRejectStartOver",
    siding: "sidingHardRejectStartOver",
    fencing: "fencingHardRejectStartOver",
    concrete: "concreteHardRejectStartOver",
    landscaping: "landHardRejectStartOver",
    kitchen: "kitHardRejectStartOver",
    insulation: "insHardRejectStartOver",
    "auto-repair": "arHardRejectStartOver",
    moving: "mvHardRejectStartOver",
    // Medical and Legal use shared module — no per-vertical button id
  };
  const expectedId = REJECT_ID_MAP[vertical];
  if (expectedId) {
    const fetchUrl = URL_ANALYZE;
    let liveOk = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        await page.goto(fetchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        const html = await page.content();
        if (html.indexOf(expectedId) !== -1) { liveOk = true; break; }
      } catch (e) { /* ignore */ }
      console.log(`Deploy-poll attempt ${attempt + 1}: ${expectedId} not yet in live HTML, waiting 15s...`);
      await $w(15000);
    }
    if (!liveOk) console.log(`Warn: ${expectedId} never appeared. Continuing anyway.`);
    else console.log(`Deploy confirmed: ${expectedId} found in live HTML`);
  }

  const states = {};

  // ANALYZE 02 rejects (3 fixtures)
  for (const [name, fix] of [["roof", FIX_ROOF], ["hvac", FIX_HVAC], ["auto", FIX_AUTO]]) {
    console.log(`Analyze ${name}...`);
    await gotoSafe(page, URL_ANALYZE);
    await page.waitForSelector('input[type=file]', { timeout: 30000 });
    await $w(2000);
    const inp = await page.$('input[type=file]');
    await inp.uploadFile(fix);
    try {
      await page.waitForFunction(() => Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText)), { timeout: 90000 });
    } catch (e) { console.log(`${name} waitFn timeout`); }
    await $w(2000);
    states["analyze_" + name] = await rejectState(page);
    console.log(`${name}:`, JSON.stringify(states["analyze_" + name]));
    await snapshot(page, `analyze/redo-04-precta-${name}-rejected.png`);
  }

  // COMPARE: initial + reject + refresh
  console.log("Compare...");
  await gotoSafe(page, URL_COMPARE);
  await snapshot(page, "compare/redo-01-initial.png");
  const cmpInputs = await page.$$('input[type=file]');
  if (cmpInputs.length >= 1) {
    await cmpInputs[0].uploadFile(FIX_ROOF);
    try {
      await page.waitForFunction(() => Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText)), { timeout: 90000 });
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
  console.log("=== DONE: " + vertical + " ===");
  console.log(JSON.stringify(states, null, 2));
  await browser.close();
})();
