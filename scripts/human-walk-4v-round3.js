// Round 3: just wait longer for analyze verdict to render (no clever detection).
// Use specific result-element selectors instead of innerText regex.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "human-walk-4v-round3-2026-04-28");
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
    } else { req.continue(); }
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|verdict|TP_Engine|400|500/i.test(t)) console.log(`  [${label}]`, m.type(), t.substring(0, 220));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}
async function dumpText(page, name, sel = "main") {
  const txt = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? (el.innerText || "").slice(0, 6000) : "(no main)";
  }, sel);
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"], protocolTimeout: 240000 });

  const jobs = [
    { v: "win", url: "window-quote-analyzer.html", fixture: "test-quotes/windows-images/comparison-windows-mid.png", label: "Cascade $9500" },
    { v: "paint", url: "painting-quote-analyzer.html", fixture: "test-quotes/painting-test-images/07-is-this-a-fair-price-from-professional-point-of-vi.jpeg", label: "Cabinet $2820" },
    { v: "conc", url: "concrete-quote-analyzer.html", fixture: "test-quotes/concrete-test-images/04-is-this-a-fair-quote-for-stamped-patio.jpeg", label: "Stamped $11900" },
    { v: "conc-bug", url: "concrete-quote-analyzer.html", fixture: "test-quotes/concrete-test-images/02-quote-to-widen-driveway-pour-cement-pad-for-shed-p.png", label: "Driveway $12636 [bug subtotal]" },
    { v: "sid", url: "siding-quote-analyzer.html", fixture: "test-quotes/siding-images/comparison-siding-mid.png", label: "Queen City $14880" }
  ];

  for (const j of jobs) {
    try {
      const page = await newPage(browser, `${j.v}`);
      console.log(`\n=== ${j.v}: ${j.label} ===`);
      await page.goto(`${BASE}/${j.url}`, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(1500);
      const fixture = path.join(ROOT, j.fixture);
      const fileInput = await page.$('input[type="file"]');
      await fileInput.uploadFile(fixture);
      console.log(`  uploaded ${path.basename(fixture)}`);

      // Wait until OCR loading is gone OR up to 90s
      for (let t = 0; t < 18; t++) {
        await sleep(5000);
        const ocrDone = await page.evaluate(() => {
          const t = document.body.innerText;
          // Loading indicator gone?
          if (/Reading text|Analyzing your|This may take a moment/i.test(t.substring(0, 1500))) return false;
          return true;
        });
        if (ocrDone) { console.log(`  OCR done after ${(t+1)*5}s`); break; }
      }

      // Click "Yes, analyze this price" if confirm card is there
      await sleep(3000);
      const confirmClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const yesBtn = btns.find(b => /yes,? analyze this price/i.test(b.innerText));
        if (yesBtn) { yesBtn.click(); return true; }
        return false;
      });
      if (confirmClicked) {
        console.log(`  clicked confirm`);
        await sleep(5000);
      }

      await shot(page, `${j.v}-result-top`);
      await shot(page, `${j.v}-result-full`, true);
      await dumpText(page, `${j.v}-result`);
      await page.close();
    } catch (e) { console.log(`  ${j.v} FAIL:`, e.message); }
  }
  await browser.close();
  console.log(`\n=== ROUND 3 DONE. Output in ${OUT} ===`);
})();
