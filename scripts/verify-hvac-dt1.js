// Verify HVAC-DT-1 fix — uploads the messiest HVAC fixtures and confirms the
// PRICING row falls back to "<region> regional pricing" when AI returns
// junk-from-OCR (e.g. "Ustomer Nal Je") or a sub-type label as the city
// (e.g. "Heat pump"). Mirror of scripts/verify-plumb-dt1.js.

const path = require("path");
const { launchHarnessBrowser, preparePage } = require("../test/lib/harness-browser");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..");

// Things that should never render as "<x> local pricing" — form-field
// fragments + HVAC sub-type / job-type labels.
const LEAK_TOKENS = [
  "ustomer", "nstomer", "nal\\s?je", "ddress", "nvoice", "ate", "age", "hone",
  "mail", "ignature", "ubtotal", "mount", "ue", "ty", "tem", "escription",
  "heat\\s?pump", "furnace", "central\\s?air", "mini\\s?split", "geothermal",
  "install", "replace", "service", "repair", "maintenance"
];
const LEAK_RX = new RegExp("\\b(" + LEAK_TOKENS.join("|") + ")\\b.*local\\s+pricing", "i");

async function checkFixture(browser, label, fixturePath) {
  console.log(`\n=== ${label} ===`);
  const page = await browser.newPage();
  await preparePage(page, BASE);
  await page.setViewport({ width: 1440, height: 900 });
  page.setDefaultTimeout(120000);

  await page.goto(BASE + "/hvac-quote-analyzer.html?cb=" + Date.now(), { waitUntil: "networkidle2" });
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
    await page.type("#tpManualPrice", "5000");
    await page.click("#tpManualPriceBtn");
  }

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 2500));

  const result = await page.evaluate(() => {
    const out = { pricing: "", details: {}, detailCount: 0, bodyText: "", hardReject: false };
    const dets = document.querySelectorAll(".hvac-detail");
    out.detailCount = dets.length;
    dets.forEach(d => {
      const lbl = (d.querySelector(".label") || {}).innerText || "";
      const val = (d.querySelector(".value") || {}).innerText || "";
      if (lbl) out.details[lbl.trim().toLowerCase()] = val.trim();
    });
    out.pricing = out.details["pricing"] || "";
    out.hardReject = !!document.getElementById("hvacHardRejectStartOver") || /not.*hvac|wrong.*vertical|hard.*reject/i.test(document.body.innerText.slice(0, 2000));
    out.bodyText = document.body.innerText.slice(0, 800).replace(/\s+/g, " ");
    return out;
  });

  console.log(`  hvac-detail rows: ${result.detailCount}`);
  console.log(`  PRICING row: "${result.pricing}"`);
  if (!result.pricing) {
    console.log(`  hardReject=${result.hardReject}`);
    console.log(`  detail keys: ${Object.keys(result.details).join(", ")}`);
    console.log(`  body[0..800]: ${result.bodyText}`);
  }
  const isLeak = LEAK_RX.test(result.pricing);
  if (isLeak) {
    console.log("  LEAK DETECTED");
  } else if (result.pricing) {
    console.log("  CLEAN");
  } else if (result.hardReject) {
    console.log("  HARD REJECT (no PRICING row rendered, fixture rejected by wrong-vertical/abuse-guard)");
  } else {
    console.log("  NO SIGNAL (verifier did not capture a PRICING row, cannot certify clean)");
  }
  await page.close();
  return !isLeak;
}

(async () => {
  const browser = await launchHarnessBrowser();
  let passed = 0, total = 0;
  try {
    // f04 Austin $33k — comparison-style with form-field labels at top
    total++; if (await checkFixture(browser, "f04 Austin $33k AC+heater (form labels)",
      "test-quotes/hvac-images/04-just-got-quoted-33k-for-ac-and-heater-in-austin-fo.jpeg")) passed++;
    // f05 dense quote with sub-type leakage potential
    total++; if (await checkFixture(browser, "f05 dense quote",
      "test-quotes/hvac-images/05-i-mean-ya-cant-make-this-stuff-up.jpeg")) passed++;
    // f10 mini-split — sub-type "Mini Split" likely to leak as city
    total++; if (await checkFixture(browser, "f10 8k mini split (sub-type leak risk)",
      "test-quotes/hvac-images/10-8k-for-mitsubishi-mini-split-leak-detection-just-t.png")) passed++;
  } finally {
    await browser.close();
  }
  console.log(`\n${passed}/${total} clean`);
  process.exit(passed === total ? 0 : 1);
})();
