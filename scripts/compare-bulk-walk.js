// Bulk walk N compare-* pages. Args: comma-separated vertical names matching
// compare-<v>-quotes.html and test-quotes/<v>-images/comparison-*-low.png.
// Logs N/A counts per vertical so we can quickly judge regressions.

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";
const ROOT = "C:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";

// Map vertical name (URL slug) → fixture-folder + low/high glob
const VERTICALS = {
  "fencing":     { dir: "fencing-images",     low: "comparison-fence-low.png",   high: "comparison-fence-high.png",   apiSlug: "fencing-estimate" },
  "gutters":     { dir: "gutters-images",     low: "comparison-gutters-low.png", high: "comparison-gutters-high.png", apiSlug: "gutters-estimate" },
  "garage-door": { dir: "garage-door-images", low: "comparison-garage-low.png",  high: "comparison-garage-high.png",  apiSlug: "garage-door-estimate" },
  "landscaping": { dir: "landscaping-images", low: "comparison-land-low.png",    high: "comparison-land-high.png",    apiSlug: "landscaping-estimate" },
  "concrete":    { dir: "concrete-images",    low: "comparison-conc-low.png",    high: "comparison-conc-high.png",    apiSlug: "concrete-estimate" },
  "insulation":  { dir: "insulation-images",  low: "comparison-insul-low.png",   high: "comparison-insul-high.png",   apiSlug: "insulation-estimate" },
  "electrical":  { dir: "electrical-images",  low: "comparison-panel-01-low.png", high: "comparison-panel-03-high.png", apiSlug: "electrical-estimate" },
};

(async () => {
  const verticals = (process.argv[2] || "").split(",").filter(Boolean);
  if (!verticals.length) { console.error("usage: node compare-bulk-walk.js fencing,gutters,..."); process.exit(1); }

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const summary = [];

  for (const v of verticals) {
    const cfg = VERTICALS[v];
    if (!cfg) { console.error(`unknown vertical: ${v}`); continue; }

    const OUT = `c:/tmp/compare-${v}-walk`;
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
    const FIXTURES = [
      path.join(ROOT, "test-quotes", cfg.dir, cfg.low),
      path.join(ROOT, "test-quotes", cfg.dir, cfg.high),
    ];
    const PAGE_URL = `${BASE}/compare-${v}-quotes.html`;

    console.log(`\n========== ${v} ==========`);
    console.log(`page: ${PAGE_URL}`);

    const page = await browser.newPage();
    page.setDefaultTimeout(180000);
    await page.setViewport({ width: 1440, height: 1200 });

    const apiResponses = [];
    page.on("response", async res => {
      if (res.url().includes(`/api/${cfg.apiSlug}`)) {
        let body = ""; try { body = await res.text(); } catch {}
        apiResponses.push({ url: res.url(), status: res.status(), body });
      }
    });

    try {
      await page.goto(PAGE_URL, { waitUntil: "networkidle2" });
      await new Promise(r => setTimeout(r, 2000));

      for (let i = 0; i < FIXTURES.length; i++) {
        console.log(`→ slot ${i}: ${path.basename(FIXTURES[i])}`);
        const inp = await page.$(`#file${i}`);
        if (!inp) throw new Error(`#file${i} not found`);
        await inp.uploadFile(FIXTURES[i]);
        await page.waitForFunction(idx => {
          const slot = document.getElementById(`slot${idx}`);
          return slot && (slot.classList.contains("uploaded") || slot.querySelector(".slot-error"));
        }, { timeout: 180000 }, i);
        const state = await page.evaluate(idx => {
          const slot = document.getElementById(`slot${idx}`);
          return { uploaded: slot.classList.contains("uploaded"), error: !!slot.querySelector(".slot-error"), nameVal: (slot.querySelector(".slot-edit-name") || {}).value || null, priceVal: (slot.querySelector(".slot-edit-price") || {}).value || null };
        }, i);
        console.log(`  → slot${i}:`, JSON.stringify(state));
      }

      await page.waitForFunction(() => { const b = document.getElementById("compareBtn"); return b && !b.disabled; });
      await page.click("#compareBtn");
      await page.waitForFunction(() => document.querySelector(".cmp-table"));
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(OUT, "results-1440.png"), fullPage: true });

      const table = await page.evaluate(() => {
        const tbl = document.querySelector(".cmp-table"); if (!tbl) return null;
        return { headers: Array.from(tbl.querySelectorAll("thead th")).map(th => th.innerText.trim()), rows: Array.from(tbl.querySelectorAll("tbody tr")).map(tr => Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim())) };
      });
      console.log(table.headers.join(" | "));
      console.log("-".repeat(50));
      table.rows.forEach(r => console.log(r.join(" | ")));

      let na = 0, total = 0;
      table.rows.forEach(r => { for (let i = 1; i < r.length; i++) { total++; if (r[i] === "N/A" || r[i] === "Not stated" || r[i] === "? Unclear") na++; } });
      const ctrName0 = table.headers[1] || "";
      const ctrName1 = table.headers[2] || "";
      const usingFallbackLabel = /^[A-Z][a-z]+ [123]$/.test(ctrName0) || /^[A-Z][a-z]+ [123]$/.test(ctrName1);
      console.log(`N/A: ${na}/${total} | contractor labels: "${ctrName0}" "${ctrName1}" | fallback-name? ${usingFallbackLabel}`);

      summary.push({ vertical: v, na, total, ctrName0, ctrName1, fallback: usingFallbackLabel, apiCalls: apiResponses.length });
      fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ table, apiResponses }, null, 2));
    } catch (e) {
      console.error(`${v} WALK ERROR:`, e.message);
      summary.push({ vertical: v, error: e.message });
    } finally {
      await page.close();
    }
  }

  console.log("\n\n========== SUMMARY ==========");
  summary.forEach(s => console.log(JSON.stringify(s)));
  await browser.close();
})().catch(e => { console.error("BULK ERROR:", e.message); process.exit(1); });
