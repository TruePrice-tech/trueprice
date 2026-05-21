// Re-walk 4 verticals: longer OCR wait, better Compare button selector, type into landscape size field.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT_BASE = path.join(ROOT, "output", "4-vertical-walk-2026-04-28-v2");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(OUT_BASE)) fs.mkdirSync(OUT_BASE, { recursive: true });

const VERTICALS = {
  insulation: { analyzer: "insulation-quote-analyzer.html", compare: "compare-insulation-quotes.html",
    fixtureDir: "test-quotes/insulation-images",
    analyzeFixture: "comparison-insul-mid.png",
    compareFixtures: ["comparison-insul-low.png", "comparison-insul-mid.png", "comparison-insul-high.png"] },
  kitchen: { analyzer: "kitchen-quote-analyzer.html", compare: "compare-kitchen-quotes.html",
    fixtureDir: "test-quotes/kitchen-images",
    analyzeFixture: "comparison-kitchen-mid.png",
    compareFixtures: ["comparison-kitchen-low.png", "comparison-kitchen-mid.png", "comparison-kitchen-high.png"] },
  landscaping: { analyzer: "landscaping-quote-analyzer.html", compare: "compare-landscaping-quotes.html",
    fixtureDir: "test-quotes/landscaping-test-images", compareDir: "test-quotes/landscaping-images",
    analyzeFixture: "09-is-this-quote-to-re-do-the-landscape-lighting-arou.png",
    compareFixtures: ["comparison-land-low.png", "comparison-land-mid.png", "comparison-land-high.png"],
    estimate: "landscaping-estimate.html",  // need re-do with size input
  },
  garage: { analyzer: "garage-door-quote-analyzer.html", compare: "compare-garage-door-quotes.html",
    fixtureDir: "test-quotes/garage-door-images",
    analyzeFixture: "real-02-is-this-a-good-deal.jpeg",
    compareFixtures: ["comparison-garage-low.png", "comparison-garage-mid.png", "comparison-garage-high.png"] },
};

async function shot(page, dir, n) { await page.screenshot({ path: path.join(dir, `${n}.png`), fullPage: true }); console.log(`    shot: ${n}`); }
async function dump(page, dir, n) {
  const s = await page.evaluate(() => {
    const heads = Array.from(document.querySelectorAll("h1,h2,h3")).map(h => h.textContent.trim()).filter(Boolean).slice(0, 24);
    const body = (document.body.innerText || "").substring(0, 7000);
    return { heads, body };
  });
  fs.writeFileSync(path.join(dir, `${n}.txt`), `=== HEADINGS ===\n${s.heads.join("\n")}\n\n=== BODY ===\n${s.body}`);
  console.log(`    dump: ${n}.txt`);
}

async function newPage(browser, label, errSink) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    else req.continue();
  });
  page.on("response", async (r) => { if (r.status() >= 400) errSink.push(`${label} HTTP ${r.status()} ${r.url().substring(0, 140)}`); });
  page.on("console", (m) => { if (m.type() === "error") errSink.push(`${label} ce: ${m.text().substring(0, 200)}`); });
  page.on("pageerror", (e) => errSink.push(`${label} pe: ${e.message}`));
  return page;
}

async function waitParseProgress(page, expectedCount, maxMs) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const ok = await page.evaluate((c) => {
      const t = document.body.innerText || "";
      // success indicators across compare pages
      if (/all\s+(quotes|files)\s+ready|ready to compare/i.test(t)) return true;
      // progress indicator like "X of Y ready" or "Ready - $X"
      const m = t.match(/(\d+)\s+of\s+(\d+)\s+ready/i);
      if (m && parseInt(m[1]) >= c) return true;
      // analyzer "Reading text" gone + we see Verdict / Project Details
      if (/(WOOGORO\s+\w+\s+VERDICT|Project Details|Quote Analysis|Yes,\s*analyze)/i.test(t) && !/Reading text|Analyzing your/i.test(t)) return true;
      return false;
    }, expectedCount);
    if (ok) return true;
    await sleep(2000);
  }
  return false;
}

async function reAnalyze(browser, key, cfg) {
  console.log(`\n--- ANALYZE-RERUN ${key} ---`);
  const dir = path.join(OUT_BASE, key); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const errSink = [];
  const page = await newPage(browser, `${key}-an`, errSink);
  await page.goto(`${BASE}/${cfg.analyzer}`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  const fp = path.join(ROOT, cfg.fixtureDir, cfg.analyzeFixture);
  const fileInput = await page.$('input[type=file]');
  await fileInput.uploadFile(fp);
  console.log(`    uploaded: ${cfg.analyzeFixture}`);
  // Wait up to 90s for analyzer to finish reading
  const ok1 = await waitParseProgress(page, 1, 100000);
  console.log(`    parse-progress reached: ${ok1}`);
  await shot(page, dir, "an-rerun-01-parsed");
  // Click "Yes, analyze this price" if shown
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("button, a"));
    const yes = all.find(b => /yes,?\s*analyze|analyze\s*this\s*price|continue\s*anyway/i.test(b.textContent || ""));
    if (yes) yes.click();
  });
  await sleep(8000);
  await shot(page, dir, "an-rerun-02-after-yes");
  await dump(page, dir, "an-rerun-02-after-yes");
  fs.writeFileSync(path.join(dir, "an-rerun-_errors.txt"), errSink.join("\n"));
  await page.close();
}

async function reCompare(browser, key, cfg) {
  console.log(`\n--- COMPARE-RERUN ${key} ---`);
  const dir = path.join(OUT_BASE, key); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const errSink = [];
  const page = await newPage(browser, `${key}-cmp`, errSink);
  await page.goto(`${BASE}/${cfg.compare}`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  const cmpDir = cfg.compareDir || cfg.fixtureDir;
  const inputs = await page.$$('input[type=file]');
  console.log(`    inputs: ${inputs.length}`);
  for (let i = 0; i < 3; i++) {
    const fp = path.join(ROOT, cmpDir, cfg.compareFixtures[i]);
    const inp = inputs[Math.min(i, inputs.length - 1)];
    await inp.uploadFile(fp);
    console.log(`    slot${i}: ${cfg.compareFixtures[i]}`);
    await sleep(2500);
  }
  // Wait for all 3 to finish parsing - up to 150s
  const ok = await waitParseProgress(page, 3, 150000);
  console.log(`    parse done: ${ok}`);
  await shot(page, dir, "cmp-rerun-01-parsed");
  // Click the actual Compare submit button (NOT the nav link). Heuristic: button.tp-compare-submit, .btn-compare, btnCompareGo, button containing "Compare My Quotes" or "Compare Quotes" but NOT a nav <a>.
  await page.evaluate(() => {
    // priority list of selectors
    const ids = ["btnCompareGo", "tpCompareSubmit", "btnCompare", "btnCompareQuotes"];
    for (const id of ids) { const e = document.getElementById(id); if (e) { e.click(); return; } }
    // class-based
    const cls = document.querySelector("button.tp-compare-submit, button.btn-compare, button.compare-submit");
    if (cls) { cls.click(); return; }
    // Fallback: button (not anchor) with text "Compare ..." that's NOT in nav
    const btns = Array.from(document.querySelectorAll("button"));
    const cand = btns.find(b => /compare\s+(my|these|all|now|quotes)/i.test(b.textContent || "") && !b.closest("nav") && !b.closest("header") && !b.disabled);
    if (cand) { cand.click(); return; }
  });
  await sleep(20000);
  await shot(page, dir, "cmp-rerun-02-results");
  await dump(page, dir, "cmp-rerun-02-results");
  // Mobile too
  await page.setViewport({ width: 390, height: 844 });
  await sleep(800);
  await shot(page, dir, "cmp-rerun-03-results-mobile");
  fs.writeFileSync(path.join(dir, "cmp-rerun-_errors.txt"), errSink.join("\n"));
  await page.close();
}

async function reLandscapeEstimate(browser) {
  console.log(`\n--- LANDSCAPING ESTIMATE RERUN (with size input) ---`);
  const dir = path.join(OUT_BASE, "landscaping"); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const errSink = [];
  const page = await newPage(browser, "land-est", errSink);
  await page.goto(`${BASE}/landscaping-estimate.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  // set address
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set("addrStreet", "17064 Laurelmont Ct"); set("addrCity", "Fort Mill"); set("addrState", "SC"); set("addrZip", "29707");
  });
  // Click Begin (whatever it's called)
  await page.evaluate(() => {
    for (const id of ["btnEstimate", "btnStart", "btnBegin"]) { const e = document.getElementById(id); if (e) { e.click(); return; } }
  });
  await sleep(2500);
  await shot(page, dir, "est-rerun-01-step1");
  // Step 1: pick a project type
  await page.evaluate(() => {
    const o = document.querySelector('[data-val="paver_patio"], [data-val="sod_installation"], [data-val="full_makeover"], [data-val]');
    if (o) o.click();
  });
  await sleep(1200);
  // Click any visible Continue
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find(b => /next|continue/i.test(b.textContent || "") && !b.disabled && b.offsetParent !== null);
    if (b) b.click();
  });
  await sleep(2000);
  // Step 2: type into size input
  await page.evaluate(() => {
    const el = document.querySelector('input[type="number"]:not([disabled])') || document.getElementById("sizeInput") || document.getElementById("areaInput");
    if (el) { el.focus(); el.value = "500"; el.dispatchEvent(new Event("input", {bubbles: true})); el.dispatchEvent(new Event("change", {bubbles: true})); }
  });
  await sleep(800);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find(b => /next|continue|see\s*estimate|get\s*estimate/i.test(b.textContent || "") && !b.disabled && b.offsetParent !== null);
    if (b) b.click();
  });
  await sleep(2500);
  await shot(page, dir, "est-rerun-02-after-size");
  // Continue clicking through any remaining steps
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const o = document.querySelector('[data-val]:not([data-picked]):not([style*="display: none"])');
      if (o) o.click();
      const card = document.querySelector(".wg-hometype-card");
      if (card) card.click();
    });
    await sleep(700);
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find(b => /next|continue|see\s*estimate|get\s*estimate|calculate/i.test(b.textContent || "") && !b.disabled && b.offsetParent !== null);
      if (b) b.click();
    });
    await sleep(2200);
  }
  await sleep(3000);
  await shot(page, dir, "est-rerun-03-result");
  await dump(page, dir, "est-rerun-03-result");
  fs.writeFileSync(path.join(dir, "est-rerun-_errors.txt"), errSink.join("\n"));
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // Re-walk landscape estimate first
  try { await reLandscapeEstimate(browser); } catch(e) { console.log("land-est rerun err:", e.message); }

  // Re-analyze (landscape + garage primarily; insulation+kitchen reached result first time but verdicts were buggy so re-confirm)
  for (const key of ["landscaping", "garage", "insulation", "kitchen"]) {
    try { await reAnalyze(browser, key, VERTICALS[key]); } catch(e) { console.log(`${key} an err:`, e.message); }
  }

  // Re-compare all 4
  for (const key of ["insulation", "kitchen", "landscaping", "garage"]) {
    try { await reCompare(browser, key, VERTICALS[key]); } catch(e) { console.log(`${key} cmp err:`, e.message); }
  }

  await browser.close();
  console.log("\nDONE -> ", OUT_BASE);
})();
