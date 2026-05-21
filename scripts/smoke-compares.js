// Quick smoke test: load all compare pages, screenshot, log any JS errors
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const OUT = path.resolve(__dirname, "..", "output", "audits", "smoke-compares-2026-04-29");
fs.mkdirSync(OUT, { recursive: true });
function $w(s) { return new Promise(r => setTimeout(r, s)); }

const VERTICALS = [
  "plumbing", "electrical", "solar", "windows", "painting", "siding",
  "fencing", "concrete", "landscaping", "garage-door", "foundation",
  "kitchen", "insulation", "gutters", "moving", "medical", "legal",
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const results = [];
  for (const v of VERTICALS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errors = [];
    page.on("pageerror", e => errors.push("page: " + e.message));
    page.on("console", msg => { if (msg.type() === "error") errors.push("console: " + msg.text()); });
    const url = `https://woogoro.com/compare-${v}-quotes.html`;
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      await $w(2500);
      await page.screenshot({ path: path.join(OUT, `${v}.png`), fullPage: false });
      const has = await page.evaluate(() => ({
        title: document.title,
        hasGuard: typeof window.tpEnforceVerticalMatch === "function",
        hasDetect: typeof window.detectVerticalFromText === "function",
        hasMatPat: typeof window.MATERIAL_PATTERNS !== "undefined",
        hasUploadCard: !!document.querySelector(".cmp-card, .caq-card"),
      }));
      results.push({ v, ok: true, ...has, errors: errors.slice(0, 3) });
    } catch (e) {
      results.push({ v, ok: false, err: e.message, errors });
    }
    await page.close();
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
