// Walk compare-moving-quotes.html with the 3 comparison fixtures
// (ATL Discount $990 / Peach State $1,860 / White Glove $4,040 — same
// Atlanta -> Marietta route, same 3BR ~8000 lbs). Confirms compare path
// renders correctly post moving-deep-test 2026-05-03 MV-1 fix and that
// the API's source field shows "claude-haiku" (not regex_fallback).

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";
const ROOT = "C:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const FIXTURES = [
  path.join(ROOT, "test-quotes/moving-images/comparison-move-low.png"),
  path.join(ROOT, "test-quotes/moving-images/comparison-move-mid.png"),
  path.join(ROOT, "test-quotes/moving-images/comparison-move-high.png"),
];
const OUT = "c:/tmp/compare-moving-walk";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 1200 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/moving-estimate") || res.url().includes("/api/parse-quote")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  console.log("→ navigating compare-moving-quotes.html");
  await page.goto(BASE + "/compare-moving-quotes.html", { waitUntil: "networkidle2" });
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

  console.log("\n=== API RESPONSES ===");
  for (const r of apiResponses) {
    let parsed;
    try { parsed = JSON.parse(r.body); } catch { parsed = null; }
    const data = parsed && parsed.data ? parsed.data : null;
    console.log(`  ${r.url} -> ${r.status} source=${parsed?.source || "?"} totalPrice=${data?.totalPrice} companyName=${data?.companyName} pickupState=${data?.pickupState} deliveryState=${data?.deliveryState} _priceSource=${data?._priceSource || "(none)"}`);
  }

  fs.writeFileSync(path.join(OUT, "table.json"), JSON.stringify(table, null, 2));
  fs.writeFileSync(path.join(OUT, "api-responses.json"), JSON.stringify(apiResponses, null, 2));

  await browser.close();
  console.log(`\n→ output written to ${OUT}`);
})();
