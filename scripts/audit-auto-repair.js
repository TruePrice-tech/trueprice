// Auto-repair audit harness
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL_ANALYZE = "https://woogoro.com/auto-repair.html";
const URL_COMPARE = "https://woogoro.com/compare-auto-quotes.html";
const URL_ESTIMATE = "https://woogoro.com/auto-estimate.html";
const FIX_DEFAULT = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "auto-equinox-quote.jpeg");
const FIX_HONDA = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "auto-honda-paper-photo.jpeg");
const FIX_AUDI = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "audi-screenshot.jpg");
const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const OUT = path.resolve(__dirname, "..", "output", "audits", "auto-repair-2026-04-29");
fs.mkdirSync(OUT + "/analyze", { recursive: true });
fs.mkdirSync(OUT + "/compare", { recursive: true });
fs.mkdirSync(OUT + "/estimate", { recursive: true });

const STEP = process.argv[2] || "1";
function $w(s) { return new Promise(r => setTimeout(r, s)); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1280, height: 900 });

  if (STEP === "analyze-init") {
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "analyze/01-initial.png"), fullPage: true });
    console.log("Done.");
  }
  if (STEP === "analyze-upload") {
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    // Click "I Have a Quote" card to reveal upload UI
    await page.evaluate(() => {
      if (typeof switchPath === "function") switchPath("quote");
    });
    await $w(3000);
    const fileInput = await page.$('input[type=file]');
    if (!fileInput) { console.log("No file input after card click"); await browser.close(); return; }
    await fileInput.uploadFile(FIX_DEFAULT);
    await $w(60000);
    await page.screenshot({ path: path.join(OUT, "analyze/02-after-upload.png"), fullPage: true });
    const text = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    fs.writeFileSync(path.join(OUT, "analyze/02-result-text.txt"), text);
    console.log("Done. resultLen=", text.length);
  }
  if (STEP === "analyze-reject") {
    await page.goto(URL_ANALYZE, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await page.evaluate(() => {
      if (typeof switchPath === "function") switchPath("quote");
    });
    await $w(3000);
    const fileInput = await page.$('input[type=file]');
    if (!fileInput) { console.log("No file input after card click"); await browser.close(); return; }
    await fileInput.uploadFile(FIX_ROOF);
    let rejectSeen = false;
    for (let i = 0; i < 75; i++) {
      await $w(1000);
      const seen = await page.evaluate(() => /this is not an? auto|looks like.*roof/i.test(document.body.innerText));
      if (seen) { rejectSeen = true; break; }
    }
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "analyze/03-roofing-on-auto.png"), fullPage: true });
    console.log("rejectSeen=", rejectSeen);
  }
  if (STEP === "compare-init") {
    await page.goto(URL_COMPARE, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "compare/01-initial.png"), fullPage: true });
    console.log("Done.");
  }
  if (STEP === "estimate-init") {
    await page.goto(URL_ESTIMATE, { waitUntil: "networkidle2", timeout: 60000 });
    await $w(2000);
    await page.screenshot({ path: path.join(OUT, "estimate/01-initial.png"), fullPage: true });
    console.log("Done.");
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
