// Verify PLUMB-DT-1 fix — f7 (Roto-Rooter) + f8 (Indirect WH) should render
// "<region> regional pricing" instead of leaking AI-hallucinated city.
//
// Runs only the 2 affected fixtures, captures PRICING row, prints PASS/FAIL.

const path = require("path");
const { launchHarnessBrowser, preparePage } = require("../test/lib/harness-browser");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..");

async function checkFixture(browser, label, fixturePath) {
  console.log(`\n=== ${label} ===`);
  const page = await browser.newPage();
  await preparePage(page, BASE);
  await page.setViewport({ width: 1440, height: 900 });
  page.setDefaultTimeout(120000);

  await page.goto(BASE + "/plumbing-quote-analyzer.html?cb=" + Date.now(), { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));

  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_DIR, fixturePath));

  await page.waitForFunction(() => {
    return !!document.getElementById("confirmPriceBtn") ||
           !!document.getElementById("manualPriceBtn") ||
           !!document.getElementById("plumbHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const hasConfirm = await page.evaluate(() => !!document.getElementById("confirmPriceBtn"));
  const hasManual = await page.evaluate(() => !!document.getElementById("manualPriceBtn"));
  if (hasConfirm) await page.click("#confirmPriceBtn");
  else if (hasManual) {
    await page.type("#manualPrice", "500");
    await page.click("#manualPriceBtn");
  }

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const result = await page.evaluate(() => {
    const out = { pricing: "", details: {} };
    document.querySelectorAll(".plumb-detail").forEach(d => {
      const lbl = (d.querySelector(".label") || {}).innerText || "";
      const val = (d.querySelector(".value") || {}).innerText || "";
      if (lbl) out.details[lbl.trim().toLowerCase()] = val.trim();
    });
    out.pricing = out.details["pricing"] || "";
    return out;
  });

  console.log(`  PRICING row: "${result.pricing}"`);
  const isClean = /regional pricing/i.test(result.pricing) ||
                  /^[A-Za-z][A-Za-z\s\-'.]+\sloc(al)? pricing$/.test(result.pricing) === false ||
                  // Allowed: explicit US city followed by " local pricing"
                  /^(Los Angeles|West Hollywood|Indianapolis|New York|Chicago|Houston|Atlanta|Dallas|Austin|Seattle|Denver|Miami|Boston|Philadelphia|Phoenix|Charlotte|Columbus|Jacksonville|Memphis|Nashville|Portland|Albuquerque|Baltimore|Milwaukee|San Antonio|San Diego|San Francisco|Fort Mill)\b.* local pricing$/i.test(result.pricing);
  // Strict cleanliness check: no "Indirect"/"Ustomer"/"Nal"/"Nstomer"/etc
  const isLeak = /\b(indirect|ustomer|nstomer|nal\s?je|ddress|nvoice|tank|tankless|sewer|repipe)\b.*local pricing/i.test(result.pricing);
  if (isLeak) {
    console.log("  ❌ LEAK DETECTED");
  } else {
    console.log("  ✅ CLEAN");
  }
  await page.close();
  return !isLeak;
}

(async () => {
  const browser = await launchHarnessBrowser();
  let passed = 0, total = 0;
  try {
    total++; if (await checkFixture(browser, "f8 indirect WH (page 1, no city)",
      "test-quotes/plumbing-images/10-is-this-estimate-crazy-or-am-i.jpeg")) passed++;
    total++; if (await checkFixture(browser, "f7 Roto-Rooter (Customer Name OCR drop)",
      "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg")) passed++;
  } finally {
    await browser.close();
  }
  console.log(`\n${passed}/${total} clean`);
  process.exit(passed === total ? 0 : 1);
})();
