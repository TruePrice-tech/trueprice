// Walk compare-solar-quotes.html: upload f1+f3 (Sunset Solar low + Apex premium+
// battery) — different system size + brand + battery. Inspect the rendered
// comparison table for any "N/A" values where API returned a real value.

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";
const ROOT = "C:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const FIXTURES = [
  path.join(ROOT, "test-quotes/solar-images/comparison-solar-01-low.png"),
  path.join(ROOT, "test-quotes/solar-images/comparison-solar-03-high.png"),
];
const OUT = "c:/tmp/compare-solar-walk";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 1200 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/solar-estimate") || res.url().includes("/api/parse-quote")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  console.log("→ navigating compare-solar-quotes.html");
  await page.goto(BASE + "/compare-solar-quotes.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  // Upload both fixtures sequentially
  for (let i = 0; i < FIXTURES.length; i++) {
    console.log(`→ uploading slot ${i}: ${path.basename(FIXTURES[i])}`);
    const inp = await page.$(`#file${i}`);
    if (!inp) throw new Error(`#file${i} not found`);
    await inp.uploadFile(FIXTURES[i]);
    // Wait for slot to flip to uploaded state (slot-edit-price input appears)
    await page.waitForFunction(idx => {
      const slot = document.getElementById(`slot${idx}`);
      return slot && (slot.classList.contains("uploaded") || slot.querySelector(".slot-error"));
    }, { timeout: 180000 }, i);
    const state = await page.evaluate(idx => {
      const slot = document.getElementById(`slot${idx}`);
      return {
        uploaded: slot.classList.contains("uploaded"),
        error: !!slot.querySelector(".slot-error"),
        nameVal: (slot.querySelector(".slot-edit-name") || {}).value || null,
        priceVal: (slot.querySelector(".slot-edit-price") || {}).value || null,
      };
    }, i);
    console.log(`  → slot${i}:`, state);
  }

  // Click Compare
  await page.waitForFunction(() => {
    const b = document.getElementById("compareBtn");
    return b && !b.disabled;
  });
  await page.click("#compareBtn");

  await page.waitForFunction(() => document.querySelector(".cmp-table"));
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(OUT, "results-1440.png"), fullPage: true });

  // Mobile screenshot
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT, "results-mobile.png"), fullPage: true });
  await page.setViewport({ width: 1440, height: 1200 });
  await new Promise(r => setTimeout(r, 600));

  // Extract comparison table contents
  const table = await page.evaluate(() => {
    const tbl = document.querySelector(".cmp-table");
    if (!tbl) return null;
    const headers = Array.from(tbl.querySelectorAll("thead th")).map(th => th.innerText.trim());
    const rows = Array.from(tbl.querySelectorAll("tbody tr")).map(tr => {
      const cells = Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim());
      return cells;
    });
    const winner = (document.querySelector(".cmp-winner-title") || {}).innerText || "";
    const banner = (document.querySelector(".cmp-winner-sub") || {}).innerText || "";
    const scoreLabels = Array.from(document.querySelectorAll(".cmp-score-label")).map(s => s.innerText.trim());
    return { headers, rows, winner, banner, scoreLabels };
  });

  console.log("\n=== WINNER ===");
  console.log(table.winner);
  console.log(table.banner);
  console.log("Scores:", table.scoreLabels.join(" / "));
  console.log("\n=== TABLE ===");
  console.log(table.headers.join(" | "));
  console.log("-".repeat(60));
  table.rows.forEach(r => console.log(r.join(" | ")));

  // Count N/A cells
  let naCount = 0;
  let totalCells = 0;
  table.rows.forEach(r => {
    for (let i = 1; i < r.length; i++) {
      totalCells++;
      if (r[i] === "N/A" || r[i] === "Not stated" || r[i] === "? Unclear") naCount++;
    }
  });
  console.log(`\nN/A or Unclear cells: ${naCount}/${totalCells}`);

  // API response analysis
  console.log("\n=== API responses ===");
  apiResponses.forEach((r, i) => {
    let parsed = null;
    try { parsed = JSON.parse(r.body); } catch {}
    if (parsed?.data) {
      const d = parsed.data;
      console.log(`api[${i}] status=${r.status} totalPrice=${d.totalPrice} systemSizeKW=${d.systemSizeKW} panelBrand=${d.panelBrand} inverterBrand=${d.inverterBrand} batteryIncluded=${d.batteryIncluded} warrantyPanels=${d.warrantyPanels} warrantyWorkmanship=${d.warrantyWorkmanship} priceAfterTaxCredit=${d.priceAfterTaxCredit} costPerWatt=${d.costPerWatt}`);
    } else {
      console.log(`api[${i}] status=${r.status} body=${(r.body || "").slice(0, 120)}`);
    }
  });

  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ table, apiResponses }, null, 2));
  console.log(`\nScreenshot + JSON saved to ${OUT}`);

  await browser.close();
})().catch(e => { console.error("WALK ERROR:", e.message); process.exit(1); });
