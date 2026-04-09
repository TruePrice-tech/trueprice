#!/usr/bin/env node
// Plumbing analyzer accuracy harness.
//
// Usage:  node scripts/test-plumbing-accuracy.js
//
// What it does:
//   1. Iterates every fixture in test-quotes/plumbing-images/
//   2. For each fixture, launches puppeteer, navigates to
//        https://truepricehq.com/plumbing-quote-analyzer.html?path=quote
//      and programmatically uploads the file via the hidden <input type="file">.
//   3. Waits for the analysis to complete (either the result screen or the
//      manual-entry-primary screen).
//   4. Extracts the displayed price, service type, and confidence.
//   5. Diffs against the EXPECTED map below and prints a PASS/FAIL table.
//
// Notes for whoever fills this in:
//   - Leave fixtures you don't have ground truth for OUT of EXPECTED; the
//     harness will skip them (status = SKIP) and they won't fail the run.
//   - If the site falls back to manual-entry-primary, the harness records
//     confidence = "low" and price = null. Counts as FAIL unless expected
//     price is null.
//   - BASE_URL defaults to production. Override with `BASE_URL=http://localhost:3000 node ...`
//     for local testing.

const path = require("path");
const fs = require("fs");

let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch (e) {
  console.error("Missing dependency: puppeteer. Install with `npm i -D puppeteer`.");
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL || "https://truepricehq.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "test-quotes", "plumbing-images");
const TIMEOUT_MS = 120000; // 2 min per fixture (multi-pass Tesseract is slow)

// ── GROUND TRUTH — fill these in before running ──
// Keys are file names inside test-quotes/plumbing-images/.
// Omit a fixture to SKIP it. Use `expectedPrice: null` if you expect the
// analyzer to bail out to manual entry (i.e. no parseable price).
const EXPECTED = {
  // "01-did-i-get-ripped-off.jpeg": { expectedPrice: null, expectedJobType: null },
  // "02-contractor-says-1800-to-move-water-supply-into-the.jpeg": { expectedPrice: 1800, expectedJobType: "repipe" },
  // "03-did-i-get-a-i-dont-want-to-do-this-quote.jpeg":             { expectedPrice: null, expectedJobType: null },
  // "04-is-this-normal.jpeg":                                       { expectedPrice: null, expectedJobType: null },
  // "05-plumber-has-refused-to-quote-to-fix-this-shower-ta.jpeg":   { expectedPrice: null, expectedJobType: null },
  // "06-help-me-understand-the-invoicenote-from-a-plumber.jpeg":    { expectedPrice: null, expectedJobType: null },
  // "07-my-water-bill-in-the-past-few-months-has-doubled-f.jpg":    { expectedPrice: null, expectedJobType: null },
  // "08-4-plumber-quotes---2-say-abs-2-say-pvc--why.jpeg":          { expectedPrice: null, expectedJobType: null },
  // "09-is-she-right-is-this-an-absurd-quote.jpg":                  { expectedPrice: null, expectedJobType: null },
  // "10-is-this-estimate-crazy-or-am-i.jpeg":                       { expectedPrice: null, expectedJobType: null },
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
  page.on("console", msg => {
    if (msg.type() === "error") console.log(`  [console.error] ${msg.text()}`);
  });

  const url = `${BASE_URL}/plumbing-quote-analyzer.html?path=quote`;
  await page.goto(url, { waitUntil: "networkidle2" });

  // The UI starts on an address form; we don't need to fill it to upload.
  // Wait for the hidden file input to appear. The page uses `fileInput` via
  // an id-less input inside the drop zone, so query by [type=file].
  await page.waitForSelector('input[type="file"]', { timeout: 30000 });

  const fixturePath = path.join(FIXTURES_DIR, fixtureName);
  const [inputEl] = await page.$$('input[type="file"]');
  await inputEl.uploadFile(fixturePath);

  // Wait until either the result screen or manual-entry-primary screen is shown.
  // Result: "#progFill" is replaced by the result card. Manual: presence of
  // `#manualPrice` input.
  await page.waitForFunction(
    () => {
      const manual = document.getElementById("manualPrice");
      if (manual) return true;
      // Result screen has a headline with the verdict + a $ amount.
      const bodyText = document.body.innerText || "";
      return /verdict|fair|overpri|underpri|your\s+quote/i.test(bodyText)
        && /\$[0-9,]+/.test(bodyText);
    },
    { timeout: TIMEOUT_MS }
  );

  // Extract results.
  const result = await page.evaluate(() => {
    const manual = document.getElementById("manualPrice");
    if (manual) {
      return { kind: "manual_entry", price: null, confidence: "low", jobType: null };
    }
    const bodyText = document.body.innerText || "";
    const priceMatch = bodyText.match(/\$([0-9][0-9,]*)/);
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null;
    // Service/job type is rendered somewhere in the result card; best-effort grab.
    const serviceMatch = bodyText.match(/(?:service|job)\s*[:\-]?\s*([A-Za-z ]+)/i);
    const jobType = serviceMatch ? serviceMatch[1].trim() : null;
    const confidence =
      /high\s+confidence/i.test(bodyText) ? "high" :
      /medium\s+confidence/i.test(bodyText) ? "medium" :
      /low\s+confidence/i.test(bodyText) ? "low" : "unknown";
    return { kind: "result", price, confidence, jobType };
  });

  await page.close();
  return result;
}

(async function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`Fixtures dir not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const fixtures = fs
    .readdirSync(FIXTURES_DIR)
    .filter(n => /\.(jpe?g|png|pdf|webp)$/i.test(n))
    .sort();

  console.log(`Running plumbing accuracy test against ${BASE_URL}`);
  console.log(`Found ${fixtures.length} fixtures in ${FIXTURES_DIR}\n`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const rows = [];
  for (const name of fixtures) {
    const expected = EXPECTED[name];
    if (!expected) {
      rows.push({ status: "SKIP", name, expected: "(no ground truth)", actual: "", conf: "" });
      continue;
    }
    process.stdout.write(`Testing ${name}...\n`);
    try {
      const res = await analyzeFixture(browser, name);
      const ok = pricesMatch(expected.expectedPrice, res.price);
      rows.push({
        status: ok ? "PASS" : "FAIL",
        name,
        expected: expected.expectedPrice == null ? "(manual)" : `$${expected.expectedPrice}`,
        actual: res.price == null ? "(manual)" : `$${res.price}`,
        conf: res.confidence
      });
    } catch (err) {
      rows.push({ status: "ERROR", name, expected: `$${expected.expectedPrice}`, actual: err.message.slice(0, 60), conf: "" });
    }
  }

  await browser.close();

  // Print summary table
  console.log("\n── Results ──");
  const w = { status: 6, name: 50, expected: 14, actual: 14, conf: 10 };
  const hdr = `${"STATUS".padEnd(w.status)} ${"FIXTURE".padEnd(w.name)} ${"EXPECTED".padEnd(w.expected)} ${"GOT".padEnd(w.actual)} ${"CONF".padEnd(w.conf)}`;
  console.log(hdr);
  console.log("-".repeat(hdr.length));
  for (const r of rows) {
    console.log(
      `${r.status.padEnd(w.status)} ${r.name.padEnd(w.name)} ${String(r.expected).padEnd(w.expected)} ${String(r.actual).padEnd(w.actual)} ${String(r.conf).padEnd(w.conf)}`
    );
  }

  const pass = rows.filter(r => r.status === "PASS").length;
  const fail = rows.filter(r => r.status === "FAIL").length;
  const err = rows.filter(r => r.status === "ERROR").length;
  const skip = rows.filter(r => r.status === "SKIP").length;
  console.log(`\n${pass} pass, ${fail} fail, ${err} error, ${skip} skip`);
  process.exit(fail + err > 0 ? 1 : 0);
})();
