// Auto-repair deep-test walk — 3 paths (analyze / compare / estimate) +
// mobile + 1 unhappy-path per route. Logs key signals so the human reviewer
// can scroll the screenshots + JSON + body-text dumps and confirm.

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const OUT = path.resolve(__dirname, "..", "output", "auto-deep-test-2026-05-02");
fs.mkdirSync(OUT, { recursive: true });

const FIXTURES_ROOT = path.resolve(__dirname, "..");

const ANALYZE_FIXTURES = [
  { id: "f2-precision-mid",    file: "test-quotes/auto-images/comparison-brake-02-shop-b-mid.png" },
  { id: "f1-honest-wrench",    file: "test-quotes/auto-images/comparison-brake-01-shop-a-low.png" },
  { id: "f3-park-avenue",      file: "test-quotes/auto-images/comparison-brake-03-shop-c-high.png" },
  { id: "f4-jeep-insurance",   file: "test-quotes/auto-images/07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg" },
  { id: "f5-audi-recs",        file: "test-quotes/auto-images/09-am-i-crazy-or-is-this-quote.jpg" },
  { id: "f6-equinox",          file: "test/receipt/ocr-cache/fixtures/auto-equinox-quote.jpeg" },
  { id: "f7-honda-cr-v",       file: "test/receipt/ocr-cache/fixtures/auto-honda-paper-photo.jpeg" },
  { id: "f8-bmw-x3",           file: "test-quotes/sample-auto-bmw-nc.png" },
];

const COMPARE_TRIO = [
  "test-quotes/auto-images/comparison-brake-01-shop-a-low.png",
  "test-quotes/auto-images/comparison-brake-02-shop-b-mid.png",
  "test-quotes/auto-images/comparison-brake-03-shop-c-high.png",
];

async function shotAnalyze(browser, fx) {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1440, height: 900 });
  const consoleErrors = [];
  page.on("pageerror", e => consoleErrors.push("pageerror: " + e.message));
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push("console.error: " + msg.text().slice(0, 200)); });
  await page.goto(BASE + "/auto-repair.html?path=quote", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));
  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_ROOT, fx.file));

  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("arHardRejectStartOver");
  }, { timeout: 120000 }).catch(() => null);

  await page.screenshot({ path: path.join(OUT, `analyze-${fx.id}-pre-confirm.png`), fullPage: true });

  const has = await page.evaluate(() => ({
    confirm: !!document.getElementById("tpConfirmPriceBtn"),
    manual: !!document.getElementById("tpManualPriceBtn"),
    hardReject: !!document.getElementById("tpHardRejectStartOver") || !!document.getElementById("arHardRejectStartOver"),
  }));
  if (has.hardReject) {
    fs.writeFileSync(path.join(OUT, `analyze-${fx.id}-rejected.txt`), await page.evaluate(() => document.body.innerText.slice(0, 2000)));
    fs.writeFileSync(path.join(OUT, `analyze-${fx.id}-errors.txt`), consoleErrors.join("\n"));
    await page.close();
    return { hardReject: true };
  }
  if (has.confirm) await page.click("#tpConfirmPriceBtn");
  else if (has.manual) {
    await page.type("#tpManualPrice", "1000");
    await page.click("#tpManualPriceBtn");
  }
  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, `analyze-${fx.id}-result.png`), fullPage: true });
  const dump = await page.evaluate(() => {
    return {
      verdictLabel: (document.querySelector(".verdict-label") || {}).innerText || "",
      verdictPrice: (document.querySelector(".verdict-price") || {}).innerText || "",
      verdictRange: (document.querySelector(".verdict-range") || {}).innerText || "",
      details: Array.from(document.querySelectorAll(".ar-detail")).map(d => ({
        label: ((d.querySelector(".label") || {}).innerText || "").trim(),
        value: ((d.querySelector(".value") || {}).innerText || "").trim(),
      })),
      tableRows: Array.from(document.querySelectorAll(".ar-table tbody tr")).map(tr => Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim())),
      hasInsuranceBanner: /this looks like an insurance/i.test(document.body.innerText),
      hasRecommendationBanner: /this looks like a list of dealer service recommendations/i.test(document.body.innerText),
      bodyText: document.body.innerText.slice(0, 4000),
    };
  });
  fs.writeFileSync(path.join(OUT, `analyze-${fx.id}-dump.json`), JSON.stringify(dump, null, 2));
  fs.writeFileSync(path.join(OUT, `analyze-${fx.id}-errors.txt`), consoleErrors.join("\n"));
  await page.close();
  return { hardReject: false, dump, errors: consoleErrors };
}

async function walkEstimate(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const consoleErrors = [];
  page.on("pageerror", e => consoleErrors.push("pageerror: " + e.message));
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push("console.error: " + msg.text().slice(0, 200)); });
  await page.goto(BASE + "/auto-repair.html?path=estimate", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, "estimate-01-load.png"), fullPage: true });

  // Permutation: Honda Civic 2018, brake-job, independent shop, 28206
  await page.evaluate(() => {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("input", { bubbles: true })); } };
    setVal("eVehicleCategory", "compact_sedan");
    setVal("eMake", "Honda");
  });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("input", { bubbles: true })); } };
    setVal("eModel", "Civic");
    setVal("eYear", "2018");
    setVal("eRepair", "brake_job");
    setVal("eShopType", "independent");
    setVal("eState", "NC");
    setVal("eZip", "28206");
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT, "estimate-02-filled.png"), fullPage: true });

  await page.evaluate(() => { const b = document.getElementById("btnEstimate"); if (b) b.click(); });
  await page.waitForFunction(() => !!document.querySelector(".ar-verdict-card") || !!document.getElementById("estimateResult")?.innerText?.length, { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, "estimate-03-result.png"), fullPage: true });

  const eDump = await page.evaluate(() => ({
    bodyText: document.body.innerText.slice(0, 4000),
    has$undefined: /\$undefined|NaN|undefined/.test(document.body.innerText),
  }));
  fs.writeFileSync(path.join(OUT, "estimate-dump.json"), JSON.stringify(eDump, null, 2));

  // Print emulation
  await page.emulateMediaType("print");
  await page.screenshot({ path: path.join(OUT, "estimate-04-print.png"), fullPage: true });
  await page.emulateMediaType("screen");

  // Unhappy: empty submit
  await page.goto(BASE + "/auto-repair.html?path=estimate", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => { const b = document.getElementById("btnEstimate"); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, "estimate-05-empty-submit.png"), fullPage: true });
  fs.writeFileSync(path.join(OUT, "estimate-empty-submit.txt"), await page.evaluate(() => document.body.innerText.slice(0, 2000)));

  // Mobile
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(BASE + "/auto-repair.html?path=estimate", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT, "estimate-06-mobile.png"), fullPage: true });

  fs.writeFileSync(path.join(OUT, "estimate-errors.txt"), consoleErrors.join("\n"));
  await page.close();
}

async function walkCompare(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const consoleErrors = [];
  page.on("pageerror", e => consoleErrors.push("pageerror: " + e.message));
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push("console.error: " + msg.text().slice(0, 200)); });
  await page.goto(BASE + "/compare-auto-quotes.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT, "compare-01-load.png"), fullPage: true });

  // compare-auto-quotes uses 3 separate file inputs (#file0, #file1, #file2)
  for (let i = 0; i < 3; i++) {
    const slot = await page.$('#file' + i);
    if (!slot) continue;
    await slot.uploadFile(path.join(FIXTURES_ROOT, COMPARE_TRIO[i]));
    await new Promise(r => setTimeout(r, 6000)); // each upload triggers OCR
  }

  // Wait until comparison results render — try multiple known classes.
  await page.waitForFunction(() => {
    return !!document.querySelector(".compare-result, .cq-result, .comparison-table, .verdict-price, [data-result]") ||
           /best value|winner|cheapest|best deal|(?:rank|score)/i.test(document.body.innerText);
  }, { timeout: 180000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(OUT, "compare-02-result.png"), fullPage: true });

  const cDump = await page.evaluate(() => ({
    bodyText: document.body.innerText.slice(0, 6000),
    headingsCount: document.querySelectorAll("h1,h2,h3").length,
    tables: Array.from(document.querySelectorAll("table")).map(t => t.innerText.slice(0, 2000)),
  }));
  fs.writeFileSync(path.join(OUT, "compare-dump.json"), JSON.stringify(cDump, null, 2));

  // Mobile
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(BASE + "/compare-auto-quotes.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, "compare-03-mobile.png"), fullPage: true });

  fs.writeFileSync(path.join(OUT, "compare-errors.txt"), consoleErrors.join("\n"));
  await page.close();
}

async function walkAnalyzeMobile(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(BASE + "/auto-repair.html?path=quote", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(OUT, "analyze-mobile-01-load.png"), fullPage: true });
  const inp = await page.$('input[type="file"]');
  if (inp) {
    await inp.uploadFile(path.join(FIXTURES_ROOT, "test-quotes/auto-images/comparison-brake-01-shop-a-low.png"));
    await page.waitForFunction(() => !!document.getElementById("tpConfirmPriceBtn") || !!document.getElementById("tpManualPriceBtn") || !!document.getElementById("arHardRejectStartOver"), { timeout: 120000 }).catch(() => null);
    await page.screenshot({ path: path.join(OUT, "analyze-mobile-02-confirm.png"), fullPage: true });
    if (await page.$("#tpConfirmPriceBtn")) await page.click("#tpConfirmPriceBtn");
    await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT, "analyze-mobile-03-result.png"), fullPage: true });
  }
  await page.close();
}

async function walkAnalyzeUnhappy(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  // Upload a wrong-vertical file: HVAC fixture into auto-repair analyzer
  await page.goto(BASE + "/auto-repair.html?path=quote", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  const inp = await page.$('input[type="file"]');
  if (inp) {
    await inp.uploadFile(path.join(FIXTURES_ROOT, "test-quotes/hvac-images/comparison-ac-01-low.png"));
    await page.waitForFunction(() => !!document.getElementById("arHardRejectStartOver") || !!document.getElementById("tpHardRejectStartOver") || !!document.getElementById("tpConfirmPriceBtn"), { timeout: 120000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT, "analyze-unhappy-wrong-vertical.png"), fullPage: true });
    fs.writeFileSync(path.join(OUT, "analyze-unhappy-wrong-vertical.txt"), await page.evaluate(() => document.body.innerText.slice(0, 2500)));
  }
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const summary = { ts: new Date().toISOString(), base: BASE, analyze: {}, walks: {} };

  console.log("=== ANALYZE PATH ===");
  for (const fx of ANALYZE_FIXTURES) {
    process.stdout.write(`  ${fx.id} ... `);
    try {
      const r = await shotAnalyze(browser, fx);
      summary.analyze[fx.id] = r.hardReject ? { hardReject: true } : {
        verdictLabel: r.dump.verdictLabel,
        verdictPrice: r.dump.verdictPrice,
        verdictRange: r.dump.verdictRange,
        details: r.dump.details,
        tableRowCount: r.dump.tableRows.length,
        hasInsuranceBanner: r.dump.hasInsuranceBanner,
        hasRecommendationBanner: r.dump.hasRecommendationBanner,
        consoleErrors: r.errors.length,
      };
      console.log("done");
    } catch (e) {
      summary.analyze[fx.id] = { error: e.message };
      console.log("ERROR:", e.message);
    }
  }

  console.log("=== ESTIMATE PATH ===");
  try { await walkEstimate(browser); summary.walks.estimate = "ok"; } catch (e) { summary.walks.estimate = e.message; console.log("estimate ERROR:", e.message); }

  console.log("=== COMPARE PATH ===");
  try { await walkCompare(browser); summary.walks.compare = "ok"; } catch (e) { summary.walks.compare = e.message; console.log("compare ERROR:", e.message); }

  console.log("=== MOBILE ANALYZE ===");
  try { await walkAnalyzeMobile(browser); summary.walks.mobile = "ok"; } catch (e) { summary.walks.mobile = e.message; console.log("mobile ERROR:", e.message); }

  console.log("=== UNHAPPY: wrong-vertical ===");
  try { await walkAnalyzeUnhappy(browser); summary.walks.unhappy = "ok"; } catch (e) { summary.walks.unhappy = e.message; console.log("unhappy ERROR:", e.message); }

  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
  console.log("\nDone. Output:", OUT);
})();
