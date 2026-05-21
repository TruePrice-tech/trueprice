// Quick puppeteer verification: hard-reject + compare sub-nav
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "output", "verify-fixes", new Date().toISOString().replace(/[:.]/g, "-"));
const FIX = path.join(ROOT, "test", "receipt", "ocr-cache", "fixtures");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // Test 1: Upload roofing fixture to plumbing analyzer, expect HARD REJECT
  {
    console.log("\n=== TEST 1: hard-reject (roofing fixture -> plumbing analyzer) ===");
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1400 });
    await page.goto(BASE + "/plumbing-quote-analyzer.html", { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 3000));
    const inputs = await page.$$('input[type="file"]');
    if (inputs.length === 0) { console.log("FAIL: no file input"); }
    else {
      await inputs[0].uploadFile(path.join(FIX, "roofing-gaf-quote.jpeg"));
      console.log("uploaded roofing-gaf-quote.jpeg");
      // Wait until either (a) hard-reject screen renders, or (b) result/intermediate
      // screen renders, or (c) 120s timeout.
      try {
        await page.waitForFunction(() => {
          const h1 = document.querySelector("h1")?.textContent || "";
          return /this is not a/i.test(h1) || /we found your quote/i.test(h1) || /quote analysis/i.test(h1);
        }, { timeout: 120000, polling: 1000 });
      } catch (e) {
        console.log("timed out waiting for terminal state");
      }
      await new Promise((r) => setTimeout(r, 2000));
      await page.screenshot({ path: path.join(OUT, "01-plumbing-after-roofing-upload.png"), fullPage: true });
      const detected = await page.evaluate(() => {
        const h1 = document.querySelector("h1")?.textContent || "";
        const text = document.body.textContent || "";
        return {
          h1Reject: /this is not a/i.test(h1),
          h1Confirm: /we found your quote/i.test(h1),
          h1Analyzing: /analyzing your/i.test(h1),
          hasGotoAnalyzer: text.includes("Analyze as Roofing instead"),
          hasContinueAnyway: text.toLowerCase().includes("continue here anyway"),
          hasFakePrice: text.includes("$16,766") || text.includes("$16,765"),
          h1: h1,
        };
      });
      console.log("detected:", detected);
      if (detected.h1Reject && detected.hasGotoAnalyzer && !detected.hasFakePrice) {
        console.log("PASS: hard-reject screen shown, no fake price extracted");
      } else {
        console.log("FAIL: hard-reject did not appear in terminal state", detected);
      }
    }
    await page.close();
  }

  // Test 2: compare page sub-nav
  {
    console.log("\n=== TEST 2: compare sub-nav ===");
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1400 });
    await page.goto(BASE + "/compare-roofing-quotes.html", { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(OUT, "02-compare-roofing-with-subnav.png"), fullPage: false });
    const found = await page.evaluate(() => {
      const text = document.body.textContent || "";
      return {
        hasSubnavText: text.includes("You are comparing quotes"),
        hasEstimateLink: !!document.querySelector('a[href*="-estimator"], a[href*="-estimate.html"]'),
        hasAnalyzeLink: !!document.querySelector('a[href*="quote-analyzer.html"]'),
      };
    });
    console.log("found:", found);
    if (found.hasSubnavText && found.hasEstimateLink && found.hasAnalyzeLink) {
      console.log("PASS: compare sub-nav present with both intent links");
    } else {
      console.log("FAIL: sub-nav incomplete", found);
    }
    await page.close();
  }

  // Test 3: control - upload roofing fixture to roofing analyzer, expect NO reject
  {
    console.log("\n=== TEST 3: control (roofing fixture -> roofing analyzer) ===");
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1400 });
    await page.goto(BASE + "/roofing-quote-analyzer.html", { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 3000));
    const inputs = await page.$$('input[type="file"]');
    if (inputs.length === 0) { console.log("no file input"); }
    else {
      await inputs[0].uploadFile(path.join(FIX, "roofing-gaf-quote.jpeg"));
      await new Promise((r) => setTimeout(r, 35000));
      await page.screenshot({ path: path.join(OUT, "03-roofing-control.png"), fullPage: true });
      const detected = await page.evaluate(() => ({
        hasHardReject: (document.body.textContent || "").includes("This is not a"),
        h1: document.querySelector("h1")?.textContent || "",
      }));
      console.log("detected:", detected);
      if (!detected.hasHardReject) {
        console.log("PASS: no hard-reject for matching vertical");
      } else {
        console.log("FAIL: hard-reject incorrectly fired on matching vertical");
      }
    }
    await page.close();
  }

  await browser.close();
  console.log(`\nScreenshots: ${OUT}`);
})();
