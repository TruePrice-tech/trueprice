// Capture engineResult.stateCode + aiData.stateCode + state.address.stateCode
// at render time for f7 to confirm PL-2 root cause.

const puppeteer = require("puppeteer");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 900 });

  // Wrap TP_Engine.analyzeQuote to capture engineResult before plumbing analyzer mutates state.
  await page.evaluateOnNewDocument(() => {
    window.__TP_DEBUG_ER = null;
    var origGetter = Object.getOwnPropertyDescriptor;
    Object.defineProperty(window, "TP_Engine", {
      configurable: true,
      set: function(v) {
        var orig = v.analyzeQuote;
        v.analyzeQuote = async function() {
          var r = await orig.apply(this, arguments);
          window.__TP_DEBUG_ER = {
            stateCode: r.stateCode,
            city: r.city,
            aiData_stateCode: r.aiData && r.aiData.stateCode,
            aiData_city: r.aiData && r.aiData.city,
          };
          return r;
        };
        Object.defineProperty(window, "TP_Engine", { value: v, writable: true, configurable: true });
      }
    });
  });

  await page.goto(BASE + "/plumbing-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_DIR, "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg"));

  await page.waitForFunction(() => !!document.getElementById("confirmPriceBtn") || !!document.getElementById("manualPriceBtn"), { timeout: 120000 }).catch(() => null);
  if (await page.$("#confirmPriceBtn")) await page.click("#confirmPriceBtn");
  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const debug = await page.evaluate(() => window.__TP_DEBUG_ER);
  const pricing = await page.evaluate(() => {
    var rows = {};
    document.querySelectorAll(".plumb-detail").forEach(d => {
      var l = (d.querySelector(".label") || {}).innerText || "";
      var v = (d.querySelector(".value") || {}).innerText || "";
      if (l) rows[l.trim().toLowerCase()] = v.trim();
    });
    return rows.pricing;
  });

  console.log("engineResult debug:", JSON.stringify(debug));
  console.log("rendered pricing row:", JSON.stringify(pricing));
  await browser.close();
})();
