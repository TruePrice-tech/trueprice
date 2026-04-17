#!/usr/bin/env node
/**
 * qa-walk-thorough.js — full human-like walkthrough of Woogoro flows.
 *
 * For each vertical and each path:
 *   1. Open page, wait until DOM is FULLY rendered + JS settled (not just networkidle)
 *   2. Print the actual visible page state: title, h1, visible buttons, key inputs
 *   3. Try to click as a user would (looking for actual button text)
 *   4. Wait for transitions, then describe what's visible now
 *   5. Take a screenshot AND extract rendered text content for review
 *   6. Capture every console error, network failure, broken link
 *
 * Output: text report + screenshots in output/qa-thorough/
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const ROOT = path.dirname(__dirname);
const OUT_DIR = path.join(ROOT, "output", "qa-thorough");
const BASE = "https://woogoro.com";

// Wait helpers
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function setupOutput() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    fs.unlinkSync(path.join(OUT_DIR, f));
  }
}

async function shot(page, name) {
  const file = path.join(OUT_DIR, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

// Wait for the page to be FULLY visually settled — no spinners, no loading text
async function waitForRender(page, maxMs = 8000) {
  // First wait for network idle and main render
  await page.waitForNetworkIdle({ idleTime: 1500, timeout: maxMs }).catch(() => {});
  // Then explicitly wait extra time for any client-side JS rendering
  await sleep(1500);
  // Wait for any visible spinners to disappear
  await page.evaluate(() => {
    return new Promise(resolve => {
      let attempts = 0;
      const check = () => {
        attempts++;
        const spinners = [...document.querySelectorAll("[class*='spin'], [class*='loading'], [class*='loader']")]
          .filter(el => el.offsetParent !== null);
        if (spinners.length === 0 || attempts > 10) resolve();
        else setTimeout(check, 200);
      };
      check();
    });
  }).catch(() => {});
}

// Read the visible rendered state of the page
async function describePage(page) {
  return await page.evaluate(() => {
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.offsetParent !== null;
    };
    const text = el => (el.textContent || "").trim().replace(/\s+/g, " ").substring(0, 100);

    const title = document.title;
    const url = location.href;
    const h1 = [...document.querySelectorAll("h1")].filter(visible).map(text);
    const h2 = [...document.querySelectorAll("h2")].filter(visible).map(text);

    // Visible CTAs (buttons + button-like links)
    const ctaSelectors = "button, a.btn, a.tp-intent-card, a.est-card, a.cs-btn, [role='button']";
    const ctas = [...document.querySelectorAll(ctaSelectors)]
      .filter(visible)
      .map(text)
      .filter(t => t.length > 0)
      .slice(0, 25);

    // Visible inputs
    const inputs = [...document.querySelectorAll("input:not([type='hidden']), textarea, select")]
      .filter(visible)
      .map(el => ({
        type: el.type || el.tagName.toLowerCase(),
        placeholder: (el.placeholder || "").substring(0, 50),
        value: (el.value || "").substring(0, 100),
        name: (el.name || el.id || "").substring(0, 50),
        required: el.required || false,
      }));

    // Page word count
    const bodyText = document.body.innerText || "";
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

    // Detect known issues
    const issues = [];
    if (bodyText.includes("404") || bodyText.includes("Not Found")) issues.push("possible 404");
    if (bodyText.includes("Internal Server Error") || bodyText.includes("500")) issues.push("possible 500");
    if (/undefined|NaN|null/i.test(bodyText.substring(0, 5000))) issues.push("template variable not interpolated");
    if (wordCount < 50) issues.push(`thin content (${wordCount} words)`);

    // Check for broken images
    const brokenImgs = [...document.querySelectorAll("img")]
      .filter(img => img.complete && img.naturalHeight === 0)
      .map(img => img.src.substring(0, 80));

    return {
      url, title, h1, h2, ctas, inputs,
      wordCount, issues, brokenImgs,
      bodyTextSample: bodyText.substring(0, 600).replace(/\s+/g, " "),
    };
  });
}

// Click a button matching exact text (case-insensitive contains)
async function clickByVisibleText(page, textPattern) {
  const result = await page.evaluate(pattern => {
    const re = new RegExp(pattern, "i");
    const visible = el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.offsetParent !== null;
    };
    const candidates = [...document.querySelectorAll("a, button, [role='button']")];
    for (const el of candidates) {
      if (!visible(el)) continue;
      const text = (el.textContent || "").trim().replace(/\s+/g, " ");
      if (re.test(text)) {
        el.click();
        return { ok: true, text: text.substring(0, 80) };
      }
    }
    return { ok: false, available: candidates.filter(visible).slice(0, 10).map(c => (c.textContent || "").trim().replace(/\s+/g, " ").substring(0, 60)) };
  }, textPattern);
  return result;
}

function attachConsoleCapture(page) {
  page._errors = [];
  page._failedReqs = [];
  page.on("pageerror", e => page._errors.push("[pageerror] " + (e.message || "").substring(0, 200)));
  page.on("console", msg => {
    if (msg.type() === "error") page._errors.push(msg.text().substring(0, 200));
  });
  page.on("requestfailed", req => {
    page._failedReqs.push(req.url() + " :: " + (req.failure()?.errorText || ""));
  });
}

const REPORT = [];
function log(s) { console.log(s); REPORT.push(s); }

async function walkVertical(browser, vertical, label) {
  log(`\n${"=".repeat(60)}\n=== ${vertical.toUpperCase()} (${label}) ===\n${"=".repeat(60)}`);

  // === ESTIMATE PATH ===
  log(`\n--- ESTIMATE PATH ---`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  attachConsoleCapture(page);

  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForRender(page);
    let state = await describePage(page);
    log(`Step 1: Homepage at ${state.url}`);
    log(`  Title: "${state.title}"`);
    log(`  H1: ${JSON.stringify(state.h1)}`);
    log(`  Visible CTAs (sample): ${JSON.stringify(state.ctas.slice(0, 8))}`);
    log(`  Word count: ${state.wordCount}`);
    if (state.issues.length) log(`  ISSUES: ${state.issues.join(", ")}`);
    await shot(page, `${vertical}-est-1-home`);

    // Click "Get an estimate" — match the actual visible text (looking at homepage I know it says "Don't have a quote yet?")
    const click1 = await clickByVisibleText(page, "Get an estimate|Don't have a quote yet|Estimate first");
    if (!click1.ok) {
      log(`  ✗ Could not click "Get an estimate" CTA. Available: ${JSON.stringify(click1.available)}`);
      await page.close();
      return;
    }
    log(`  ✓ Clicked: "${click1.text}"`);
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await waitForRender(page);

    state = await describePage(page);
    log(`Step 2: Estimate picker at ${state.url}`);
    log(`  Title: "${state.title}"`);
    log(`  H1: ${JSON.stringify(state.h1)}`);
    log(`  Word count: ${state.wordCount}`);
    if (state.issues.length) log(`  ISSUES: ${state.issues.join(", ")}`);
    await shot(page, `${vertical}-est-2-picker`);

    // Click vertical card by exact label match
    const click2 = await clickByVisibleText(page, `^${label}$|^${label}\\s|\\b${label}\\b`);
    if (!click2.ok) {
      log(`  ✗ Could not click "${label}" card. Available: ${JSON.stringify(click2.available.slice(0, 5))}`);
      await page.close();
      return;
    }
    log(`  ✓ Clicked: "${click2.text}"`);
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await waitForRender(page);

    state = await describePage(page);
    log(`Step 3: Vertical estimate page at ${state.url}`);
    log(`  Title: "${state.title}"`);
    log(`  H1: ${JSON.stringify(state.h1)}`);
    log(`  H2 (first 5): ${JSON.stringify(state.h2.slice(0, 5))}`);
    log(`  Word count: ${state.wordCount}`);
    log(`  Visible inputs: ${state.inputs.length} (${JSON.stringify(state.inputs.slice(0, 3))})`);
    log(`  Visible CTAs (sample): ${JSON.stringify(state.ctas.slice(0, 5))}`);
    if (state.issues.length) log(`  ISSUES: ${state.issues.join(", ")}`);
    if (state.brokenImgs.length) log(`  BROKEN IMAGES: ${JSON.stringify(state.brokenImgs.slice(0, 3))}`);
    await shot(page, `${vertical}-est-3-page`);

    if (page._errors.length) log(`  CONSOLE ERRORS: ${JSON.stringify(page._errors.slice(0, 3))}`);
    if (page._failedReqs.length) log(`  FAILED REQUESTS: ${JSON.stringify(page._failedReqs.slice(0, 3))}`);
  } catch (e) {
    log(`  EXCEPTION: ${e.message}`);
  } finally {
    await page.close();
  }

  // === ANALYZE PATH ===
  log(`\n--- ANALYZE PATH ---`);
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1366, height: 900 });
  attachConsoleCapture(page2);

  try {
    await page2.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForRender(page2);

    // Look for the analyze CTA — should match "I have a quote" or "Analyze a quote" or similar
    const click1 = await clickByVisibleText(page2, "I have a quote|Analyze.*quote|^Analyze");
    if (!click1.ok) {
      log(`  ✗ Could not click "Analyze" CTA. Available: ${JSON.stringify(click1.available)}`);
      await page2.close();
      return;
    }
    log(`  ✓ Clicked: "${click1.text}"`);
    await page2.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await waitForRender(page2);

    let state = await describePage(page2);
    log(`Step 2: Analyze picker at ${state.url}`);
    log(`  Title: "${state.title}"`);
    log(`  H1: ${JSON.stringify(state.h1)}`);
    log(`  Word count: ${state.wordCount}`);
    if (state.issues.length) log(`  ISSUES: ${state.issues.join(", ")}`);
    await shot(page2, `${vertical}-ana-1-picker`);

    const click2 = await clickByVisibleText(page2, `^${label}$|^${label}\\s|\\b${label}\\b`);
    if (!click2.ok) {
      log(`  ✗ Could not click "${label}" card. Available: ${JSON.stringify(click2.available.slice(0, 5))}`);
      await page2.close();
      return;
    }
    log(`  ✓ Clicked: "${click2.text}"`);
    await page2.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await waitForRender(page2);

    state = await describePage(page2);
    log(`Step 3: Analyzer page at ${state.url}`);
    log(`  Title: "${state.title}"`);
    log(`  H1: ${JSON.stringify(state.h1)}`);
    log(`  Word count: ${state.wordCount}`);
    log(`  Visible inputs: ${state.inputs.length} (${JSON.stringify(state.inputs.slice(0, 3))})`);
    const hasFileInput = state.inputs.some(i => i.type === "file");
    log(`  File upload present: ${hasFileInput ? "✓ yes" : "✗ NO (expected for analyze path)"}`);
    if (state.issues.length) log(`  ISSUES: ${state.issues.join(", ")}`);
    await shot(page2, `${vertical}-ana-2-page`);

    if (page2._errors.length) log(`  CONSOLE ERRORS: ${JSON.stringify(page2._errors.slice(0, 3))}`);
  } catch (e) {
    log(`  EXCEPTION: ${e.message}`);
  } finally {
    await page2.close();
  }

  // === COMPARE PATH ===
  log(`\n--- COMPARE PATH ---`);
  const page3 = await browser.newPage();
  await page3.setViewport({ width: 1366, height: 900 });
  attachConsoleCapture(page3);

  try {
    await page3.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForRender(page3);

    const click1 = await clickByVisibleText(page3, "Multiple quotes|Compare\\s*\\d|Compare quotes|^Compare");
    if (!click1.ok) {
      log(`  ✗ Could not click "Compare" CTA. Available: ${JSON.stringify(click1.available)}`);
      await page3.close();
      return;
    }
    log(`  ✓ Clicked: "${click1.text}"`);
    await page3.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await waitForRender(page3);

    let state = await describePage(page3);
    log(`Step 2: Compare picker at ${state.url}`);
    log(`  Title: "${state.title}"`);
    log(`  H1: ${JSON.stringify(state.h1)}`);
    log(`  Word count: ${state.wordCount}`);
    if (state.issues.length) log(`  ISSUES: ${state.issues.join(", ")}`);
    await shot(page3, `${vertical}-cmp-1-picker`);

    const click2 = await clickByVisibleText(page3, `^${label}$|^${label}\\s|\\b${label}\\b`);
    if (!click2.ok) {
      log(`  ✗ Could not click "${label}" card. Available: ${JSON.stringify(click2.available.slice(0, 5))}`);
      await page3.close();
      return;
    }
    log(`  ✓ Clicked: "${click2.text}"`);
    await page3.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await waitForRender(page3);

    state = await describePage(page3);
    log(`Step 3: Compare page at ${state.url}`);
    log(`  Title: "${state.title}"`);
    log(`  H1: ${JSON.stringify(state.h1)}`);
    log(`  Word count: ${state.wordCount}`);
    log(`  Visible inputs: ${state.inputs.length}`);
    const fileInputs = state.inputs.filter(i => i.type === "file").length;
    log(`  File upload count: ${fileInputs} (expected 2-3 for compare path)`);
    if (state.issues.length) log(`  ISSUES: ${state.issues.join(", ")}`);
    await shot(page3, `${vertical}-cmp-2-page`);

    if (page3._errors.length) log(`  CONSOLE ERRORS: ${JSON.stringify(page3._errors.slice(0, 3))}`);
  } catch (e) {
    log(`  EXCEPTION: ${e.message}`);
  } finally {
    await page3.close();
  }
}

// ============================================================
// Main
// ============================================================
(async () => {
  await setupOutput();
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const verticals = [
    ["roofing", "Roofing"],
    ["hvac", "HVAC"],
    ["fence", "Fence"],
    ["plumbing", "Plumbing"],
    ["solar", "Solar"],
    ["concrete", "Concrete"],
  ];

  for (const [v, label] of verticals) {
    await walkVertical(browser, v, label);
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT_DIR, "report.txt"), REPORT.join("\n"));
  console.log(`\n\nReport saved to ${OUT_DIR}/report.txt`);
})();
