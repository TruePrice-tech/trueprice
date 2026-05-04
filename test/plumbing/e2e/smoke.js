#!/usr/bin/env node
// Layer 3 — E2E smoke test. Run pre-commit only, NOT during iteration.
// 3 fixtures: one easy, one medium, one hard. Catches bail-out gate bugs,
// minified-file drift, and HTML glue — things Layer 1/2 can't see.
//
// Usage: node test/plumbing/e2e/smoke.js
//        BASE_URL=http://localhost:3000 node test/plumbing/e2e/smoke.js

const path = require("path");
const { launchHarnessBrowser, preparePage } = require("../../lib/harness-browser");

const BASE_URL = process.env.BASE_URL || "https://woogoro.com";
const FIXTURES = path.resolve(__dirname, "..", "..", "..", "test-quotes", "plumbing-images");
const SMOKE = [
  { name: "comparison-wh-01-low.png",        expected: 1380 },  // easy: clean synthetic
  { name: "messy-comparison-wh-02-mid.jpg",  expected: 2553 },  // medium: degraded
  { name: "comparison-wh-03-high.png",       expected: 7571 }   // hard: tankless, high tier
];

function pricesMatch(e, a) {
  if (a == null) return false;
  return Math.abs(e - a) <= Math.max(50, e * 0.05);
}

(async () => {
  const browser = await launchHarnessBrowser();
  const rows = [];
  for (const { name, expected } of SMOKE) {
    const t0 = Date.now();
    const page = await browser.newPage();
    await preparePage(page, BASE_URL);
    try {
      await page.goto(`${BASE_URL}/plumbing-quote-analyzer.html?path=quote`, { waitUntil: "networkidle2", timeout: 60000 });
      await page.waitForSelector('input[type="file"]', { timeout: 30000 });
      const [input] = await page.$$('input[type="file"]');
      await input.uploadFile(path.join(FIXTURES, name));
      await page.waitForFunction(() => {
        if (document.getElementById("manualPrice")) return true;
        const t = document.body.innerText || "";
        return /verdict|fair|overpri|underpri|your\s+quote/i.test(t) && /\$[0-9,]+/.test(t);
      }, { timeout: 180000 });
      const price = await page.evaluate(() => {
        if (document.getElementById("manualPrice")) return null;
        const m = (document.body.innerText || "").match(/\$([0-9][0-9,]*)/);
        return m ? Number(m[1].replace(/,/g, "")) : null;
      });
      const status = pricesMatch(expected, price) ? "PASS" : "FAIL";
      rows.push({ status, name, expected, price, ms: Date.now() - t0 });
    } catch (e) {
      rows.push({ status: "ERROR", name, expected, price: null, ms: Date.now() - t0, err: e.message.slice(0, 80) });
    }
    await page.close();
  }
  await browser.close();

  console.log("── Layer 3 — E2E Smoke ──");
  for (const r of rows) {
    const got = r.price == null ? "(manual)" : `$${r.price}`;
    console.log(`${r.status.padEnd(8)} ${r.name.padEnd(40)} exp $${r.expected}  got ${got}  ${(r.ms/1000).toFixed(1)}s${r.err ? "  " + r.err : ""}`);
  }
  const fail = rows.filter(r => r.status !== "PASS").length;
  process.exit(fail > 0 ? 1 : 0);
})();
