// Human-walk: windows + siding + painting + concrete, all 3 paths each.
// Lane address: 17064 Laurelmont Ct, Fort Mill SC 29707.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "human-walk-4v-2026-04-28");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  const fp = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function newPage(browser, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else {
      req.continue();
    }
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|verdict|TP_Engine|400|500|undefined/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function dumpText(page, name, sel = "main") {
  const txt = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? (el.innerText || "").slice(0, 5000) : "(no main)";
  }, sel);
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

async function fillAddress(page) {
  await page.waitForSelector("#addrStreet", { timeout: 15000 });
  await page.evaluate(() => {
    document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
    document.getElementById("addrCity").value = "Fort Mill";
    document.getElementById("addrState").value = "SC";
    document.getElementById("addrZip").value = "29707";
  });
}

async function pickByDataVal(page, container, val) {
  await page.evaluate((c, v) => {
    const o = document.querySelector(`#${c} [data-val="${v}"]`);
    if (o) o.click();
  }, container, val);
}

async function uploadFile(page, fixturePath) {
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) throw new Error("no file input");
  await fileInput.uploadFile(fixturePath);
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── WINDOWS ESTIMATE ─────────────────────────────────────────────
  try {
    const page = await newPage(browser, "win-est");
    console.log("\n=== WINDOWS ESTIMATE: Lane, 9 windows, vinyl mid-tier double-hung double-lowe pocket ===");
    await page.goto(`${BASE}/window-estimate.html`, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(1500);
    await shot(page, "01-win-est-landing");
    await fillAddress(page);
    await sleep(300);
    await page.click("#btnEstimate");
    await sleep(1200);
    await shot(page, "02-win-est-step1-count");
    await pickByDataVal(page, "optCount", "9-15");
    await sleep(700);
    await pickByDataVal(page, "optMaterial", "vinyl");
    await sleep(700);
    await shot(page, "03-win-est-step3-brand");
    // Brand tier (mid)
    await page.evaluate(() => { const o = document.querySelector('#optBrandTier [data-val="mid"]'); if (o) o.click(); });
    await sleep(700);
    await pickByDataVal(page, "optStyle", "double-hung");
    await sleep(700);
    await pickByDataVal(page, "optGlass", "double-lowe");
    await sleep(700);
    await pickByDataVal(page, "optInstall", "pocket");
    await sleep(2500);
    await shot(page, "04-win-est-result-top");
    await shot(page, "05-win-est-result-full", true);
    await dumpText(page, "05-win-est-result");
    await page.close();
  } catch (e) { console.log("  WINDOWS EST FAIL:", e.message); }

  // ─── SIDING ESTIMATE ──────────────────────────────────────────────
  try {
    const page = await newPage(browser, "sid-est");
    console.log("\n=== SIDING ESTIMATE: Lane, fiber cement, 1800 sqft wall, 2 story, fair condition ===");
    await page.goto(`${BASE}/siding-estimate.html`, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(1500);
    await shot(page, "10-sid-est-landing");
    await fillAddress(page);
    await sleep(300);
    await page.click("#btnEstimate");
    await sleep(1500);
    await shot(page, "11-sid-est-step1-material");
    await pickByDataVal(page, "optSiding", "fiber_cement");
    await sleep(800);
    await shot(page, "12-sid-est-step2-sqft");
    // Set wall sqft via direct value + click continue
    await page.evaluate(() => {
      const inp = document.getElementById("sqftInput");
      if (inp) { inp.value = "1800"; inp.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await sleep(400);
    await page.click("#sqftNext");
    await sleep(800);
    await pickByDataVal(page, "optStories", "2");
    await sleep(800);
    await pickByDataVal(page, "optCondition", "fair");
    await sleep(2500);
    await shot(page, "13-sid-est-result-top");
    await shot(page, "14-sid-est-result-full", true);
    await dumpText(page, "14-sid-est-result");
    await page.close();
  } catch (e) { console.log("  SIDING EST FAIL:", e.message); }

  // ─── PAINTING ESTIMATE ────────────────────────────────────────────
  try {
    const page = await newPage(browser, "paint-est");
    console.log("\n=== PAINTING ESTIMATE: Lane, exterior, ~2400 sqft, 2 coats, mid tier, fair ===");
    await page.goto(`${BASE}/painting-estimate.html`, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(1500);
    await shot(page, "20-paint-est-landing");
    await fillAddress(page);
    await sleep(300);
    await page.click("#btnEstimate");
    await sleep(1500);
    await shot(page, "21-paint-est-step1-project");
    await pickByDataVal(page, "optProject", "exterior");
    await sleep(2200);  // wait for OSM/home-type
    await shot(page, "22-paint-est-step2-home");
    // Click Looks right - Continue (uses prefilled OSM home type)
    await page.evaluate(() => {
      const btn = document.getElementById("sqftContinue");
      if (btn) btn.click();
    });
    await sleep(1000);
    await shot(page, "23-paint-est-step3-coats");
    await pickByDataVal(page, "optQuality", "premium");  // 2 coats
    await sleep(800);
    await shot(page, "24-paint-est-step4-tier");
    await page.evaluate(() => { const o = document.querySelector('#optBrandTier [data-val="mid"]'); if (o) o.click(); });
    await sleep(800);
    await pickByDataVal(page, "optCondition", "fair");
    await sleep(2500);
    await shot(page, "25-paint-est-result-top");
    await shot(page, "26-paint-est-result-full", true);
    await dumpText(page, "26-paint-est-result");
    await page.close();
  } catch (e) { console.log("  PAINTING EST FAIL:", e.message); }

  // ─── CONCRETE ESTIMATE ────────────────────────────────────────────
  try {
    const page = await newPage(browser, "conc-est");
    console.log("\n=== CONCRETE ESTIMATE: Lane, 800 sq ft patio, 4\" thick, no demo ===");
    await page.goto(`${BASE}/concrete-estimate.html`, { waitUntil: "networkidle2", timeout: 45000 });
    await sleep(1500);
    await shot(page, "30-conc-est-landing");
    await fillAddress(page);
    await sleep(300);
    await page.click("#btnEstimate");
    await sleep(1200);
    await shot(page, "31-conc-est-step1-project");
    await pickByDataVal(page, "optProject", "concrete_patio");
    await sleep(800);
    await pickByDataVal(page, "optSize", "800");
    await sleep(800);
    await pickByDataVal(page, "optThick", "4");
    await sleep(800);
    await pickByDataVal(page, "optDemo", "no");
    await sleep(2500);
    await shot(page, "32-conc-est-result-top");
    await shot(page, "33-conc-est-result-full", true);
    await dumpText(page, "33-conc-est-result");
    await page.close();
  } catch (e) { console.log("  CONCRETE EST FAIL:", e.message); }

  // ─── ANALYZE WALKS ────────────────────────────────────────────────
  const analyzeJobs = [
    { v: "win", url: "window-quote-analyzer.html", fixture: "test-quotes/windows-images/real/reddit-img-1-fair-quote.jpg", label: "EcoView 18 windows ~$10067" },
    { v: "paint", url: "painting-quote-analyzer.html", fixture: "test-quotes/painting-test-images/07-is-this-a-fair-price-from-professional-point-of-vi.jpeg", label: "Cabinet paint $2820" },
    { v: "conc", url: "concrete-quote-analyzer.html", fixture: "test-quotes/concrete-test-images/02-quote-to-widen-driveway-pour-cement-pad-for-shed-p.png", label: "Driveway widen multi-pour $12636" },
    { v: "conc2", url: "concrete-quote-analyzer.html", fixture: "test-quotes/concrete-test-images/04-is-this-a-fair-quote-for-stamped-patio.jpeg", label: "Stamped patio $11900" },
    { v: "sid", url: "siding-quote-analyzer.html", fixture: "test-quotes/siding-images/comparison-siding-mid.png", label: "[synthetic mid] siding (no real fixture)" },
  ];

  for (const j of analyzeJobs) {
    try {
      const page = await newPage(browser, `${j.v}-anly`);
      console.log(`\n=== ANALYZE [${j.v}]: ${j.label} ===`);
      await page.goto(`${BASE}/${j.url}`, { waitUntil: "networkidle2", timeout: 45000 });
      await sleep(1500);
      await shot(page, `40-${j.v}-anly-landing`);
      const fixture = path.join(ROOT, j.fixture);
      if (!fs.existsSync(fixture)) { console.log(`  MISSING FIXTURE: ${fixture}`); await page.close(); continue; }
      await uploadFile(page, fixture);
      console.log(`  uploaded: ${path.basename(fixture)}`);
      await sleep(35000); // wait for OCR + parse
      await shot(page, `41-${j.v}-anly-result-top`);
      await shot(page, `42-${j.v}-anly-result-full`, true);
      await dumpText(page, `42-${j.v}-anly-result`);
      await page.close();
    } catch (e) { console.log(`  ANALYZE [${j.v}] FAIL:`, e.message); }
  }

  // ─── COMPARE WALKS (3-quote sets, synthetic comparison fixtures) ──
  const compareJobs = [
    { v: "win", url: "compare-windows-quotes.html", dir: "test-quotes/windows-images", lo: "comparison-windows-low.png", mid: "comparison-windows-mid.png", hi: "comparison-windows-high.png" },
    { v: "sid", url: "compare-siding-quotes.html", dir: "test-quotes/siding-images", lo: "comparison-siding-low.png", mid: "comparison-siding-mid.png", hi: "comparison-siding-high.png" },
    { v: "paint", url: "compare-painting-quotes.html", dir: "test-quotes/painting-images", lo: "comparison-paint-low.png", mid: "comparison-paint-mid.png", hi: "comparison-paint-high.png" },
    { v: "conc", url: "compare-concrete-quotes.html", dir: "test-quotes/concrete-images", lo: "comparison-conc-low.png", mid: "comparison-conc-mid.png", hi: "comparison-conc-high.png" },
  ];

  for (const j of compareJobs) {
    try {
      const page = await newPage(browser, `${j.v}-cmp`);
      console.log(`\n=== COMPARE [${j.v}]: 3 synthetic quotes lo/mid/hi ===`);
      await page.goto(`${BASE}/${j.url}`, { waitUntil: "networkidle2", timeout: 45000 });
      await sleep(1500);
      await shot(page, `60-${j.v}-cmp-landing`);
      // Most compare pages use multi-file <input type="file" multiple>
      const fileInput = await page.$('input[type="file"]');
      if (!fileInput) { console.log("  no file input"); await page.close(); continue; }
      const f1 = path.join(ROOT, j.dir, j.lo);
      const f2 = path.join(ROOT, j.dir, j.mid);
      const f3 = path.join(ROOT, j.dir, j.hi);
      const missing = [f1, f2, f3].filter(f => !fs.existsSync(f));
      if (missing.length) { console.log("  MISSING:", missing); await page.close(); continue; }
      await fileInput.uploadFile(f1, f2, f3);
      console.log(`  uploaded 3 fixtures`);
      await sleep(60000); // OCR + parse 3 docs
      await shot(page, `61-${j.v}-cmp-after-upload`);
      await shot(page, `62-${j.v}-cmp-result-full`, true);
      await dumpText(page, `62-${j.v}-cmp-result`);
      await page.close();
    } catch (e) { console.log(`  COMPARE [${j.v}] FAIL:`, e.message); }
  }

  await browser.close();
  console.log(`\n=== DONE. Output in ${OUT} ===`);
})();
