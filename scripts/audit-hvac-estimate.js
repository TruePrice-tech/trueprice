// Quick smoke for HVAC estimate
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const URL = "https://woogoro.com/hvac-estimate.html";
const OUT = path.resolve(__dirname, "..", "output", "audits", "hvac-2026-04-29", "estimate");
fs.mkdirSync(OUT, { recursive: true });
function $w(s) { return new Promise(r => setTimeout(r, s)); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await $w(2000);
  await page.screenshot({ path: path.join(OUT, "01-initial.png"), fullPage: true });
  const desc = await page.evaluate(() => ({
    title: document.title,
    bodyTextStart: document.body.innerText.slice(0, 800),
    interactiveCount: document.querySelectorAll("a, button, input, select").length,
  }));
  console.log("HVAC estimate loaded:", JSON.stringify(desc, null, 2).slice(0, 1000));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
