// Capture 01-initial estimate landing for each vertical
// Usage: node scripts/redo-estimate-initial.js <vertical> [date]
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const vertical = process.argv[2];
if (!vertical) { console.error("Usage: node redo-estimate-initial.js <vertical> [date]"); process.exit(1); }

const URL_ESTIMATE_MAP = {
  plumbing: "plumbing-estimate.html",
  electrical: "electrical-estimate.html",
  solar: "solar-estimate.html",
  windows: "window-estimate.html",
  painting: "painting-estimate.html",
  siding: "siding-estimate.html",
  fencing: "fencing-estimate.html",
  concrete: "concrete-estimate.html",
  landscaping: "landscaping-estimate.html",
  kitchen: "kitchen-estimate.html",
  insulation: "insulation-estimate.html",
};
const URL = "https://woogoro.com/" + URL_ESTIMATE_MAP[vertical];

const OUT_DATE = process.argv[3] || "2026-04-30";
const OUT = path.resolve(__dirname, "..", "output", "audits", vertical + "-" + OUT_DATE);
fs.mkdirSync(path.join(OUT, "estimate"), { recursive: true });

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

  console.log(`${vertical} estimate 01-initial...`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await $w(5000);
  await page.screenshot({ path: path.join(OUT, "estimate", "redo-01-initial.png"), fullPage: true });

  const state = await page.evaluate(() => {
    const banner = Array.from(document.querySelectorAll("div")).find(el => /No email.*No phone.*No signup.*never sell/i.test(el.innerText || ""));
    const h1 = (document.querySelector("h1") || {}).innerText;
    const formInputs = document.querySelectorAll("input, select, button[type=submit]").length;
    const seoH2 = Array.from(document.querySelectorAll("h2")).filter(h => /What|Red flags|Common|How|Most important|Helpful/i.test(h.innerText)).length;
    return {
      h1: h1 || "(none)",
      trustBannerVisible: banner ? (banner.offsetParent !== null && banner.offsetHeight > 0) : false,
      formInputCount: formInputs,
      seoH2Count: seoH2,
      url: location.href,
    };
  });
  console.log(`${vertical} estimate state:`, JSON.stringify(state));
  fs.writeFileSync(path.join(OUT, "estimate", "redo-01-initial-state.json"), JSON.stringify(state, null, 2));

  await browser.close();
  console.log("DONE: " + vertical);
})();
