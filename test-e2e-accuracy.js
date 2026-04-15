// End-to-end accuracy test: upload REAL images through the live site
// as a user would, wait for Tesseract + parser, check results.
// Tests 2 fixtures per vertical: 1 clean + 1 messy (if available).

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const VERTICALS = [
  { name: "hvac", url: "/hvac-quote-analyzer.html",
    fixtures: ["hvac-images/comparison-ac-01-low.png", "hvac-images/messy-comparison-ac-01-low.jpg"],
    expectPrice: [3456, 3456] },
  { name: "plumbing", url: "/plumbing-quote-analyzer.html",
    fixtures: ["plumbing-images/comparison-wh-01-low.png", "plumbing-images/messy-comparison-wh-01-low.jpg"],
    expectPrice: [1380, 1380] },
  { name: "electrical", url: "/electrical-quote-analyzer.html",
    fixtures: ["electrical-images/comparison-panel-01-low.png", "electrical-images/messy-comparison-panel-01-low.jpg"],
    expectPrice: [1660, 1660] },
  { name: "roofing", url: "/roofing-quote-analyzer.html",
    fixtures: ["roofing-images/comparison-roof-01-low.png", "roofing-images/messy-comparison-roof-01-low.jpg"],
    expectPrice: [7565, 7565] },
  { name: "fencing", url: "/fencing-quote-analyzer.html",
    fixtures: ["fencing-images/comparison-fence-low.png", "fencing-images/messy-comparison-fence-low.jpg"],
    expectPrice: [5100, 5100] },
  { name: "concrete", url: "/concrete-quote-analyzer.html",
    fixtures: ["concrete-images/comparison-conc-low.png", "concrete-images/messy-comparison-conc-low.jpg"],
    expectPrice: [4840, 4840] },
  { name: "foundation", url: "/foundation-quote-analyzer.html",
    fixtures: ["foundation-images/comparison-pier-low.png", "foundation-images/messy-comparison-pier-low.jpg"],
    expectPrice: [6900, 6900] },
  { name: "garage-door", url: "/garage-door-quote-analyzer.html",
    fixtures: ["garage-door-images/comparison-garage-low.png", "garage-door-images/messy-comparison-garage-low.jpg"],
    expectPrice: [1420, 1420] },
  { name: "gutters", url: "/gutters-quote-analyzer.html",
    fixtures: ["gutters-images/comparison-gutters-low.png", "gutters-images/messy-comparison-gutters-low.jpg"],
    expectPrice: [1260, 1260] },
  { name: "insulation", url: "/insulation-quote-analyzer.html",
    fixtures: ["insulation-images/comparison-insul-low.png", "insulation-images/messy-comparison-insul-low.jpg"],
    expectPrice: [1730, 1730] },
  { name: "kitchen", url: "/kitchen-quote-analyzer.html",
    fixtures: ["kitchen-images/comparison-kitchen-low.png", "kitchen-images/messy-comparison-kitchen-low.jpg"],
    expectPrice: [13850, 13850] },
  { name: "landscaping", url: "/landscaping-quote-analyzer.html",
    fixtures: ["landscaping-images/comparison-land-low.png", "landscaping-images/messy-comparison-land-low.jpg"],
    expectPrice: [2080, 2080] },
  { name: "painting", url: "/painting-quote-analyzer.html",
    fixtures: ["painting-images/comparison-paint-low.png", "painting-images/messy-comparison-paint-low.jpg"],
    expectPrice: [3280, 3280] },
  { name: "siding", url: "/siding-quote-analyzer.html",
    fixtures: ["siding-images/comparison-siding-low.png", "siding-images/messy-comparison-siding-low.jpg"],
    expectPrice: [9040, 9040] },
  { name: "solar", url: "/solar-quote-analyzer.html",
    fixtures: ["solar-images/comparison-solar-01-low.png", "solar-images/messy-comparison-solar-01-low.jpg"],
    expectPrice: [14940, 14940] },
  { name: "windows", url: "/window-quote-analyzer.html",
    fixtures: ["windows-images/comparison-windows-low.png", "windows-images/messy-comparison-windows-low.jpg"],
    expectPrice: [5640, 5640] },
  { name: "moving", url: "/moving-quote-analyzer.html",
    fixtures: ["moving-images/comparison-move-low.png", "moving-images/messy-comparison-move-low.jpg"],
    expectPrice: [990, 990] },
  { name: "auto", url: "/auto-repair.html",
    fixtures: ["auto-images/comparison-brake-01-shop-a-low.png", "auto-images/messy-comparison-brake-01-shop-a-low.jpg"],
    expectPrice: [328, 328] },
];

const requested = process.argv.slice(2);
const toTest = requested.length ? VERTICALS.filter(v => requested.includes(v.name)) : VERTICALS;
function pad(s, n) { return (s + " ".repeat(n)).slice(0, n); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  let totalTests = 0, priceHit = 0, priceMiss = 0, priceWrong = 0;
  let cleanTests = 0, cleanHit = 0, messyTests = 0, messyHit = 0;
  const failures = [];

  console.log(pad("VERTICAL", 14) + pad("TYPE", 8) + pad("EXPECT", 10) + pad("GOT", 10) + pad("MATCH", 8) + pad("TIME", 8) + "STATUS");
  console.log("-".repeat(76));

  for (const v of toTest) {
    for (let i = 0; i < v.fixtures.length; i++) {
      const fixturePath = path.resolve("test-quotes", v.fixtures[i]);
      if (!fs.existsSync(fixturePath)) continue;

      const isMessy = v.fixtures[i].includes("messy");
      const label = isMessy ? "messy" : "clean";
      const expectedPrice = v.expectPrice[i];
      totalTests++;
      if (isMessy) messyTests++; else cleanTests++;

      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message.slice(0, 60)));

      const t0 = Date.now();
      let gotPrice = 0, status = "?";

      try {
        await page.goto("https://truepricehq.com" + v.url, { waitUntil: "networkidle2", timeout: 20000 });

        // Find file input
        const fileInput = await page.$("input[type='file']");
        if (!fileInput) { status = "NO INPUT"; await page.close(); continue; }

        // Upload
        await fileInput.uploadFile(fixturePath);

        // Wait for price (up to 90s)
        let found = false;
        for (let w = 0; w < 30; w++) {
          await new Promise(r => setTimeout(r, 3000));
          const check = await page.evaluate(() => {
            const body = document.body.innerText;
            const m = body.match(/\$[\d,]+/);
            const hasPrice = !!m;
            const hasResult = body.includes("We found") || body.includes("Quote Price") ||
                              body.includes("Verdict") || body.includes("Analysis") ||
                              body.includes("ESTIMATED") || body.includes("score");
            return { hasPrice, hasResult, price: m ? parseInt(m[0].replace(/[$,]/g, "")) : 0 };
          });

          if (check.hasPrice && check.price > 50) {
            gotPrice = check.price;
            found = true;
            break;
          }
        }

        if (!found) {
          status = "TIMEOUT";
        } else {
          // Check price accuracy (within 15% tolerance)
          const tolerance = 0.15;
          const lo = expectedPrice * (1 - tolerance);
          const hi = expectedPrice * (1 + tolerance);
          if (gotPrice >= lo && gotPrice <= hi) {
            status = "MATCH";
            priceHit++;
            if (isMessy) messyHit++; else cleanHit++;
          } else if (gotPrice > 0) {
            status = "WRONG";
            priceWrong++;
            failures.push(v.name + " " + label + ": expected $" + expectedPrice + " got $" + gotPrice);
          } else {
            status = "NO PRICE";
            priceMiss++;
          }
        }
      } catch (e) {
        status = "ERROR: " + e.message.slice(0, 30);
      }

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        pad(v.name, 14) +
        pad(label, 8) +
        pad("$" + expectedPrice.toLocaleString(), 10) +
        pad(gotPrice > 0 ? "$" + gotPrice.toLocaleString() : "-", 10) +
        pad(status, 8) +
        pad(elapsed + "s", 8) +
        (errors.length ? "JS:" + errors[0].slice(0, 20) : "")
      );

      await page.close();
    }
  }

  console.log("\n" + "=".repeat(76));
  console.log("OVERALL: " + priceHit + "/" + totalTests + " prices match (" + Math.round(priceHit / totalTests * 100) + "%)");
  console.log("  Clean: " + cleanHit + "/" + cleanTests + " (" + (cleanTests > 0 ? Math.round(cleanHit / cleanTests * 100) : 0) + "%)");
  console.log("  Messy: " + messyHit + "/" + messyTests + " (" + (messyTests > 0 ? Math.round(messyHit / messyTests * 100) : 0) + "%)");
  console.log("  Wrong price: " + priceWrong + "  No price: " + priceMiss + "  Timeout: " + (totalTests - priceHit - priceWrong - priceMiss));

  if (failures.length) {
    console.log("\nFAILURES:");
    failures.forEach(f => console.log("  " + f));
  }

  await browser.close();
})();
