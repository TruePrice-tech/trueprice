// Quick test: verify the 3 known false positives are now rejected
const puppeteer = require("puppeteer");
const path = require("path");

const cases = [
  { v: "plumbing", url: "/plumbing-quote-analyzer.html", file: "03-did-i-get-a-i-dont-want-to-do-this-quote.jpeg", dir: "plumbing-images", inputId: "fileInput", was: 133553 },
  { v: "roofing", url: "/roofing-quote-analyzer.html", file: "03-how-over-priced-is-this-estimate-for-a-metal-ro.jpeg", dir: "roofing-images", inputId: "quoteFile", was: 136375 },
  { v: "roofing", url: "/roofing-quote-analyzer.html", file: "05-does-this-quote-seem-reasonable-i-know-nothing-.jpeg", dir: "roofing-images", inputId: "quoteFile", was: 7 },
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-http-cache"] });

  for (const c of cases) {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto("https://woogoro.com" + c.url + "?_cb=" + Date.now(), { waitUntil: "networkidle2", timeout: 30000 });

    await page.waitForSelector("#" + c.inputId, { timeout: 15000 }).catch(() => null);
    const input = await page.$("#" + c.inputId);
    if (!input) {
      const fallback = await page.$("input[type='file']");
      if (!fallback) { console.log(c.v + " | NO INPUT"); await page.close(); continue; }
      await fallback.uploadFile(path.resolve("test-quotes", c.dir, c.file));
    } else {
      await input.uploadFile(path.resolve("test-quotes", c.dir, c.file));
    }

    let gotPrice = 0, status = "?";
    for (let w = 0; w < 30; w++) {
      await new Promise(r => setTimeout(r, 3000));
      const check = await page.evaluate(() => {
        var body = document.body ? document.body.innerText : "";
        var cb = document.getElementById("confirmPriceBtn") || document.getElementById("tpConfirmPriceBtn");
        var mb = document.getElementById("manualPriceBtn") || document.getElementById("tpManualPriceBtn");
        var hasVerdict = /Fair Price|Overpriced|Below Average|Above Average|Unusually Low/.test(body);
        var priceMatches = body.match(/\$[\d,]+/g) || [];
        var prices = priceMatches.map(function(p) { return parseFloat(p.replace(/[$,]/g, "")); }).filter(function(v) { return v >= 50 && v <= 500000; });
        var a = window.__latestAnalysis;
        var noQuote = body.indexOf("Enter your quote") >= 0 || body.indexOf("couldn't read") >= 0;
        return { cb: !!cb, mb: !!mb, hasVerdict: hasVerdict, prices: prices.slice(0, 3), ap: a ? (a.quotePrice || 0) : 0, noQuote: noQuote };
      });
      if (check.cb && check.prices.length) { gotPrice = check.prices[0]; status = "STILL BAD"; break; }
      if (check.mb || check.noQuote) { status = "FIXED (no price)"; break; }
      if (check.hasVerdict && check.prices.length) { gotPrice = check.prices[0]; status = "STILL BAD"; break; }
      if (check.ap > 0) { gotPrice = check.ap; status = "STILL BAD"; break; }
    }
    if (status === "?") status = "TIMEOUT";

    var label = gotPrice > 0 ? "$" + gotPrice.toLocaleString() : "NO PRICE";
    console.log(c.v + " | " + c.file.slice(0, 50) + " | was: $" + c.was.toLocaleString() + " | now: " + label + " | " + status);
    await page.close();
  }
  await browser.close();
})();
