#!/usr/bin/env node
// Layer 2 helper — regenerate OCR cache for real image fixtures.
// Slow (~minutes). Run rarely: only when you add fixtures or change Tesseract config.
//
// Strategy: upload each fixture to the LIVE plumbing analyzer, wait for OCR
// to finish, then capture the raw extracted text via window.__TP_LAST_OCR_TEXT
// (set by analyzer-ocr.js as a side effect of extractImageText).
//
// Usage:
//   node test/plumbing/ocr-cache/refresh.js
//   node test/plumbing/ocr-cache/refresh.js single-fixture.png
//   BASE_URL=http://localhost:3000 node test/plumbing/ocr-cache/refresh.js

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const BASE_URL = process.env.BASE_URL || "https://truepricehq.com";
const FIXTURES = path.resolve(__dirname, "..", "..", "..", "test-quotes", "plumbing-images");
const CACHE = __dirname;
const ONLY = (process.argv[2] && !process.argv[2].startsWith("--")) ? process.argv[2] : null;
const FAILING_ONLY = process.argv.includes("--failing");
const FAILING_SET = new Set([
  "comparison-wh-03-high.png",
  "messy-comparison-wh-03-high.jpg",
  "02-contractor-says-1800-to-move-water-supply-into-the.jpeg"
]);

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  let files = fs.readdirSync(FIXTURES).filter(n => /\.(jpe?g|png|webp)$/i.test(n)).sort();
  if (ONLY) files = files.filter(n => n === ONLY);
  if (FAILING_ONLY) files = files.filter(n => FAILING_SET.has(n));

  for (const name of files) {
    const outPath = path.join(CACHE, name + ".txt");
    process.stdout.write(`OCR ${name} … `);
    const t0 = Date.now();
    const page = await browser.newPage();
    const consoleText = [];
    page.on("console", m => consoleText.push(m.text()));
    try {
      await page.goto(`${BASE_URL}/plumbing-quote-analyzer.html?path=quote`, { waitUntil: "networkidle2", timeout: 60000 });
      await page.waitForSelector('input[type="file"]', { timeout: 30000 });
      const [input] = await page.$$('input[type="file"]');
      await input.uploadFile(path.join(FIXTURES, name));
      await page.waitForFunction(
        () => {
          if (window.__TP_LAST_OCR_TEXT) return true;
          const m = document.getElementById("manualPrice");
          const body = document.body.innerText || "";
          return !!m || /verdict|fair|overpri|underpri|your\s+quote/i.test(body);
        },
        { timeout: 180000 }
      );
      let text = await page.evaluate(() => window.__TP_LAST_OCR_TEXT || "");
      if (!text) {
        // Fallback: pull from console logs (analyzer-ocr may log extracted text)
        text = consoleText.filter(l => l.length > 50).join("\n");
      }
      fs.writeFileSync(outPath, text);
      console.log(`${((Date.now()-t0)/1000).toFixed(1)}s  ${text.length} chars`);
    } catch (e) {
      console.log(`FAIL: ${e.message.slice(0, 80)}`);
    }
    await page.close();
  }
  await browser.close();
})();
