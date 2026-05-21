// Roofing deep test 2026-05-04 — focused walk targeting prior-dive deferred items.
// Verifies: P3 Heritage warranty extraction in compare, P4 Pinnacle material in compare,
// P5 mascot variant on analyzer result card, contractor surfaced for CTA gate, mobile,
// estimate-path price + copy, print/PDF rendering.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "roof-deep-test-2026-05-04");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = true) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  console.log(`  shot: ${name}`);
}

async function newPage(browser, label, mobile = false) {
  const page = await browser.newPage();
  if (mobile) {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
  } else {
    await page.setViewport({ width: 1280, height: 900 });
  }
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
    if (/error|fail|verdict|undefined/i.test(t) && !/font|sourcemap|favicon/i.test(t)) {
      console.log(`  [${label}]`, m.type(), t.substring(0, 240));
    }
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  page.setDefaultTimeout(120000);
  return page;
}

async function uploadFile(page, fixturePath) {
  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(fixturePath);
}

// ---------- COMPARE PATH ----------
async function walkCompare(browser) {
  console.log("\n=== COMPARE: 3 fixtures (low/mid/high) ===");
  const page = await newPage(browser, "compare");
  await page.goto(BASE + "/compare-roofing-quotes.html", { waitUntil: "networkidle2" });
  await sleep(2000);
  await shot(page, "compare-01-empty");

  const fixtures = [
    "test-quotes/roofing-images/comparison-roof-01-low.png",
    "test-quotes/roofing-images/comparison-roof-02-mid.png",
    "test-quotes/roofing-images/comparison-roof-03-high.png",
  ];
  const fileInputs = await page.$$('input[type="file"]');
  console.log(`  found ${fileInputs.length} file inputs`);
  for (let i = 0; i < Math.min(fixtures.length, fileInputs.length); i++) {
    await fileInputs[i].uploadFile(path.join(ROOT, fixtures[i]));
    await sleep(1500);
  }
  console.log("  waiting 90s for OCR + AI on 3 quotes...");
  await sleep(90000);
  await shot(page, "compare-02-uploaded");

  // Click Compare button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const t = btns.find(b => /compare\s+[23]\s+quotes/i.test((b.textContent || "").trim()));
    if (t) t.click();
  });
  await sleep(8000);
  await shot(page, "compare-03-results");

  // Dump the comparison table cells for warranty/material verification
  const tableDump = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tr, .cmp-table tr, .compare-row, [class*='compare']")).slice(0, 40);
    return rows.map(r => (r.innerText || "").replace(/\s+/g, " ").trim()).filter(t => t && t.length < 400);
  });
  require("fs").writeFileSync(require("path").join(OUT, "compare-table-rows.json"), JSON.stringify(tableDump, null, 2));
  console.log("  table-rows captured:", tableDump.length);

  // Capture the results JSON state
  const stateDump = await page.evaluate(() => {
    return {
      quotesCount: (window.compareQuotes || []).length,
      quotes: (window.compareQuotes || []).map(q => ({
        contractor: q.contractor,
        price: q.price,
        material: q.material || q.brand || null,
        warranty: q.warranty,
        warrantyYears: q.warrantyYears,
        scopeCovered: (q.scopeCovered || []).length,
        scopeMissing: (q.scopeMissing || []).length,
        score: q.score || q.totalScore || null,
        bestValueBadge: q.bestValueBadge || null,
      })),
      bodyTextHead: document.body.innerText.slice(0, 4500),
    };
  });
  fs.writeFileSync(path.join(OUT, "compare-state.json"), JSON.stringify(stateDump, null, 2));
  console.log("  compare-state.json written, quotes:", stateDump.quotesCount);

  await page.close();
}

// ---------- ANALYZE PATH ----------
async function walkAnalyze(browser, fixtureFile, label) {
  console.log(`\n=== ANALYZE: ${label} ===`);
  const page = await newPage(browser, "analyze-" + label);
  await page.goto(BASE + "/roofing-quote-analyzer.html?path=quote", { waitUntil: "networkidle2" });
  await sleep(2500);

  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(ROOT, fixtureFile));
  console.log("  uploaded, waiting 40s for analyze...");
  await sleep(40000);
  await shot(page, "analyze-" + label + "-01-result");

  // Inspect result card mascot + contractor + warranty + material
  const dump = await page.evaluate(() => {
    const a = window.__latestAnalysis || {};
    const mascots = Array.from(document.querySelectorAll("img")).filter(i => /Iris|trudy|woogoro/i.test(i.src || "") || /mascot|laurel|verdict-img/i.test(i.className || "")).map(i => ({ src: i.src, className: i.className, w: i.naturalWidth, h: i.naturalHeight, parent: i.parentElement?.id || i.parentElement?.className?.slice(0, 80) }));
    return {
      latestAnalysis: {
        contractor: a.contractor,
        material: a.material,
        warrantyYears: a.warrantyYears,
        warranty: a.warranty,
        quotePrice: a.quotePrice,
        verdict: a.verdict,
        stateCode: a.stateCode,
        city: a.city,
      },
      mascotImgs: mascots.slice(0, 8),
      bodyTextHead: document.body.innerText.slice(0, 3500),
    };
  });
  fs.writeFileSync(path.join(OUT, "analyze-" + label + ".json"), JSON.stringify(dump, null, 2));
  console.log("  contractor:", dump.latestAnalysis.contractor, "| material:", dump.latestAnalysis.material, "| warrantyYears:", dump.latestAnalysis.warrantyYears);

  // Scroll to capture full result
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(800);
  await shot(page, "analyze-" + label + "-02-bottom");
  await page.close();
  return dump;
}

// ---------- ESTIMATE PATH ----------
async function walkEstimate(browser) {
  console.log("\n=== ESTIMATE: Fort Mill SC, 2200 sqft, architectural, replace ===");
  const page = await newPage(browser, "estimate");
  await page.goto(BASE + "/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "networkidle2" });
  await sleep(2500);
  await shot(page, "estimate-01-form");

  // Fill form via direct evaluate
  await page.evaluate(() => {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    setVal("journeyStreetAddress", "17064 Laurelmont Ct");
    setVal("journeyCity", "Fort Mill");
    setVal("journeyState", "SC");
    setVal("journeyZipCode", "29707");
  });
  await sleep(800);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const t = btns.find(b => /get my estimate|continue|next/i.test((b.textContent || "").trim()));
    if (t) t.click();
  });
  await sleep(3000);
  await shot(page, "estimate-02-after-address");

  // Pick architectural shingles, full replace
  await page.evaluate(() => {
    const click = (group, value) => {
      const btn = document.querySelector(`button.est-option[data-group="${group}"][data-value="${value}"]`);
      if (btn) btn.click();
    };
    click("workType", "replace");
    click("material", "architectural");
    click("steepness", "average");
    click("complexity", "average");
    click("propertyType", "single-family");
    click("insurance", "no");
    const sz = document.getElementById("estHomeSize");
    if (sz) { sz.value = "2200"; sz.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await sleep(800);
  await shot(page, "estimate-03-form-filled");

  await page.evaluate(() => { const b = document.getElementById("estSubmitBtn"); if (b) b.click(); });
  await sleep(7000);
  await shot(page, "estimate-04-result");

  const eDump = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 3500),
  }));
  fs.writeFileSync(path.join(OUT, "estimate-result.txt"), eDump.text);
  await page.close();
}

// ---------- MOBILE ----------
async function walkMobile(browser) {
  console.log("\n=== MOBILE: analyze path on Heritage fixture ===");
  const page = await newPage(browser, "mobile", true);
  await page.goto(BASE + "/roofing-quote-analyzer.html", { waitUntil: "networkidle2" });
  await sleep(2000);
  await shot(page, "mobile-01-analyzer");

  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(ROOT, "test-quotes/roofing-images/comparison-roof-02-mid.png"));
  await sleep(40000);
  await shot(page, "mobile-02-result");
  await page.close();
}

// ---------- PRINT ----------
async function walkPrint(browser) {
  console.log("\n=== PRINT: analyzer result page PDF ===");
  const page = await newPage(browser, "print");
  await page.goto(BASE + "/roofing-quote-analyzer.html", { waitUntil: "networkidle2" });
  await sleep(2000);
  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(ROOT, "test-quotes/roofing-images/comparison-roof-02-mid.png"));
  await sleep(40000);
  await page.emulateMediaType("print");
  await page.pdf({ path: path.join(OUT, "analyze-print.pdf"), format: "Letter" });
  console.log("  analyze-print.pdf written");
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const phase = process.argv[2] || "all";

  try {
    if (phase === "all" || phase === "estimate") await walkEstimate(browser);
    if (phase === "all" || phase === "analyze") {
      await walkAnalyze(browser, "test-quotes/roofing-images/comparison-roof-02-mid.png", "heritage");
      await walkAnalyze(browser, "test/receipt/ocr-cache/fixtures/roofing-gaf-quote.jpeg", "gaf");
    }
    if (phase === "all" || phase === "compare") await walkCompare(browser);
    if (phase === "all" || phase === "mobile") await walkMobile(browser);
    if (phase === "all" || phase === "print") await walkPrint(browser);
  } finally {
    await browser.close();
  }
  console.log("\nDone. Output:", OUT);
})();
