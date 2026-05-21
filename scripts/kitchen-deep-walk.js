// Kitchen deep test 2026-05-02 — human walk script.
// Walks the 3 kitchen surfaces (estimate / compare / analyze) + mobile +
// wrong-vertical hard-reject, capturing screenshots + body-text dumps so
// findings can be read off as a human.
//
// Mirrors scripts/electrical-deep-walk.js. Run after the fixture-truth
// harness baseline so we have ground truth to compare display against.
//
// Usage: node scripts/kitchen-deep-walk.js
// Output: output/kitchen-deep-test-2026-05-02/

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const OUT = path.resolve(__dirname, "..", "output", "kitchen-deep-test-2026-05-02");
fs.mkdirSync(OUT, { recursive: true });

const FIXTURES_DIR = path.resolve(__dirname, "..");
const ANALYZE_FIXTURES = [
  ["f1-quick-low",      "test-quotes/kitchen-images/comparison-kitchen-low.png"],
  ["f2-prairie-mid",    "test-quotes/kitchen-images/comparison-kitchen-mid.png"],
  ["f3-artisan-high",   "test-quotes/kitchen-images/comparison-kitchen-high.png"],
  ["f7-mock-midrange",  "test-quotes/kitchen-images/mock-01.png"],
  ["f8-real-photo",     "test-quotes/real-quotes/kitchen/fixture-kitchen-remodel.jpg"],
];

async function dumpBody(page, fname) {
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, fname + ".txt"), text);
}

async function shot(page, fname) {
  await page.screenshot({ path: path.join(OUT, fname + ".png"), fullPage: true });
}

async function uploadToAnalyze(page, file) {
  await page.goto(BASE + "/kitchen-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));
  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_DIR, file));
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("kitHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const has = await page.evaluate(() => ({
    confirm: !!document.getElementById("tpConfirmPriceBtn"),
    manual: !!document.getElementById("tpManualPriceBtn"),
    reject: !!document.getElementById("tpHardRejectStartOver") ||
            !!document.getElementById("kitHardRejectStartOver"),
  }));
  if (has.reject) return "rejected";
  if (has.confirm) {
    await page.click("#tpConfirmPriceBtn");
  } else if (has.manual) {
    await page.type("#tpManualPrice", "30000");
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
  // Address → tier → kitchen size → countertop → result.
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/kitchen-estimate.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));
    await shot(page, "estimator-01-initial");
    await dumpBody(page, "estimator-01-initial");

    // Try to fill address if present
    const street = await page.$('input[id*="treet"], input[name*="street"]');
    if (street) await street.type("100 Main St");
    const city = await page.$('input[id*="ity"], input[name*="city"]');
    if (city) await city.type("Charlotte");
    const stEl = await page.$('input[id*="tate"], input[name*="state"]');
    if (stEl) await stEl.type("NC");
    const zipEl = await page.$('input[id*="ip"], input[name*="zip"]');
    if (zipEl) await zipEl.type("28202");

    const buttons = await page.$$("button, a");
    for (const b of buttons) {
      const txt = await page.evaluate(el => el.innerText, b);
      if (/get\s*(an\s*)?estimate|start\s*estimate/i.test(txt)) {
        await b.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1500));
    await shot(page, "estimator-02-step1-tier");
    await dumpBody(page, "estimator-02-step1-tier");

    // Click Mid-Range tier (kit-option)
    const tierOpts = await page.$$(".kit-option");
    for (const opt of tierOpts) {
      const txt = await page.evaluate(el => el.innerText, opt);
      if (/mid[- ]?range/i.test(txt)) { await opt.click(); break; }
    }
    await new Promise(r => setTimeout(r, 1200));
    await shot(page, "estimator-03-step2-size");
    await dumpBody(page, "estimator-03-step2-size");

    // Click "Large" kitchen size
    const sizeOpts = await page.$$(".kit-option");
    for (const opt of sizeOpts) {
      const txt = await page.evaluate(el => el.innerText, opt);
      if (/large/i.test(txt) && !/expansive/i.test(txt)) { await opt.click(); break; }
    }
    await new Promise(r => setTimeout(r, 1200));
    await shot(page, "estimator-04-step3-counter");
    await dumpBody(page, "estimator-04-step3-counter");

    // Click Quartz counter
    const matOpts = await page.$$(".kit-option");
    for (const opt of matOpts) {
      const txt = await page.evaluate(el => el.innerText, opt);
      if (/quartz/i.test(txt) && !/quartzite/i.test(txt)) { await opt.click(); break; }
    }
    await new Promise(r => setTimeout(r, 2000));
    await shot(page, "estimator-05-result");
    await dumpBody(page, "estimator-05-result");
    await page.close();
  }

  // ─────────────── COMPARE PATH ───────────────
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE + "/compare-kitchen-quotes.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2500));
    await shot(page, "compare-01-initial");
    await dumpBody(page, "compare-01-initial");

    const fileInputs = await page.$$('input[type="file"]');
    console.log(`compare: found ${fileInputs.length} file inputs`);
    if (fileInputs.length >= 3) {
      const files = [
        "test-quotes/kitchen-images/comparison-kitchen-low.png",
        "test-quotes/kitchen-images/comparison-kitchen-mid.png",
        "test-quotes/kitchen-images/comparison-kitchen-high.png",
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
    await page.goto(BASE + "/kitchen-quote-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));
    await shot(page, "mobile-01-analyze-initial");

    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(path.join(FIXTURES_DIR, "test-quotes/kitchen-images/comparison-kitchen-mid.png"));
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
    await page.goto(BASE + "/kitchen-quote-analyzer.html", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2500));
    const inp = await page.$('input[type="file"]');
    await inp.uploadFile(path.join(FIXTURES_DIR, "test-quotes/electrical-images/comparison-panel-01-low.png"));
    await page.waitForFunction(() => {
      return !!document.getElementById("kitHardRejectStartOver") ||
             !!document.getElementById("tpHardRejectStartOver") ||
             !!document.getElementById("tpConfirmPriceBtn") ||
             !!document.getElementById("tpManualPriceBtn");
    }, { timeout: 120000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 1000));
    await shot(page, "wrong-vertical-electrical-into-kitchen");
    await dumpBody(page, "wrong-vertical-electrical-into-kitchen");
    const rejected = await page.evaluate(() =>
      !!document.getElementById("kitHardRejectStartOver") ||
      !!document.getElementById("tpHardRejectStartOver"));
    console.log(`wrong-vertical hard-reject: ${rejected ? "FIRED" : "MISSED"}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nWalk complete. Output: ${OUT}`);
})();
