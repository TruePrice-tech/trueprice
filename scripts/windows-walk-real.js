// Windows deep-dive walk: estimate (Lane's address) + analyzer (real EcoView fixture).
// Stubs /api/geocode-suggest so autocomplete dropdown can't intercept clicks.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "windows-walk-real-2026-04-27");
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
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  // Hide webdriver navigator flag
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
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
    if (/error|fail|TP_Engine|400|verdict|undefined|state\.address/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled"
    ]
  });

  // === PATH 1: ESTIMATE ===
  {
    const page = await newPage(browser, "estimate");
    console.log("\n=== PATH 1: WINDOW ESTIMATE — Lane's real address (Fort Mill SC) ===");
    await page.goto(`${BASE}/window-estimate.html`, { waitUntil: "networkidle2", timeout: 60000 });
    // Wait for Vercel checkpoint to resolve and the form to render
    await page.waitForSelector("#addrStreet", { timeout: 60000 });
    await sleep(800);
    await shot(page, "01-estimate-landing");

    await page.evaluate(() => {
      document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
      document.getElementById("addrCity").value = "Fort Mill";
      document.getElementById("addrState").value = "SC";
      document.getElementById("addrZip").value = "29707";
    });
    await sleep(300);
    await shot(page, "02-estimate-address-filled");

    await page.click("#btnEstimate");
    await sleep(3000); // wait for OSM signal to come in
    await shot(page, "03-estimate-step1-count");

    // Step 1: 16+ (whole house)
    await page.evaluate(() => { const o = document.querySelector('#optCount [data-val="16+"]'); if (o) o.click(); });
    await sleep(600);
    await shot(page, "04-estimate-step2-material");

    // Step 2: vinyl
    await page.evaluate(() => { const o = document.querySelector('#optMaterial [data-val="vinyl"]'); if (o) o.click(); });
    await sleep(600);
    await shot(page, "05-estimate-step3-tier");

    // Step 3: mid tier
    await page.evaluate(() => { const o = document.querySelector('#optBrandTier [data-val="mid"]'); if (o) o.click(); });
    await sleep(600);
    await shot(page, "06-estimate-step4-style");

    // Step 4: double-hung
    await page.evaluate(() => { const o = document.querySelector('#optStyle [data-val="double-hung"]'); if (o) o.click(); });
    await sleep(600);
    await shot(page, "07-estimate-step5-glass");

    // Step 5: double-lowe
    await page.evaluate(() => { const o = document.querySelector('#optGlass [data-val="double-lowe"]'); if (o) o.click(); });
    await sleep(600);
    await shot(page, "08-estimate-step6-install");

    // Step 6: pocket
    await page.evaluate(() => { const o = document.querySelector('#optInstall [data-val="pocket"]'); if (o) o.click(); });
    await sleep(2500);
    await shot(page, "09-estimate-result-top");
    await shot(page, "10-estimate-result-full", true);

    // Capture verdict block + result-footer presence
    const captured = await page.evaluate(() => {
      const verdict = document.querySelector('.win-verdict');
      const resultFooter = document.querySelector('[class*="result-footer"]') || document.querySelector('.tp-result-footer');
      return {
        verdictText: verdict ? verdict.innerText : "MISSING",
        bodyText: document.body.innerText.substring(0, 1500),
        resultFooterPresent: !!resultFooter
      };
    });
    console.log("  ESTIMATE verdict:", captured.verdictText.replace(/\n+/g, " | "));
    console.log("  resultFooterPresent:", captured.resultFooterPresent);
    fs.writeFileSync(path.join(OUT, "estimate-snapshot.txt"), captured.bodyText);

    await page.close();
  }

  // === PATH 2: ANALYZE — real EcoView fixture ===
  const fixtures = [
    { id: "01-real", file: "real/reddit-img-1-fair-quote.jpg", note: "EcoView 18 windows + bow, ~$10,627, expected FAIR" }
  ];

  for (const fx of fixtures) {
    const page = await newPage(browser, `analyze-${fx.id}`);
    console.log(`\n=== PATH 2.${fx.id}: ANALYZE — ${fx.note} ===`);
    await page.goto(`${BASE}/window-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(1500);
    await shot(page, `${fx.id}-20-landing`);

    const fixturePath = path.join(ROOT, "test-quotes/windows-images", fx.file);
    await (await page.$('input[type="file"]')).uploadFile(fixturePath);
    console.log("  uploaded:", fx.file);

    const start1 = Date.now();
    let confirmReady = false;
    // Messy handwritten quotes (e.g. EcoView) push Tesseract past 90s; allow 240s.
    while (Date.now() - start1 < 240000) {
      await sleep(2500);
      confirmReady = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
        return !!(target && !target.disabled && target.offsetParent !== null);
      });
      if (confirmReady) break;
    }
    console.log("  confirm ready:", confirmReady, "after", Math.round((Date.now() - start1) / 1000) + "s");
    await shot(page, `${fx.id}-21-confirm-step`);
    const confirmText = await page.evaluate(() => document.body.innerText.substring(0, 1200));
    console.log("  confirm snippet:", confirmText.replace(/\n+/g, " | ").substring(0, 240));
    fs.writeFileSync(path.join(OUT, `${fx.id}-confirm-snapshot.txt`), confirmText);

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
          return inVerdictBox && /(Fair Price|Above Average|Higher Than Expected|Below Average|Overpriced|Unusually Low|Estimated Cost)/i.test(txt);
        });
        if (done) break;
      }
      console.log("  rendered:", done, "after", Math.round((Date.now() - start2) / 1000) + "s");
      await sleep(1500);
      await shot(page, `${fx.id}-22-result-top`);
      await shot(page, `${fx.id}-23-result-full`, true);

      const resCap = await page.evaluate(() => {
        const verdict = document.querySelector('.win-verdict');
        // Also pull the OCR text the engine extracted, to debug parser misses
        let ocrText = "";
        try { ocrText = window.__TP_LAST_OCR_TEXT || ""; } catch (e) {}
        return {
          verdictText: verdict ? verdict.innerText : "MISSING",
          bodyText: document.body.innerText.substring(0, 2500),
          ocrText: ocrText.substring(0, 4000)
        };
      });
      console.log("  ANALYZE verdict:", resCap.verdictText.replace(/\n+/g, " | "));
      fs.writeFileSync(path.join(OUT, `${fx.id}-result-snapshot.txt`), resCap.bodyText);
      if (resCap.ocrText) fs.writeFileSync(path.join(OUT, `${fx.id}-ocr-text.txt`), resCap.ocrText);
    }
    await page.close();
  }

  // === PATH 3: COMPARE — synthetic 3 windows fixtures ===
  {
    const page = await newPage(browser, "compare");
    console.log("\n=== PATH 3: COMPARE — 3 synthetic window quotes (Pacific / Cascade / Evergreen) ===");
    await page.goto(`${BASE}/compare-windows-quotes.html`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector('input[type="file"]', { timeout: 60000 });
    await sleep(1000);
    await shot(page, "30-compare-landing");

    const cmpFixtures = [
      "comparison-windows-low.png",   // Pacific $5,640
      "comparison-windows-mid.png",   // Cascade $9,500
      "comparison-windows-high.png"   // Evergreen $19,520
    ];
    const fileInputs = await page.$$('input[type="file"]');
    for (let i = 0; i < Math.min(cmpFixtures.length, fileInputs.length); i++) {
      await fileInputs[i].uploadFile(path.join(ROOT, "test-quotes/windows-images", cmpFixtures[i]));
      console.log("  uploaded slot", i, ":", cmpFixtures[i]);
      await sleep(1200);
    }
    await sleep(2000);
    await shot(page, "31-compare-uploaded");

    // Wait for the Compare button to be ready (all three uploads processed)
    const start1 = Date.now();
    let buttonReady = false;
    while (Date.now() - start1 < 180000) {
      await sleep(2500);
      buttonReady = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /^Compare\s+\d\s+quotes?/i.test((b.textContent || "").trim()));
        return !!(target && !target.disabled && target.offsetParent !== null);
      });
      if (buttonReady) break;
    }
    console.log("  Compare button ready:", buttonReady, "after", Math.round((Date.now() - start1) / 1000) + "s");
    await shot(page, "32-compare-button-ready");

    if (buttonReady) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const target = btns.find(b => /^Compare\s+\d\s+quotes?/i.test((b.textContent || "").trim()));
        if (target) target.click();
      });
      await sleep(5000);
      await shot(page, "33-compare-result-top");
      await shot(page, "34-compare-result-full", true);

      const cmpResult = await page.evaluate(() => document.body.innerText.substring(0, 3000));
      fs.writeFileSync(path.join(OUT, "compare-result-snapshot.txt"), cmpResult);
      console.log("  COMPARE result snippet:", cmpResult.replace(/\n+/g, " | ").substring(0, 280));
    }
    await page.close();
  }

  await browser.close();
  console.log("\nDONE. Output:", OUT);
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
