// Walk compare-windows-quotes.html: upload low + high fixtures.
// Mirrors compare-solar-walk.js. CMP-WIN-1+2+3 verification.

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";
const ROOT = "C:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const FIXTURES = [
  path.join(ROOT, "test-quotes/windows-images/comparison-windows-low.png"),
  path.join(ROOT, "test-quotes/windows-images/comparison-windows-high.png"),
];
const OUT = "c:/tmp/compare-windows-walk";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--enable-features=SharedArrayBuffer",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-web-security",
    ],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 1200 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  await page.setExtraHTTPHeaders({ "x-woogoro-test": "1", "Origin": BASE });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/windows-estimate") || res.url().includes("/api/parse-quote")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  console.log("→ navigating compare-windows-quotes.html");
  await page.goto(BASE + "/compare-windows-quotes.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  for (let i = 0; i < FIXTURES.length; i++) {
    console.log(`→ uploading slot ${i}: ${path.basename(FIXTURES[i])}`);
    const inp = await page.$(`#file${i}`);
    if (!inp) throw new Error(`#file${i} not found`);
    await inp.uploadFile(FIXTURES[i]);
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

  await page.waitForFunction(() => {
    const b = document.getElementById("compareBtn");
    return b && !b.disabled;
  });
  await page.click("#compareBtn");

  await page.waitForFunction(() => document.querySelector(".cmp-table"));
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(OUT, "results-1440.png"), fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT, "results-mobile.png"), fullPage: true });
  await page.setViewport({ width: 1440, height: 1200 });
  await new Promise(r => setTimeout(r, 600));

  const table = await page.evaluate(() => {
    const tbl = document.querySelector(".cmp-table");
    if (!tbl) return null;
    const headers = Array.from(tbl.querySelectorAll("thead th")).map(th => th.innerText.trim());
    const rows = Array.from(tbl.querySelectorAll("tbody tr")).map(tr => Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim()));
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

  let naCount = 0, totalCells = 0;
  table.rows.forEach(r => {
    for (let i = 1; i < r.length; i++) {
      totalCells++;
      if (r[i] === "N/A" || r[i] === "Not stated" || r[i] === "? Unclear") naCount++;
    }
  });
  console.log(`\nN/A or Unclear cells: ${naCount}/${totalCells}`);

  console.log("\n=== API responses ===");
  apiResponses.forEach((r, i) => {
    let parsed = null;
    try { parsed = JSON.parse(r.body); } catch {}
    if (parsed?.data) {
      const d = parsed.data;
      console.log(`api[${i}] status=${r.status} totalPrice=${d.totalPrice} brand=${d.brand} material=${d.material} windowCount=${d.windowCount} glassPackage=${d.glassPackage} uFactor=${d.uFactor} laborTotal=${d.laborTotal} warrantyFrame=${d.warrantyFrame} contractor=${d.contractor}`);
    } else {
      console.log(`api[${i}] status=${r.status} body=${(r.body || "").slice(0, 120)}`);
    }
  });

  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ table, apiResponses }, null, 2));
  console.log(`\nScreenshot + JSON saved to ${OUT}`);

  await browser.close();
})().catch(e => { console.error("WALK ERROR:", e.message); process.exit(1); });
