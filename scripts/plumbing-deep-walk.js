// Plumbing deep test 2026-05-02 — human walk script.
// Walks the 3 plumbing surfaces (estimate / compare / analyze) + mobile +
// wrong-vertical hard-reject, capturing screenshots + body-text dumps so
// findings can be read off as a human.
//
// Mirrors scripts/auto-repair-deep-walk.js. Run after the fixture-truth
// harness baseline so we have ground truth to compare display against.
//
// Usage: node scripts/plumbing-deep-walk.js
// Output: output/plumbing-deep-test-2026-05-02/

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const OUT = path.resolve(__dirname, "..", "output", "plumbing-deep-test-2026-05-02");
fs.mkdirSync(OUT, { recursive: true });

const FIXTURES_DIR = path.resolve(__dirname, "..");
const ANALYZE_FIXTURES = [
  ["f1-budget-tank-low",     "test-quotes/plumbing-images/comparison-wh-01-low.png"],
  ["f2-westside-tank-mid",   "test-quotes/plumbing-images/comparison-wh-02-mid.png"],
  ["f3-premier-tankless",    "test-quotes/plumbing-images/comparison-wh-03-high.png"],
  ["f7-roto-rooter-redacted", "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg"],
  ["f8-indirect-wh",          "test-quotes/plumbing-images/10-is-this-estimate-crazy-or-am-i.jpeg"],
];

async function dumpBody(page, fname) {
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, fname + ".txt"), text);
}

async function shot(page, fname) {
  await page.screenshot({ path: path.join(OUT, fname + ".png"), fullPage: true });
}

async function uploadToAnalyze(page, file) {
  await page.goto(BASE + "/plumbing-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));
  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_DIR, file));
  await page.waitForFunction(() => {
    return !!document.getElementById("confirmPriceBtn") ||
           !!document.getElementById("manualPriceBtn") ||
           !!document.getElementById("plumbHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const has = await page.evaluate(() => ({
    confirm: !!document.getElementById("confirmPriceBtn"),
    manual: !!document.getElementById("manualPriceBtn"),
    reject: !!document.getElementById("plumbHardRejectStartOver"),
  }));
  if (has.reject) return "rejected";
  if (has.confirm) {
    await page.click("#confirmPriceBtn");
  } else if (has.manual) {
    await page.type("#manualPrice", "500");
    await page.click("#manualPriceBtn");
  }
  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));
  return "ok";
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─────────────── ANALYZE PATH ───────────────
  for (const [id, file] of ANALYZE_FIXTURES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    process.stdout.write(`analyze ${id} ... `);
    const r = await uploadToAnalyze(page, file);
    await shot(page, `analyze-${id}`);
    await dumpBody(page, `analyze-${id}`);
    console.log(r);
    await page.close();
  }

  // ─────────────── ESTIMATE PATH ───────────────
  // Path: address → service type → sub-type → details → urgency → result.
  // Walk water-heater-tank-50-gas-Charlotte-NC (typical case).
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/plumbing-estimate.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));
    await shot(page, "estimate-01-initial");
    await dumpBody(page, "estimate-01-initial");

    // Try to drive through the estimator. Plumbing estimate page details vary;
    // dump body text and screenshot. If interactive, we'd need to click options.
    await page.close();
  }

  // Estimate via the analyzer's Estimator entry — the analyzer page has both
  // upload + estimator. Address → "Get an Estimate" button → estimator steps.
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/plumbing-quote-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));
    await shot(page, "estimator-01-address");
    await dumpBody(page, "estimator-01-address");

    // Fill address: Charlotte NC 28202.
    const hasAddr = await page.evaluate(() => !!document.getElementById("addrCity"));
    if (hasAddr) {
      await page.type("#addrStreet", "100 Main St");
      await page.type("#addrCity", "Charlotte");
      await page.type("#addrState", "NC");
      await page.type("#addrZip", "28202");
      const btn = await page.$("#btnEstimate");
      if (btn) await btn.click();
      await new Promise(r => setTimeout(r, 1500));
      await shot(page, "estimator-02-step1-service");
      await dumpBody(page, "estimator-02-step1-service");

      // Click "Water Heater" option.
      const opts = await page.$$(".plumb-option");
      if (opts.length) {
        await opts[0].click();   // water_heater
        await new Promise(r => setTimeout(r, 1200));
        await shot(page, "estimator-03-step2-subtype");
        await dumpBody(page, "estimator-03-step2-subtype");
      }
    }
    await page.close();
  }

  // ─────────────── COMPARE PATH ───────────────
  // Upload 3 plumbing quotes side-by-side (clean wh-01, wh-02, wh-03).
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/compare-plumbing-quotes.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2500));
    await shot(page, "compare-01-initial");
    await dumpBody(page, "compare-01-initial");

    // Find file inputs (compare pages typically have 3 upload zones).
    const fileInputs = await page.$$('input[type="file"]');
    console.log(`compare: found ${fileInputs.length} file inputs`);
    if (fileInputs.length >= 3) {
      const files = [
        "test-quotes/plumbing-images/comparison-wh-01-low.png",
        "test-quotes/plumbing-images/comparison-wh-02-mid.png",
        "test-quotes/plumbing-images/comparison-wh-03-high.png",
      ];
      for (let i = 0; i < 3; i++) {
        await fileInputs[i].uploadFile(path.join(FIXTURES_DIR, files[i]));
        await new Promise(r => setTimeout(r, 1500));
      }
      // Wait for analyze
      await new Promise(r => setTimeout(r, 30000));
      await shot(page, "compare-02-after-uploads");
      await dumpBody(page, "compare-02-after-uploads");

      // Look for "Compare" or analyze button
      const buttons = await page.$$("button");
      for (const b of buttons) {
        const txt = await page.evaluate(el => el.innerText, b);
        if (/compare|analyze/i.test(txt)) {
          await b.click();
          break;
        }
      }
      await new Promise(r => setTimeout(r, 30000));
      await shot(page, "compare-03-result");
      await dumpBody(page, "compare-03-result");
    }
    await page.close();
  }

  // ─────────────── MOBILE EMULATION ───────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(BASE + "/plumbing-quote-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));
    await shot(page, "mobile-01-analyze-initial");

    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(path.join(FIXTURES_DIR, "test-quotes/plumbing-images/comparison-wh-02-mid.png"));
    await page.waitForFunction(() => {
      return !!document.getElementById("confirmPriceBtn") ||
             !!document.querySelector(".verdict-price");
    }, { timeout: 90000 }).catch(() => null);
    if (await page.$("#confirmPriceBtn")) await page.click("#confirmPriceBtn");
    await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 1500));
    await shot(page, "mobile-02-analyze-result");
    await dumpBody(page, "mobile-02-analyze-result");
    await page.close();
  }

  // ─────────────── WRONG-VERTICAL HARD REJECT ───────────────
  // Upload an HVAC fixture into plumbing analyzer — should hard-reject.
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/plumbing-quote-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2500));
    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(path.join(FIXTURES_DIR, "test-quotes/hvac-images/comparison-ac-01-low.png"));
    await page.waitForFunction(() => {
      return !!document.getElementById("plumbHardRejectStartOver") ||
             !!document.getElementById("confirmPriceBtn") ||
             !!document.getElementById("manualPriceBtn");
    }, { timeout: 90000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 1000));
    await shot(page, "wrong-vertical-hvac-into-plumbing");
    await dumpBody(page, "wrong-vertical-hvac-into-plumbing");
    const rejected = await page.evaluate(() => !!document.getElementById("plumbHardRejectStartOver"));
    console.log(`wrong-vertical hard-reject: ${rejected ? "FIRED" : "MISSED"}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nWalk complete. Output: ${OUT}`);
})();
