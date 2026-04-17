#!/usr/bin/env node
// Plumbing analyzer accuracy harness — v2 (volume + discovery + persistence).
//
// Modes:
//   1. PASS/FAIL  — fixtures in EXPECTED with known ground truth
//   2. DISCOVERY  — fixtures NOT in EXPECTED, runs them anyway and reports
//                    extracted values so you can label them later
//   3. COVERAGE   — end-of-run stats: % parsed, % manual fallback, avg confidence
//
// Persistence:
//   Writes a timestamped JSON to test-results/plumbing/<timestamp>.json
//   Also updates test-results/plumbing/latest.json (always the newest)
//
// Usage:
//   node scripts/test-plumbing-accuracy.js
//   BASE_URL=http://localhost:3000 node scripts/test-plumbing-accuracy.js
//   node scripts/test-plumbing-accuracy.js --baseline       (compare to test-results/plumbing/baseline.json)
//   node scripts/test-plumbing-accuracy.js --save-baseline  (write current run as the new baseline)

const path = require("path");
const fs = require("fs");

let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch (e) {
  console.error("Missing dependency: puppeteer. Install with `npm i -D puppeteer`.");
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "test-quotes", "plumbing-images");
const RESULTS_DIR = path.resolve(__dirname, "..", "test-results", "plumbing");
const TIMEOUT_MS = 180000; // 3 min per fixture (multi-pass Tesseract is slow on real photos)

// ── GROUND TRUTH ──
// Hand-labeled expected results. Add more as you label fixtures.
// Format: filename → { expectedPrice, expectedJobType, notes }
// expectedPrice: number, or null if you expect manual-entry fallback
// expectedJobType: short string like "water_heater_tank", "drain_cleaning", "repipe"
const EXPECTED = {
  // ── synthetic mocks (clean, typed, known ground truth) ──
  "comparison-wh-01-low.png":  { expectedPrice: 1380, expectedJobType: "water_heater_tank",     notes: "Budget Plumbing, 50-gal gas tank" },
  "comparison-wh-02-mid.png":  { expectedPrice: 2553, expectedJobType: "water_heater_tank",     notes: "Westside Plumbing, Bradford White 50-gal" },
  "comparison-wh-03-high.png": { expectedPrice: 7571, expectedJobType: "water_heater_tankless", notes: "Premier Home, Rinnai tankless premium" },

  // ── synthetic mocks degraded (same data, lower quality) ──
  "messy-comparison-wh-01-low.jpg":  { expectedPrice: 1380, expectedJobType: "water_heater_tank",     notes: "Budget — degraded version" },
  "messy-comparison-wh-02-mid.jpg":  { expectedPrice: 2553, expectedJobType: "water_heater_tank",     notes: "Westside — degraded version" },
  "messy-comparison-wh-03-high.jpg": { expectedPrice: 7571, expectedJobType: "water_heater_tankless", notes: "Premier — degraded version" },

  // ── real Reddit fixtures (label these as you verify them) ──
  // "01-did-i-get-ripped-off.jpeg": { expectedPrice: ?, expectedJobType: "?" },
  "02-contractor-says-1800-to-move-water-supply-into-the.jpeg": { expectedPrice: 1800, expectedJobType: "repipe", notes: "Title says $1800 to move water supply" },
};

// Tolerance for price match (5% or $50 — whichever is larger).
function pricesMatch(expected, actual) {
  if (expected == null && actual == null) return true;
  if (expected == null || actual == null) return false;
  const tol = Math.max(50, expected * 0.05);
  return Math.abs(expected - actual) <= tol;
}

async function analyzeFixture(browser, fixtureName) {
  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const consoleErrors = [];
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });

  const t0 = Date.now();
  const url = `${BASE_URL}/plumbing-quote-analyzer.html?path=quote`;
  await page.goto(url, { waitUntil: "networkidle2" });

  await page.waitForSelector('input[type="file"]', { timeout: 30000 });

  const fixturePath = path.join(FIXTURES_DIR, fixtureName);
  const [inputEl] = await page.$$('input[type="file"]');
  await inputEl.uploadFile(fixturePath);

  // Wait for either result screen or manual-entry-primary fallback.
  await page.waitForFunction(
    () => {
      const manual = document.getElementById("manualPrice");
      if (manual) return true;
      const bodyText = document.body.innerText || "";
      return /verdict|fair|overpri|underpri|your\s+quote/i.test(bodyText)
        && /\$[0-9,]+/.test(bodyText);
    },
    { timeout: TIMEOUT_MS }
  );

  const elapsed = Date.now() - t0;

  const result = await page.evaluate(() => {
    const manual = document.getElementById("manualPrice");
    if (manual) {
      return { kind: "manual_entry", price: null, confidence: "low", jobType: null };
    }
    const bodyText = document.body.innerText || "";
    // First $ amount in result-card region (rough — works for most layouts)
    const priceMatch = bodyText.match(/\$([0-9][0-9,]*)/);
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null;
    const serviceMatch = bodyText.match(/(?:service\s*type|job\s*type)\s*[:\-]?\s*([A-Za-z _]+)/i);
    const jobType = serviceMatch ? serviceMatch[1].trim().toLowerCase().replace(/\s+/g, "_") : null;
    const confidence =
      /high\s+confidence/i.test(bodyText) ? "high" :
      /medium\s+confidence/i.test(bodyText) ? "medium" :
      /low\s+confidence/i.test(bodyText) ? "low" : "unknown";
    return { kind: "result", price, confidence, jobType };
  });

  await page.close();
  return { ...result, elapsedMs: elapsed, consoleErrors };
}

function loadBaseline() {
  const p = path.join(RESULTS_DIR, "baseline.json");
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

(async function main() {
  const args = process.argv.slice(2);
  const useBaseline = args.includes("--baseline");
  const saveBaseline = args.includes("--save-baseline");
  const labeledOnly = args.includes("--labeled-only");

  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`Fixtures dir not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  let fixtures = fs
    .readdirSync(FIXTURES_DIR)
    .filter(n => /\.(jpe?g|png|pdf|webp)$/i.test(n))
    .sort();
  if (labeledOnly) fixtures = fixtures.filter(n => EXPECTED[n]);

  console.log(`Plumbing accuracy harness v2`);
  console.log(`  Target:   ${BASE_URL}`);
  console.log(`  Fixtures: ${fixtures.length} in ${FIXTURES_DIR}`);
  console.log(`  Labeled:  ${fixtures.filter(n => EXPECTED[n]).length}`);
  console.log(`  Discovery: ${fixtures.filter(n => !EXPECTED[n]).length}`);
  console.log("");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const rows = [];
  let i = 0;
  let consecutiveFails = 0;
  let abortedEarly = false;
  for (const name of fixtures) {
    if (consecutiveFails >= 3) {
      console.log(`\n>>> FAIL-FAST: 3 consecutive failures, aborting remaining ${fixtures.length - i} fixtures.`);
      abortedEarly = true;
      break;
    }
    i++;
    const expected = EXPECTED[name];
    const isLabeled = !!expected;
    process.stdout.write(`[${i}/${fixtures.length}] ${name} ${isLabeled ? "(labeled)" : "(discovery)"}\n`);
    try {
      const res = await analyzeFixture(browser, name);
      let status;
      if (isLabeled) {
        status = pricesMatch(expected.expectedPrice, res.price) ? "PASS" : "FAIL";
        if (status === "FAIL") consecutiveFails++; else consecutiveFails = 0;
      } else {
        status = res.price != null ? "DISCOVERED" : "NEEDS_MANUAL";
        if (status === "NEEDS_MANUAL") consecutiveFails++; else consecutiveFails = 0;
      }
      rows.push({
        status,
        name,
        expectedPrice: isLabeled ? expected.expectedPrice : null,
        expectedJobType: isLabeled ? expected.expectedJobType : null,
        actualPrice: res.price,
        actualJobType: res.jobType,
        confidence: res.confidence,
        kind: res.kind,
        elapsedMs: res.elapsedMs,
        consoleErrorCount: res.consoleErrors.length,
        notes: isLabeled ? expected.notes : null
      });
    } catch (err) {
      rows.push({
        status: "ERROR",
        name,
        expectedPrice: isLabeled ? expected.expectedPrice : null,
        actualPrice: null,
        error: err.message.slice(0, 200)
      });
    }
  }

  await browser.close();

  // ── Print summary table ──
  console.log("\n── Per-fixture results ──");
  const w = { status: 12, name: 60, expected: 12, actual: 12, conf: 8, time: 8 };
  const hdr = `${"STATUS".padEnd(w.status)} ${"FIXTURE".padEnd(w.name)} ${"EXPECTED".padEnd(w.expected)} ${"GOT".padEnd(w.actual)} ${"CONF".padEnd(w.conf)} ${"TIME".padEnd(w.time)}`;
  console.log(hdr);
  console.log("-".repeat(hdr.length));
  for (const r of rows) {
    const exp = r.expectedPrice == null ? (r.status.startsWith("DISCOV") || r.status === "NEEDS_MANUAL" ? "(no label)" : "(manual)") : `$${r.expectedPrice}`;
    const got = r.actualPrice == null ? "(manual)" : `$${r.actualPrice}`;
    const time = r.elapsedMs ? `${(r.elapsedMs/1000).toFixed(1)}s` : "—";
    console.log(
      `${(r.status || "").padEnd(w.status)} ${r.name.padEnd(w.name)} ${exp.padEnd(w.expected)} ${got.padEnd(w.actual)} ${(r.confidence || "").padEnd(w.conf)} ${time.padEnd(w.time)}`
    );
  }

  // ── Coverage stats ──
  const labeled = rows.filter(r => r.expectedPrice !== null && r.expectedPrice !== undefined);
  const pass = labeled.filter(r => r.status === "PASS").length;
  const fail = labeled.filter(r => r.status === "FAIL").length;
  const errored = rows.filter(r => r.status === "ERROR").length;
  const discovered = rows.filter(r => r.status === "DISCOVERED").length;
  const needsManual = rows.filter(r => r.status === "NEEDS_MANUAL").length;
  const totalParsed = rows.filter(r => r.actualPrice != null).length;
  const totalManual = rows.filter(r => r.actualPrice == null && r.status !== "ERROR").length;

  const confs = rows.map(r => r.confidence).filter(c => c && c !== "unknown");
  const high = confs.filter(c => c === "high").length;
  const medium = confs.filter(c => c === "medium").length;
  const low = confs.filter(c => c === "low").length;

  const elapsedTotal = rows.reduce((s, r) => s + (r.elapsedMs || 0), 0);
  const avgElapsed = rows.length ? Math.round(elapsedTotal / rows.length / 1000) : 0;

  console.log("\n── Coverage ──");
  console.log(`  Total fixtures:       ${rows.length}`);
  console.log(`  Labeled (PASS/FAIL):  ${labeled.length}  →  ${pass} PASS, ${fail} FAIL`);
  console.log(`  Discovery:            ${discovered + needsManual}  →  ${discovered} parsed, ${needsManual} fell to manual`);
  console.log(`  Errors:               ${errored}`);
  console.log(`  Parse rate:           ${rows.length ? Math.round(100 * totalParsed / rows.length) : 0}%  (${totalParsed}/${rows.length} returned a price)`);
  console.log(`  Manual fallback rate: ${rows.length ? Math.round(100 * totalManual / rows.length) : 0}%  (${totalManual}/${rows.length})`);
  if (labeled.length) {
    console.log(`  Labeled accuracy:     ${Math.round(100 * pass / labeled.length)}%  (${pass}/${labeled.length})`);
  }
  console.log(`  Confidence breakdown: high=${high}, medium=${medium}, low=${low}`);
  console.log(`  Avg time per fixture: ${avgElapsed}s`);

  // ── Persistence ──
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runFile = path.join(RESULTS_DIR, `${ts}.json`);
  const latestFile = path.join(RESULTS_DIR, "latest.json");
  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    fixtureCount: rows.length,
    labeled: labeled.length,
    pass, fail, errored, discovered, needsManual,
    parseRate: rows.length ? Math.round(100 * totalParsed / rows.length) : 0,
    manualRate: rows.length ? Math.round(100 * totalManual / rows.length) : 0,
    accuracy: labeled.length ? Math.round(100 * pass / labeled.length) : null,
    confidence: { high, medium, low },
    avgElapsedMs: rows.length ? Math.round(elapsedTotal / rows.length) : 0,
    rows
  };
  fs.writeFileSync(runFile, JSON.stringify(summary, null, 2));
  fs.writeFileSync(latestFile, JSON.stringify(summary, null, 2));
  console.log(`\nSaved: ${runFile}`);
  console.log(`Saved: ${latestFile}`);

  if (saveBaseline) {
    const baselineFile = path.join(RESULTS_DIR, "baseline.json");
    fs.writeFileSync(baselineFile, JSON.stringify(summary, null, 2));
    console.log(`Saved: ${baselineFile} (new baseline)`);
  }

  // ── Baseline diff ──
  if (useBaseline) {
    const baseline = loadBaseline();
    if (!baseline) {
      console.log("\nNo baseline.json found. Run with --save-baseline first to create one.");
    } else {
      console.log("\n── Baseline diff ──");
      console.log(`  Accuracy:    ${baseline.accuracy ?? "n/a"}%  →  ${summary.accuracy ?? "n/a"}%`);
      console.log(`  Parse rate:  ${baseline.parseRate}%  →  ${summary.parseRate}%`);
      console.log(`  Manual rate: ${baseline.manualRate}%  →  ${summary.manualRate}%`);
      // Per-fixture regression check
      const baselineByName = Object.fromEntries(baseline.rows.map(r => [r.name, r]));
      const regressed = rows.filter(r => {
        const b = baselineByName[r.name];
        return b && b.status === "PASS" && r.status === "FAIL";
      });
      const fixed = rows.filter(r => {
        const b = baselineByName[r.name];
        return b && b.status === "FAIL" && r.status === "PASS";
      });
      if (regressed.length) console.log(`  REGRESSED:   ${regressed.map(r => r.name).join(", ")}`);
      if (fixed.length)     console.log(`  FIXED:       ${fixed.map(r => r.name).join(", ")}`);
      if (!regressed.length && !fixed.length) console.log(`  No per-fixture changes vs baseline.`);
    }
  }

  process.exit(fail + errored > 0 ? 1 : 0);
})();
