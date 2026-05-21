// Walk all 3 HVAC paths against the live site
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "hvac-walk-2026-04-27");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── PATH 1: ESTIMATE ──────────────────────────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("console", (m) => {
      const t = m.text();
      if (/error|400|fail|TP_Engine/i.test(t)) console.log("  [console]", m.type(), t.substring(0, 220));
    });
    page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

    console.log("\n=== PATH 1: HVAC ESTIMATE (Lane's address, heat pump) ===");
    await page.goto(`${BASE}/hvac-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "01-estimate-landing");

    await page.waitForSelector("#addrStreet", { timeout: 10000 });
    await page.type("#addrStreet", "17064 Laurelmont Ct", { delay: 30 });
    await sleep(500);
    await page.evaluate(() => {
      const sug = document.getElementById("addrSuggestions");
      if (sug) sug.style.display = "none";
      document.getElementById("addrCity").value = "Fort Mill";
      document.getElementById("addrState").value = "SC";
      document.getElementById("addrZip").value = "29707";
    });
    await shot(page, "02-estimate-address-filled");
    await page.click("#btnEstimate");
    await sleep(800);

    // Step 1: Heat Pump
    await page.evaluate(() => { const o = document.querySelector('#optSystem [data-val="heat_pump"]'); if (o) o.click(); });
    await sleep(500);
    await shot(page, "03-estimate-step2-efficiency");
    // Step 2: 16 SEER
    await page.evaluate(() => { const o = document.querySelector('#optEff [data-val="16"]'); if (o) o.click(); });
    await sleep(800);
    await shot(page, "04-estimate-step3-home");
    // Step 3: Wait for OSM or just enter sqft manually
    await sleep(2000);
    // Try to reveal manual entry if home-type cards rendered
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

  // ─── PATH 2: ANALYZE — fixture 04 (clear typed quote) ───────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("console", (m) => {
      const t = m.text();
      if (/error|400|fail|TP_Engine/i.test(t)) console.log("  [console]", m.type(), t.substring(0, 220));
    });
    page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

    console.log("\n=== PATH 2: HVAC ANALYZE (real Reddit fixture 04) ===");
    await page.goto(`${BASE}/hvac-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "20-analyze-landing");

    const fixture = path.join(ROOT, "test-quotes/hvac-images/04-is-this-reasonable.jpeg");
    await (await page.$('input[type="file"]')).uploadFile(fixture);
    console.log("  uploaded:", path.basename(fixture));

    // Wait for confirm step
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
    await shot(page, "21-analyze-confirm-step");

    if (confirmReady) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
        if (target) target.click();
      });
      console.log("  clicked confirm");
      // Wait for verdict to render
      const start2 = Date.now();
      let done = false;
      while (Date.now() - start2 < 90000) {
        await sleep(2500);
        done = await page.evaluate(() => {
          const txt = document.body.innerText;
          // Look for hvac verdict patterns specifically (avoid false positives from SEO content)
          const inVerdictBox = !!document.querySelector('[class*="-verdict"]');
          const hasVerdict = inVerdictBox && /(Fair Price|Above Average|Higher Than Expected|Below Average|Overpriced|Unusually Low|Needs Review|Estimated Cost)/i.test(txt);
          return hasVerdict;
        });
        if (done) break;
      }
      console.log("  analysis rendered:", done, "after", Math.round((Date.now() - start2) / 1000) + "s");
      await sleep(1500);
      await shot(page, "22-analyze-result-top");
      await shot(page, "23-analyze-result-full", true);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(600);
      await shot(page, "24-analyze-result-bottom");
    }
    await page.close();
  }

  // ─── PATH 3: COMPARE — synthetic 3-AC set ──────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("console", (m) => {
      const t = m.text();
      if (/error|400|fail|TP_Engine|verdict/i.test(t)) console.log("  [console]", m.type(), t.substring(0, 220));
    });
    page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

    console.log("\n=== PATH 3: HVAC COMPARE (3 fixtures) ===");
    await page.goto(`${BASE}/compare-hvac-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "30-compare-landing", true);

    const fixtures = [
      path.join(ROOT, "test-quotes/hvac-images/comparison-ac-01-low.png"),
      path.join(ROOT, "test-quotes/hvac-images/comparison-ac-02-mid.png"),
      path.join(ROOT, "test-quotes/hvac-images/comparison-ac-03-high.png"),
    ];
    const fileInputs = await page.$$('input[type="file"]');
    console.log("  found inputs:", fileInputs.length);
    for (let i = 0; i < Math.min(fixtures.length, fileInputs.length); i++) {
      await fileInputs[i].uploadFile(fixtures[i]);
      console.log("  upload", i, ":", path.basename(fixtures[i]));
      await sleep(700);
    }

    // Wait for "Compare 3 quotes" button
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
    console.log("  Compare-3-quotes button ready:", buttonReady, "after", Math.round((Date.now() - start1) / 1000) + "s");

    if (buttonReady) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /^Compare\s+3\s+quotes?/i.test((b.textContent || "").trim()));
        if (target) target.click();
      });
      console.log("  clicked compare");
      await sleep(4000);
      await shot(page, "32-compare-result-top");
      await shot(page, "33-compare-result-full", true);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(600);
      await shot(page, "34-compare-result-bottom");
    }
    await page.close();
  }

  await browser.close();
  console.log("\nDONE. Output:", OUT);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
