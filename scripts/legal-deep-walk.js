// Legal vertical full walk: analyze + compare + estimate paths.
// Per the canonical 8-step procedure (project_fixture_truth_harness.md +
// feedback_deep_test_command.md), the harness covers the analyze path; this
// script walks the compare and estimate paths in browser as a human would.
//
// PARTIALLY SUPERSEDED 2026-05-04 by:
//   - test/legal/fixture-ground-truth.test.js (analyze-path regression)
//   - test/legal-compare/fixture-ground-truth.test.js (compare-path regression)
// This script is still useful for screenshot capture + manual visual review,
// but for CI / regression purposes, prefer the two harnesses (which are
// auto-discovered by .github/workflows/regression-gate.yml). Keep this
// script for occasional eyeballing, not for routine regression.
//
// Run: node scripts/legal-deep-walk.js
// Saves screenshots + DOM excerpts to output/legal-deep-walk-2026-05-03/

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const OUT = path.resolve(__dirname, "..", "output", "legal-deep-walk-2026-05-03");
fs.mkdirSync(OUT, { recursive: true });

const FIXTURES_DIR = path.resolve(__dirname, "..");
const COMPARE_FIXTURES = [
  "test-quotes/legal-images/comparison-pi-01-firm-a-low.png",
  "test-quotes/legal-images/comparison-pi-02-firm-b-mid.png",
  "test-quotes/legal-images/comparison-pi-03-firm-c-high.png",
];

async function walkCompare(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1440, height: 1000 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/legal-fee-estimate")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body: body.slice(0, 4000) });
    }
  });

  console.log("[compare] navigating");
  await page.goto(BASE + "/compare-legal-quotes.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  // Three slots: file0, file1, file2
  for (let i = 0; i < COMPARE_FIXTURES.length; i++) {
    const inp = await page.$(`#file${i}`);
    if (!inp) {
      console.log(`[compare] slot ${i} input not found`);
      continue;
    }
    console.log(`[compare] uploading slot ${i}: ${path.basename(COMPARE_FIXTURES[i])}`);
    await inp.uploadFile(path.join(FIXTURES_DIR, COMPARE_FIXTURES[i]));
    // Wait for slot to flip from "uploading" → "uploaded"
    await page.waitForFunction((idx) => {
      const slot = document.getElementById(`slot${idx}`);
      return slot && slot.classList.contains("uploaded");
    }, { timeout: 90000 }, i).catch(() => null);
    console.log(`[compare] slot ${i} settled`);
  }

  // After all 3 settle, screenshot the slot state, then click Compare.
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUT, "compare-3pi-slots.png"), fullPage: true });

  const btn = await page.$("#compareBtn");
  if (btn) {
    const disabled = await page.evaluate(b => b.disabled, btn);
    console.log("[compare] Compare button disabled? " + disabled);
    if (!disabled) {
      await btn.click();
      console.log("[compare] clicked Compare");
      await new Promise(r => setTimeout(r, 3500));
    }
  }
  await page.screenshot({ path: path.join(OUT, "compare-3pi-results.png"), fullPage: true });

  const summary = await page.evaluate(() => {
    const text = document.body.innerText;
    const slotsState = [0, 1, 2].map(i => {
      const slot = document.getElementById(`slot${i}`);
      return slot ? {
        classList: slot.className,
        text: (slot.innerText || "").slice(0, 200),
      } : null;
    });
    // Capture any rendered comparison cards / verdicts
    const cards = Array.from(document.querySelectorAll(".cq-card, .quote-card, .compare-card")).map(c => ({
      tag: c.tagName,
      cls: c.className,
      text: (c.innerText || "").slice(0, 600),
    }));
    return {
      bodyTextSlice: text.slice(0, 4000),
      slotsState,
      cards,
    };
  });

  fs.writeFileSync(path.join(OUT, "compare-summary.json"), JSON.stringify({ summary, apiResponses }, null, 2));
  console.log("[compare] saved summary + 1 screenshot");
  await page.close();
}

async function walkEstimate(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1440, height: 1000 });

  console.log("[estimate] navigating");
  await page.goto(BASE + "/legal-estimate.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(OUT, "estimate-01-landing.png"), fullPage: true });

  // Fill location and progress
  const fillField = async (sel, value) => {
    const el = await page.$(sel);
    if (!el) return false;
    await el.click({ clickCount: 3 });
    await el.type(value);
    return true;
  };
  await fillField('input[placeholder*="City" i], input[name*="city" i], #city', "Charlotte");
  await fillField('input[placeholder*="State" i], input[name*="state" i], #state', "NC");
  await fillField('input[placeholder*="ZIP" i], input[name*="zip" i], #zip', "28202");

  await page.screenshot({ path: path.join(OUT, "estimate-02-after-location.png"), fullPage: true });

  // Click the primary CTA (a real <button>)
  const clickButtonByText = async (txt) => {
    const handles = await page.$$("button, a, [role=button]");
    for (const h of handles) {
      const t = await page.evaluate(b => (b.innerText || "").trim(), h).catch(() => "");
      if (t === txt) { await h.click(); return true; }
    }
    return false;
  };
  // Click a .legal-option chooser by data-val
  const clickOption = async (val) => {
    return await page.evaluate(v => {
      const el = document.querySelector('.legal-option[data-val="' + v + '"]');
      if (el) { el.click(); return true; }
      return false;
    }, val);
  };

  const clicked = await clickButtonByText("Get Legal Fee Estimate");
  console.log("[estimate] click Get Legal Fee Estimate: " + clicked);
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUT, "estimate-03-after-cta.png"), fullPage: true });

  // Step 1: serviceType = personal_injury
  const s1 = await clickOption("personal_injury");
  console.log("[estimate] step1 personal_injury: " + s1);
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, "estimate-04-after-service.png"), fullPage: true });

  // Step 2: subType — pick the FIRST option whatever it is (varies per service)
  const s2 = await page.evaluate(() => {
    const el = document.querySelector('#optSubType .legal-option');
    if (el) { el.click(); return el.getAttribute("data-val") || "(no data-val)"; }
    return null;
  });
  console.log("[estimate] step2 subType: " + s2);
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, "estimate-05-after-subtype.png"), fullPage: true });

  // Step 3: complexity = moderate
  const s3 = await clickOption("moderate");
  console.log("[estimate] step3 moderate: " + s3);
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, "estimate-06-after-complexity.png"), fullPage: true });

  // Step 4: feeStructure = contingency
  const s4 = await clickOption("contingency");
  console.log("[estimate] step4 contingency: " + s4);
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUT, "estimate-07-result.png"), fullPage: true });

  // Capture the rendered result payload
  const finalState = await page.evaluate(() => ({
    bodyTextSlice: document.body.innerText.slice(0, 6000),
    verdictText: (document.querySelector(".legal-verdict") || {}).innerText || "",
    rangeText: (document.querySelector(".verdict-range") || {}).innerText || "",
    priceText: (document.querySelector(".verdict-price") || {}).innerText || "",
  }));
  fs.writeFileSync(path.join(OUT, "estimate-final-state.json"), JSON.stringify(finalState, null, 2));
  console.log("[estimate] done");
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  try {
    await walkCompare(browser);
    await walkEstimate(browser);
  } catch (e) {
    console.error("walk error:", e);
  } finally {
    await browser.close();
  }
  console.log("\nOutput dir: " + OUT);
})();
