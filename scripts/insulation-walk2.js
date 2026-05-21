// Round 2: walk analyze (clicking Yes to confirm price), compare, plus extra fixtures.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "insulation-walk-2026-04-27");
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
    if (/error|fail|TP_Engine|400|verdict/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function walkAnalyze(browser, fixtureName) {
  console.log(`\n=== ANALYZE (${fixtureName}) ===`);
  const page = await newPage(browser, "analyze");
  await page.goto(`${BASE}/insulation-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 45000 });
  await sleep(1500);
  const safeName = fixtureName.replace(/\.[^.]+$/, "");

  const fixturePath = path.join(ROOT, "test-quotes", "insulation-images", fixtureName);
  if (!fs.existsSync(fixturePath)) { console.log("  fixture missing:", fixturePath); await page.close(); return; }

  const inputHandle = await page.$('input[type=file]');
  if (!inputHandle) { console.log("  no file input"); await page.close(); return; }
  await inputHandle.uploadFile(fixturePath);
  console.log("  uploaded:", fixtureName);

  await sleep(28000); // Wait for OCR + processing
  await shot(page, `a2-${safeName}-01-confirm`, true);

  // Click "Yes, analyze this price" if present
  const yesClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    const target = btns.find(b => /yes,?\s*analyze/i.test(b.textContent));
    if (target) { target.click(); return true; }
    return false;
  });
  console.log("  yes button clicked:", yesClicked);
  await sleep(5000);
  await shot(page, `a2-${safeName}-02-result`, true);

  // Read all visible result text to confirm verdict, benchmark, etc.
  const summary = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3")).map(h => h.textContent.trim()).filter(t => t);
    const allBody = (document.body.innerText || "").substring(0, 4000);
    return { headings, allBody };
  });
  console.log("  HEADINGS:", JSON.stringify(summary.headings.slice(0, 12)));
  console.log("  BODY (4k):");
  summary.allBody.split("\n").slice(0, 60).forEach(l => console.log("    " + l));

  await page.close();
}

async function walkCompare(browser) {
  console.log("\n=== COMPARE PATH ===");
  const page = await newPage(browser, "compare");
  await page.goto(`${BASE}/compare-insulation-quotes.html`, { waitUntil: "networkidle2", timeout: 45000 });
  await sleep(2000);
  await shot(page, "c-01-landing", true);

  // Look for file inputs and try to upload 3 fixtures
  const inputs = await page.$$('input[type=file]');
  console.log("  file inputs found:", inputs.length);

  const fxs = ["mock-01.png", "mock-04.png", "mock-07.png"];
  if (inputs.length >= 3) {
    for (let i = 0; i < 3; i++) {
      const fp = path.join(ROOT, "test-quotes", "insulation-images", fxs[i]);
      if (fs.existsSync(fp)) {
        await inputs[i].uploadFile(fp);
        console.log("  uploaded slot", i, ":", fxs[i]);
      }
    }
  } else if (inputs.length >= 1) {
    // Some compare pages use a single repeated input
    for (let i = 0; i < Math.min(3, fxs.length); i++) {
      const fp = path.join(ROOT, "test-quotes", "insulation-images", fxs[i]);
      if (fs.existsSync(fp)) {
        await inputs[0].uploadFile(fp);
        console.log("  uploaded:", fxs[i]);
        await sleep(2000);
      }
    }
  }
  await sleep(35000);
  await shot(page, "c-02-after-uploads", true);

  // Click compare/analyze if present
  const ran = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    const target = btns.find(b => /compare|analyze|run/i.test(b.textContent) && !/quote|analyzer/i.test(b.getAttribute("href") || ""));
    if (target) { target.click(); return target.textContent.trim().substring(0, 60); }
    return null;
  });
  console.log("  compare button clicked:", ran);
  await sleep(20000);
  await shot(page, "c-03-result", true);

  const summary = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3")).map(h => h.textContent.trim()).filter(t => t);
    const allBody = (document.body.innerText || "").substring(0, 4000);
    return { headings, allBody };
  });
  console.log("  HEADINGS:", JSON.stringify(summary.headings.slice(0, 12)));
  console.log("  BODY (first 60 lines):");
  summary.allBody.split("\n").slice(0, 60).forEach(l => console.log("    " + l));

  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: false, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    await walkAnalyze(browser, "mock-01.png");
    await walkAnalyze(browser, "mock-05.png");
    await walkAnalyze(browser, "mock-09.png");
    await walkCompare(browser);
  } catch (e) {
    console.error("WALK FAILED:", e);
  } finally {
    await browser.close();
  }
})();
