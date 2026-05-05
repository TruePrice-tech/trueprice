// Verify ELE-DT-1 fix on electrical-quote-analyzer.html — uploads the
// messiest fixtures and confirms the PRICING row falls back to "<region>
// regional pricing" when AI returns junk-from-OCR or sub-type labels as the
// city. Mirror of scripts/verify-plumb-dt1.js + scripts/verify-hvac-dt1.js.

const path = require("path");
const { launchHarnessBrowser, preparePage } = require("../test/lib/harness-browser");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..");

const LEAK_TOKENS = [
  "ustomer", "nstomer", "nal\\s?je", "ddress", "nvoice", "ate", "age", "hone",
  "mail", "ignature", "ubtotal", "mount", "ue", "ty", "tem", "escription",
  "panel", "service", "wiring", "outlet", "circuit", "breaker", "ev\\s?charger",
  "recessed", "lights", "amps", "subpanel", "upgrade",
  "routine", "soon", "emergency"
];
const LEAK_RX = new RegExp("\\b(" + LEAK_TOKENS.join("|") + ")\\b.*local\\s+pricing", "i");

async function checkFixture(browser, label, fixturePath) {
  console.log(`\n=== ${label} ===`);
  const page = await browser.newPage();
  await preparePage(page, BASE);
  await page.setViewport({ width: 1440, height: 900 });
  page.setDefaultTimeout(120000);

  await page.goto(BASE + "/electrical-quote-analyzer.html?cb=" + Date.now(), { waitUntil: "networkidle2" });
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
    const dets = document.querySelectorAll(".elec-detail");
    out.detailCount = dets.length;
    dets.forEach(d => {
      const lbl = (d.querySelector(".label") || {}).innerText || "";
      const val = (d.querySelector(".value") || {}).innerText || "";
      if (lbl) out.details[lbl.trim().toLowerCase()] = val.trim();
    });
    out.pricing = out.details["pricing"] || "";
    out.hardReject = !!document.getElementById("tpHardRejectStartOver");
    out.bodyText = document.body.innerText.slice(0, 800).replace(/\s+/g, " ");
    return out;
  });

  console.log(`  elec-detail rows: ${result.detailCount}`);
  console.log(`  PRICING row: "${result.pricing}"`);
  if (!result.pricing) {
    console.log(`  body[0..800]: ${result.bodyText}`);
  }
  const isLeak = LEAK_RX.test(result.pricing);
  if (isLeak) {
    console.log("  LEAK DETECTED");
  } else if (result.pricing) {
    console.log("  CLEAN");
  } else if (result.hardReject) {
    console.log("  HARD REJECT");
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
    total++; if (await checkFixture(browser, "f07 lowball side job",
      "test-quotes/electrical-images/07-did-i-lowball-myself-on-this-side-job.jpeg")) passed++;
    total++; if (await checkFixture(browser, "messy panel mid (OCR-stripped form labels)",
      "test-quotes/electrical-images/messy-comparison-panel-02-mid.jpg")) passed++;
    total++; if (await checkFixture(browser, "messy panel high (sub-type leak risk)",
      "test-quotes/electrical-images/messy-comparison-panel-03-high.jpg")) passed++;
  } finally {
    await browser.close();
  }
  console.log(`\n${passed}/${total} clean`);
  process.exit(passed === total ? 0 : 1);
})();
