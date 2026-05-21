// Real-quote walk: 4 actual Reddit fixtures + Lane's address for estimate.
// Stubs /api/geocode-suggest so autocomplete dropdown can't intercept clicks.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "hvac-walk-real-2026-04-27");
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
  // Stub geocode-suggest so it never returns suggestions (no dropdown to intercept clicks)
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
    if (/error|fail|TP_Engine|400|verdict/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── PATH 1: ESTIMATE — Lane's real address ────────────────────────
  {
    const page = await newPage(browser, "estimate");
    console.log("\n=== PATH 1: HVAC ESTIMATE — Lane's real address (Fort Mill SC) ===");
    await page.goto(`${BASE}/hvac-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "01-estimate-landing");

    // Set values directly without typing (avoids triggering autocomplete)
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
    await shot(page, "03a-after-click-btnEstimate");

    // Step 1: Heat Pump
    await page.evaluate(() => { const o = document.querySelector('#optSystem [data-val="heat_pump"]'); if (o) o.click(); });
    await sleep(600);
    await shot(page, "03-estimate-step2-efficiency");
    // Step 2: 16 SEER
    await page.evaluate(() => { const o = document.querySelector('#optEff [data-val="16"]'); if (o) o.click(); });
    await sleep(1500);
    await shot(page, "04-estimate-step3-home");
    // Step 3: Wait for OSM, then manual entry
    await sleep(2000);
    await page.evaluate(() => {
      const link = document.getElementById("manualSqftLink");
      if (link) link.click();
    });
    await sleep(500);
    // Set sqft 2000
    await page.evaluate(() => {
      const sq = document.getElementById("sqftInput");
      if (sq) { sq.value = "2000"; sq.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await sleep(300);
    await page.evaluate(() => { const b = document.getElementById("sqftNext"); if (b) b.click(); });
    await sleep(800);
    await shot(page, "05-estimate-step4-duct");
    // Step 4: ductwork good
    await page.evaluate(() => { const o = document.querySelector('#optDuct [data-val="good"]'); if (o) o.click(); });
    await sleep(500);
    await shot(page, "06-estimate-step5-urgency");
    // Step 5: this_season
    await page.evaluate(() => { const o = document.querySelector('#optUrg [data-val="this_season"]'); if (o) o.click(); });
    await sleep(2500);
    await shot(page, "07-estimate-result-top");
    await shot(page, "08-estimate-result-full", true);

    await page.close();
  }

  // ─── PATH 2: ANALYZE — 4 real fixtures ──────────────────────────────
  const fixtures = [
    { id: "04", file: "04-is-this-reasonable.jpeg", note: "$610 R-22 service" },
    { id: "07", file: "07-had-a-leak-in-the-coil-of-my-air-handler-is-this-r.jpeg", note: "$3,810 coil swap" },
    { id: "09", file: "09-every-quote-10-total-ive-gotten-for-a-heat-pump-in.png", note: "10-quote table" },
    { id: "10", file: "10-8k-for-mitsubishi-mini-split-leak-detection-just-t.png", note: "$7,543 mini-split leak" }
  ];

  for (const fx of fixtures) {
    const page = await newPage(browser, `analyze-${fx.id}`);
    console.log(`\n=== PATH 2.${fx.id}: ANALYZE — ${fx.note} ===`);
    await page.goto(`${BASE}/hvac-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    const fixture = path.join(ROOT, "test-quotes/hvac-images", fx.file);
    await (await page.$('input[type="file"]')).uploadFile(fixture);
    console.log("  uploaded:", fx.file);

    const start1 = Date.now();
    let confirmReady = false;
    while (Date.now() - start1 < 90000) {
      await sleep(2000);
      confirmReady = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
        return !!(target && !target.disabled && target.offsetParent !== null);
      });
      if (confirmReady) break;
    }
    console.log("  confirm ready:", confirmReady, "after", Math.round((Date.now() - start1) / 1000) + "s");
    await shot(page, `${fx.id}-21-confirm-step`);
    // Capture the displayed price on the confirm step
    const confirmText = await page.evaluate(() => document.body.innerText.substring(0, 800));
    console.log("  confirm text snippet:", confirmText.replace(/\n+/g, " | ").substring(0, 200));

    if (confirmReady) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
        if (target) target.click();
      });
      const start2 = Date.now();
      let done = false;
      while (Date.now() - start2 < 90000) {
        await sleep(2500);
        done = await page.evaluate(() => {
          const txt = document.body.innerText;
          const inVerdictBox = !!document.querySelector('[class*="-verdict"]');
          const hasVerdict = inVerdictBox && /(Fair Price|Above Average|Higher Than Expected|Below Average|Overpriced|Unusually Low|Service Quote|Needs Review|Estimated Cost)/i.test(txt);
          return hasVerdict;
        });
        if (done) break;
      }
      console.log("  rendered:", done, "after", Math.round((Date.now() - start2) / 1000) + "s");
      await sleep(1500);
      await shot(page, `${fx.id}-22-result-top`);
      await shot(page, `${fx.id}-23-result-full`, true);
    }
    await page.close();
  }

  // ─── PATH 3: COMPARE — synthetic 3-AC set (no real triplets locally) ──
  {
    const page = await newPage(browser, "compare");
    console.log("\n=== PATH 3: COMPARE (synthetic 3 AC fixtures — real triplets unavailable) ===");
    await page.goto(`${BASE}/compare-hvac-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);

    const cmpFixtures = [
      "comparison-ac-01-low.png",
      "comparison-ac-02-mid.png",
      "comparison-ac-03-high.png"
    ];
    const fileInputs = await page.$$('input[type="file"]');
    for (let i = 0; i < Math.min(cmpFixtures.length, fileInputs.length); i++) {
      await fileInputs[i].uploadFile(path.join(ROOT, "test-quotes/hvac-images", cmpFixtures[i]));
      await sleep(700);
    }

    const start1 = Date.now();
    let buttonReady = false;
    while (Date.now() - start1 < 120000) {
      await sleep(2000);
      buttonReady = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /^Compare\s+3\s+quotes?/i.test((b.textContent || "").trim()));
        return !!(target && !target.disabled && target.offsetParent !== null);
      });
      if (buttonReady) break;
    }
    console.log("  Compare button ready:", buttonReady);
    if (buttonReady) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /^Compare\s+3\s+quotes?/i.test((b.textContent || "").trim()));
        if (target) target.click();
      });
      await sleep(4000);
      await shot(page, "30-compare-result-top");
      await shot(page, "31-compare-result-full", true);
    }
    await page.close();
  }

  await browser.close();
  console.log("\nDONE. Output:", OUT);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
