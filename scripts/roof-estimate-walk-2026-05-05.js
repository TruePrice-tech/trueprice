// One-shot estimate walk for roofing deep test 2026-05-05.
// Replaces stale option values from scripts/roof-deep-2026-05-04.js (workType
// "replace"→"replacement", added required season + ownership groups, fixed
// propertyType values).
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "output", "roof-deep-test-2026-05-05");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else {
      req.continue();
    }
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|verdict|undefined/i.test(t) && !/font|sourcemap|favicon/i.test(t)) {
      console.log("  [console]", m.type(), t.substring(0, 240));
    }
  });
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  page.setDefaultTimeout(120000);

  console.log("=== ESTIMATE: Fort Mill SC, 2200 sqft, architectural ===");
  await page.goto(BASE + "/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "networkidle2" });
  await sleep(3000);
  await page.screenshot({ path: path.join(OUT, "est-01-form.png"), fullPage: true });

  // Address step
  await page.evaluate(() => {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    setVal("journeyStreetAddress", "17064 Laurelmont Ct");
    setVal("journeyCity", "Fort Mill");
    setVal("journeyState", "SC");
    setVal("journeyZipCode", "29707");
  });
  await sleep(800);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const t = btns.find(b => /get my estimate|continue|next/i.test((b.textContent || "").trim()));
    if (t) t.click();
  });
  await sleep(4000);
  await page.screenshot({ path: path.join(OUT, "est-02-after-addr.png"), fullPage: true });

  // Pick all required options (correct names per js/analyzer-ui.js renderEstimatorStep)
  await page.evaluate(() => {
    const click = (group, value) => {
      const btn = document.querySelector(`button.est-option[data-group="${group}"][data-value="${value}"]`);
      if (btn) { btn.click(); return true; }
      return false;
    };
    const log = [];
    log.push(["workType", "replacement", click("workType", "replacement")]);
    log.push(["season", "fall", click("season", "fall")]);
    log.push(["material", "architectural", click("material", "architectural")]);
    log.push(["steepness", "normal", click("steepness", "normal")]);
    log.push(["complexity", "normal", click("complexity", "normal")]);
    log.push(["insurance", "no", click("insurance", "no")]);
    log.push(["propertyType", "single", click("propertyType", "single")]);
    log.push(["ownership", "yes", click("ownership", "yes")]);
    const sz = document.getElementById("estHomeSize");
    if (sz) { sz.value = "2200"; sz.dispatchEvent(new Event("input", { bubbles: true })); }
    window.__estClickLog = log;
  });
  await sleep(1500);
  const clickLog = await page.evaluate(() => window.__estClickLog);
  console.log("  click results:", JSON.stringify(clickLog));
  await page.screenshot({ path: path.join(OUT, "est-03-filled.png"), fullPage: true });

  await page.evaluate(() => { const b = document.getElementById("estSubmitBtn"); if (b) b.click(); });
  await sleep(10000);
  await page.screenshot({ path: path.join(OUT, "est-04-result.png"), fullPage: true });

  const result = await page.evaluate(() => ({
    text: document.body.innerText,
    estimatorAnswers: window.journeyState?.estimatorAnswers || null,
    osmHomeSize: window.journeyState?.osmHomeSize || null,
    pageStep: window.journeyState?.step || null,
  }));
  fs.writeFileSync(path.join(OUT, "est-result.txt"), result.text);
  fs.writeFileSync(path.join(OUT, "est-state.json"), JSON.stringify({ estimatorAnswers: result.estimatorAnswers, osmHomeSize: result.osmHomeSize, pageStep: result.pageStep }, null, 2));
  console.log("\n  estimatorAnswers:", JSON.stringify(result.estimatorAnswers));
  console.log("  osmHomeSize:", result.osmHomeSize);
  console.log("  step:", result.pageStep);

  // Pull dollar-amount tokens out of the result text
  const m = result.text.match(/\$[\d,]+(?:\.\d+)?\s*(?:[—\-–to]+\s*\$[\d,]+)?/g);
  console.log("  prices in text (first 12):", (m || []).slice(0, 12));

  await browser.close();
  console.log("\nDone:", OUT);
})();
