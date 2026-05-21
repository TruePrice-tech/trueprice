// Debug what detectHvacJobType sees on the live site for fixture 04
const puppeteer = require("puppeteer");
const path = require("path");
const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on("console", (m) => {
    const t = m.text();
    if (/DBG_|jobType|recharge|service|R22/i.test(t)) {
      console.log("  [console]", m.type(), t.substring(0, 400));
    }
  });

  await page.goto("https://woogoro.com/hvac-quote-analyzer.html", { waitUntil: "networkidle2" });
  await sleep(1500);

  // Hook into TP_Engine result so we can see the raw OCR text
  await page.evaluate(() => {
    const origAnalyze = window.TP_Engine && window.TP_Engine.analyzeQuote;
    if (origAnalyze) {
      window.TP_Engine.analyzeQuote = async function(...args) {
        const r = await origAnalyze.apply(this, args);
        console.log("DBG_OCR_TEXT_LEN:", (r.ocrText || "").length);
        console.log("DBG_OCR_TEXT_FULL:", JSON.stringify((r.ocrText || "").substring(0, 5000)));
        const lc = (r.ocrText || "").toLowerCase();
        console.log("DBG_has_condenser:", lc.includes("condenser"));
        console.log("DBG_has_recharge:", lc.includes("recharge"));
        console.log("DBG_has_install:", /\binstall/.test(lc));
        return r;
      };
    } else {
      console.log("DBG_no_engine");
    }
  });

  const fixture = path.join(ROOT, "test-quotes/hvac-images/04-is-this-reasonable.jpeg");
  await (await page.$('input[type="file"]')).uploadFile(fixture);

  // Wait for confirm
  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < 90000) {
    await sleep(2000);
    ready = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
      return !!(target && !target.disabled && target.offsetParent !== null);
    });
    if (ready) break;
  }
  console.log("  confirm ready:", ready);
  if (ready) {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find(b => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
      if (target) target.click();
    });
    await sleep(5000);
  }
  await browser.close();
})().catch(e => { console.error("FATAL:", e); process.exit(1); });
