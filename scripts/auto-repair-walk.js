// Auto-repair deep-dive walk: estimate path (5 permutations) +
// analyze path (2 real fixtures) + compare path (3 comparison fixtures).
// Lane's address: ZIP 29707, Fort Mill, SC. Real fixtures only.
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
  page.on("requestfailed", (r) => {
    const url = r.url();
    if (/api\/|woogoro\.com/.test(url)) console.log(`  [${label} REQFAIL]`, url, r.failure()?.errorText);
  });
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

// ---- ESTIMATE PATH ----
async function runEstimate(browser, label, picks) {
  const page = await newPage(browser, label);
  console.log(`\n=== ESTIMATE: ${label} ===`);
  await page.goto(`${BASE}/auto-repair.html?path=estimate`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, `${label}-01-landing`);

  // Open repair picker, check the desired repair(s) directly via JS
  await page.evaluate(() => { window.openRepairPicker && window.openRepairPicker(); });
  await sleep(600);
  await shot(page, `${label}-02-picker-open`);

  for (const r of picks.repairs) {
    const ok = await page.evaluate((key) => {
      const cb = document.getElementById("rp_" + key);
      if (!cb) return false;
      cb.checked = true;
      // Synthesize click on parent so toggleRepair() runs
      const parent = cb.closest(".repair-item");
      if (parent) {
        // Simulate a click that doesn't toggle the checkbox again
        const ev = new MouseEvent("click", { bubbles: true });
        // Override target to parent so toggleRepair sees event.target !== cb
        const origDispatch = parent.dispatchEvent.bind(parent);
        // Just call toggleRepair directly to avoid the click-target dance
        if (typeof window.toggleRepair === "function") {
          // Set checkbox already true; toggleRepair will set selectedRepairs
          window.selectedRepairs[key] = (window.REPAIRS[key] && window.REPAIRS[key].label) || key;
          window.updateRepairChips && window.updateRepairChips();
        }
      }
      return true;
    }, r);
    if (!ok) console.log(`  [estimate] could not check ${r}`);
  }

  await sleep(300);
  await page.evaluate(() => { window.closeRepairPicker && window.closeRepairPicker(); });
  await sleep(500);
  await shot(page, `${label}-03-picker-closed`);

  // Year - set then dispatch change to trigger NHTSA fetch
  await page.evaluate((y) => {
    const sel = document.getElementById("yearInput");
    sel.value = String(y);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, picks.year);
  await sleep(2500); // wait for NHTSA makes fetch

  // Set make
  await page.evaluate((m) => {
    const sel = document.getElementById("makeInput");
    // Try uppercase / case-insensitive match
    let opt = Array.prototype.find.call(sel.options, o => o.value.toUpperCase() === m.toUpperCase());
    if (!opt) {
      // Add it as fallback
      opt = document.createElement("option");
      opt.value = m.toUpperCase();
      opt.textContent = m.toUpperCase();
      sel.appendChild(opt);
    }
    sel.value = opt.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, picks.make);
  await sleep(2500); // wait for NHTSA models fetch

  // Set model
  await page.evaluate((m) => {
    const sel = document.getElementById("modelInput");
    let opt = Array.prototype.find.call(sel.options, o => o.value.toLowerCase().includes(m.toLowerCase()));
    if (!opt) {
      opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      sel.appendChild(opt);
    }
    sel.value = opt.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, picks.model);
  await sleep(400);

  // ZIP, state, shop type
  await page.evaluate((o) => {
    document.getElementById("zipInput").value = o.zip;
    document.getElementById("zipInput").dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("stateSelect").value = o.state;
    document.getElementById("shopSelect").value = o.shop;
  }, { zip: picks.zip, state: picks.state, shop: picks.shop });
  await sleep(800);
  await shot(page, `${label}-04-form-filled`);

  // Click estimate
  await page.evaluate(() => { document.getElementById("estimateBtn").click(); });
  await sleep(2500);
  await shot(page, `${label}-05-result`, true);
  await dump(page, `${label}-05-result`);

  // Toggle parts type to OEM and re-check
  const oemBtn = await page.$('button[data-pref="oem"]');
  if (oemBtn) {
    await oemBtn.click();
    await sleep(1500);
    await shot(page, `${label}-06-result-oem`, true);
  }

  // Toggle DIY mode
  const diyBtn = await page.$('button[data-mode="parts"]');
  if (diyBtn) {
    await diyBtn.click();
    await sleep(1500);
    await shot(page, `${label}-07-result-diy`, true);
    await dump(page, `${label}-07-result-diy`);
  }

  // Click "Print / Save PDF" button (record print state)
  await page.evaluate(() => {
    // Don't actually open print dialog, but trigger print emulation to verify CSS
    const printBtn = document.querySelector(".btn-print");
    if (printBtn) printBtn._wasFound = true;
  });
  // Emulate print media to capture print stylesheet output
  await page.emulateMediaType("print");
  await sleep(500);
  await shot(page, `${label}-08-print-view`, true);
  await page.emulateMediaType("screen");

  // Click "Share" — captures clipboard text via mock
  const shareBtn = await page.$('.btn-share');
  if (shareBtn) {
    const shareUrl = await page.evaluate(() => {
      // Inject mock for navigator.share / clipboard.writeText to capture
      const origShare = navigator.share;
      const origWrite = navigator.clipboard && navigator.clipboard.writeText;
      navigator.share = undefined;
      let captured = null;
      const origAlert = window.alert;
      window.alert = () => {};
      const origPrompt = window.prompt;
      window.prompt = () => {};
      navigator.clipboard = navigator.clipboard || {};
      navigator.clipboard.writeText = function(s) { captured = s; return Promise.resolve(); };
      const btn = document.querySelector(".btn-share");
      if (btn) btn.click();
      return new Promise(r => setTimeout(() => r(captured), 600));
    });
    fs.writeFileSync(path.join(OUT, `${label}-09-share-url.txt`), shareUrl || "(no clipboard captured)");
    console.log(`  share URL: ${shareUrl?.substring(0, 200)}`);
  }

  await page.close();
}

// ---- ANALYZE PATH ----
async function runAnalyze(browser, label, fixturePath) {
  const page = await newPage(browser, label);
  console.log(`\n=== ANALYZE: ${label} (${path.basename(fixturePath)}) ===`);
  await page.goto(`${BASE}/auto-repair.html?path=quote`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  await shot(page, `${label}-01-upload-page`);

  const fileInput = await page.waitForSelector("#fileInput", { timeout: 10000, visible: false });
  await fileInput.uploadFile(fixturePath);
  console.log(`  uploaded ${path.basename(fixturePath)}`);
  await sleep(2000);
  await shot(page, `${label}-02-uploading`);

  // Wait for either price-confirmation, result, or error fallback
  await page.waitForFunction(() => {
    const root = document.getElementById("quoteApp");
    if (!root) return false;
    const txt = root.innerText || "";
    return /verdict|right at the market|above|below|couldn|confirm/i.test(txt);
  }, { timeout: 90000 });
  await sleep(1500);
  await shot(page, `${label}-03-after-parse`, true);

  // If price confirmation prompt is showing, click confirm
  const confirmBtn = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => /confirm|yes|looks right|that's correct|continue/i.test(b.textContent));
    if (btn) btn.click();
    return btn ? btn.textContent.trim() : null;
  });
  if (confirmBtn) {
    console.log(`  clicked confirm: ${confirmBtn}`);
    await sleep(2500);
  }
  await shot(page, `${label}-04-result`, true);
  await dump(page, `${label}-04-result`, "#quoteApp");

  // Capture OCR text snapshot
  const ocrText = await page.evaluate(() => window.__TP_LAST_OCR_TEXT || "(no OCR text)");
  fs.writeFileSync(path.join(OUT, `${label}-05-ocr-text.txt`), ocrText);
  console.log(`  OCR text: ${ocrText.length} chars`);

  // Click "Get a Fresh Estimate" button
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => /fresh estimate/i.test(b.textContent));
    if (btn) btn.click();
  });
  await sleep(1500);
  await shot(page, `${label}-06-after-fresh-estimate-click`);

  await page.close();
}

// ---- COMPARE PATH ----
async function runCompare(browser, label, fixtures) {
  const page = await newPage(browser, label);
  console.log(`\n=== COMPARE: ${label} ===`);
  await page.goto(`${BASE}/compare-auto-quotes.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, `${label}-01-upload-page`);

  for (let i = 0; i < fixtures.length; i++) {
    const fileInput = await page.$(`#file${i}`);
    if (!fileInput) { console.log(`  no file${i} input`); break; }
    await fileInput.uploadFile(fixtures[i]);
    console.log(`  uploaded slot ${i}: ${path.basename(fixtures[i])}`);
    // Wait for slot to become "uploaded"
    await page.waitForFunction((idx) => {
      const slot = document.getElementById("slot" + idx);
      return slot && slot.classList.contains("uploaded");
    }, { timeout: 90000 }, i);
    await sleep(800);
  }
  await shot(page, `${label}-02-after-uploads`, true);

  // Click compare
  await page.evaluate(() => { document.getElementById("compareBtn").click(); });
  await sleep(2500);
  await shot(page, `${label}-03-results`, true);
  await dump(page, `${label}-03-results`);

  await page.close();
}

// ---- MOBILE ----
async function runMobile(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
  console.log(`\n=== MOBILE ===`);

  page.on("console", (m) => { if (/error|fail|warn/i.test(m.text())) console.log(`  [mobile]`, m.type(), m.text().substring(0, 240)); });
  page.on("pageerror", (e) => console.log(`  [mobile PAGEERR]`, e.message.substring(0, 240)));

  await page.goto(`${BASE}/auto-repair.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, "mobile-01-landing");

  // Switch to estimate path
  await page.evaluate(() => { window.switchPath && window.switchPath("estimate"); });
  await sleep(800);
  await shot(page, "mobile-02-estimate-path");

  // Switch to quote
  await page.evaluate(() => { window.switchPath && window.switchPath("quote"); });
  await sleep(800);
  await shot(page, "mobile-03-quote-path");

  // Cost guide
  await page.goto(`${BASE}/auto-repair-cost-guide.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1000);
  await shot(page, "mobile-04-cost-guide", true);

  // Cost estimate page
  await page.goto(`${BASE}/auto-repair-cost-estimate.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1000);
  await shot(page, "mobile-05-cost-estimate", true);

  // Compare page
  await page.goto(`${BASE}/compare-auto-quotes.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1000);
  await shot(page, "mobile-06-compare", true);

  await page.close();
}

// ---- COST GUIDE & COST ESTIMATE LANDING PAGES ----
async function runLandingPages(browser) {
  const page = await newPage(browser, "landing");
  console.log(`\n=== LANDING PAGES ===`);

  await page.goto(`${BASE}/auto-repair-cost-guide.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, "landing-01-cost-guide", true);

  await page.goto(`${BASE}/auto-repair-cost-estimate.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, "landing-02-cost-estimate", true);

  // City pages: Charlotte (close to Lane), San Francisco (high cost), Mississippi (low cost)
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
    // Estimate permutations
    await runEstimate(browser, "est-A-civic-brake-front", {
      repairs: ["brakes_front"],
      year: 2018, make: "HONDA", model: "Civic",
      zip: "29707", state: "SC", shop: "independent"
    });
    await runEstimate(browser, "est-B-f150-trans", {
      repairs: ["transmission_rebuild"],
      year: 2015, make: "FORD", model: "F-150",
      zip: "29707", state: "SC", shop: "dealer"
    });
    await runEstimate(browser, "est-C-tesla-evbattery", {
      repairs: ["ev_battery_pack"],
      year: 2022, make: "TESLA", model: "Model 3",
      zip: "29707", state: "SC", shop: "independent"
    });
    await runEstimate(browser, "est-D-old-camry-alt-chain", {
      repairs: ["alternator"],
      year: 1995, make: "TOYOTA", model: "Camry",
      zip: "29707", state: "SC", shop: "chain"
    });
    await runEstimate(browser, "est-E-audi-multi-dealer", {
      repairs: ["oil_change_synthetic", "brakes_front", "battery"],
      year: 2019, make: "AUDI", model: "A4",
      zip: "29707", state: "SC", shop: "dealer"
    });

    // Analyze
    await runAnalyze(browser, "ana-real-07-jeep-body", path.join(FIX, "07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg"));
    await runAnalyze(browser, "ana-real-09-audi-recommends", path.join(FIX, "09-am-i-crazy-or-is-this-quote.jpg"));

    // Compare with synthetic comparison fixtures
    await runCompare(browser, "cmp-3way-brake", [
      path.join(FIX, "comparison-brake-01-shop-a-low.png"),
      path.join(FIX, "comparison-brake-02-shop-b-mid.png"),
      path.join(FIX, "comparison-brake-03-shop-c-high.png"),
    ]);

    // Mobile + landing pages
    await runMobile(browser);
    await runLandingPages(browser);

  } catch (e) {
    console.error("WALK ERROR:", e);
  } finally {
    await browser.close();
  }
  console.log("\nDONE. screenshots in", OUT);
})();
