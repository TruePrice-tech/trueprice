#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const BASE_URL = process.env.BASE_URL || "https://truepricehq.com";
const FIXTURES = path.resolve(__dirname, "..", "..", "..", "test-quotes", "auto-images");
const CACHE = __dirname;
const ONLY = (process.argv[2] && !process.argv[2].startsWith("--")) ? process.argv[2] : null;

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  let files = fs.readdirSync(FIXTURES).filter(n => /\.(jpe?g|png|webp)$/i.test(n)).sort();
  if (ONLY) files = files.filter(n => n === ONLY);
  for (const name of files) {
    process.stdout.write(`OCR ${name} … `);
    const t0 = Date.now();
    const page = await browser.newPage();
    try {
      await page.goto(`${BASE_URL}/auto-repair.html?path=quote`, { waitUntil: "networkidle2", timeout: 60000 });
      // Auto page init runs switchPath via inline script; if the file input
      // isn't there yet, force the quote panel open and trigger initQuoteApp.
      await page.evaluate(() => {
        try { if (typeof switchPath === "function") switchPath("quote", true); } catch (e) {}
      });
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
        { timeout: 240000 }
      );
      const text = await page.evaluate(() => window.__TP_LAST_OCR_TEXT || "");
      fs.writeFileSync(path.join(CACHE, name + ".txt"), text);
      console.log(`${((Date.now()-t0)/1000).toFixed(1)}s  ${text.length} chars`);
    } catch (e) {
      console.log(`FAIL: ${e.message.slice(0, 80)}`);
    }
    await page.close();
  }
  await browser.close();
})();
