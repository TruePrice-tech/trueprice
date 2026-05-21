// 4-vertical human-walk: insulation / kitchen / landscaping / garage-door.
// Each vertical: estimate (1 happy path) -> analyze (1 fixture) -> compare (3 fixtures).
// Captures full-page screenshots + result-body text + console errors.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT_BASE = path.join(ROOT, "output", "4-vertical-walk-2026-04-28");
const BASE = process.env.BASE || "https://woogoro.com";
const ONLY = process.env.ONLY || ""; // run only one vertical
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT_BASE)) fs.mkdirSync(OUT_BASE, { recursive: true });

const VERTICALS = {
  insulation: {
    estimate: "insulation-estimate.html",
    analyzer: "insulation-quote-analyzer.html",
    compare: "compare-insulation-quotes.html",
    fixtureDir: "test-quotes/insulation-images",
    analyzeFixture: "comparison-insul-mid.png",  // BPI cellulose R-49 $3,025
    compareFixtures: ["comparison-insul-low.png", "comparison-insul-mid.png", "comparison-insul-high.png"],
    expected: { analyze: "$3,025 BPI cellulose R-49 + air seal + baffles + 10yr", compare: "$1,730 / $3,025 / $5,680" },
  },
  kitchen: {
    estimate: "kitchen-estimate.html",
    analyzer: "kitchen-quote-analyzer.html",
    compare: "compare-kitchen-quotes.html",
    fixtureDir: "test-quotes/kitchen-images",
    analyzeFixture: "comparison-kitchen-mid.png",  // Prairie State $27,250 mid 200sqft
    compareFixtures: ["comparison-kitchen-low.png", "comparison-kitchen-mid.png", "comparison-kitchen-high.png"],
    expected: { analyze: "$27,250 mid-grade 200sf shaker + quartz + appliances", compare: "$13,850 / $27,250 / $57,200" },
  },
  landscaping: {
    estimate: "landscaping-estimate.html",
    analyzer: "landscaping-quote-analyzer.html",
    compare: "compare-landscaping-quotes.html",
    fixtureDir: "test-quotes/landscaping-test-images",
    analyzeFixture: "09-is-this-quote-to-re-do-the-landscape-lighting-arou.png", // $9,275.93 LIGHTING
    compareDir: "test-quotes/landscaping-images",
    compareFixtures: ["comparison-land-low.png", "comparison-land-mid.png", "comparison-land-high.png"],
    expected: { analyze: "$9,275.93 LANDSCAPE LIGHTING (12 bollards + 13 spots + timer)", compare: "synthetic land low/mid/high" },
  },
  garage: {
    estimate: "garage-door-estimate.html",
    analyzer: "garage-door-quote-analyzer.html",
    compare: "compare-garage-door-quotes.html",
    fixtureDir: "test-quotes/garage-door-images",
    analyzeFixture: "real-02-is-this-a-good-deal.jpeg", // Hormann + LiftMaster ~$3,431
    compareFixtures: ["comparison-garage-low.png", "comparison-garage-mid.png", "comparison-garage-high.png"],
    expected: { analyze: "$3,240 subtotal Hormann 16x7 + LiftMaster 84505 + remote + keypad", compare: "synth garage low/mid/high" },
  },
};

async function shot(page, dir, name, full = true) {
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: full });
  console.log(`    shot: ${name}`);
}

function logBody(page, label, dir, name) {
  return page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3")).map(h => h.textContent.trim()).filter(Boolean).slice(0, 18);
    const buttons = Array.from(document.querySelectorAll("button:not([disabled]), a.btn, a[role=button]")).map(b => b.textContent.trim().substring(0, 80)).filter(Boolean).slice(0, 24);
    const body = (document.body.innerText || "").substring(0, 5500);
    return { headings, buttons, body };
  }).then(snap => {
    fs.writeFileSync(path.join(dir, `${name}.txt`), `=== HEADINGS ===\n${snap.headings.join("\n")}\n\n=== BUTTONS ===\n${snap.buttons.join("\n")}\n\n=== BODY (5.5k) ===\n${snap.body}`);
    console.log(`    body: ${name}.txt (${snap.body.length} chars)`);
    return snap;
  });
}

async function newPage(browser, label, errSink) {
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
  page.on("response", async (r) => {
    const s = r.status();
    if (s >= 400) errSink.push(`${label} HTTP ${s} ${r.url().substring(0, 120)}`);
  });
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" || /TP_Engine.*fail|verdict|stuck|undefined is not/i.test(t)) errSink.push(`${label} console ${m.type()}: ${t.substring(0, 240)}`);
  });
  page.on("pageerror", (e) => errSink.push(`${label} pageerror: ${e.message}`));
  return page;
}

async function walkEstimate(browser, key, cfg, outDir, errSink) {
  console.log(`  --- ESTIMATE ${key} ---`);
  const page = await newPage(browser, `${key}-est`, errSink);
  await page.goto(`${BASE}/${cfg.estimate}`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  await shot(page, outDir, `est-01-landing`);
  await logBody(page, `${key}-est-landing`, outDir, `est-01-landing`);

  // Set address
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set("addrStreet", "17064 Laurelmont Ct");
    set("addrCity", "Fort Mill");
    set("addrState", "SC");
    set("addrZip", "29707");
  });

  // Hit a "begin" button if present
  const startBtns = ["btnEstimate", "btnStart", "btnBegin", "tpStartEstimate"];
  await page.evaluate((ids) => {
    for (const id of ids) { const el = document.getElementById(id); if (el) { el.click(); return; } }
  }, startBtns);
  await sleep(2500);
  await shot(page, outDir, `est-02-after-start`);

  // Try clicking through up to 6 stepper steps with first available choice
  for (let step = 1; step <= 6; step++) {
    await page.evaluate(() => {
      // Click first .opt-card / [data-val] / radio in current visible step
      const visible = document.querySelectorAll('[data-val]:not([style*="display: none"]), .opt-card:not([style*="display: none"]), label.opt');
      if (visible.length) visible[0].click();
    });
    await sleep(800);
    // Pick first home-type card if shown
    await page.evaluate(() => {
      const card = document.querySelector(".wg-hometype-card");
      if (card) card.click();
    });
    await sleep(400);
    // Click any visible Continue/Next button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const next = btns.find(b => /next|continue|see\s*estimate|get\s*estimate|calculate/i.test(b.textContent) && !b.disabled && b.offsetParent !== null);
      if (next) next.click();
    });
    await sleep(2000);
  }
  await sleep(3000);
  await shot(page, outDir, `est-03-result`);
  await logBody(page, `${key}-est-result`, outDir, `est-03-result`);

  // Mobile screenshot
  await page.setViewport({ width: 390, height: 844 });
  await sleep(500);
  await shot(page, outDir, `est-04-result-mobile`);

  await page.close();
}

async function walkAnalyze(browser, key, cfg, outDir, errSink) {
  console.log(`  --- ANALYZE ${key} (${cfg.analyzeFixture}) ---`);
  const page = await newPage(browser, `${key}-an`, errSink);
  await page.goto(`${BASE}/${cfg.analyzer}`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  await shot(page, outDir, `an-01-landing`);
  await logBody(page, `${key}-an-landing`, outDir, `an-01-landing`);

  const fp = path.join(ROOT, cfg.fixtureDir, cfg.analyzeFixture);
  if (!fs.existsSync(fp)) { console.log(`    !! fixture missing: ${fp}`); await page.close(); return; }

  const fileInput = await page.$('input[type=file]');
  if (!fileInput) { console.log(`    !! no file input`); await page.close(); return; }
  await fileInput.uploadFile(fp);
  console.log(`    uploaded: ${cfg.analyzeFixture}`);
  await sleep(35000);  // OCR + analyze
  await shot(page, outDir, `an-02-after-upload`);

  // Click "Yes" on price confirmation if present
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    const yes = btns.find(b => /yes,?\s*analyze|continue|yes\s*proceed|analyze\s*this\s*price/i.test(b.textContent));
    if (yes) yes.click();
  });
  await sleep(8000);
  await shot(page, outDir, `an-03-result`);
  await logBody(page, `${key}-an-result`, outDir, `an-03-result`);

  // Mobile screenshot
  await page.setViewport({ width: 390, height: 844 });
  await sleep(800);
  await shot(page, outDir, `an-04-result-mobile`);

  await page.close();
}

async function walkCompare(browser, key, cfg, outDir, errSink) {
  console.log(`  --- COMPARE ${key} ---`);
  const page = await newPage(browser, `${key}-cmp`, errSink);
  await page.goto(`${BASE}/${cfg.compare}`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2000);
  await shot(page, outDir, `cmp-01-landing`);
  await logBody(page, `${key}-cmp-landing`, outDir, `cmp-01-landing`);

  const cmpDir = cfg.compareDir || cfg.fixtureDir;
  const fps = cfg.compareFixtures.map(n => path.join(ROOT, cmpDir, n));
  for (const fp of fps) if (!fs.existsSync(fp)) console.log(`    !! missing: ${fp}`);

  const inputs = await page.$$('input[type=file]');
  console.log(`    inputs: ${inputs.length}`);
  if (inputs.length >= 3) {
    for (let i = 0; i < 3; i++) {
      await inputs[i].uploadFile(fps[i]);
      console.log(`    slot${i}: ${cfg.compareFixtures[i]}`);
      await sleep(2000);
    }
  } else if (inputs.length >= 1) {
    for (let i = 0; i < 3; i++) {
      await inputs[0].uploadFile(fps[i]);
      console.log(`    upload-loop ${i}: ${cfg.compareFixtures[i]}`);
      await sleep(3500);
    }
  }
  await sleep(40000);  // Wait for OCR x3
  await shot(page, outDir, `cmp-02-after-uploads`);

  // Click Compare button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    const cmp = btns.find(b => /compare\s+(my|these|quotes)|see\s+results|view\s+comparison/i.test(b.textContent) && !b.disabled);
    if (cmp) cmp.click();
  });
  await sleep(15000);
  await shot(page, outDir, `cmp-03-results`);
  await logBody(page, `${key}-cmp-result`, outDir, `cmp-03-results`);

  // Mobile screenshot
  await page.setViewport({ width: 390, height: 844 });
  await sleep(800);
  await shot(page, outDir, `cmp-04-result-mobile`);

  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const errors = {};
  const verticalsToRun = ONLY ? [ONLY] : Object.keys(VERTICALS);

  for (const key of verticalsToRun) {
    const cfg = VERTICALS[key];
    if (!cfg) { console.log(`UNKNOWN vertical: ${key}`); continue; }
    const outDir = path.join(OUT_BASE, key);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const errSink = errors[key] = [];
    console.log(`\n========== ${key.toUpperCase()} ==========`);
    try { await walkEstimate(browser, key, cfg, outDir, errSink); } catch (e) { console.log(`  !! estimate threw: ${e.message}`); errSink.push(`estimate threw: ${e.message}`); }
    try { await walkAnalyze(browser, key, cfg, outDir, errSink); } catch (e) { console.log(`  !! analyze threw: ${e.message}`); errSink.push(`analyze threw: ${e.message}`); }
    try { await walkCompare(browser, key, cfg, outDir, errSink); } catch (e) { console.log(`  !! compare threw: ${e.message}`); errSink.push(`compare threw: ${e.message}`); }
    fs.writeFileSync(path.join(outDir, "_errors.txt"), errSink.join("\n"));
    console.log(`  errors captured: ${errSink.length}`);
  }
  await browser.close();
  console.log("\nDONE -> ", OUT_BASE);
})();
