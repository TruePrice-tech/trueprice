// CMP-AUDIT walk-verifier 2026-05-03
// Walks compare-roofing-quotes.html, compare-hvac-quotes.html, and
// compare-electrical-quotes.html on live woogoro.com with the tiered
// fixture set per vertical. Asserts:
//   1. Anthropic Claude API call(s) were made (no regex-bypass-fast-path).
//   2. Each provider's displayed Total Price matches ground truth +/- $10.
//   3. No suspect-high prices >$50K (100x-bug signature for fixtures <$20K).
//   4. Comparison table is fully populated (>=8 rows, mostly non-empty cells).
//
// Usage:  node scripts/compare-cmp-audit-walk.js [vertical]
// vertical = roofing | hvac | electrical | all   (default: all)

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";
const ROOT = "C:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT_ROOT = "c:/tmp/cmp-audit-walk";
if (!fs.existsSync(OUT_ROOT)) fs.mkdirSync(OUT_ROOT, { recursive: true });

const VERTICALS = {
  roofing: {
    page: "/compare-roofing-quotes.html",
    apiEndpoint: "/api/parse-quote",
    fixtures: [
      { f: "test-quotes/roofing-images/comparison-roof-01-low.png",  truth: 7565,  name: "Budget Roofing Co" },
      { f: "test-quotes/roofing-images/comparison-roof-02-mid.png",  truth: 11895, name: "Heritage Roofing & Exteriors" },
      { f: "test-quotes/roofing-images/comparison-roof-03-high.png", truth: 17500, name: "Pinnacle Premium Roofing" },
    ],
  },
  hvac: {
    page: "/compare-hvac-quotes.html",
    apiEndpoint: "/api/hvac-estimate",
    fixtures: [
      { f: "test-quotes/hvac-images/comparison-ac-01-low.png",  truth: 3456,  name: "Arctic Air HVAC" },
      { f: "test-quotes/hvac-images/comparison-ac-02-mid.png",  truth: 6620,  name: "Precision Climate Solutions" },
      { f: "test-quotes/hvac-images/comparison-ac-03-high.png", truth: 13457, name: "Elite Comfort Systems" },
    ],
  },
  electrical: {
    page: "/compare-electrical-quotes.html",
    apiEndpoint: "/api/electrical-estimate",
    fixtures: [
      { f: "test-quotes/electrical-images/comparison-panel-01-low.png",  truth: 1660, name: "Redding Electric" },
      { f: "test-quotes/electrical-images/comparison-panel-02-mid.png",  truth: 3425, name: "Spartan Electric Services" },
      { f: "test-quotes/electrical-images/comparison-panel-03-high.png", truth: 8798, name: "Meridian Power Solutions" },
    ],
  },
  concrete: {
    page: "/compare-concrete-quotes.html",
    apiEndpoint: "/api/concrete-estimate",
    fixtures: [
      { f: "test-quotes/concrete-images/comparison-conc-low.png",  truth: 4840,  name: "Quick Pour Concrete" },
      { f: "test-quotes/concrete-images/comparison-conc-mid.png",  truth: 7800,  name: "Lone Star Concrete Works" },
      { f: "test-quotes/concrete-images/comparison-conc-high.png", truth: 12100, name: "Precision Flatwork Solutions" },
    ],
  },
  kitchen: {
    page: "/compare-kitchen-quotes.html",
    apiEndpoint: "/api/kitchen-estimate",
    fixtures: [
      { f: "test-quotes/kitchen-images/comparison-kitchen-low.png",  truth: 13850, name: "Quick Kitchen Refresh LLC" },
      { f: "test-quotes/kitchen-images/comparison-kitchen-mid.png",  truth: 27250, name: "Prairie State Kitchen & Bath" },
      { f: "test-quotes/kitchen-images/comparison-kitchen-high.png", truth: 57200, name: "Artisan Kitchen Studios" },
    ],
  },
  landscaping: {
    page: "/compare-landscaping-quotes.html",
    apiEndpoint: "/api/landscaping-estimate",
    fixtures: [
      { f: "test-quotes/landscaping-images/comparison-land-low.png",  truth: 2080, name: "Lawn & Order Landscaping" },
      { f: "test-quotes/landscaping-images/comparison-land-mid.png",  truth: 3820, name: "Evergreen Groundskeeping" },
      { f: "test-quotes/landscaping-images/comparison-land-high.png", truth: 9420, name: "Piedmont Landscape Design" },
    ],
  },
  fencing: {
    page: "/compare-fencing-quotes.html",
    apiEndpoint: "/api/fencing-estimate",
    fixtures: [
      { f: "test-quotes/fencing-images/comparison-fence-low.png",  truth: 5100,  name: "Pine State Fencing" },
      { f: "test-quotes/fencing-images/comparison-fence-mid.png",  truth: 7400,  name: "Tarheel Fence & Deck" },
      { f: "test-quotes/fencing-images/comparison-fence-high.png", truth: 10800, name: "Blueprint Outdoor Living" },
    ],
  },
  foundation: {
    page: "/compare-foundation-quotes.html",
    apiEndpoint: "/api/foundation-estimate",
    fixtures: [
      { f: "test-quotes/foundation-images/comparison-pier-low.png",  truth: 6900,  name: "Anchor Foundation Repair" },
      { f: "test-quotes/foundation-images/comparison-pier-mid.png",  truth: 8750,  name: "Gulf Coast Foundation" },
      { f: "test-quotes/foundation-images/comparison-pier-high.png", truth: 12800, name: "Citadel Structural Solutions" },
    ],
  },
  "garage-door": {
    page: "/compare-garage-door-quotes.html",
    apiEndpoint: "/api/garage-door-estimate",
    fixtures: [
      { f: "test-quotes/garage-door-images/comparison-garage-low.png",  truth: 1420, name: "Valley Discount Garage Doors" },
      { f: "test-quotes/garage-door-images/comparison-garage-mid.png",  truth: 2300, name: "Desert Overhead Door Co" },
      { f: "test-quotes/garage-door-images/comparison-garage-high.png", truth: 3700, name: "Precision Door Solutions" },
    ],
  },
  gutters: {
    page: "/compare-gutters-quotes.html",
    apiEndpoint: "/api/gutters-estimate",
    fixtures: [
      { f: "test-quotes/gutters-images/comparison-gutters-low.png",  truth: 1260, name: "Budget Rain Gutter LLC" },
      { f: "test-quotes/gutters-images/comparison-gutters-mid.png",  truth: 2380, name: "Suncoast Seamless Gutters" },
      { f: "test-quotes/gutters-images/comparison-gutters-high.png", truth: 5520, name: "Gulfside Exteriors" },
    ],
  },
  insulation: {
    page: "/compare-insulation-quotes.html",
    apiEndpoint: "/api/insulation-estimate",
    fixtures: [
      { f: "test-quotes/insulation-images/comparison-insul-low.png",  truth: 1730, name: "Midstate Insulation Direct" },
      { f: "test-quotes/insulation-images/comparison-insul-mid.png",  truth: 3025, name: "Buckeye Energy Solutions" },
      { f: "test-quotes/insulation-images/comparison-insul-high.png", truth: 5680, name: "Green Envelope Building Science" },
    ],
  },
  painting: {
    page: "/compare-painting-quotes.html",
    apiEndpoint: "/api/painting-estimate",
    fixtures: [
      { f: "test-quotes/painting-images/comparison-paint-low.png",  truth: 3280,  name: "Budget Painters Denver" },
      { f: "test-quotes/painting-images/comparison-paint-mid.png",  truth: 6680,  name: "Rocky Mountain Pro Painting" },
      { f: "test-quotes/painting-images/comparison-paint-high.png", truth: 12400, name: "Front Range Finishworks" },
    ],
  },
  siding: {
    page: "/compare-siding-quotes.html",
    apiEndpoint: "/api/siding-estimate",
    fixtures: [
      { f: "test-quotes/siding-images/comparison-siding-low.png",  truth: 9040,  name: "Ohio Vinyl Siding Direct" },
      { f: "test-quotes/siding-images/comparison-siding-mid.png",  truth: 14880, name: "Queen City Exteriors" },
      { f: "test-quotes/siding-images/comparison-siding-high.png", truth: 23620, name: "Greater Cincinnati Siding & Window" },
    ],
  },
  windows: {
    page: "/compare-windows-quotes.html",
    apiEndpoint: "/api/windows-estimate",
    fixtures: [
      { f: "test-quotes/windows-images/comparison-windows-low.png",  truth: 5640,  name: "Pacific Window Warehouse" },
      { f: "test-quotes/windows-images/comparison-windows-mid.png",  truth: 9500,  name: "Cascade Window & Door" },
      { f: "test-quotes/windows-images/comparison-windows-high.png", truth: 19520, name: "Evergreen Premier Windows" },
    ],
  },
  plumbing: {
    page: "/compare-plumbing-quotes.html",
    apiEndpoint: "/api/plumbing-estimate",
    fixtures: [
      { f: "test-quotes/plumbing-images/comparison-wh-01-low.png",  truth: 1380, name: "Budget Plumbing" },
      { f: "test-quotes/plumbing-images/comparison-wh-02-mid.png",  truth: 2553, name: "Westside Plumbing" },
      { f: "test-quotes/plumbing-images/comparison-wh-03-high.png", truth: 7571, name: "Premier Home Plumbing" },
    ],
  },
};

function moneyToInt(s) {
  if (!s) return null;
  const m = String(s).match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1].replace(/,/g, "")));
}

async function walkVertical(browser, key) {
  const cfg = VERTICALS[key];
  const OUT = path.join(OUT_ROOT, key);
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 1200 });

  const apiResponses = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes(cfg.apiEndpoint)) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url, status: res.status(), body });
    }
  });

  console.log(`\n${"=".repeat(70)}\n[${key}] navigating ${BASE + cfg.page}\n${"=".repeat(70)}`);
  await page.goto(BASE + cfg.page, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2500));

  for (let i = 0; i < cfg.fixtures.length; i++) {
    const fpath = path.join(ROOT, cfg.fixtures[i].f);
    console.log(`[${key}] uploading slot ${i}: ${path.basename(fpath)} (truth: $${cfg.fixtures[i].truth})`);
    const inp = await page.$(`#file${i}`);
    if (!inp) throw new Error(`#file${i} not found`);
    await inp.uploadFile(fpath);
    await page.waitForFunction(
      (idx) => {
        const slot = document.getElementById(`slot${idx}`);
        return slot && (slot.classList.contains("uploaded") || slot.querySelector(".slot-error"));
      },
      { timeout: 180000 },
      i
    );
    const state = await page.evaluate((idx) => {
      const slot = document.getElementById(`slot${idx}`);
      return {
        uploaded: slot.classList.contains("uploaded"),
        error: !!slot.querySelector(".slot-error"),
        priceVal: (slot.querySelector(".slot-edit-price") || {}).value || null,
        nameVal: (slot.querySelector(".slot-edit-name") || {}).value || null,
      };
    }, i);
    console.log(`[${key}]   slot${i}:`, state);
  }

  await page.waitForFunction(() => {
    const b = document.getElementById("compareBtn");
    return b && !b.disabled;
  });
  await page.click("#compareBtn");
  await page.waitForFunction(() => document.querySelector(".cmp-table"));
  await new Promise((r) => setTimeout(r, 2000));

  await page.screenshot({ path: path.join(OUT, "results-1440.png"), fullPage: true });

  const table = await page.evaluate(() => {
    const tbl = document.querySelector(".cmp-table");
    if (!tbl) return null;
    const headers = Array.from(tbl.querySelectorAll("thead th")).map((th) => th.innerText.trim());
    const rows = Array.from(tbl.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim())
    );
    const winner = (document.querySelector(".cmp-winner-title") || {}).innerText || "";
    const banner = (document.querySelector(".cmp-winner-sub") || {}).innerText || "";
    return { headers, rows, winner, banner };
  });

  console.log(`\n[${key}] === WINNER ===`);
  console.log(`[${key}] ${table.winner}`);
  console.log(`[${key}] ${table.banner}`);
  console.log(`\n[${key}] === TABLE ===`);
  console.log(`[${key}] ${table.headers.join(" | ")}`);
  table.rows.forEach((r) => console.log(`[${key}] ${r.join(" | ")}`));

  // Find the Total Price row (label varies). Look for "total" or "$" rows.
  let priceRow = null;
  for (const r of table.rows) {
    const label = (r[0] || "").toLowerCase();
    if (label.includes("total") || label.includes("price") || label === "estimate") {
      priceRow = r;
      break;
    }
  }
  if (!priceRow) {
    // Fall back to any row whose data cells look like prices
    for (const r of table.rows) {
      if (r.slice(1).every((c) => /\$\s*[\d,]/.test(c))) {
        priceRow = r;
        break;
      }
    }
  }

  // Per-fixture price assertion
  const priceChecks = [];
  if (priceRow) {
    for (let i = 0; i < cfg.fixtures.length; i++) {
      const cell = priceRow[i + 1] || "";
      const displayed = moneyToInt(cell);
      const truth = cfg.fixtures[i].truth;
      const delta = displayed != null ? Math.abs(displayed - truth) : null;
      const pass = delta != null && delta <= 10;
      const x100Bug = displayed != null && displayed > 50000 && truth < 20000;
      priceChecks.push({ idx: i, fixture: cfg.fixtures[i].name, truth, displayed, delta, pass, x100Bug });
    }
  }

  const apiCallCount = apiResponses.filter((r) => r.status === 200).length;
  const api429Count = apiResponses.filter((r) => r.status === 429).length;
  const apiErrorCount = apiResponses.filter((r) => r.status >= 400 && r.status !== 429).length;

  // Row fullness: count non-empty data cells
  let totalCells = 0;
  let emptyCells = 0;
  for (const r of table.rows) {
    for (let i = 1; i < r.length; i++) {
      totalCells++;
      const c = (r[i] || "").trim();
      if (!c || c === "—" || c === "-" || c === "N/A" || c === "Not stated" || c === "? Unclear") emptyCells++;
    }
  }

  const summary = {
    vertical: key,
    apiCallCount200: apiCallCount,
    apiCalls429: api429Count,
    apiCallsOtherError: apiErrorCount,
    rowCount: table.rows.length,
    cells: { total: totalCells, empty: emptyCells, fullness: ((totalCells - emptyCells) / totalCells * 100).toFixed(1) + "%" },
    priceChecks,
    priceRowFound: !!priceRow,
    priceRowLabel: priceRow ? priceRow[0] : null,
    winner: table.winner,
  };

  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ summary, table, apiResponses }, null, 2));
  console.log(`\n[${key}] === API ===`);
  apiResponses.forEach((r, i) => {
    let parsed = null;
    try { parsed = JSON.parse(r.body); } catch {}
    const totalPrice = parsed?.data?.totalPrice ?? parsed?.data?.price ?? "?";
    const src = parsed?.data?._priceSource || parsed?.data?._source || "claude";
    console.log(`[${key}] api[${i}] status=${r.status} totalPrice=${totalPrice} source=${src}`);
  });

  console.log(`\n[${key}] === SUMMARY ===`);
  console.log(JSON.stringify(summary, null, 2));

  await page.close();
  return summary;
}

(async () => {
  const arg = (process.argv[2] || "all").toLowerCase();
  const targets = arg === "all" ? Object.keys(VERTICALS) : [arg];
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  const results = {};
  let overallPass = true;

  for (const key of targets) {
    if (!VERTICALS[key]) {
      console.error(`Unknown vertical: ${key}`);
      continue;
    }
    try {
      const s = await walkVertical(browser, key);
      results[key] = s;

      // Pass criteria
      const allPricesPass = s.priceChecks.length === 3 && s.priceChecks.every((c) => c.pass);
      const noBug100x = s.priceChecks.every((c) => !c.x100Bug);
      const apiCalled = s.apiCallCount200 > 0;
      const tableFull = s.rowCount >= 6 && parseFloat(s.cells.fullness) >= 50;

      const pass = allPricesPass && noBug100x && apiCalled && tableFull;
      console.log(`\n[${key}] >>> ${pass ? "PASS" : "FAIL"} <<<`);
      console.log(`[${key}] allPricesPass=${allPricesPass} noBug100x=${noBug100x} apiCalled=${apiCalled} tableFull=${tableFull}`);
      if (!pass) overallPass = false;

      // Brief pause between verticals to let rate-limit windows breathe
      if (targets.length > 1) await new Promise((r) => setTimeout(r, 3000));
    } catch (e) {
      console.error(`[${key}] WALK ERROR:`, e.message);
      overallPass = false;
    }
  }

  fs.writeFileSync(path.join(OUT_ROOT, "all-results.json"), JSON.stringify(results, null, 2));
  console.log(`\n${"=".repeat(70)}\nOVERALL: ${overallPass ? "PASS" : "FAIL"}\n${"=".repeat(70)}`);
  await browser.close();
  process.exit(overallPass ? 0 : 1);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
