// Re-test compare-medical SEO-hide post-fix (commit 8bf1728313)
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const URL_COMPARE = "https://woogoro.com/compare-medical-quotes.html";
const FIX_ROOF = path.resolve(__dirname, "..", "test", "receipt", "ocr-cache", "fixtures", "roofing-gaf-quote.jpeg");
const OUT = path.resolve(__dirname, "..", "output", "audits", "medical-2026-04-30");

function $w(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto(URL_COMPARE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await $w(4000);
  const inps = await page.$$('input[type=file]');
  if (inps.length < 1) { console.log("No file inputs"); await browser.close(); return; }
  await inps[0].uploadFile(FIX_ROOF);
  try {
    await page.waitForFunction(() => Array.from(document.querySelectorAll("h1")).some(h => /This is not/i.test(h.innerText)), { timeout: 75000 });
  } catch (e) { console.log("waitFn timeout"); }
  await $w(2000);
  const state = await page.evaluate(() => {
    const banner = Array.from(document.querySelectorAll("div")).find(el => /No email.*No phone.*No signup.*never sell/i.test(el.innerText || ""));
    const bannerVisible = banner ? (banner.offsetParent !== null && banner.offsetHeight > 0) : false;
    const h = Array.from(document.querySelectorAll("h1")).find(el => /This is not/i.test(el.innerText));
    const seoVisible = Array.from(document.querySelectorAll("h2")).filter(h => /How to compare|Most important|Helpful Medical/i.test(h.innerText)).map(h => h.offsetParent !== null);
    return {
      h1: h ? h.innerText : "(none)",
      trustBannerVisible: bannerVisible,
      seoVisibleArr: seoVisible,
      seoAnyVisible: seoVisible.some(v => v === true),
      seoCount: seoVisible.length
    };
  });
  console.log("REDO compare-medical state:", JSON.stringify(state, null, 2));
  await page.screenshot({ path: path.join(OUT, "compare", "redo-03-results-postfix.png"), fullPage: true });
  fs.writeFileSync(path.join(OUT, "compare", "redo-state-postfix.json"), JSON.stringify(state, null, 2));
  await browser.close();
})();
