// Real user upload test: navigate through each page's steps, upload a quote,
// verify the result screen appears without JS errors.
const puppeteer = require("puppeteer");
const path = require("path");

const BASE = "https://truepricehq.com";

const TESTS = [
  // Single-quote: 5 verticals
  {
    label: "SINGLE: Plumbing",
    url: "/plumbing-quote-analyzer.html",
    file: "test-quotes/real-quotes/plumbing/fixture-water-heater-handwritten.jpg",
    steps: async (page) => {
      // Click "Analyze a Quote" tab if visible
      await clickText(page, /analyze.*quote|have a quote|upload/i);
      await pause(1000);
      // Fill state if needed
      await trySelectState(page);
      await pause(500);
      // Click next/continue
      await clickText(page, /^next$|^continue$|^skip$/i);
      await pause(1000);
    }
  },
  {
    label: "SINGLE: Roofing",
    url: "/roofing-quote-analyzer.html",
    file: "test-quotes/real-quotes/roofing/fixture-roof-replacement.jpg",
    steps: async (page) => {
      // Roofing uses analyzer-ui, may have direct upload
      await clickText(page, /analyze.*quote|upload.*quote|have a quote/i);
      await pause(1500);
    }
  },
  {
    label: "SINGLE: HVAC",
    url: "/hvac-quote-analyzer.html",
    file: "test-quotes/real-quotes/hvac/fixture-ac-replacement.jpg",
    steps: async (page) => {
      await clickText(page, /analyze.*quote|have a quote|upload/i);
      await pause(1000);
      await trySelectState(page);
      await pause(500);
      await clickText(page, /^next$|^continue$|^skip$/i);
      await pause(1000);
    }
  },
  {
    label: "SINGLE: Electrical",
    url: "/electrical-quote-analyzer.html",
    file: "test-quotes/real-quotes/electrical/fixture-panel-upgrade.jpg",
    steps: async (page) => {
      await clickText(page, /analyze.*quote|have a quote|upload/i);
      await pause(1000);
      await trySelectState(page);
      await pause(500);
      await clickText(page, /^next$|^continue$|^skip$/i);
      await pause(1000);
    }
  },
  {
    label: "SINGLE: Moving",
    url: "/moving-quote-analyzer.html",
    file: "test-quotes/real-quotes/moving/fixture-local-move.jpg",
    steps: async (page) => {
      await clickText(page, /analyze.*quote|have a quote|upload/i);
      await pause(1000);
      await trySelectState(page);
      await pause(500);
      await clickText(page, /^next$|^continue$|^skip$|^analyze$/i);
      await pause(1000);
    }
  },

  // Compare: 3 verticals (upload 1 quote to slot 1)
  {
    label: "COMPARE: Plumbing",
    url: "/compare-plumbing-quotes.html",
    file: "test-quotes/real-quotes/plumbing/fixture-water-heater-handwritten.jpg",
    steps: async (page) => {
      // Compare pages usually have upload slots directly visible
      await pause(1500);
    }
  },
  {
    label: "COMPARE: Roofing",
    url: "/compare-roofing-quotes.html",
    file: "test-quotes/real-quotes/roofing/fixture-roof-replacement.jpg",
    steps: async (page) => {
      await pause(1500);
    }
  },
  {
    label: "COMPARE: HVAC",
    url: "/compare-hvac-quotes.html",
    file: "test-quotes/real-quotes/hvac/fixture-ac-replacement.jpg",
    steps: async (page) => {
      await pause(1500);
    }
  },
];

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickText(page, pattern) {
  try {
    const elements = await page.$$("a, button, [role='tab'], [role='button'], .tab, .nav-link");
    for (const el of elements) {
      const text = await page.evaluate(e => (e.innerText || e.textContent || "").trim(), el);
      if (pattern.test(text)) {
        await el.click();
        return true;
      }
    }
  } catch (e) {}
  return false;
}

async function trySelectState(page) {
  try {
    const selects = await page.$$("select");
    for (const sel of selects) {
      const id = await page.evaluate(e => e.id || "", sel);
      if (/state/i.test(id)) {
        await page.select("#" + id, "NC");
        return;
      }
    }
  } catch (e) {}
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
    timeout: 60000,
  });

  let pass = 0, fail = 0;

  for (const test of TESTS) {
    console.log(`\n${test.label}`);
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    const errors = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 150)));

    try {
      await page.goto(BASE + test.url, { waitUntil: "networkidle2", timeout: 20000 });

      // Run page-specific navigation steps
      await test.steps(page);

      // Find file input
      let fileInput = await page.$("input[type='file']");

      if (!fileInput) {
        // Try one more round of clicking
        await clickText(page, /upload|analyze|quote|next|continue/i);
        await pause(2000);
        fileInput = await page.$("input[type='file']");
      }

      if (!fileInput) {
        console.log("  NO FILE INPUT found after navigation");
        fail++;
        await page.close();
        continue;
      }

      // Upload
      const filePath = path.resolve(test.file);
      await fileInput.uploadFile(filePath);
      console.log("  Uploaded, waiting for result...");

      // Wait for result (up to 90s)
      let result = "timeout";
      for (let w = 0; w < 30; w++) {
        await pause(3000);
        const state = await page.evaluate(() => {
          const body = document.body?.innerText || "";
          const processing = /scanning|processing|extracting|analyzing|reading|loading|almost done|checking/i.test(body);
          const hasConfirm = !!(document.getElementById("confirmPriceBtn") || document.getElementById("tpConfirmPriceBtn"));
          const hasManual = !!(document.getElementById("manualPriceBtn") || document.getElementById("tpManualPriceBtn"));
          const hasVerdict = /fair price|overpriced|below average|above average|good deal|unusually low/i.test(body);
          const hasError = /something went wrong/i.test(body);
          // Compare page: check if quote data appeared
          const hasCompareData = /quote\s*[123]|contractor|total.*\$/i.test(body) && /uploaded|analyzed|parsed/i.test(body);
          // Compare: check if the uploaded file name appears
          const hasFileName = body.includes(".jpg") || body.includes(".jpeg") || body.includes(".png");
          return { processing, hasConfirm, hasManual, hasVerdict, hasError, hasCompareData, hasFileName };
        });

        if (state.processing) { process.stdout.write("."); continue; }

        if (state.hasConfirm) { result = "price_confirm"; break; }
        if (state.hasManual) { result = "manual_entry"; break; }
        if (state.hasVerdict) { result = "verdict"; break; }
        if (state.hasError) { result = "error"; break; }
        if (state.hasCompareData || state.hasFileName) { result = "compare_data"; break; }
      }

      console.log("");
      const resultLabels = {
        price_confirm: "Price found, confirmation shown",
        manual_entry: "Manual entry (OCR couldn't read)",
        verdict: "Verdict displayed",
        compare_data: "Compare data loaded",
        error: "Error state",
        timeout: "TIMEOUT (no result after 90s)",
      };
      console.log("  Result: " + resultLabels[result]);

      if (errors.length) {
        console.log("  JS ERRORS:");
        errors.forEach(e => console.log("    " + e));
        fail++;
      } else if (result === "timeout" || result === "error") {
        fail++;
      } else {
        console.log("  No JS errors");
        pass++;
      }

    } catch (e) {
      console.log("  EXCEPTION: " + e.message.slice(0, 100));
      fail++;
    }

    await page.close();
  }

  console.log("\n=== RESULTS ===");
  console.log(`${pass} passed, ${fail} failed out of ${TESTS.length} tests`);

  await browser.close();
})();
