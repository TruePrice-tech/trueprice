// Concrete deep-dive walk: estimate (Lane's address) + analyze (real fixtures) + compare (3 fixtures)
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "concrete-walk-2026-04-27");
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
    if (/error|fail|verdict|TP_Engine|400|500/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function dumpResultText(page, name) {
  const txt = await page.evaluate(() => {
    const el = document.getElementById("concApp") || document.querySelector("main");
    return el ? (el.innerText || "").slice(0, 4000) : "(no concApp)";
  });
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── PATH 1: ESTIMATE — Lane's real address ────────────────────────
  {
    const page = await newPage(browser, "estimate");
    console.log("\n=== PATH 1: CONCRETE ESTIMATE — Lane (Fort Mill SC), 800sqft patio 4\" no-demo ===");
    await page.goto(`${BASE}/concrete-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
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
    await sleep(1200);
    await shot(page, "03-estimate-step1-project-type");

    // Step 1: concrete_patio
    await page.evaluate(() => { const o = document.querySelector('#optProject [data-val="concrete_patio"]'); if (o) o.click(); });
    await sleep(600);
    await shot(page, "04-estimate-step2-size");

    // Step 2: 800 sq ft
    await page.evaluate(() => { const o = document.querySelector('#optSize [data-val="800"]'); if (o) o.click(); });
    await sleep(600);
    await shot(page, "05-estimate-step3-thickness");

    // Step 3: 4 inch
    await page.evaluate(() => { const o = document.querySelector('#optThick [data-val="4"]'); if (o) o.click(); });
    await sleep(600);
    await shot(page, "06-estimate-step4-demolition");

    // Step 4: no
    await page.evaluate(() => { const o = document.querySelector('#optDemo [data-val="no"]'); if (o) o.click(); });
    await sleep(2000);
    await shot(page, "07-estimate-result-top");
    await shot(page, "08-estimate-result-full", true);
    await dumpResultText(page, "08-estimate-result");

    await page.close();
  }

  // ─── PATH 2: ANALYZE — real fixtures ──────────────────────────────
  const fixtures = [
    { id: "03", file: "03-2000-sqft-of-concrete-amp-800-sqft-of-turf.jpeg", note: "$20,400 unlicensed install 2000 sqft conc + 800 turf" },
    { id: "06", file: "06-quote-to-widen-driveway-pour-cement-pad-for-shed-p.png", note: "$12,636.56 multi-pour driveway/sidewalk/shed pad" },
    { id: "08", file: "08-new-concrete-or-mud-jack.jpeg", note: "image-only, no readable text" },
    { id: "09", file: "09-concrete-tupac-quote.jpg", note: "Tupac meme garbage" }
  ];

  for (const fx of fixtures) {
    const page = await newPage(browser, `analyze-${fx.id}`);
    console.log(`\n=== PATH 2.${fx.id}: ANALYZE — ${fx.note} ===`);
    await page.goto(`${BASE}/concrete-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    const fixture = path.join(ROOT, "test-quotes/concrete-images", fx.file);
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      console.log(`  [skip ${fx.id}] no file input found`);
      await shot(page, `analyze-${fx.id}-NOINPUT`, true);
      await page.close();
      continue;
    }
    await fileInput.uploadFile(fixture);
    console.log(`  uploaded: ${fx.file}`);

    // Wait for either result or error to render
    const start = Date.now();
    let got = false;
    while (Date.now() - start < 90000) {
      await sleep(1500);
      const seen = await page.evaluate(() => {
        const t = (document.getElementById("concApp")?.innerText || "");
        return t.includes("Quote Analysis") || t.includes("couldn") || t.includes("Verdict") || t.includes("manual");
      });
      if (seen) { got = true; break; }
    }
    await shot(page, `analyze-${fx.id}-result`, true);
    await dumpResultText(page, `analyze-${fx.id}-result`);
    if (!got) console.log(`  [${fx.id}] timed out waiting for result`);

    await page.close();
  }

  // ─── PATH 3: COMPARE — 3 comparison fixtures ────────────────────
  {
    const page = await newPage(browser, "compare");
    console.log("\n=== PATH 3: COMPARE — comparison-conc-low/mid/high ===");
    await page.goto(`${BASE}/compare-concrete-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "compare-01-landing");

    const cmpFiles = [
      "comparison-conc-low.png",
      "comparison-conc-mid.png",
      "comparison-conc-high.png"
    ];
    for (let i = 0; i < cmpFiles.length; i++) {
      const fixture = path.join(ROOT, "test-quotes/concrete-images", cmpFiles[i]);
      const inp = await page.$(`#file${i}`);
      if (!inp) { console.log(`  [skip] no #file${i}`); continue; }
      await inp.uploadFile(fixture);
      console.log(`  uploaded slot ${i}: ${cmpFiles[i]}`);
      await sleep(2500);
    }
    await shot(page, "compare-02-after-uploads", true);

    // Look for compare button + click
    const start = Date.now();
    let clicked = false;
    while (Date.now() - start < 30000) {
      const ok = await page.evaluate(() => {
        const btn = document.querySelector(".cmp-compare-btn, button[onclick*='compare'], #compareBtn");
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
