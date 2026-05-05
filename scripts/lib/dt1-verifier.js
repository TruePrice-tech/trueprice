// Shared runner for the per-vertical PRICING-row leak verifiers (DT-1
// sweep, follows PLUMB-DT-1 pattern). Each per-vertical caller supplies
// the analyzer page path, the .<v>-detail class selector, the LEAK_TOKENS
// list, and the fixture list. Output is human-readable per-fixture so a
// silent capture failure (the trap that hid PLUMB-DT-1 for 2 days) shows
// up explicitly instead of passing as "0 fails".

const path = require("path");
const { launchHarnessBrowser, preparePage } = require("../../test/lib/harness-browser");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "../..");

const FORM_LEAK_TOKENS = [
  "ustomer", "nstomer", "nal\\s?je", "ddress", "nvoice", "ate", "age", "hone",
  "mail", "ignature", "ubtotal", "mount", "ue", "ty", "tem", "escription"
];

async function runVerifier({ analyzerPath, detailClass, pricingLabelKey, leakTokens, manualPrice, fixtures }) {
  const allTokens = [...new Set([...FORM_LEAK_TOKENS, ...(leakTokens || [])])];
  const LEAK_RX = new RegExp("\\b(" + allTokens.join("|") + ")\\b.*local\\s+pricing", "i");
  const browser = await launchHarnessBrowser();
  let passed = 0, total = 0;
  try {
    for (const fix of fixtures) {
      total++;
      const ok = await checkFixture(browser, fix.label, fix.file, {
        analyzerPath, detailClass, pricingLabelKey: pricingLabelKey || "pricing", manualPrice: manualPrice || "5000", LEAK_RX
      });
      if (ok) passed++;
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${passed}/${total} clean`);
  process.exit(passed === total ? 0 : 1);
}

async function checkFixture(browser, label, fixturePath, opts) {
  console.log(`\n=== ${label} ===`);
  const page = await browser.newPage();
  await preparePage(page, BASE);
  await page.setViewport({ width: 1440, height: 900 });
  page.setDefaultTimeout(120000);

  await page.goto(BASE + opts.analyzerPath + "?cb=" + Date.now(), { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));

  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_DIR, fixturePath));

  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const hasConfirm = await page.evaluate(() => !!document.getElementById("tpConfirmPriceBtn"));
  const hasManual = await page.evaluate(() => !!document.getElementById("tpManualPriceBtn"));
  if (hasConfirm) await page.click("#tpConfirmPriceBtn");
  else if (hasManual) {
    await page.type("#tpManualPrice", opts.manualPrice);
    await page.click("#tpManualPriceBtn");
  }

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 2500));

  const result = await page.evaluate((cls, key) => {
    const out = { pricing: "", details: {}, detailCount: 0, bodyText: "", hardReject: false };
    const dets = document.querySelectorAll("." + cls);
    out.detailCount = dets.length;
    dets.forEach(d => {
      const lbl = (d.querySelector(".label") || {}).innerText || "";
      const val = (d.querySelector(".value") || {}).innerText || "";
      if (lbl) out.details[lbl.trim().toLowerCase()] = val.trim();
    });
    out.pricing = out.details[key] || out.details["pricing"] || out.details["pricing source"] || "";
    out.hardReject = !!document.getElementById("tpHardRejectStartOver");
    out.bodyText = document.body.innerText.slice(0, 800).replace(/\s+/g, " ");
    return out;
  }, opts.detailClass, opts.pricingLabelKey);

  console.log(`  ${opts.detailClass} rows: ${result.detailCount}`);
  console.log(`  PRICING row: "${result.pricing}"`);
  if (!result.pricing) console.log(`  body[0..800]: ${result.bodyText}`);
  const isLeak = opts.LEAK_RX.test(result.pricing);
  if (isLeak) console.log("  LEAK DETECTED");
  else if (result.pricing) console.log("  CLEAN");
  else if (result.hardReject) console.log("  HARD REJECT");
  else console.log("  NO SIGNAL");
  await page.close();
  return !isLeak;
}

module.exports = { runVerifier };
