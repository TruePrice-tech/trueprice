// Walk all 3 plumbing paths against the live site
// Estimate: real address  |  Analyze: real Reddit fixture  |  Compare: 3 fixtures
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "plumb-walk-2026-04-26");
const BASE = process.env.BASE || "https://woogoro.com";

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name, full = false) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ─── PATH 1: ESTIMATE ──────────────────────────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("console", (m) => console.log("  [console]", m.type(), m.text().substring(0, 200)));
    page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

    console.log("\n=== PATH 1: ESTIMATE ===");
    await page.goto(`${BASE}/plumbing-estimate.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "01-estimate-landing");

    // Type the address fields
    const street = "17064 Laurelmont Ct";
    const city = "Fort Mill";
    const stateCode = "SC";
    const zip = "29707";

    await page.waitForSelector("#addrStreet", { timeout: 10000 });
    await page.type("#addrStreet", street, { delay: 30 });
    await sleep(500);
    await shot(page, "02-estimate-street-typed");
    // Fill remaining fields directly (skip autocomplete picker to keep test deterministic)
    await page.evaluate((c, s, z) => {
      document.getElementById("addrSuggestions").style.display = "none";
      document.getElementById("addrCity").value = c;
      document.getElementById("addrState").value = s;
      document.getElementById("addrZip").value = z;
    }, city, stateCode, zip);
    await shot(page, "03-estimate-address-filled");

    await page.click("#btnEstimate");
    await sleep(800);
    await shot(page, "04-estimate-step1-service");

    // Step 1: pick water heater
    await page.evaluate(() => {
      const opt = document.querySelector('#optService [data-val="water_heater"]');
      if (opt) opt.click();
    });
    await sleep(500);
    await shot(page, "05-estimate-step2-subtype");

    // Step 2: pick tank_50_gas
    await page.evaluate(() => {
      const opt = document.querySelector('#optSubType [data-val="tank_50_gas"]');
      if (opt) opt.click();
    });
    await sleep(500);
    await shot(page, "06-estimate-step3-location");

    // Step 3: pick garage
    await page.evaluate(() => {
      const opt = document.querySelector('#optLocation [data-val="garage"]');
      if (opt) opt.click();
    });
    await sleep(500);
    await shot(page, "07-estimate-step4-urgency");

    // Step 4: pick this_season
    await page.evaluate(() => {
      const opt = document.querySelector('#optUrg [data-val="this_season"]');
      if (opt) opt.click();
    });
    await sleep(2500); // wait for cityMult fetch + render
    await shot(page, "08-estimate-result-top");
    await shot(page, "09-estimate-result-full", true);

    // Scroll to bottom to see footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(800);
    await shot(page, "10-estimate-result-bottom");

    // Mobile shot of result
    await page.setViewport({ width: 390, height: 844 });
    await sleep(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);
    await shot(page, "11-estimate-result-mobile-full", true);

    await page.close();
  }

  // ─── PATH 2: ANALYZE ──────────────────────────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("console", (m) => console.log("  [console]", m.type(), m.text().substring(0, 200)));
    page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

    console.log("\n=== PATH 2: ANALYZE (real Reddit fixture) ===");
    await page.goto(`${BASE}/plumbing-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "20-analyze-landing", true);

    // Find the file input. Most analyzer pages use a hidden file input with id like "fileInput" or similar.
    const fixturePath = path.join(ROOT, "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg");
    if (!fs.existsSync(fixturePath)) {
      console.log("  ERROR: fixture not found:", fixturePath);
    } else {
      // Find all file inputs and pick the first
      const fileInputHandle = await page.$('input[type="file"]');
      if (fileInputHandle) {
        await fileInputHandle.uploadFile(fixturePath);
        console.log("  uploaded fixture:", path.basename(fixturePath));
        await sleep(2000);
        await shot(page, "21-analyze-uploading");
        // Wait up to 60s for result
        const start = Date.now();
        let resultFound = false;
        while (Date.now() - start < 60000) {
          await sleep(2000);
          const verdictText = await page.evaluate(() => {
            const txt = document.body.innerText;
            if (/verdict|fair price|above average|overpriced|estimate|benchmark|analysis/i.test(txt)) return txt.substring(0, 500);
            return null;
          });
          if (verdictText) { resultFound = true; break; }
        }
        console.log("  result detected:", resultFound, "after", Math.round((Date.now() - start) / 1000) + "s");
        await shot(page, "22-analyze-result-top");
        await shot(page, "23-analyze-result-full", true);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(600);
        await shot(page, "24-analyze-result-bottom");
      } else {
        console.log("  ERROR: no file input found on analyzer page");
      }
    }
    await page.close();
  }

  // ─── PATH 3: COMPARE ──────────────────────────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("console", (m) => console.log("  [console]", m.type(), m.text().substring(0, 200)));
    page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

    console.log("\n=== PATH 3: COMPARE (3 real fixtures) ===");
    await page.goto(`${BASE}/compare-plumbing-quotes.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, "30-compare-landing", true);

    // Find file inputs and upload 3 fixtures — try the comparison set first
    const fixtures = [
      path.join(ROOT, "test-quotes/plumbing-images/comparison-wh-01-low.png"),
      path.join(ROOT, "test-quotes/plumbing-images/comparison-wh-02-mid.png"),
      path.join(ROOT, "test-quotes/plumbing-images/comparison-wh-03-high.png"),
    ];
    for (const f of fixtures) {
      if (!fs.existsSync(f)) console.log("  MISSING:", f);
    }

    // Some comparison pages have one file input that accepts multiple, others have 3 separate inputs.
    const fileInputs = await page.$$('input[type="file"]');
    console.log("  found file inputs:", fileInputs.length);
    if (fileInputs.length === 0) {
      console.log("  ERROR: no file inputs on compare page");
    } else if (fileInputs.length === 1) {
      // Multi-file single input
      await fileInputs[0].uploadFile(...fixtures);
      console.log("  uploaded all 3 to single multi-input");
    } else {
      // Separate inputs
      for (let i = 0; i < Math.min(fixtures.length, fileInputs.length); i++) {
        await fileInputs[i].uploadFile(fixtures[i]);
        console.log("  uploaded to input", i, ":", path.basename(fixtures[i]));
        await sleep(500);
      }
    }
    await sleep(2000);
    await shot(page, "31-compare-uploading");

    // Look for an "Analyze" / "Compare" button to trigger
    const triggered = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, a"));
      const target = buttons.find(b => /analyze|compare|submit|see results/i.test(b.textContent || ""));
      if (target) { target.click(); return target.textContent.trim().substring(0, 80); }
      return null;
    });
    console.log("  triggered button:", triggered);

    // Wait up to 90s for compare result
    const start = Date.now();
    let resultFound = false;
    while (Date.now() - start < 90000) {
      await sleep(3000);
      const txt = await page.evaluate(() => document.body.innerText);
      if (/recommended|cheapest|winner|best price|verdict|summary|side by side/i.test(txt) && txt.length > 1500) {
        resultFound = true;
        break;
      }
    }
    console.log("  compare result detected:", resultFound, "after", Math.round((Date.now() - start) / 1000) + "s");
    await shot(page, "32-compare-result-top");
    await shot(page, "33-compare-result-full", true);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(600);
    await shot(page, "34-compare-result-bottom");

    await page.close();
  }

  await browser.close();
  console.log("\nDONE. Output:", OUT);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
