// Re-capture only compare path for Auto-repair (previous run crashed at screenshot)
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL_COMPARE = "https://woogoro.com/compare-auto-quotes.html";
const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const OUT = path.resolve(__dirname, "..", "output", "audits", "auto-repair-2026-04-30");

function $w(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    protocolTimeout: 240000,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  console.log("Compare reject...");
  await page.goto(URL_COMPARE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await $w(4000);
  const inps = await page.$$('input[type=file]');
  if (inps.length < 1) { console.log("No file inputs"); await browser.close(); return; }
  await inps[0].uploadFile(FIX_ROOF);
  try {
    await page.waitForFunction(() => Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText)), { timeout: 180000 });
  } catch (e) { console.log("waitFn timeout"); }
  await $w(2000);
  await page.screenshot({ path: path.join(OUT, "compare", "redo-03-results.png"), fullPage: true });
  console.log("Compare 03 captured");

  await page.reload({ waitUntil: "domcontentloaded" });
  await $w(4000);
  await page.screenshot({ path: path.join(OUT, "compare", "redo-05-after-refresh.png"), fullPage: true });
  console.log("Compare 05 captured");

  await browser.close();
})();
