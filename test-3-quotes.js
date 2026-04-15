// Quick real-user test: upload 3 quotes through the live site via Puppeteer
const puppeteer = require("puppeteer");
const path = require("path");

const BASE = "https://truepricehq.com";

const TESTS = [
  {
    label: "AUTO - Jiffy Lube invoice (phone photo, redactions)",
    file: path.resolve("test-quotes/real-quotes/auto/1boni58.jpeg"),
    page: "/auto-repair.html",
    inputId: "fileInput",
  },
  {
    label: "ROOFING - Handwritten proposal (blue pen on form)",
    file: path.resolve("test-quotes/real-quotes/roofing/13r1q44.png"),
    page: "/roofing-quote-analyzer.html",
    inputId: "quoteFile",
  },
  {
    label: "MOVING - Digital moving quote",
    file: path.resolve("test-quotes/real-quotes/moving/1bgju9p.jpeg"),
    page: "/moving-quote-analyzer.html",
    inputId: "fileInput",
  },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
    timeout: 60000,
  });

  for (const test of TESTS) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`TEST: ${test.label}`);
    console.log(`${"=".repeat(80)}`);

    const page = await browser.newPage();
    page.setDefaultTimeout(120000);

    // Capture console logs from the page
    const logs = [];
    page.on("console", msg => {
      const text = msg.text();
      if (text.includes("[PARSE]") || text.includes("[ocr") || text.includes("price") || text.includes("Price")) {
        logs.push(text);
      }
    });

    try {
      console.log(`\n1. Navigating to ${BASE}${test.page} ...`);
      await page.goto(BASE + test.page, { waitUntil: "networkidle2", timeout: 30000 });

      // Wait for file input
      await page.waitForSelector(`#${test.inputId}`, { timeout: 15000 }).catch(() => null);
      let fileInput = await page.$(`#${test.inputId}`);
      if (!fileInput) {
        fileInput = await page.$("input[type='file']");
      }
      if (!fileInput) {
        console.log("   ERROR: No file input found on page");
        await page.close();
        continue;
      }

      console.log(`2. Uploading image ...`);
      await fileInput.uploadFile(test.file);

      // Poll for results
      console.log(`3. Waiting for analysis ...`);
      let finalState = null;
      for (let w = 0; w < 40; w++) {
        await new Promise(r => setTimeout(r, 3000));

        finalState = await page.evaluate(() => {
          const body = document.body?.innerText || "";

          // Check for price confirmation
          const confirmBtn = document.getElementById("confirmPriceBtn") ||
                             document.getElementById("tpConfirmPriceBtn");
          const manualBtn = document.getElementById("manualPriceBtn") ||
                            document.getElementById("tpManualPriceBtn");

          // Check for verdict/result
          const hasVerdict = body.includes("Fair Price") || body.includes("Overpriced") ||
                             body.includes("Below Average") || body.includes("Above Average") ||
                             body.includes("Unusually Low") || body.includes("Good Deal");

          // Check for "We found" price
          const foundPrice = body.includes("We found") || body.includes("found your quote") ||
                             body.includes("detected a total");

          // Check for manual entry
          const noPrice = body.includes("Enter your quote") || body.includes("couldn't read") ||
                          body.includes("enter the total") || body.includes("Manual");

          // Still processing?
          const processing = body.includes("Scanning") || body.includes("Processing") ||
                             body.includes("Extracting") || body.includes("Analyzing") ||
                             body.includes("Almost done") || body.includes("Reading");

          // Error
          const hasError = body.includes("Something went wrong") || body.includes("error");

          // Try to find price on screen
          const priceMatches = body.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
          const prices = priceMatches
            .map(p => parseFloat(p.replace(/[$,]/g, "")))
            .filter(v => v >= 10 && v <= 500000);

          // Get visible text sections
          const h2s = Array.from(document.querySelectorAll("h2, h3, .verdict, .price-display, .result-price"))
            .map(el => el.innerText.trim())
            .filter(t => t.length > 0);

          return {
            hasVerdict,
            foundPrice,
            noPrice,
            processing,
            hasError,
            prices: prices.slice(0, 8),
            headings: h2s.slice(0, 5),
            confirmVisible: !!confirmBtn && confirmBtn.offsetParent !== null,
            manualVisible: !!manualBtn && manualBtn.offsetParent !== null,
            bodySnippet: body.substring(0, 500),
          };
        });

        if (finalState.processing) {
          process.stdout.write(".");
          continue;
        }

        if (finalState.hasVerdict || finalState.foundPrice || finalState.noPrice ||
            finalState.confirmVisible || finalState.manualVisible || finalState.hasError) {
          break;
        }
      }
      console.log("");

      // Report what the user sees
      console.log(`\n--- WHAT THE USER SEES ---`);
      if (finalState.confirmVisible) {
        console.log(`   SCREEN: "We found your price" confirmation`);
        console.log(`   Prices on screen: ${finalState.prices.map(p => "$" + p).join(", ") || "NONE"}`);
      } else if (finalState.manualVisible || finalState.noPrice) {
        console.log(`   SCREEN: Manual entry required - parser couldn't read the quote`);
        console.log(`   Prices on screen: ${finalState.prices.map(p => "$" + p).join(", ") || "NONE"}`);
      } else if (finalState.hasVerdict) {
        console.log(`   SCREEN: Verdict/result shown`);
        console.log(`   Prices on screen: ${finalState.prices.map(p => "$" + p).join(", ") || "NONE"}`);
      } else if (finalState.processing) {
        console.log(`   SCREEN: Still processing after 2 minutes (timeout)`);
      } else {
        console.log(`   SCREEN: Unknown state`);
      }

      if (finalState.headings.length) {
        console.log(`   Headings: ${finalState.headings.join(" | ")}`);
      }

      // Console logs from parser
      if (logs.length) {
        console.log(`\n--- PARSER CONSOLE LOGS ---`);
        logs.forEach(l => console.log(`   ${l}`));
      }

      // First 500 chars of visible text
      console.log(`\n--- PAGE TEXT (first 500 chars) ---`);
      console.log(finalState.bodySnippet);

    } catch (e) {
      console.log(`   ERROR: ${e.message}`);
    }

    await page.close();
    logs.length = 0;
  }

  await browser.close();
  console.log("\n\nDONE");
})();
