// Capture broader coverage paths missing from redo-vertical.js:
// - 01-initial analyze landing (per-vertical)
// - 05-after-refresh (per-vertical, identical to 01-initial functionally — captures clean reset)
// Usage: node scripts/redo-broader-coverage.js <vertical> [date]
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const vertical = process.argv[2];
if (!vertical) { console.error("Usage: node redo-broader-coverage.js <vertical> [date]"); process.exit(1); }

const URL_ANALYZE_MAP = {
  plumbing: "plumbing-quote-analyzer.html",
  electrical: "electrical-quote-analyzer.html",
  solar: "solar-quote-analyzer.html",
  windows: "window-quote-analyzer.html",
  painting: "painting-quote-analyzer.html",
  siding: "siding-quote-analyzer.html",
  fencing: "fencing-quote-analyzer.html",
  concrete: "concrete-quote-analyzer.html",
  landscaping: "landscaping-quote-analyzer.html",
  kitchen: "kitchen-quote-analyzer.html",
  insulation: "insulation-quote-analyzer.html",
  "auto-repair": "auto-repair.html",
  moving: "moving-quote-analyzer.html",
  medical: "medical-bill-analyzer.html",
  legal: "legal-fee-analyzer.html",
};
const URL_ANALYZE = "https://woogoro.com/" + URL_ANALYZE_MAP[vertical];

const OUT_DATE = process.argv[3] || "2026-04-30";
const OUT = path.resolve(__dirname, "..", "output", "audits", vertical + "-" + OUT_DATE);
fs.mkdirSync(path.join(OUT, "analyze"), { recursive: true });

function $w(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  // 01-initial: just navigate to the analyzer landing
  console.log(`${vertical} 01-initial...`);
  await page.goto(URL_ANALYZE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await $w(5000);
  await page.screenshot({ path: path.join(OUT, "analyze", "redo-01-initial.png"), fullPage: true });

  // Probe initial state
  const state = await page.evaluate(() => {
    const banner = Array.from(document.querySelectorAll("div")).find(el => /No email.*No phone.*No signup.*never sell/i.test(el.innerText || ""));
    const h1 = (document.querySelector("h1") || {}).innerText;
    const seoVisible = Array.from(document.querySelectorAll("h2")).filter(h => /What to look for|Red flags|Common hidden|How to compare|Most important|Helpful/i.test(h.innerText)).map(h => h.offsetParent !== null);
    return {
      h1: h1 || "(none)",
      trustBannerVisible: banner ? (banner.offsetParent !== null && banner.offsetHeight > 0) : false,
      seoSectionsVisible: seoVisible.length,
      seoAllVisible: seoVisible.every(v => v === true),
    };
  });
  console.log(`${vertical} 01-initial state:`, JSON.stringify(state));
  fs.writeFileSync(path.join(OUT, "analyze", "redo-01-initial-state.json"), JSON.stringify(state, null, 2));

  await browser.close();
  console.log("DONE: " + vertical);
})();
