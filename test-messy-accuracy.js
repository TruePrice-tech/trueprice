// Test ALL messy fixtures across all verticals through the live analyzer.
// Upload each messy image, check if price is extracted.
// Also test compare path with messy fixtures.

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const VERTICALS = [
  { name: "hvac", url: "/hvac-quote-analyzer.html", dir: "hvac-images" },
  { name: "plumbing", url: "/plumbing-quote-analyzer.html", dir: "plumbing-images" },
  { name: "electrical", url: "/electrical-quote-analyzer.html", dir: "electrical-images" },
  { name: "roofing", url: "/roofing-quote-analyzer.html", dir: "roofing-images" },
  { name: "fencing", url: "/fencing-quote-analyzer.html", dir: "fencing-images" },
  { name: "concrete", url: "/concrete-quote-analyzer.html", dir: "concrete-images" },
  { name: "foundation", url: "/foundation-quote-analyzer.html", dir: "foundation-images" },
  { name: "garage-door", url: "/garage-door-quote-analyzer.html", dir: "garage-door-images" },
  { name: "gutters", url: "/gutters-quote-analyzer.html", dir: "gutters-images" },
  { name: "insulation", url: "/insulation-quote-analyzer.html", dir: "insulation-images" },
  { name: "kitchen", url: "/kitchen-quote-analyzer.html", dir: "kitchen-images" },
  { name: "landscaping", url: "/landscaping-quote-analyzer.html", dir: "landscaping-images" },
  { name: "painting", url: "/painting-quote-analyzer.html", dir: "painting-images" },
  { name: "siding", url: "/siding-quote-analyzer.html", dir: "siding-images" },
  { name: "solar", url: "/solar-quote-analyzer.html", dir: "solar-images" },
  { name: "windows", url: "/window-quote-analyzer.html", dir: "windows-images" },
  { name: "moving", url: "/moving-quote-analyzer.html", dir: "moving-images" },
];

const requested = process.argv.slice(2);
const toTest = requested.length ? VERTICALS.filter(v => requested.includes(v.name)) : VERTICALS;
function pad(s, n) { return (s + " ".repeat(n)).slice(0, n); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  let totalAnalyzer = 0, analyzerHit = 0;
  let totalCompare = 0, compareHit = 0;

  console.log("=== ANALYZER PATH: MESSY FIXTURES ===\n");
  console.log(pad("VERTICAL", 14) + pad("FIXTURE", 45) + pad("PRICE", 10) + pad("TIME", 8) + "STATUS");
  console.log("-".repeat(85));

  for (const v of toTest) {
    const dir = path.resolve("test-quotes", v.dir);
    if (!fs.existsSync(dir)) continue;

    // Get all messy fixtures
    const messyFiles = fs.readdirSync(dir).filter(f =>
      f.includes("messy") && (f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg"))
    );

    for (const fixture of messyFiles) {
      totalAnalyzer++;
      const fixturePath = path.join(dir, fixture);
      const page = await browser.newPage();
      const t0 = Date.now();
      let gotPrice = 0, status = "?";

      try {
        await page.goto("https://truepricehq.com" + v.url, { waitUntil: "networkidle2", timeout: 20000 });
        const fileInput = await page.$("input[type='file']");
        if (!fileInput) { status = "NO INPUT"; await page.close(); continue; }

        await fileInput.uploadFile(fixturePath);

        // Wait up to 60s for price
        for (let w = 0; w < 20; w++) {
          await new Promise(r => setTimeout(r, 3000));
          const check = await page.evaluate(() => {
            const body = document.body.innerText;
            const m = body.match(/\$[\d,]+/);
            return { price: m ? parseInt(m[0].replace(/[$,]/g, "")) : 0 };
          });
          if (check.price > 50) { gotPrice = check.price; break; }
        }

        status = gotPrice > 0 ? "OK" : "NO PRICE";
        if (gotPrice > 0) analyzerHit++;
      } catch (e) {
        status = "ERROR";
      }

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        pad(v.name, 14) +
        pad(fixture.slice(0, 43), 45) +
        pad(gotPrice > 0 ? "$" + gotPrice.toLocaleString() : "-", 10) +
        pad(elapsed + "s", 8) +
        status
      );
      await page.close();
    }
  }

  console.log("\n=== COMPARE PATH: MESSY FIXTURES ===\n");

  // Test compare with messy low + mid for each vertical
  const COMPARE_VERTICALS = [
    { name: "hvac", url: "/compare-hvac-quotes.html", files: ["hvac-images/messy-comparison-ac-01-low.jpg", "hvac-images/messy-comparison-ac-02-mid.jpg"] },
    { name: "fencing", url: "/compare-fencing-quotes.html", files: ["fencing-images/messy-comparison-fence-low.jpg", "fencing-images/messy-comparison-fence-mid.jpg"] },
    { name: "concrete", url: "/compare-concrete-quotes.html", files: ["concrete-images/messy-comparison-conc-low.jpg", "concrete-images/messy-comparison-conc-mid.jpg"] },
    { name: "siding", url: "/compare-siding-quotes.html", files: ["siding-images/messy-comparison-siding-low.jpg", "siding-images/messy-comparison-siding-mid.jpg"] },
    { name: "windows", url: "/compare-windows-quotes.html", files: ["windows-images/messy-comparison-windows-low.jpg", "windows-images/messy-comparison-windows-mid.jpg"] },
  ];

  const cmpToTest = requested.length ? COMPARE_VERTICALS.filter(v => requested.includes(v.name)) : COMPARE_VERTICALS;

  console.log(pad("VERTICAL", 14) + pad("SLOT0", 12) + pad("SLOT1", 12) + pad("TIME", 8) + "STATUS");
  console.log("-".repeat(56));

  for (const v of cmpToTest) {
    totalCompare++;
    const file0 = path.resolve("test-quotes", v.files[0]);
    const file1 = path.resolve("test-quotes", v.files[1]);
    if (!fs.existsSync(file0) || !fs.existsSync(file1)) { console.log(pad(v.name, 14) + "MISSING FILES"); continue; }

    const page = await browser.newPage();
    const t0 = Date.now();
    let s0 = "?", s1 = "?", status = "?";

    try {
      await page.goto("https://truepricehq.com" + v.url, { waitUntil: "networkidle2", timeout: 20000 });
      const inputs = await page.$$("input[type='file']");
      if (inputs.length < 2) { status = "NO INPUTS"; await page.close(); continue; }

      await inputs[0].uploadFile(file0);
      await new Promise(r => setTimeout(r, 2000));
      await inputs[1].uploadFile(file1);

      // Wait for both slots
      await page.waitForFunction(() => {
        const a = document.getElementById("slot0");
        const b = document.getElementById("slot1");
        if (!a || !b) return false;
        return (a.classList.contains("uploaded") || a.innerText.includes("Could not")) &&
               (b.classList.contains("uploaded") || b.innerText.includes("Could not"));
      }, { timeout: 120000 });

      const state = await page.evaluate(() => ({
        s0: document.getElementById("slot0")?.classList.contains("uploaded"),
        s1: document.getElementById("slot1")?.classList.contains("uploaded")
      }));

      s0 = state.s0 ? "OK" : "FAIL";
      s1 = state.s1 ? "OK" : "FAIL";
      status = (s0 === "OK" && s1 === "OK") ? "PASS" : "FAIL";
      if (status === "PASS") compareHit++;
    } catch (e) {
      status = "TIMEOUT";
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(pad(v.name, 14) + pad(s0, 12) + pad(s1, 12) + pad(elapsed + "s", 8) + status);
    await page.close();
  }

  console.log("\n" + "=".repeat(56));
  console.log("ANALYZER: " + analyzerHit + "/" + totalAnalyzer + " messy images parsed (" + Math.round(analyzerHit / totalAnalyzer * 100) + "%)");
  console.log("COMPARE:  " + compareHit + "/" + totalCompare + " messy pairs compared (" + Math.round(compareHit / totalCompare * 100) + "%)");

  await browser.close();
})();
