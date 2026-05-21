// Continue auto-repair dive: analyzer (2 fixtures), compare (3 fixtures), mobile,
// landing pages. Handles price-confirm prompt explicitly.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "auto-dive-2026-04-27");
const FIX = path.join(ROOT, "test-quotes", "auto-images");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function newPage(browser, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36");
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|verdict|undefined|TP_Engine|400|500|warn/i.test(t)) console.log(`  [${label}]`, m.type(), t.substring(0, 280));
  });
  page.on("pageerror", (e) => console.log(`  [${label} PAGEERR]`, e.message.substring(0, 280)));
  return page;
}

async function dump(page, name, selector) {
  const txt = await page.evaluate((sel) => {
    const el = sel ? document.querySelector(sel) : (document.getElementById("estimateResult") || document.getElementById("quoteApp") || document.querySelector("main"));
    return el ? (el.innerText || "").slice(0, 8000) : "(no el)";
  }, selector);
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

async function runAnalyze(browser, label, fixturePath) {
  const page = await newPage(browser, label);
  console.log(`\n=== ANALYZE: ${label} (${path.basename(fixturePath)}) ===`);
  await page.goto(`${BASE}/auto-repair.html?path=quote`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  await shot(page, `${label}-01-upload-page`);

  const fileInput = await page.waitForSelector("#fileInput", { timeout: 10000, visible: false });
  await fileInput.uploadFile(fixturePath);
  console.log(`  uploaded ${path.basename(fixturePath)}`);

  // Wait up to 90s for either price-confirm prompt OR final result
  try {
    await page.waitForFunction(() => {
      return !!document.getElementById("tpConfirmPriceBtn") ||
             !!document.querySelector(".ar-verdict-card") ||
             /couldn|enter the quote total|fallback/i.test(document.body.innerText);
    }, { timeout: 90000 });
  } catch (e) {
    console.log(`  [analyze] timeout waiting for confirm/verdict: ${e.message}`);
  }
  await sleep(1000);
  await shot(page, `${label}-02-after-parse`, true);
  await dump(page, `${label}-02-after-parse`, "#quoteApp");

  // Capture detected price + OCR text BEFORE confirming
  const detected = await page.evaluate(() => {
    const ocr = window.__TP_LAST_OCR_TEXT || "";
    const priceEl = document.querySelector("#quoteApp [style*='font-size:36px']") || document.querySelector("#quoteApp div[style*='color:#166534']");
    const priceTxt = priceEl ? priceEl.innerText : "(no price element)";
    return { priceShown: priceTxt, ocrLen: ocr.length, ocrSample: ocr.substring(0, 600) };
  });
  fs.writeFileSync(path.join(OUT, `${label}-03-detected.txt`), JSON.stringify(detected, null, 2));
  console.log(`  detected price: ${detected.priceShown}`);
  console.log(`  ocr ${detected.ocrLen} chars: ${detected.ocrSample.substring(0, 200).replace(/\s+/g, " ")}...`);

  // Click confirm
  const confirmed = await page.evaluate(() => {
    const btn = document.getElementById("tpConfirmPriceBtn");
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (confirmed) {
    console.log(`  clicked confirm`);
    await page.waitForFunction(() => !!document.querySelector(".ar-verdict-card"), { timeout: 30000 }).catch(() => {});
    await sleep(2000);
  }
  await shot(page, `${label}-04-result`, true);
  await dump(page, `${label}-04-result`, "#quoteApp");

  await page.close();
}

async function runCompare(browser, label, fixtures) {
  const page = await newPage(browser, label);
  console.log(`\n=== COMPARE: ${label} ===`);
  await page.goto(`${BASE}/compare-auto-quotes.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, `${label}-01-upload-page`);

  for (let i = 0; i < fixtures.length; i++) {
    const fileInput = await page.$(`#file${i}`);
    if (!fileInput) { console.log(`  no file${i}`); break; }
    await fileInput.uploadFile(fixtures[i]);
    console.log(`  uploaded slot ${i}: ${path.basename(fixtures[i])}`);
    try {
      await page.waitForFunction((idx) => {
        const slot = document.getElementById("slot" + idx);
        return slot && (slot.classList.contains("uploaded") || slot.querySelector(".slot-error"));
      }, { timeout: 90000 }, i);
    } catch (e) { console.log(`  [cmp] slot ${i} timeout: ${e.message}`); }
    await sleep(800);
  }
  await shot(page, `${label}-02-after-uploads`, true);

  const compareReady = await page.evaluate(() => {
    const btn = document.getElementById("compareBtn");
    return btn ? !btn.disabled : false;
  });
  console.log(`  compare button enabled: ${compareReady}`);
  if (compareReady) {
    await page.evaluate(() => document.getElementById("compareBtn").click());
    await sleep(2500);
  }
  await shot(page, `${label}-03-results`, true);
  await dump(page, `${label}-03-results`);

  await page.close();
}

async function runMobile(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
  console.log(`\n=== MOBILE ===`);
  page.on("pageerror", (e) => console.log(`  [mobile PAGEERR]`, e.message.substring(0, 240)));

  await page.goto(`${BASE}/auto-repair.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, "mobile-01-landing", true);

  await page.evaluate(() => { window.switchPath && window.switchPath("estimate"); });
  await sleep(800);
  await shot(page, "mobile-02-estimate-path", true);

  await page.evaluate(() => { window.switchPath && window.switchPath("quote"); });
  await sleep(800);
  await shot(page, "mobile-03-quote-path", true);

  await page.goto(`${BASE}/auto-repair-cost-guide.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1000);
  await shot(page, "mobile-04-cost-guide", true);

  await page.goto(`${BASE}/auto-repair-cost-estimate.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1000);
  await shot(page, "mobile-05-cost-estimate", true);

  await page.goto(`${BASE}/compare-auto-quotes.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1000);
  await shot(page, "mobile-06-compare", true);

  await page.close();
}

async function runLandingPages(browser) {
  const page = await newPage(browser, "landing");
  console.log(`\n=== LANDING PAGES ===`);
  await page.goto(`${BASE}/auto-repair-cost-guide.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, "landing-01-cost-guide", true);

  await page.goto(`${BASE}/auto-repair-cost-estimate.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, "landing-02-cost-estimate", true);

  for (const city of ["charlotte-nc", "san-francisco-ca", "tampa-fl"]) {
    await page.goto(`${BASE}/${city}-auto-repair-cost.html`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(1200);
    await shot(page, `landing-03-${city}`, true);
  }
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    await runAnalyze(browser, "ana-real-07-jeep-body", path.join(FIX, "07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg"));
    await runAnalyze(browser, "ana-real-09-audi-recommends", path.join(FIX, "09-am-i-crazy-or-is-this-quote.jpg"));

    await runCompare(browser, "cmp-3way-brake", [
      path.join(FIX, "comparison-brake-01-shop-a-low.png"),
      path.join(FIX, "comparison-brake-02-shop-b-mid.png"),
      path.join(FIX, "comparison-brake-03-shop-c-high.png"),
    ]);

    await runCompare(browser, "cmp-2way-real-mix", [
      path.join(FIX, "07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg"),
      path.join(FIX, "09-am-i-crazy-or-is-this-quote.jpg"),
    ]);

    await runMobile(browser);
    await runLandingPages(browser);
  } catch (e) {
    console.error("WALK2 ERROR:", e);
  } finally {
    await browser.close();
  }
  console.log("\nDONE walk2.");
})();
