// Round 2: re-walk what failed in round 1.
// - Compare paths: upload to #file0/#file1/#file2 separately, capture verdict
// - Analyze paths: click through "Yes, analyze this price" to reach verdict
// - Window analyze: longer protocolTimeout for the slow EcoView OCR
// - Siding estimate: poll until OSM resolves OR force-set wallSqFt manually
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "human-walk-4v-round2-2026-04-28");
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
    if (/error|fail|verdict|TP_Engine|400|500|undefined/i.test(t)) console.log(`  [${label}]`, m.type(), t.substring(0, 220));
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
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
    protocolTimeout: 180000  // 3 min for slow OCR
  });

  // ─── COMPARE WALKS (proper per-slot upload) ────────────────────────
  const compareJobs = [
    { v: "win", url: "compare-windows-quotes.html", dir: "test-quotes/windows-images", lo: "comparison-windows-low.png", mid: "comparison-windows-mid.png", hi: "comparison-windows-high.png" },
    { v: "sid", url: "compare-siding-quotes.html", dir: "test-quotes/siding-images", lo: "comparison-siding-low.png", mid: "comparison-siding-mid.png", hi: "comparison-siding-high.png" },
    { v: "paint", url: "compare-painting-quotes.html", dir: "test-quotes/painting-images", lo: "comparison-paint-low.png", mid: "comparison-paint-mid.png", hi: "comparison-paint-high.png" },
    { v: "conc", url: "compare-concrete-quotes.html", dir: "test-quotes/concrete-images", lo: "comparison-conc-low.png", mid: "comparison-conc-mid.png", hi: "comparison-conc-high.png" }
  ];

  for (const j of compareJobs) {
    try {
      const page = await newPage(browser, `${j.v}-cmp`);
      console.log(`\n=== COMPARE [${j.v}]: 3 quotes lo/mid/hi ===`);
      await page.goto(`${BASE}/${j.url}`, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(2000);
      await shot(page, `60-${j.v}-cmp-landing`);

      // Upload one file per slot
      for (let i = 0; i < 3; i++) {
        const fname = i === 0 ? j.lo : i === 1 ? j.mid : j.hi;
        const fp = path.join(ROOT, j.dir, fname);
        if (!fs.existsSync(fp)) { console.log(`  MISSING: ${fp}`); continue; }
        const fileEl = await page.$(`#file${i}`);
        if (!fileEl) { console.log(`  no #file${i}`); continue; }
        await fileEl.uploadFile(fp);
        console.log(`  uploaded slot ${i}: ${fname}`);
        await sleep(15000);  // per-slot OCR + parse
      }
      await shot(page, `61-${j.v}-cmp-after-uploads`);

      // Most compare flows auto-show verdict once 2+ quotes uploaded.
      // Wait extra and screenshot full result.
      await sleep(8000);
      await shot(page, `62-${j.v}-cmp-results-full`, true);
      await dumpText(page, `62-${j.v}-cmp-results`);
      await page.close();
    } catch (e) { console.log(`  COMPARE [${j.v}] FAIL:`, e.message); }
  }

  // ─── ANALYZE: click through price-confirm to reach verdict ────────
  const analyzeJobs = [
    { v: "win", url: "window-quote-analyzer.html", fixture: "test-quotes/windows-images/comparison-windows-mid.png", expected: 9500, label: "[clean synth] Cascade 12 vinyl $9500" },
    { v: "win-real", url: "window-quote-analyzer.html", fixture: "test-quotes/windows-images/real/reddit-img-1-fair-quote.jpg", expected: 10067, label: "[real] EcoView 18 windows $10067 (slow OCR)" },
    { v: "paint", url: "painting-quote-analyzer.html", fixture: "test-quotes/painting-test-images/07-is-this-a-fair-price-from-professional-point-of-vi.jpeg", expected: 2820, label: "Cabinet paint $2820" },
    { v: "conc", url: "concrete-quote-analyzer.html", fixture: "test-quotes/concrete-test-images/04-is-this-a-fair-quote-for-stamped-patio.jpeg", expected: 11900, label: "Stamped patio $11,900" },
    { v: "conc-bug", url: "concrete-quote-analyzer.html", fixture: "test-quotes/concrete-test-images/02-quote-to-widen-driveway-pour-cement-pad-for-shed-p.png", expected: 12636, label: "Driveway widen $12,636 [BUG: parser grabs subtotal $11,674]" },
    { v: "sid", url: "siding-quote-analyzer.html", fixture: "test-quotes/siding-images/comparison-siding-mid.png", expected: 14880, label: "[synth] Queen City siding $14880" }
  ];

  for (const j of analyzeJobs) {
    try {
      const page = await newPage(browser, `${j.v}-anly`);
      console.log(`\n=== ANALYZE [${j.v}]: ${j.label} ===`);
      await page.goto(`${BASE}/${j.url}`, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(1500);
      const fixture = path.join(ROOT, j.fixture);
      if (!fs.existsSync(fixture)) { console.log(`  MISSING FIXTURE`); await page.close(); continue; }
      const fileInput = await page.$('input[type="file"]');
      if (!fileInput) { console.log(`  no file input`); await page.close(); continue; }
      await fileInput.uploadFile(fixture);
      console.log(`  uploaded: ${path.basename(fixture)}`);

      // Wait up to 90s for OCR + price-confirm card to appear
      let confirmed = false;
      for (let t = 0; t < 18; t++) {
        await sleep(5000);
        const found = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const yesBtn = btns.find(b => /yes,? analyze this price/i.test(b.innerText));
          if (yesBtn) { yesBtn.click(); return "clicked-yes"; }
          // Direct verdict (high-confidence skip)
          if (document.body.innerText.match(/(verdict|fair|above|higher than|lower than|red flag)/i)) return "verdict-direct";
          return null;
        });
        if (found) { console.log(`  ${found} after ${(t+1)*5}s`); confirmed = true; break; }
      }
      if (!confirmed) console.log(`  no price-confirm or verdict in 90s`);
      await sleep(8000);
      await shot(page, `40-${j.v}-anly-result-top`);
      await shot(page, `41-${j.v}-anly-result-full`, true);
      await dumpText(page, `41-${j.v}-anly-result`);
      await page.close();
    } catch (e) { console.log(`  ANALYZE [${j.v}] FAIL:`, e.message); }
  }

  // ─── SIDING ESTIMATE (full coverage) ──────────────────────────────
  try {
    const page = await newPage(browser, "sid-est");
    console.log("\n=== SIDING ESTIMATE: poll for OSM, then advance ===");
    await page.goto(`${BASE}/siding-estimate.html`, { waitUntil: "networkidle2", timeout: 60000 });
    await sleep(1500);
    await page.waitForSelector("#addrStreet", { timeout: 15000 });
    await page.evaluate(() => {
      document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
      document.getElementById("addrCity").value = "Fort Mill";
      document.getElementById("addrState").value = "SC";
      document.getElementById("addrZip").value = "29707";
    });
    await sleep(300);
    await page.click("#btnEstimate");
    await sleep(2000);
    await page.evaluate(() => {
      const o = document.querySelector('#optSiding [data-val="fiber_cement"]');
      if (o) o.click();
    });
    // Wait for OSM to resolve before advancing
    await sleep(8000);
    // Now set wall sq ft + click Next
    await page.evaluate(() => {
      const inp = document.getElementById("sqftInput");
      if (inp) { inp.value = "1800"; inp.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await sleep(500);
    await page.click("#sqftNext");
    await sleep(1500);
    await page.evaluate(() => {
      const o = document.querySelector('#optStories [data-val="2"]');
      if (o) o.click();
    });
    await sleep(800);
    await page.evaluate(() => {
      const o = document.querySelector('#optCondition [data-val="fair"]');
      if (o) o.click();
    });
    await sleep(2500);
    await shot(page, "70-sid-est-result-top");
    await shot(page, "71-sid-est-result-full", true);
    await dumpText(page, "71-sid-est-result");
    await page.close();
  } catch (e) { console.log("  SID EST FAIL:", e.message); }

  await browser.close();
  console.log(`\n=== ROUND 2 DONE. Output in ${OUT} ===`);
})();
