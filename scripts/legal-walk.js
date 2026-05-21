// Minimal legal walk: estimate landing + 1 analyze fixture + 3-quote compare.
// Reads as a human via screenshots + result-text dumps.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "legal-walk-2026-04-28");
const FIX = path.join(ROOT, "test-quotes", "legal-images");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}
async function dump(page, sel, name) {
  const txt = await page.evaluate((s) => {
    const el = document.querySelector(s) || document.querySelector("main");
    return el ? (el.innerText || "").slice(0, 8000) : "(no el)";
  }, sel);
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}
async function newPage(browser, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|verdict|undefined|400|500|warn/i.test(t)) {
      console.log(`  [${label}]`, m.type(), t.substring(0, 240));
    }
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

  // 1. ESTIMATE landing
  console.log("=== ESTIMATE: landing ===");
  let page = await newPage(browser, "est");
  await page.goto(`${BASE}/legal-estimate.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, "est-01-landing", true);
  await dump(page, "main", "est-01-landing");
  await page.close();

  // 2. ANALYZE — upload 1 real fixture (estate planning flat fee)
  console.log("=== ANALYZE: 01-estate-planning ===");
  page = await newPage(browser, "an");
  await page.goto(`${BASE}/legal-fee-analyzer.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, "an-01-landing");
  const input = await page.waitForSelector("#fileInput, input[type=file]", { timeout: 15000 });
  await input.uploadFile(path.join(FIX, "01-estate-planning-flat-fee.png"));
  console.log("  uploaded estate-planning fixture");
  // wait for verdict
  for (let i = 0; i < 80; i++) {
    await sleep(1000);
    const ready = await page.evaluate(() => {
      const txt = (document.body.innerText || "").toLowerCase();
      return /verdict|fair price|above|below|expected|fee|attorney/i.test(txt) && !!document.querySelector(".verdict, [class*=verdict], [id*=Verdict], [id*=result]");
    });
    if (ready) break;
  }
  await sleep(1500);
  await shot(page, "an-02-result", true);
  await dump(page, "main", "an-02-result");
  await page.close();

  // 3. COMPARE — 3 PI quotes
  console.log("=== COMPARE: 3 PI quotes ===");
  page = await newPage(browser, "cmp");
  await page.goto(`${BASE}/compare-legal-quotes.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);
  await shot(page, "cmp-01-landing");
  const inputs = await page.$$('input[type=file]');
  console.log(`  found ${inputs.length} file inputs`);
  if (inputs.length >= 3) {
    await inputs[0].uploadFile(path.join(FIX, "comparison-pi-01-firm-a-low.png"));
    await sleep(1500);
    await inputs[1].uploadFile(path.join(FIX, "comparison-pi-02-firm-b-mid.png"));
    await sleep(1500);
    await inputs[2].uploadFile(path.join(FIX, "comparison-pi-03-firm-c-high.png"));
    await sleep(1500);
  } else if (inputs.length >= 1) {
    // multi-file single input
    await inputs[0].uploadFile(
      path.join(FIX, "comparison-pi-01-firm-a-low.png"),
      path.join(FIX, "comparison-pi-02-firm-b-mid.png"),
      path.join(FIX, "comparison-pi-03-firm-c-high.png")
    );
  }
  await shot(page, "cmp-02-uploaded");
  // Click any compare/analyze submit button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const go = btns.find((b) => /compare|analyze|submit|run|see/i.test(b.innerText || ""));
    if (go) go.click();
  });
  // Wait for verdict
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    const ready = await page.evaluate(() => {
      const txt = (document.body.innerText || "").toLowerCase();
      return /best value|verdict|recommend|firm a|firm b/i.test(txt);
    });
    if (ready) break;
  }
  await sleep(2000);
  await shot(page, "cmp-03-result", true);
  await dump(page, "main", "cmp-03-result");
  await page.close();

  await browser.close();
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
