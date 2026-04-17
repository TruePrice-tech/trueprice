// Real-image accuracy test: upload actual Reddit/phone photos through each
// vertical's analyzer page, check if OCR + parser extracts a price.
// Reports: price found, OCR text length, time taken, confidence.

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = "https://woogoro.com";

const VERTICALS = [
  { name: "plumbing", url: "/plumbing-quote-analyzer.html", dir: "plumbing-images", inputId: "fileInput" },
  { name: "hvac", url: "/hvac-quote-analyzer.html", dir: "hvac-images", inputId: "fileInput" },
  { name: "electrical", url: "/electrical-quote-analyzer.html", dir: "electrical-images", inputId: "fileInput" },
  { name: "roofing", url: "/roofing-quote-analyzer.html", dir: "roofing-images", inputId: "quoteFile" },
  { name: "fencing", url: "/fencing-quote-analyzer.html", dir: "fencing-images", inputId: "fileInput" },
  { name: "concrete", url: "/concrete-quote-analyzer.html", dir: "concrete-images", inputId: "fileInput" },
  { name: "foundation", url: "/foundation-quote-analyzer.html", dir: "foundation-images", inputId: "fileInput" },
  { name: "garage-door", url: "/garage-door-quote-analyzer.html", dir: "garage-door-images", inputId: "fileInput" },
  { name: "gutters", url: "/gutters-quote-analyzer.html", dir: "gutters-images", inputId: "fileInput" },
  { name: "insulation", url: "/insulation-quote-analyzer.html", dir: "insulation-images", inputId: "fileInput" },
  { name: "kitchen", url: "/kitchen-quote-analyzer.html", dir: "kitchen-images", inputId: "fileInput" },
  { name: "landscaping", url: "/landscaping-quote-analyzer.html", dir: "landscaping-images", inputId: "fileInput" },
  { name: "painting", url: "/painting-quote-analyzer.html", dir: "painting-images", inputId: "fileInput" },
  { name: "siding", url: "/siding-quote-analyzer.html", dir: "siding-images", inputId: "fileInput" },
  { name: "solar", url: "/solar-quote-analyzer.html", dir: "solar-images", inputId: "fileInput" },
  { name: "windows", url: "/window-quote-analyzer.html", dir: "windows-images", inputId: "fileInput" },
  { name: "moving", url: "/moving-quote-analyzer.html", dir: "moving-images", inputId: "fileInput" },
  { name: "auto", url: "/auto-repair.html", dir: "auto-images", inputId: "fileInput" },
  { name: "medical", url: "/medical-bill-analyzer.html", dir: "medical-images", inputId: "fileInput" },
  { name: "legal", url: "/legal-fee-analyzer.html", dir: "legal-images", inputId: "fileInput" },
];

const requested = process.argv.slice(2);
const toTest = requested.length ? VERTICALS.filter(v => requested.includes(v.name)) : VERTICALS;

function pad(s, n) { return (s + " ".repeat(n)).slice(0, n); }

function getRealImages(dir) {
  const fullDir = path.resolve("test-quotes", dir);
  if (!fs.existsSync(fullDir)) return [];
  return fs.readdirSync(fullDir)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .filter(f => !f.includes("comparison") && !f.includes("messy"))
    .sort();
}

// Extract title-hint price from Reddit post title (manifest)
function loadManifestPrices(dir) {
  const manifestPath = path.resolve("test-quotes", dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return {};
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const map = {};
    for (const entry of manifest) {
      // Try to extract price hints from title
      const title = entry.title || "";
      const priceMatches = title.match(/\$[\d,]+k?/gi) || [];
      const prices = priceMatches.map(p => {
        let val = parseFloat(p.replace(/[$,]/g, ""));
        if (p.toLowerCase().endsWith("k")) val *= 1000;
        return val;
      }).filter(v => v >= 50 && v <= 500000);
      map[entry.file] = { title, hintPrices: prices, reddit: entry.permalink || "" };
    }
    return map;
  } catch { return {}; }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    timeout: 60000
  });

  let totalTests = 0, priceFound = 0, noPrice = 0, errors = 0;
  const results = [];

  console.log("\n=== REAL IMAGE ACCURACY TEST ===\n");
  console.log(pad("VERTICAL", 13) + pad("FIXTURE", 52) + pad("PRICE", 10) + pad("HINT", 10) + pad("TIME", 7) + "STATUS");
  console.log("-".repeat(100));

  for (const v of toTest) {
    const images = getRealImages(v.dir);
    if (!images.length) {
      console.log(pad(v.name, 13) + "(no real images found)");
      continue;
    }

    const manifestPrices = loadManifestPrices(v.dir);

    for (const img of images) {
      totalTests++;
      const imgPath = path.resolve("test-quotes", v.dir, img);
      const manifest = manifestPrices[img] || { title: "", hintPrices: [] };
      const hintStr = manifest.hintPrices.length ? "$" + manifest.hintPrices[0].toLocaleString() : "-";

      const page = await browser.newPage();
      page.setDefaultTimeout(120000);
      const pageErrors = [];
      page.on("pageerror", e => pageErrors.push(e.message.slice(0, 80)));

      const t0 = Date.now();
      let gotPrice = 0, status = "?", ocrLen = 0;

      try {
        await page.goto(BASE + v.url, { waitUntil: "networkidle2", timeout: 30000 });

        // For roofing, the file input is rendered by analyzer-ui.js after page load
        // For auto-repair, the file input is inside a dynamically rendered step
        // Wait for the file input to appear
        await page.waitForSelector(`#${v.inputId}`, { timeout: 15000 }).catch(() => null);

        const fileInput = await page.$(`#${v.inputId}`);
        if (!fileInput) {
          // Try generic fallback
          const fallback = await page.$("input[type='file']");
          if (!fallback) {
            status = "NO INPUT";
            console.log(pad(v.name, 13) + pad(img.slice(0, 50), 52) + pad("-", 10) + pad(hintStr, 10) + pad("-", 7) + status);
            await page.close();
            errors++;
            continue;
          }
          await fallback.uploadFile(imgPath);
        } else {
          await fileInput.uploadFile(imgPath);
        }

        // Wait for OCR + parsing to complete.
        // Possible end states:
        //   1. Price confirm screen (plumbing inline): #confirmPriceBtn
        //   2. Price confirm screen (shared component): #tpConfirmPriceBtn
        //   3. Manual entry screen (plumbing inline): #manualPriceBtn
        //   4. Manual entry screen (shared component): #tpManualPriceBtn
        //   5. High-confidence auto-skip: goes straight to result (verdict text)
        //   6. Roofing: window.__latestAnalysis populated
        //   7. Error state
        // Poll for up to 90s
        let found = false;
        for (let w = 0; w < 30; w++) {
          await new Promise(r => setTimeout(r, 3000));

          const check = await page.evaluate(() => {
            const body = document.body?.innerText || "";

            // Check for ALL possible price confirmation buttons
            const confirmBtn = document.getElementById("confirmPriceBtn") ||
                               document.getElementById("tpConfirmPriceBtn");
            const manualBtn = document.getElementById("manualPriceBtn") ||
                              document.getElementById("tpManualPriceBtn");

            // Check for price anywhere on page
            const priceMatches = body.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
            const prices = priceMatches
              .map(p => parseFloat(p.replace(/[$,]/g, "")))
              .filter(v => v >= 50 && v <= 500000);

            // Check for "We found" or "Enter your quote"
            const foundQuote = body.includes("We found") || body.includes("found your quote");
            const noQuote = body.includes("Enter your quote") || body.includes("couldn't read");

            // Check for result screen indicators (verdict shown = high-confidence auto-skip)
            const hasVerdict = body.includes("Fair Price") || body.includes("Overpriced") ||
                               body.includes("Below Average") || body.includes("Above Average") ||
                               body.includes("Unusually Low");

            // Check for error
            const hasError = body.includes("Something went wrong");

            // Check window.__latestAnalysis (roofing + any analyzer-ui.js page)
            let analysisPrice = 0;
            let analysisVerdict = "";
            try {
              const a = window.__latestAnalysis;
              if (a && a.quotePrice) { analysisPrice = a.quotePrice; analysisVerdict = a.verdict || ""; }
            } catch {}

            // Get OCR text length
            let ocrLen = 0;
            try {
              if (window.__TP_LAST_OCR_TEXT) ocrLen = window.__TP_LAST_OCR_TEXT.length;
              else if (window.__tpDebug?.getLatestParsed) {
                const p = window.__tpDebug.getLatestParsed();
                ocrLen = p?.rawText?.length || p?.text?.length || 0;
              }
            } catch {}

            // Still processing?
            const isProcessing = body.includes("Scanning") || body.includes("Processing") ||
                                 body.includes("Extracting") || body.includes("Analyzing") ||
                                 body.includes("Almost done") || body.includes("Loading");

            return {
              prices: prices.slice(0, 5),
              foundQuote,
              noQuote,
              hasVerdict,
              hasError,
              hasConfirmBtn: !!confirmBtn,
              hasManualBtn: !!manualBtn,
              analysisPrice,
              analysisVerdict,
              ocrLen,
              isProcessing
            };
          });

          // Price found on confirmation screen (either variant)
          if (check.hasConfirmBtn && check.prices.length) {
            gotPrice = check.prices[0];
            ocrLen = check.ocrLen;
            found = true;
            break;
          }

          // No price found (manual entry prompt, either variant)
          if (check.hasManualBtn || check.noQuote) {
            ocrLen = check.ocrLen;
            found = true;
            status = "NO PRICE";
            break;
          }

          // High-confidence auto-skip: went straight to result with verdict
          if (check.hasVerdict && check.prices.length) {
            gotPrice = check.prices[0];
            ocrLen = check.ocrLen;
            found = true;
            break;
          }

          // Roofing / analyzer-ui.js: __latestAnalysis populated
          if (check.analysisPrice > 0) {
            gotPrice = check.analysisPrice;
            ocrLen = check.ocrLen;
            found = true;
            break;
          }

          // Error
          if (check.hasError) {
            status = "ERROR";
            found = true;
            break;
          }

          // If not processing anymore and no buttons/result, it's stuck
          if (!check.isProcessing && w > 5) {
            // Give it 2 more polls then bail
            if (w > 8) {
              status = "STUCK";
              found = true;
              break;
            }
          }
        }

        if (!found) {
          status = "TIMEOUT";
        } else if (gotPrice > 0) {
          status = "FOUND";
          priceFound++;
        } else if (status !== "ERROR") {
          status = "NO PRICE";
          noPrice++;
        } else {
          errors++;
        }

      } catch (e) {
        status = "ERROR: " + e.message.slice(0, 40);
        errors++;
      }

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const priceStr = gotPrice > 0 ? "$" + Math.round(gotPrice).toLocaleString() : "-";

      console.log(
        pad(v.name, 13) +
        pad(img.slice(0, 50), 52) +
        pad(priceStr, 10) +
        pad(hintStr, 10) +
        pad(elapsed + "s", 7) +
        status +
        (pageErrors.length ? " [JS:" + pageErrors[0].slice(0, 30) + "]" : "")
      );

      results.push({
        vertical: v.name,
        file: img,
        extractedPrice: gotPrice,
        hintPrice: manifest.hintPrices[0] || null,
        title: manifest.title,
        status,
        elapsed: parseFloat(elapsed),
        ocrLen,
        jsErrors: pageErrors
      });

      await page.close();
    }
  }

  // Summary
  console.log("\n" + "=".repeat(100));
  console.log(`TOTAL: ${totalTests} images tested`);
  console.log(`  Price found: ${priceFound} (${Math.round(priceFound / totalTests * 100)}%)`);
  console.log(`  No price:    ${noPrice} (${Math.round(noPrice / totalTests * 100)}%)`);
  console.log(`  Errors:      ${errors}`);
  console.log(`  Timeout:     ${totalTests - priceFound - noPrice - errors}`);

  // Per-vertical summary
  console.log("\n--- Per Vertical ---");
  const verticalStats = {};
  for (const r of results) {
    if (!verticalStats[r.vertical]) verticalStats[r.vertical] = { total: 0, found: 0, noPrice: 0, errors: 0 };
    verticalStats[r.vertical].total++;
    if (r.status === "FOUND") verticalStats[r.vertical].found++;
    else if (r.status === "NO PRICE") verticalStats[r.vertical].noPrice++;
    else verticalStats[r.vertical].errors++;
  }
  for (const [v, s] of Object.entries(verticalStats)) {
    const pct = s.total > 0 ? Math.round(s.found / s.total * 100) : 0;
    console.log(`  ${pad(v, 14)} ${s.found}/${s.total} found (${pct}%)  ${s.noPrice} no-price  ${s.errors} errors`);
  }

  // Where title had a price hint, check if extracted price is in ballpark
  const withHints = results.filter(r => r.hintPrice && r.extractedPrice > 0);
  if (withHints.length) {
    console.log("\n--- Hint Price Comparison (where Reddit title mentioned a price) ---");
    let closeCount = 0;
    for (const r of withHints) {
      const ratio = r.extractedPrice / r.hintPrice;
      const close = ratio >= 0.3 && ratio <= 3.0;
      if (close) closeCount++;
      console.log(`  ${pad(r.vertical, 12)} ${pad(r.file.slice(0, 40), 42)} extracted=$${Math.round(r.extractedPrice)}  hint=$${Math.round(r.hintPrice)}  ratio=${ratio.toFixed(2)} ${close ? "" : "FAR OFF"}`);
    }
    console.log(`  ${closeCount}/${withHints.length} within 3x of hint price`);
  }

  // Save results to JSON
  const outPath = path.resolve("test-results-real-images.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${outPath}`);

  await browser.close();
})();
