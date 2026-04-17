#!/usr/bin/env node
/**
 * Take clean viewport screenshots of key result states from the live
 * site, so we can visually verify nothing is broken on the 3 paths.
 */
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = path.dirname(__dirname);
const OUT = path.join(ROOT, "output", "qa-reshot");

const BASE = "https://woogoro.com";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false });
}

async function shotWithScroll(page, name, scrollY = 0) {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: false });
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) try { fs.unlinkSync(path.join(OUT, f)); } catch (e) {}

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // 1. Homepage
  const p1 = await browser.newPage();
  await p1.setViewport({ width: 1366, height: 900 });
  await p1.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(2000);
  await shot(p1, "01-home");

  // 2. Estimate picker
  await p1.goto(BASE + "/get-an-estimate.html", { waitUntil: "networkidle2" });
  await sleep(1500);
  await shot(p1, "02-estimate-picker");

  // 3. Analyze picker
  await p1.goto(BASE + "/analyze-my-quote.html", { waitUntil: "networkidle2" });
  await sleep(1500);
  await shot(p1, "03-analyze-picker");

  // 4. Compare picker
  await p1.goto(BASE + "/compare-quotes-picker.html", { waitUntil: "networkidle2" });
  await sleep(1500);
  await shot(p1, "04-compare-picker");

  // 5. Roofing analyzer landing (the critical page for the user)
  await p1.goto(BASE + "/roofing-quote-analyzer.html?path=quote", { waitUntil: "networkidle2" });
  await sleep(2500);
  await shot(p1, "05-roofing-analyze-landing");

  // 6. Upload a real roofing quote and show result
  const fixture = path.join(ROOT, "test-quotes", "roofing-images", "07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg");
  const inputs = await p1.$$("input[type='file']");
  if (inputs[0] && fs.existsSync(fixture)) {
    await inputs[0].uploadFile(fixture);
    await p1.evaluate((inp) => inp.dispatchEvent(new Event("change", { bubbles: true })), inputs[0]);
    await sleep(45000);
    await shotWithScroll(p1, "06-roofing-analyze-result-top", 0);
    await shotWithScroll(p1, "07-roofing-analyze-result-scope", 600);
    await shotWithScroll(p1, "08-roofing-analyze-result-detail", 1200);
  }

  // 7. Roofing compare
  const fixture2 = path.join(ROOT, "test-quotes", "roofing-images", "01-can-this-be-done-for-8500.png");
  await p1.goto(BASE + "/compare-quotes.html?service=roofing", { waitUntil: "networkidle2" });
  await sleep(2500);
  await shot(p1, "09-compare-roofing-landing");
  const cInputs = await p1.$$("input[type='file']");
  if (cInputs.length >= 2) {
    await cInputs[0].uploadFile(fixture);
    await p1.evaluate((inp) => inp.dispatchEvent(new Event("change", { bubbles: true })), cInputs[0]);
    await sleep(2000);
    await cInputs[1].uploadFile(fixture2);
    await p1.evaluate((inp) => inp.dispatchEvent(new Event("change", { bubbles: true })), cInputs[1]);
    await sleep(60000);
    await shot(p1, "10-compare-roofing-uploaded");
    // Click compare button
    await p1.evaluate(() => {
      const btns = [...document.querySelectorAll("button")].filter(b => /compare\s+\d/i.test(b.textContent || ""));
      if (btns[0]) btns[0].click();
    });
    await sleep(4000);
    await shotWithScroll(p1, "11-compare-roofing-result-top", 0);
    await shotWithScroll(p1, "12-compare-roofing-result-table", 600);
  }

  await browser.close();
  console.log("Reshot complete:", OUT);
})();
