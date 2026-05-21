// Garage door deep-dive walk: estimate (Lane's SC address, multiple permutations) +
// analyze (real-02 + mock-01) + compare (low/mid/high triplet) + mobile viewport.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "garage-door-walk-2026-04-27");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function newPage(browser, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36");
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });
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
    if (/error|fail|verdict|TP_Engine|400|500/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function dumpResultText(page, name) {
  const txt = await page.evaluate(() => {
    const el = document.getElementById("gdApp") || document.querySelector("main");
    return el ? (el.innerText || "").slice(0, 6000) : "(no gdApp)";
  });
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

async function fillAddressAndStart(page) {
  await page.waitForSelector("#addrStreet", { timeout: 15000 });
  await page.evaluate(() => {
    document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
    document.getElementById("addrCity").value = "Fort Mill";
    document.getElementById("addrState").value = "SC";
    document.getElementById("addrZip").value = "29707";
  });
  await sleep(300);
  await page.click("#btnEstimate");
  await sleep(1500);
}

async function pickOption(page, containerId, val) {
  const ok = await page.evaluate((cid, v) => {
    const o = document.querySelector(`#${cid} [data-val="${v}"]`);
    if (o) { o.click(); return true; }
    return false;
  }, containerId, val);
  if (!ok) console.log(`  [pick] could not click ${containerId} ${val}`);
  await sleep(700);
}

async function runEstimateWalk(browser, label, picks) {
  const page = await newPage(browser, label);
  console.log(`\n=== ESTIMATE: ${label} ===`);
  await page.goto(`${BASE}/garage-door-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1500);
  await shot(page, `${label}-01-landing`);
  await fillAddressAndStart(page);
  await shot(page, `${label}-02-step1-service`);

  await pickOption(page, "optService", picks.serviceType);
  await sleep(800);

  // For door types, pick material then opener
  if (picks.serviceType !== "opener_only" && picks.serviceType !== "spring_replacement") {
    await shot(page, `${label}-03-step2-material`);
    await pickOption(page, "optMaterial", picks.material);
    await sleep(800);
    await shot(page, `${label}-04-step3-opener`);
    await pickOption(page, "optOpener", picks.opener);
  }

  await sleep(2500);
  await shot(page, `${label}-05-result-top`);
  await shot(page, `${label}-06-result-full`, true);
  await dumpResultText(page, `${label}-06-result`);
  await page.close();
}

async function uploadAndAnalyze(browser, label, fixtureFile) {
  const page = await newPage(browser, label);
  console.log(`\n=== ANALYZE: ${label} (${fixtureFile}) ===`);
  await page.goto(`${BASE}/garage-door-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);
  await shot(page, `${label}-01-landing`);

  // Set address first
  await page.evaluate(() => {
    if (document.getElementById("addrStreet")) {
      document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
      document.getElementById("addrCity").value = "Fort Mill";
      document.getElementById("addrState").value = "SC";
      document.getElementById("addrZip").value = "29707";
    }
  });

  // Find file input - might be uploadZone or a fileInput
  const filePath = path.join(ROOT, "test-quotes", "garage-door-images", fixtureFile);
  if (!fs.existsSync(filePath)) {
    console.log(`  [skip] fixture missing: ${filePath}`);
    await page.close();
    return;
  }

  // Wait for upload zone & file input to render
  await page.waitForFunction(() => !!document.querySelector('input[type="file"]'), { timeout: 15000 });
  const inputHandle = await page.$('input[type="file"]');
  if (!inputHandle) {
    console.log(`  [error] no file input found`);
    await page.close();
    return;
  }
  await inputHandle.uploadFile(filePath);
  console.log(`  uploaded fixture: ${fixtureFile}`);
  await sleep(2000);
  await shot(page, `${label}-02-uploading`);

  // Wait until result step or price-confirmation prompt
  let waited = 0;
  while (waited < 90000) {
    const phase = await page.evaluate(() => {
      const el = document.getElementById("gdApp");
      const text = el ? (el.innerText || "") : "";
      if (text.includes("Verdict") || text.includes("Quote Total") || text.includes("Below Average") || text.includes("Above Average") || text.includes("Fair Price") || text.includes("Overpriced") || text.includes("Unusually Low")) return "result";
      if (text.includes("does this price look right") || text.includes("Confirm this price") || text.includes("Is this the total")) return "confirm";
      if (text.includes("couldn't read")) return "error";
      return "loading";
    });
    if (phase === "result" || phase === "error") break;
    if (phase === "confirm") {
      await shot(page, `${label}-03-price-confirm`);
      // Click confirm
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const confirm = btns.find(b => /confirm|yes|looks right|continue|use this/i.test(b.innerText || ""));
        if (confirm) confirm.click();
      });
      await sleep(1500);
    }
    await sleep(1500);
    waited += 1500;
  }
  await sleep(1500);
  await shot(page, `${label}-04-result-top`);
  await shot(page, `${label}-05-result-full`, true);
  await dumpResultText(page, `${label}-05-result`);
  await page.close();
}

async function runCompareWalk(browser, label, files) {
  const page = await newPage(browser, label);
  console.log(`\n=== COMPARE: ${label} (${files.length} files) ===`);
  await page.goto(`${BASE}/compare-garage-door-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);
  await shot(page, `${label}-01-landing`);

  for (let i = 0; i < files.length; i++) {
    const fp = path.join(ROOT, "test-quotes", "garage-door-images", files[i]);
    if (!fs.existsSync(fp)) { console.log(`  missing: ${fp}`); continue; }
    const inputHandle = await page.$(`#file${i}`);
    if (!inputHandle) { console.log(`  no #file${i}`); continue; }
    await inputHandle.uploadFile(fp);
    console.log(`  uploaded slot ${i}: ${files[i]}`);
    await sleep(500);
  }

  // Wait for parsing to complete
  let waited = 0;
  while (waited < 120000) {
    const ready = await page.evaluate(() => {
      const b = document.getElementById("compareBtn");
      return b && !b.disabled;
    });
    if (ready) break;
    await sleep(1500);
    waited += 1500;
  }
  await shot(page, `${label}-02-parsed`);
  await page.click("#compareBtn");
  await sleep(3500);
  await shot(page, `${label}-03-results-top`);
  await shot(page, `${label}-04-results-full`, true);
  const resultsText = await page.evaluate(() => {
    const el = document.getElementById("resultsContent");
    return el ? (el.innerText || "").slice(0, 7000) : "(no resultsContent)";
  });
  fs.writeFileSync(path.join(OUT, `${label}-04-results.txt`), resultsText);
  await page.close();
}

async function mobileEstimateWalk(browser) {
  const page = await browser.newPage();
  console.log(`\n=== MOBILE ESTIMATE ===`);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else {
      req.continue();
    }
  });
  await page.goto(`${BASE}/garage-door-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);
  await shot(page, `mobile-01-landing`);
  await page.evaluate(() => {
    document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
    document.getElementById("addrCity").value = "Fort Mill";
    document.getElementById("addrState").value = "SC";
    document.getElementById("addrZip").value = "29707";
  });
  await page.click("#btnEstimate");
  await sleep(1500);
  await shot(page, `mobile-02-step1`);
  await pickOption(page, "optService", "double_car");
  await sleep(800);
  await shot(page, `mobile-03-step2`);
  await pickOption(page, "optMaterial", "steel_insulated");
  await sleep(800);
  await pickOption(page, "optOpener", "yes");
  await sleep(2500);
  await shot(page, `mobile-04-result-top`);
  await shot(page, `mobile-05-result-full`, true);
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process"
    ]
  });

  // ─── ESTIMATE PATH — 6 permutations ────────────────────────
  // 1. Baseline: single car steel basic + opener
  await runEstimateWalk(browser, "estimate-single-basic", {
    serviceType: "single_car", material: "steel_basic", opener: "yes"
  });
  // 2. Common: double car insulated steel + opener
  await runEstimateWalk(browser, "estimate-double-insulated", {
    serviceType: "double_car", material: "steel_insulated", opener: "yes"
  });
  // 3. Premium: custom carriage composite + opener
  await runEstimateWalk(browser, "estimate-carriage-composite", {
    serviceType: "custom_carriage", material: "composite", opener: "yes"
  });
  // 4. Door only: double wood, no opener
  await runEstimateWalk(browser, "estimate-double-wood-noopener", {
    serviceType: "double_car", material: "wood", opener: "no"
  });
  // 5. Opener only (skips material + opener Q's)
  await runEstimateWalk(browser, "estimate-opener-only", {
    serviceType: "opener_only"
  });
  // 6. Spring replacement (skips material + opener Q's)
  await runEstimateWalk(browser, "estimate-spring", {
    serviceType: "spring_replacement"
  });

  // ─── ANALYZE PATH ──────────────────────────────────
  // real-02: ~$3,431 Hormann 16x7 insulated + LiftMaster smart belt
  await uploadAndAnalyze(browser, "analyze-real02-hormann", "real-02-is-this-a-good-deal.jpeg");
  // mock-01: $3,599 ProDoor Clopay Premium carriage + LiftMaster belt
  await uploadAndAnalyze(browser, "analyze-mock01-prodoor", "mock-01.png");

  // ─── COMPARE PATH ──────────────────────────────────
  await runCompareWalk(browser, "compare-low-mid-high", [
    "comparison-garage-low.png",
    "comparison-garage-mid.png",
    "comparison-garage-high.png"
  ]);

  // ─── MOBILE VIEWPORT ───────────────────────────────
  await mobileEstimateWalk(browser);

  await browser.close();
  console.log(`\nAll walks complete. Output: ${OUT}`);
})();
