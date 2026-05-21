// Electrical deep test 2026-05-02 — human walk script.
// Walks the 3 electrical surfaces (estimate / compare / analyze) + mobile +
// wrong-vertical hard-reject, capturing screenshots + body-text dumps so
// findings can be read off as a human.
//
// Mirrors scripts/plumbing-deep-walk.js. Run after the fixture-truth
// harness baseline so we have ground truth to compare display against.
//
// Usage: node scripts/electrical-deep-walk.js
// Output: output/electrical-deep-test-2026-05-02/

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const OUT = path.resolve(__dirname, "..", "output", "electrical-deep-test-2026-05-02");
fs.mkdirSync(OUT, { recursive: true });

const FIXTURES_DIR = path.resolve(__dirname, "..");
const ANALYZE_FIXTURES = [
  ["f1-redding-low",        "test-quotes/electrical-images/comparison-panel-01-low.png"],
  ["f2-spartan-mid",        "test-quotes/electrical-images/comparison-panel-02-mid.png"],
  ["f3-meridian-high",      "test-quotes/electrical-images/comparison-panel-03-high.png"],
  ["f7-service-form-9432",  "test-quotes/real-world/electrical-extra-11.png"],
  ["f8-recessed-3487",      "test-quotes/real-world/electrical-extra-12.jpg"],
  ["f9-handwritten",        "test-quotes/electrical-images/07-did-i-lowball-myself-on-this-side-job.jpeg"],
];

async function dumpBody(page, fname) {
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, fname + ".txt"), text);
}

async function shot(page, fname) {
  await page.screenshot({ path: path.join(OUT, fname + ".png"), fullPage: true });
}

async function uploadToAnalyze(page, file) {
  await page.goto(BASE + "/electrical-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));
  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_DIR, file));
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("elecHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const has = await page.evaluate(() => ({
    confirm: !!document.getElementById("tpConfirmPriceBtn"),
    manual: !!document.getElementById("tpManualPriceBtn"),
    reject: !!document.getElementById("tpHardRejectStartOver") ||
            !!document.getElementById("elecHardRejectStartOver"),
  }));
  if (has.reject) return "rejected";
  if (has.confirm) {
    await page.click("#tpConfirmPriceBtn");
  } else if (has.manual) {
    await page.type("#tpManualPrice", "500");
    await page.click("#tpManualPriceBtn");
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
  // Address → service type (Panel Upgrade) → home age → home size → urgency → result.
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/electrical-quote-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));
    await shot(page, "estimator-01-initial");
    await dumpBody(page, "estimator-01-initial");

    const hasAddr = await page.evaluate(() => !!document.querySelector('input[id*="addr"], input[id*="ity"], input[name*="city"]'));
    if (hasAddr) {
      const street = await page.$('input[id*="treet"], input[name*="street"]');
      if (street) await street.type("100 Main St");
      const city = await page.$('input[id*="ity"], input[name*="city"]');
      if (city) await city.type("Charlotte");
      const stEl = await page.$('input[id*="tate"], input[name*="state"]');
      if (stEl) await stEl.type("NC");
      const zipEl = await page.$('input[id*="ip"], input[name*="zip"]');
      if (zipEl) await zipEl.type("28202");
      // Click "Get an Estimate" button
      const buttons = await page.$$("button, a");
      for (const b of buttons) {
        const txt = await page.evaluate(el => el.innerText, b);
        if (/get\s*(an\s*)?estimate|start\s*estimate/i.test(txt)) {
          await b.click();
          break;
        }
      }
      await new Promise(r => setTimeout(r, 1500));
      await shot(page, "estimator-02-step1-service");
      await dumpBody(page, "estimator-02-step1-service");

      // Click "Panel Upgrade" option
      const opts = await page.$$(".elec-option");
      if (opts.length) {
        await opts[0].click();
        await new Promise(r => setTimeout(r, 1200));
        await shot(page, "estimator-03-step2-followup");
        await dumpBody(page, "estimator-03-step2-followup");
      }
    }
    await page.close();
  }

  // ─────────────── COMPARE PATH ───────────────
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/compare-electrical-quotes.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2500));
    await shot(page, "compare-01-initial");
    await dumpBody(page, "compare-01-initial");

    const fileInputs = await page.$$('input[type="file"]');
    console.log(`compare: found ${fileInputs.length} file inputs`);
    if (fileInputs.length >= 3) {
      const files = [
        "test-quotes/electrical-images/comparison-panel-01-low.png",
        "test-quotes/electrical-images/comparison-panel-02-mid.png",
        "test-quotes/electrical-images/comparison-panel-03-high.png",
      ];
      for (let i = 0; i < 3; i++) {
        await fileInputs[i].uploadFile(path.join(FIXTURES_DIR, files[i]));
        await new Promise(r => setTimeout(r, 1500));
      }
      await new Promise(r => setTimeout(r, 60000));
      await shot(page, "compare-02-after-uploads");
      await dumpBody(page, "compare-02-after-uploads");

      const buttons = await page.$$("button");
      for (const b of buttons) {
        const txt = await page.evaluate(el => el.innerText, b);
        if (/compare|analyze/i.test(txt)) {
          await b.click();
          break;
        }
      }
      await new Promise(r => setTimeout(r, 60000));
      await shot(page, "compare-03-result");
      await dumpBody(page, "compare-03-result");
    }
    await page.close();
  }

  // ─────────────── MOBILE EMULATION ───────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(BASE + "/electrical-quote-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));
    await shot(page, "mobile-01-analyze-initial");

    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(path.join(FIXTURES_DIR, "test-quotes/electrical-images/comparison-panel-02-mid.png"));
    await page.waitForFunction(() => {
      return !!document.getElementById("tpConfirmPriceBtn") ||
             !!document.querySelector(".verdict-price");
    }, { timeout: 120000 }).catch(() => null);
    if (await page.$("#tpConfirmPriceBtn")) await page.click("#tpConfirmPriceBtn");
    await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 1500));
    await shot(page, "mobile-02-analyze-result");
    await dumpBody(page, "mobile-02-analyze-result");
    await page.close();
  }

  // ─────────────── WRONG-VERTICAL HARD REJECT ───────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/electrical-quote-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2500));
    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(path.join(FIXTURES_DIR, "test-quotes/hvac-images/comparison-ac-01-low.png"));
    await page.waitForFunction(() => {
      return !!document.getElementById("elecHardRejectStartOver") ||
             !!document.getElementById("tpHardRejectStartOver") ||
             !!document.getElementById("tpConfirmPriceBtn") ||
             !!document.getElementById("tpManualPriceBtn");
    }, { timeout: 120000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 1000));
    await shot(page, "wrong-vertical-hvac-into-electrical");
    await dumpBody(page, "wrong-vertical-hvac-into-electrical");
    const rejected = await page.evaluate(() =>
      !!document.getElementById("elecHardRejectStartOver") ||
      !!document.getElementById("tpHardRejectStartOver"));
    console.log(`wrong-vertical hard-reject: ${rejected ? "FIRED" : "MISSED"}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nWalk complete. Output: ${OUT}`);
})();
