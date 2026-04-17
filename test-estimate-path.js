// Test estimate path: click through like a user from the analyzer page
// through address entry to getting a result. Check for UX issues.
const puppeteer = require("puppeteer");

const BASE = "https://woogoro.com";

const ESTIMATES = [
  { url: "/plumbing-quote-analyzer.html", vertical: "Plumbing", state: "NC" },
  { url: "/roofing-quote-analyzer.html", vertical: "Roofing", state: "TX" },
  { url: "/hvac-quote-analyzer.html", vertical: "HVAC", state: "FL" },
  { url: "/electrical-quote-analyzer.html", vertical: "Electrical", state: "CA" },
  { url: "/moving-quote-analyzer.html", vertical: "Moving", state: "GA" },
];

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickByText(page, pattern) {
  const els = await page.$$("a, button, [role='tab'], [role='button'], div[class*='tab'], div[class*='option']");
  for (const el of els) {
    const text = await page.evaluate(e => (e.innerText || "").trim(), el);
    const visible = await page.evaluate(e => e.offsetParent !== null, el);
    if (visible && pattern.test(text)) {
      await el.click();
      return text;
    }
  }
  return null;
}

async function fillField(page, selector, value) {
  const el = await page.$(selector);
  if (!el) return false;
  await el.click({ clickCount: 3 });
  await el.type(value);
  return true;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"], timeout: 60000 });

  console.log("=".repeat(80));
  console.log("ESTIMATE PATH TEST: click through as a real user");
  console.log("=".repeat(80));

  for (const est of ESTIMATES) {
    console.log(`\n--- ${est.vertical} ---`);
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    const issues = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 120)));

    try {
      // Step 1: Load page
      await page.goto(BASE + est.url, { waitUntil: "networkidle2", timeout: 15000 });
      console.log("  1. Page loaded");

      // Step 2: Click estimate tab/link
      let clicked = await clickByText(page, /estimate|calculator|how much|get.*estimate/i);
      if (!clicked) {
        // Try the estimate-first URL
        await page.goto(BASE + est.url + "?path=estimate", { waitUntil: "networkidle2", timeout: 15000 });
        clicked = "direct URL";
      }
      await pause(1500);
      console.log("  2. Clicked: " + (clicked || "estimate path"));

      // Step 3: Check what's on screen
      let body = await page.evaluate(() => document.body.innerText.slice(0, 500));

      // Look for address/state fields
      const hasState = await page.$("#addrState, #stateSelect, select[name*='state']");
      const hasZip = await page.$("#addrZip, input[name*='zip']");

      if (hasState) {
        // Fill state
        const stateId = await page.evaluate(() => {
          const el = document.querySelector("#addrState, #stateSelect, select[name*='state']");
          return el ? (el.tagName === "SELECT" ? el.id : el.id) : null;
        });

        if (stateId) {
          const isSelect = await page.evaluate(id => document.getElementById(id)?.tagName === "SELECT", stateId);
          if (isSelect) {
            await page.select("#" + stateId, est.state);
          } else {
            await fillField(page, "#" + stateId, est.state);
          }
          console.log("  3. Filled state: " + est.state);
        }
      } else {
        console.log("  3. No state field found");
        issues.push("No state/address field on estimate page");
      }

      // Step 4: Look for vertical-specific options (service type, etc.)
      await pause(500);
      const options = await page.$$("[class*='option'], [class*='chip'], [data-val]");
      if (options.length > 0) {
        // Click the first option
        const firstOption = options[0];
        const optText = await page.evaluate(e => e.innerText.trim().slice(0, 30), firstOption);
        await firstOption.click();
        console.log("  4. Selected option: " + optText);
        await pause(500);
      }

      // Step 5: Click submit/next/get estimate
      let submitClicked = await clickByText(page, /get.*estimate|calculate|next|submit|see.*result/i);
      if (!submitClicked) {
        // Try any primary button
        submitClicked = await clickByText(page, /estimate|analyze|check|go/i);
      }
      console.log("  5. Clicked: " + (submitClicked || "no submit button found"));
      if (!submitClicked) issues.push("No submit/estimate button found");

      await pause(2000);

      // Step 6: Check for results
      body = await page.evaluate(() => document.body.innerText);
      const hasPrice = /\$[\d,]+/.test(body);
      const hasBenchmark = /average|benchmark|typical|fair|expected/i.test(body);
      const hasVerdict = /fair price|overpriced|below average|above average|good deal|unusually low/i.test(body);

      // Extract visible prices
      const prices = body.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
      const significantPrices = prices
        .map(p => parseFloat(p.replace(/[$,]/g, "")))
        .filter(v => v >= 100 && v <= 200000);

      if (hasVerdict) {
        console.log("  6. RESULT: Verdict shown");
        console.log("     Prices on screen: " + significantPrices.slice(0, 5).map(p => "$" + p.toLocaleString()).join(", "));
      } else if (hasPrice && hasBenchmark) {
        console.log("  6. RESULT: Price + benchmark shown");
        console.log("     Prices on screen: " + significantPrices.slice(0, 5).map(p => "$" + p.toLocaleString()).join(", "));
      } else if (hasPrice) {
        console.log("  6. PARTIAL: Prices visible but no verdict/benchmark");
        console.log("     Prices: " + significantPrices.slice(0, 5).map(p => "$" + p.toLocaleString()).join(", "));
        issues.push("Prices shown but no verdict or benchmark");
      } else {
        // Check if we're stuck on a step
        const bodySnippet = body.slice(0, 300).replace(/\n/g, " | ");
        console.log("  6. NO RESULT: still on form/step");
        console.log("     Body: " + bodySnippet.slice(0, 150));
        issues.push("Estimate did not produce a result");
      }

      // Check for JS errors
      if (errors.length) {
        console.log("  JS ERRORS:");
        errors.forEach(e => console.log("    " + e));
        issues.push("JS errors: " + errors.length);
      }

      // Check for UX issues
      // - Geolocation prompt
      // - Broken images
      // - Empty sections
      const brokenImages = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("img")).filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src).length;
      });
      if (brokenImages > 0) issues.push(brokenImages + " broken images");

      if (issues.length) {
        console.log("  ISSUES:");
        issues.forEach(i => console.log("    - " + i));
      } else {
        console.log("  No issues found");
      }

    } catch (e) {
      console.log("  ERROR: " + e.message.slice(0, 100));
    }

    await page.close();
  }

  await browser.close();
  console.log("\nDone.");
})();
