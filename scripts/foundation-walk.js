// Foundation 3-path human walk: estimate flow, compare flow, analyzer post-confirm.
// Captures full-page screenshots + rendered text per path so the deep test can
// be reviewed without re-running the harness.
//
// Run: node scripts/foundation-walk.js
// Output: output/foundation-walk-2026-05-03/<path>-<step>.png + walk-log.txt

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const OUT = path.join(__dirname, "..", "output", "foundation-walk-2026-05-03");
fs.mkdirSync(OUT, { recursive: true });
const log = [];

function note(s) { console.log(s); log.push(s); }

async function shot(page, name) {
  const p = path.join(OUT, name + ".png");
  await page.screenshot({ path: p, fullPage: true });
  note(`  → screenshot: ${p}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ── ESTIMATE PATH ──
  note("\n[estimate] /foundation-estimate.html");
  let page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/foundation-estimate.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  await shot(page, "01-estimate-load");

  // Step through the estimator: repair type → severity → home age
  // (Estimator runs the address page first which has been removed; the
  // analyzer-page state machine renders the upload zone there. The estimate
  // page should jump directly to the estimator wizard.)
  const estimateSteps = await page.evaluate(() => {
    const txt = document.body.innerText.slice(0, 1200);
    const opts = Array.from(document.querySelectorAll(".found-option")).map(o => o.innerText.trim());
    return { txt, opts };
  });
  note("  body sample: " + estimateSteps.txt.slice(0, 200).replace(/\n/g, " | "));
  note("  options seen: " + JSON.stringify(estimateSteps.opts));

  // Click moderate/8 piers if visible
  const opts = await page.$$(".found-option");
  if (opts.length > 0) {
    // Step 1: pier_installation (default index 0)
    await opts[0].click();
    await new Promise(r => setTimeout(r, 500));
    await shot(page, "02-estimate-step1-clicked");
    // Step 2: moderate
    const opts2 = await page.$$(".found-option");
    if (opts2.length > 1) {
      await opts2[1].click();
      await new Promise(r => setTimeout(r, 500));
      await shot(page, "03-estimate-step2-clicked");
      // Step 3: 1990+
      const opts3 = await page.$$(".found-option");
      if (opts3.length > 2) {
        await opts3[2].click();
        await new Promise(r => setTimeout(r, 1500));
        await shot(page, "04-estimate-result");
        const result = await page.evaluate(() => {
          return {
            verdictPrice: (document.querySelector(".verdict-price") || {}).innerText || "",
            verdictRange: (document.querySelector(".verdict-range") || {}).innerText || "",
            verdictLabel: (document.querySelector(".verdict-label") || {}).innerText || "",
            details: Array.from(document.querySelectorAll(".found-detail")).map(d => d.innerText),
          };
        });
        note("  estimate result: " + JSON.stringify(result));
      }
    }
  }
  await page.close();

  // ── COMPARE PATH ──
  note("\n[compare] /compare-foundation-quotes.html");
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/compare-foundation-quotes.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  await shot(page, "10-compare-load");

  // Upload all 3 clean fixtures
  const fixtures = [
    "test-quotes/foundation-images/comparison-pier-high.png",
    "test-quotes/foundation-images/comparison-pier-mid.png",
    "test-quotes/foundation-images/comparison-pier-low.png",
  ];
  const inputs = await page.$$('input[type="file"]');
  note(`  found ${inputs.length} file inputs`);
  if (inputs.length > 0) {
    // Single-multiple input or multiple inputs?
    try {
      await inputs[0].uploadFile(...fixtures.map(f => path.join(__dirname, "..", f)));
    } catch (e) {
      note("  multi-upload failed, trying per-input: " + e.message);
      for (let i = 0; i < Math.min(inputs.length, fixtures.length); i++) {
        await inputs[i].uploadFile(path.join(__dirname, "..", fixtures[i]));
      }
    }
  }
  await new Promise(r => setTimeout(r, 3000));
  await shot(page, "11-compare-uploaded");

  // Wait for compare result render
  await page.waitForFunction(() => {
    return !!document.querySelector(".cmp-winner-banner") ||
           !!document.querySelector(".cmp-winner-title") ||
           document.body.innerText.includes("best overall value") ||
           document.body.innerText.includes("closely matched");
  }, { timeout: 90000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));
  await shot(page, "12-compare-result");

  const cmpResult = await page.evaluate(() => {
    return {
      winner: (document.querySelector(".cmp-winner-title") || {}).innerText || "",
      winnerSub: (document.querySelector(".cmp-winner-sub") || {}).innerText || "",
      bodyText: document.body.innerText.slice(0, 4000),
    };
  });
  note("  compare winner: " + JSON.stringify({ winner: cmpResult.winner, sub: cmpResult.winnerSub }));
  note("  compare body sample: " + cmpResult.bodyText.slice(0, 400).replace(/\n/g, " | "));
  await page.close();

  // ── ANALYZER PATH (single fixture, full result page) ──
  note("\n[analyze] /foundation-quote-analyzer.html");
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/foundation-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  await shot(page, "20-analyze-load");

  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile(path.join(__dirname, "..", "test-quotes/foundation-images/comparison-pier-high.png"));
    await page.waitForFunction(() => !!document.getElementById("tpConfirmPriceBtn") || !!document.querySelector(".verdict-price"), { timeout: 90000 }).catch(() => null);
    await shot(page, "21-analyze-pre-confirm");
    if (await page.$("#tpConfirmPriceBtn")) {
      await page.click("#tpConfirmPriceBtn");
      await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
      await new Promise(r => setTimeout(r, 1500));
    }
    await shot(page, "22-analyze-result");
    const r = await page.evaluate(() => ({
      price: (document.querySelector(".verdict-price") || {}).innerText || "",
      label: (document.querySelector(".verdict-label") || {}).innerText || "",
      range: (document.querySelector(".verdict-range") || {}).innerText || "",
      details: Array.from(document.querySelectorAll(".found-detail")).map(d => d.innerText.replace(/\n/g, ":")),
      ctas: Array.from(document.querySelectorAll(".found-actions a, .found-btn")).map(a => a.innerText.trim()),
    }));
    note("  analyze result: " + JSON.stringify(r));
  }
  await page.close();

  // ── UNHAPPY PATH (refresh / empty submit on estimate) ──
  note("\n[unhappy] estimate refresh mid-flow");
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/foundation-estimate.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  const opts4 = await page.$$(".found-option");
  if (opts4.length > 0) {
    await opts4[0].click();
    await new Promise(r => setTimeout(r, 500));
    await page.reload({ waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1000));
    await shot(page, "30-unhappy-after-refresh");
  }
  await page.close();

  await browser.close();
  fs.writeFileSync(path.join(OUT, "walk-log.txt"), log.join("\n"));
  console.log("\nWalk complete. Output:", OUT);
})();
