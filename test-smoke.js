// Smoke test: load every analyzer and compare page, check for JS errors
const puppeteer = require("puppeteer");
const fs = require("fs");

const BASE = "https://truepricehq.com";

const PAGES = [
  // Single-quote analyzers
  { url: "/plumbing-quote-analyzer.html", label: "Plumbing analyzer" },
  { url: "/roofing-quote-analyzer.html", label: "Roofing analyzer" },
  { url: "/hvac-quote-analyzer.html", label: "HVAC analyzer" },
  { url: "/electrical-quote-analyzer.html", label: "Electrical analyzer" },
  { url: "/auto-repair.html", label: "Auto repair analyzer" },
  { url: "/solar-quote-analyzer.html", label: "Solar analyzer" },
  { url: "/moving-quote-analyzer.html", label: "Moving analyzer" },
  { url: "/painting-quote-analyzer.html", label: "Painting analyzer" },
  { url: "/fencing-quote-analyzer.html", label: "Fencing analyzer" },
  { url: "/concrete-quote-analyzer.html", label: "Concrete analyzer" },
  { url: "/foundation-quote-analyzer.html", label: "Foundation analyzer" },
  { url: "/gutters-quote-analyzer.html", label: "Gutters analyzer" },
  { url: "/insulation-quote-analyzer.html", label: "Insulation analyzer" },
  { url: "/kitchen-quote-analyzer.html", label: "Kitchen analyzer" },
  { url: "/siding-quote-analyzer.html", label: "Siding analyzer" },
  { url: "/window-quote-analyzer.html", label: "Window analyzer" },
  { url: "/garage-door-quote-analyzer.html", label: "Garage door analyzer" },
  { url: "/medical-bill-analyzer.html", label: "Medical analyzer" },
  { url: "/legal-fee-analyzer.html", label: "Legal analyzer" },
  { url: "/landscaping-quote-analyzer.html", label: "Landscaping analyzer" },

  // Compare pages
  { url: "/compare-plumbing-quotes.html", label: "Compare plumbing" },
  { url: "/compare-roofing-quotes.html", label: "Compare roofing" },
  { url: "/compare-hvac-quotes.html", label: "Compare HVAC" },
  { url: "/compare-electrical-quotes.html", label: "Compare electrical" },
  { url: "/compare-auto-quotes.html", label: "Compare auto" },
  { url: "/compare-solar-quotes.html", label: "Compare solar" },
  { url: "/compare-moving-quotes.html", label: "Compare moving" },
  { url: "/compare-painting-quotes.html", label: "Compare painting" },
  { url: "/compare-fencing-quotes.html", label: "Compare fencing" },
  { url: "/compare-concrete-quotes.html", label: "Compare concrete" },
  { url: "/compare-foundation-quotes.html", label: "Compare foundation" },
  { url: "/compare-gutters-quotes.html", label: "Compare gutters" },
  { url: "/compare-insulation-quotes.html", label: "Compare insulation" },
  { url: "/compare-kitchen-quotes.html", label: "Compare kitchen" },
  { url: "/compare-siding-quotes.html", label: "Compare siding" },
  { url: "/compare-windows-quotes.html", label: "Compare windows" },
  { url: "/compare-garage-door-quotes.html", label: "Compare garage door" },
  { url: "/compare-medical-quotes.html", label: "Compare medical" },
  { url: "/compare-legal-quotes.html", label: "Compare legal" },
  { url: "/compare-landscaping-quotes.html", label: "Compare landscaping" },
];

// Upload test for 3 paths: plumbing single, roofing single, plumbing compare
const UPLOAD_TESTS = [
  {
    label: "UPLOAD: Plumbing single-quote",
    url: "/plumbing-quote-analyzer.html",
    file: "test-quotes/real-quotes/plumbing/fixture-water-heater-handwritten.jpg",
    inputId: "fileInput",
  },
  {
    label: "UPLOAD: Roofing single-quote",
    url: "/roofing-quote-analyzer.html",
    file: "test-quotes/real-quotes/roofing/fixture-roof-replacement.jpg",
    inputId: "quoteFile",
  },
  {
    label: "UPLOAD: HVAC single-quote",
    url: "/hvac-quote-analyzer.html",
    file: "test-quotes/real-quotes/hvac/fixture-ac-replacement.jpg",
    inputId: "fileInput",
  },
];

const path = require("path");

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
    timeout: 60000,
  });

  let pass = 0, fail = 0, jsErrors = [];

  // Phase 1: Load every page, check for JS errors
  console.log("=== PHASE 1: PAGE LOAD (JS error check) ===\n");

  for (const p of PAGES) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 120)));

    try {
      await page.goto(BASE + p.url, { waitUntil: "networkidle2", timeout: 15000 });

      // Check critical scripts loaded
      const scriptsOk = await page.evaluate(() => {
        return {
          engine: typeof TP_Engine !== "undefined",
          scope: typeof TP_VerticalScope !== "undefined",
          parser: typeof parseExtractedText !== "undefined" || typeof window.parseExtractedText !== "undefined",
        };
      });

      if (errors.length) {
        console.log(`  FAIL: ${p.label} - ${errors.length} JS errors`);
        errors.forEach(e => console.log(`        ${e}`));
        jsErrors.push({ page: p.label, errors });
        fail++;
      } else {
        const missing = [];
        if (!scriptsOk.engine) missing.push("TP_Engine");
        if (!scriptsOk.scope) missing.push("TP_VerticalScope");
        if (missing.length) {
          console.log(`  WARN: ${p.label} - missing: ${missing.join(", ")}`);
        } else {
          console.log(`  OK:   ${p.label}`);
        }
        pass++;
      }
    } catch (e) {
      console.log(`  FAIL: ${p.label} - ${e.message.slice(0, 80)}`);
      fail++;
    }

    await page.close();
  }

  // Phase 2: Upload test on 3 paths
  console.log("\n=== PHASE 2: UPLOAD TEST (3 paths) ===\n");

  for (const test of UPLOAD_TESTS) {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    const errors = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 120)));

    try {
      console.log(`  ${test.label}...`);
      await page.goto(BASE + test.url, { waitUntil: "networkidle2", timeout: 20000 });

      // Navigate through address/setup steps to reach file upload
      // Try clicking "Analyze a Quote" or similar entry point
      await new Promise(r => setTimeout(r, 1500));

      // Look for analyze/upload tab or button
      const analyzeLinks = await page.$$("a, button");
      for (const link of analyzeLinks) {
        const text = await page.evaluate(el => el.innerText || "", link);
        if (/analyze.*quote|upload.*quote|have a quote/i.test(text)) {
          await link.click().catch(() => {});
          await new Promise(r => setTimeout(r, 1500));
          break;
        }
      }

      // If there's a state/zip field, fill it minimally to proceed
      const stateInput = await page.$("#stateSelect") || await page.$("#addrState") || await page.$("select[name*='state']");
      if (stateInput) {
        await page.select(stateInput._remoteObject ? "#" + await page.evaluate(el => el.id, stateInput) : "select", "NC").catch(() => {});
      }

      // Look for "next" or "continue" or "skip" button
      const allBtns = await page.$$("button");
      for (const btn of allBtns) {
        const text = await page.evaluate(el => el.innerText || "", btn);
        if (/^(next|continue|skip|get started|start)$/i.test(text.trim())) {
          await btn.click().catch(() => {});
          await new Promise(r => setTimeout(r, 1000));
          break;
        }
      }

      await new Promise(r => setTimeout(r, 1000));

      // Find file input
      let fileInput = await page.$(`#${test.inputId}`) || await page.$("input[type='file']");

      // If still no input, try clicking any remaining step buttons
      if (!fileInput) {
        const btns2 = await page.$$("button");
        for (const btn of btns2) {
          const text = await page.evaluate(el => el.innerText || "", btn);
          if (/upload|analyze|next|continue/i.test(text.trim())) {
            await btn.click().catch(() => {});
            await new Promise(r => setTimeout(r, 1500));
            break;
          }
        }
        fileInput = await page.$(`#${test.inputId}`) || await page.$("input[type='file']");
      }

      if (!fileInput) {
        console.log(`    SKIP: No file input found (page may require address step first)`);
        await page.close();
        continue;
      }

      const filePath = path.resolve(test.file);
      await fileInput.uploadFile(filePath);

      // Wait for processing
      let gotResult = false;
      for (let w = 0; w < 40; w++) {
        await new Promise(r => setTimeout(r, 3000));

        const state = await page.evaluate(() => {
          const body = document.body?.innerText || "";
          return {
            processing: /scanning|processing|extracting|analyzing|reading|loading|almost done/i.test(body),
            hasPrice: /\$[\d,]+/.test(body),
            hasVerdict: /fair price|overpriced|below average|above average|good deal/i.test(body),
            hasConfirm: !!(document.getElementById("confirmPriceBtn") || document.getElementById("tpConfirmPriceBtn")),
            hasManual: !!(document.getElementById("manualPriceBtn") || document.getElementById("tpManualPriceBtn")),
            hasError: /something went wrong|error|couldn't read/i.test(body),
          };
        });

        if (state.processing) { process.stdout.write("."); continue; }

        if (state.hasConfirm || state.hasManual || state.hasVerdict || state.hasError) {
          gotResult = true;
          console.log("");
          if (state.hasConfirm) console.log(`    RESULT: Price found, confirmation screen shown`);
          else if (state.hasManual) console.log(`    RESULT: Manual entry screen (OCR couldn't read)`);
          else if (state.hasVerdict) console.log(`    RESULT: Verdict shown (auto-confirmed)`);
          else if (state.hasError) console.log(`    RESULT: Error state`);

          if (errors.length) {
            console.log(`    JS ERRORS during upload:`);
            errors.forEach(e => console.log(`      ${e}`));
            fail++;
          } else {
            console.log(`    No JS errors during upload flow`);
            pass++;
          }
          break;
        }
      }

      if (!gotResult) {
        console.log(`\n    TIMEOUT: No result after 2 minutes`);
        if (errors.length) {
          console.log(`    JS ERRORS:`);
          errors.forEach(e => console.log(`      ${e}`));
        }
        fail++;
      }

    } catch (e) {
      console.log(`    ERROR: ${e.message.slice(0, 100)}`);
      fail++;
    }

    await page.close();
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log(`Pages loaded: ${pass + fail} (${pass} OK, ${fail} errors)`);
  if (jsErrors.length) {
    console.log(`\nPages with JS errors:`);
    jsErrors.forEach(e => console.log(`  ${e.page}: ${e.errors.length} errors`));
  } else {
    console.log("No JS errors on any page.");
  }

  await browser.close();
})();
