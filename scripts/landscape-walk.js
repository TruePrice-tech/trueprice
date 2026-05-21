// Landscaping deep-dive walk: estimate (Lane's address) + analyze (4 real fixtures) + compare (3 synthetic)
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "landscape-walk-2026-04-27");
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
    if (/error|fail|verdict|TP_Engine|400|500|expectedRange|jobType|squareFootage|redFlag/i.test(t)) {
      console.log(`  [${label} console]`, m.type(), t.substring(0, 280));
    }
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function dumpResultText(page, name) {
  const txt = await page.evaluate(() => {
    const el = document.getElementById("landApp") || document.querySelector("main");
    return el ? (el.innerText || "").slice(0, 6000) : "(no landApp)";
  });
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── PATH 1: ESTIMATE — Lane's address, paver patio scenario ───
  {
    const page = await newPage(browser, "estimate");
    console.log("\n=== PATH 1: LANDSCAPING ESTIMATE — Lane (Fort Mill SC), paver_patio 400sf mid moderate ===");
    await page.goto(`${BASE}/landscaping-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "01-estimate-landing");

    await page.waitForSelector("#addrStreet", { timeout: 10000 });
    await page.evaluate(() => {
      document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
      document.getElementById("addrCity").value = "Fort Mill";
      document.getElementById("addrState").value = "SC";
      document.getElementById("addrZip").value = "29707";
    });
    await sleep(300);
    await shot(page, "02-estimate-address-filled");

    await page.click("#btnEstimate");
    await sleep(1500);
    await shot(page, "03-estimate-step1-projectType");

    // Step 1: paver_patio
    await page.evaluate(() => { const o = document.querySelector('#optProject [data-val="paver_patio"]'); if (o) o.click(); });
    await sleep(800);
    await shot(page, "04-estimate-step2-size");

    // Step 2: enter 400 sq ft
    await page.evaluate(() => {
      const inp = document.getElementById("sizeInput");
      if (inp) { inp.value = "400"; inp.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await sleep(300);
    await page.click("#sizeNext");
    await sleep(800);
    await shot(page, "05-estimate-step3-quality");

    // Step 3: mid quality
    await page.evaluate(() => { const o = document.querySelector('#optQualityTier [data-val="mid"]'); if (o) o.click(); });
    await sleep(800);
    await shot(page, "06-estimate-step4-complexity");

    // Step 4: moderate
    await page.evaluate(() => { const o = document.querySelector('#optComplexity [data-val="moderate"]'); if (o) o.click(); });
    await sleep(2500);
    await shot(page, "07-estimate-result-top");
    await shot(page, "08-estimate-result-full", true);
    await dumpResultText(page, "08-estimate-result");

    await page.close();
  }

  // ─── PATH 1b: ESTIMATE — sod scenario ────────────────────────
  {
    const page = await newPage(browser, "estimate-sod");
    console.log("\n=== PATH 1b: LANDSCAPING ESTIMATE — sod_installation 1200 sf budget basic ===");
    await page.goto(`${BASE}/landscaping-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await page.waitForSelector("#addrStreet", { timeout: 10000 });
    await page.evaluate(() => {
      document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
      document.getElementById("addrCity").value = "Fort Mill";
      document.getElementById("addrState").value = "SC";
      document.getElementById("addrZip").value = "29707";
    });
    await page.click("#btnEstimate");
    await sleep(1500);

    await page.evaluate(() => { const o = document.querySelector('#optProject [data-val="sod_installation"]'); if (o) o.click(); });
    await sleep(800);
    await page.evaluate(() => {
      const inp = document.getElementById("sizeInput");
      if (inp) { inp.value = "1200"; inp.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await page.click("#sizeNext");
    await sleep(800);
    await page.evaluate(() => { const o = document.querySelector('#optQualityTier [data-val="budget"]'); if (o) o.click(); });
    await sleep(800);
    await page.evaluate(() => { const o = document.querySelector('#optComplexity [data-val="basic"]'); if (o) o.click(); });
    await sleep(2500);
    await shot(page, "1b-sod-result", true);
    await dumpResultText(page, "1b-sod-result");
    await page.close();
  }

  // ─── PATH 1c: ESTIMATE — project-type unit (irrigation_system, auto-skips size) ──
  {
    const page = await newPage(browser, "estimate-irrigation");
    console.log("\n=== PATH 1c: LANDSCAPING ESTIMATE — irrigation_system (project unit, size auto-skip) ===");
    await page.goto(`${BASE}/landscaping-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await page.waitForSelector("#addrStreet", { timeout: 10000 });
    await page.evaluate(() => {
      document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
      document.getElementById("addrCity").value = "Fort Mill";
      document.getElementById("addrState").value = "SC";
      document.getElementById("addrZip").value = "29707";
    });
    await page.click("#btnEstimate");
    await sleep(1500);

    await page.evaluate(() => { const o = document.querySelector('#optProject [data-val="irrigation_system"]'); if (o) o.click(); });
    await sleep(1500);
    await shot(page, "1c-irrigation-after-projType", true);
    await page.evaluate(() => { const o = document.querySelector('#optQualityTier [data-val="mid"]'); if (o) o.click(); });
    await sleep(800);
    await page.evaluate(() => { const o = document.querySelector('#optComplexity [data-val="moderate"]'); if (o) o.click(); });
    await sleep(2500);
    await shot(page, "1c-irrigation-result", true);
    await dumpResultText(page, "1c-irrigation-result");
    await page.close();
  }

  // ─── PATH 2: ANALYZE — real fixtures ──────────────────────────
  const fixtures = [
    { id: "04", file: "04-backyard-project-is-this-a-reasonable-contractor-q.png", note: "$54,300 mixed remodel: paver+wall+bocce+sidewalk+gas+grading" },
    { id: "05", file: "05-landscaping-quote-help.jpeg", note: "$67,570.34 NC turf+drip+paths, materials $25,927 + labour $41,642" },
    { id: "09", file: "09-is-this-quote-to-re-do-the-landscape-lighting-arou.png", note: "$9,275.93 WAOL lighting 25 fixtures, 50% deposit (red flag)" },
    { id: "10", file: "10-thoughts-on-this-quote-from-our-lawn-company.jpeg", note: "$2,915 Tifway 419 Bermuda sod 856 sqft + topsoil" }
  ];

  for (const fx of fixtures) {
    const page = await newPage(browser, `analyze-${fx.id}`);
    console.log(`\n=== PATH 2.${fx.id}: ANALYZE — ${fx.note} ===`);
    await page.goto(`${BASE}/landscaping-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    const fixture = path.join(ROOT, "test-quotes/landscaping-test-images", fx.file);
    if (!fs.existsSync(fixture)) {
      console.log(`  [skip ${fx.id}] fixture missing: ${fixture}`);
      await page.close();
      continue;
    }
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      console.log(`  [skip ${fx.id}] no file input found`);
      await shot(page, `analyze-${fx.id}-NOINPUT`, true);
      await page.close();
      continue;
    }
    await fileInput.uploadFile(fixture);
    console.log(`  uploaded: ${fx.file}`);

    // Stage 1: wait for price-confirm modal OR error fallback
    const start = Date.now();
    let confirmed = false;
    while (Date.now() - start < 180000) {
      await sleep(1500);
      const phase = await page.evaluate(() => {
        const btn = document.getElementById("tpConfirmPriceBtn");
        const t = (document.getElementById("landApp")?.innerText || "");
        if (btn && !btn.disabled) { btn.click(); return "clicked"; }
        if (/couldn|enter the quote|Verdict|Quote Analysis/i.test(t)) return "result";
        return "wait";
      });
      if (phase === "clicked") { confirmed = true; console.log(`  [${fx.id}] confirmed price`); break; }
      if (phase === "result") { console.log(`  [${fx.id}] reached result without confirm`); break; }
    }
    if (confirmed) await sleep(2500);
    await shot(page, `analyze-${fx.id}-result`, true);
    await dumpResultText(page, `analyze-${fx.id}-result`);
    if (!confirmed && Date.now() - start >= 180000) console.log(`  [${fx.id}] timed out`);

    await page.close();
  }

  // ─── PATH 3: COMPARE — 3 comparison fixtures ────────────────────
  {
    const page = await newPage(browser, "compare");
    console.log("\n=== PATH 3: COMPARE — comparison-land-low/mid/high ===");
    await page.goto(`${BASE}/compare-landscaping-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "compare-01-landing");

    const cmpFiles = [
      "comparison-land-low.png",
      "comparison-land-mid.png",
      "comparison-land-high.png"
    ];
    for (let i = 0; i < cmpFiles.length; i++) {
      const fixture = path.join(ROOT, "test-quotes/landscaping-images", cmpFiles[i]);
      if (!fs.existsSync(fixture)) { console.log(`  [skip] missing ${cmpFiles[i]}`); continue; }
      const inp = await page.$(`#file${i}`);
      if (!inp) { console.log(`  [skip] no #file${i}`); continue; }
      await inp.uploadFile(fixture);
      console.log(`  uploaded slot ${i}: ${cmpFiles[i]}`);
      await sleep(2500);
    }
    await shot(page, "compare-02-after-uploads", true);

    // Wait until all three slots are parsed before clicking
    const start = Date.now();
    let clicked = false;
    while (Date.now() - start < 60000) {
      const ok = await page.evaluate(() => {
        const btn = document.getElementById("compareBtn");
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });
      if (ok) { clicked = true; break; }
      await sleep(1000);
    }
    if (clicked) {
      console.log("  clicked compare button");
      await sleep(8000);
    } else {
      console.log("  could not find/click compare button");
    }
    await shot(page, "compare-03-results", true);
    await dumpResultText(page, "compare-03-results");
    await page.close();
  }

  await browser.close();
  console.log("\nDONE — output:", OUT);
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
