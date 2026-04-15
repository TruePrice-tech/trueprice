const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const VERTICALS = [
  { name: "hvac", url: "/hvac-quote-analyzer.html", fixture: "hvac-images/comparison-ac-01-low.png" },
  { name: "plumbing", url: "/plumbing-quote-analyzer.html", fixture: "plumbing-images/comparison-wh-01-low.png" },
  { name: "electrical", url: "/electrical-quote-analyzer.html", fixture: "electrical-images/comparison-panel-01-low.png" },
  { name: "solar", url: "/solar-quote-analyzer.html", fixture: "solar-images/comparison-solar-01-low.png" },
  { name: "fencing", url: "/fencing-quote-analyzer.html", fixture: "fencing-images/comparison-fence-low.png" },
  { name: "concrete", url: "/concrete-quote-analyzer.html", fixture: "concrete-images/comparison-conc-low.png" },
  { name: "foundation", url: "/foundation-quote-analyzer.html", fixture: "foundation-images/comparison-pier-low.png" },
  { name: "garage-door", url: "/garage-door-quote-analyzer.html", fixture: "garage-door-images/comparison-garage-low.png" },
  { name: "gutters", url: "/gutters-quote-analyzer.html", fixture: "gutters-images/comparison-gutters-low.png" },
  { name: "insulation", url: "/insulation-quote-analyzer.html", fixture: "insulation-images/comparison-insul-low.png" },
  { name: "kitchen", url: "/kitchen-quote-analyzer.html", fixture: "kitchen-images/comparison-kitchen-low.png" },
  { name: "landscaping", url: "/landscaping-quote-analyzer.html", fixture: "landscaping-images/comparison-land-low.png" },
  { name: "painting", url: "/painting-quote-analyzer.html", fixture: "painting-images/comparison-paint-low.png" },
  { name: "siding", url: "/siding-quote-analyzer.html", fixture: "siding-images/comparison-siding-low.png" },
  { name: "windows", url: "/window-quote-analyzer.html", fixture: "windows-images/comparison-windows-low.png" },
  { name: "auto", url: "/auto-repair.html", fixture: "auto-images/comparison-brake-01-shop-a-low.png" },
  { name: "moving", url: "/moving-quote-analyzer.html", fixture: "moving-images/comparison-move-low.png" },
  { name: "roofing", url: "/roofing-quote-analyzer.html", fixture: "roofing-images/comparison-roof-01-low.png" },
];

const requested = process.argv.slice(2);
const toTest = requested.length ? VERTICALS.filter(v => requested.includes(v.name)) : VERTICALS;

function pad(s, n) { return (s + " ".repeat(n)).slice(0, n); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  console.log(pad("VERTICAL", 14) + pad("UPLOAD", 10) + pad("PARSE", 10) + pad("PRICE", 12) + "RESULT");
  console.log("-".repeat(70));

  for (const v of toTest) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 80)));

    let upload = "?", parse = "?", price = "?", result = "?";

    try {
      await page.goto("https://truepricehq.com" + v.url, { waitUntil: "networkidle2", timeout: 20000 });

      // Find file input
      const fileInput = await page.$("input[type='file']");
      if (!fileInput) { upload = "NO INPUT"; throw new Error("skip"); }

      // Upload fixture
      const fixturePath = path.resolve("test-quotes", v.fixture);
      if (!fs.existsSync(fixturePath)) { upload = "NO FILE"; throw new Error("skip"); }
      await fileInput.uploadFile(fixturePath);
      upload = "OK";

      // Wait for parsing (up to 60s)
      let parsed = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const state = await page.evaluate(() => {
          const body = document.body.innerText;
          const hasPrice = /\$[\d,]+/.test(body);
          const hasResult = body.includes("Verdict") || body.includes("verdict") ||
                           body.includes("Expected range") || body.includes("ESTIMATED") ||
                           body.includes("Your Quote") || body.includes("We found") ||
                           body.includes("Quote Price") || body.includes("Analysis");
          const hasError = body.includes("Could not parse") || body.includes("Try another");
          return { hasPrice, hasResult, hasError, snippet: body.slice(0, 100) };
        });

        if (state.hasError) { parse = "PARSE ERR"; break; }
        if (state.hasResult || state.hasPrice) {
          parsed = true;
          parse = "OK";

          // Check for price
          const priceMatch = await page.evaluate(() => {
            const body = document.body.innerText;
            const m = body.match(/\$[\d,]+/);
            return m ? m[0] : null;
          });
          price = priceMatch || "NO PRICE";

          // Check result completeness
          const checks = await page.evaluate(() => {
            const body = document.body.innerText;
            return {
              hasVerdict: body.includes("Verdict") || body.includes("fair") || body.includes("high") || body.includes("low") || body.includes("Estimated"),
              hasDetails: body.includes("Details") || body.includes("details") || body.includes("Type") || body.includes("Service"),
            };
          });
          result = checks.hasVerdict ? "VERDICT" : (checks.hasDetails ? "DETAILS" : "PARTIAL");
          break;
        }
      }
      if (!parsed && parse === "?") parse = "TIMEOUT";

    } catch (e) {
      if (e.message !== "skip") result = "ERROR";
    }

    if (errors.length) result += " JS:" + errors.length;

    console.log(pad(v.name, 14) + pad(upload, 10) + pad(parse, 10) + pad(price, 12) + result);
    await page.close();
  }

  await browser.close();
})();
