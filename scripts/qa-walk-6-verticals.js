#!/usr/bin/env node
/**
 * qa-walk-6-verticals.js
 *
 * QA walkthrough: pick 6 verticals at random, walk all 3 paths (estimate,
 * analyze, compare) from the homepage as a user would. Take screenshots,
 * report visible issues, broken links, console errors, and missing content.
 *
 * Usage: node scripts/qa-walk-6-verticals.js
 * Output: output/qa-walk/ (screenshots + report.json)
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const ROOT = path.dirname(__dirname);
const OUT_DIR = path.join(ROOT, "output", "qa-walk");
const BASE_URL = "https://truepricehq.com";

// Pool of verticals (mix of home services + non-home)
const ALL_VERTICALS = [
  "roofing", "hvac", "fence", "plumbing", "electrical", "siding",
  "window", "concrete", "painting", "gutter", "insulation",
  "foundation", "garage-door", "solar", "landscaping", "kitchen",
  "moving", "auto-repair", "medical", "legal",
];

// Pick 6 at random for variety
function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const VERTICAL_LABELS = {
  "roofing": "Roofing", "hvac": "HVAC", "fence": "Fence",
  "plumbing": "Plumbing", "electrical": "Electrical", "siding": "Siding",
  "window": "Window", "concrete": "Concrete", "painting": "Painting",
  "gutter": "Gutters", "insulation": "Insulation", "foundation": "Foundation",
  "garage-door": "Garage Door", "solar": "Solar", "landscaping": "Landscaping",
  "kitchen": "Kitchen", "moving": "Moving", "auto-repair": "Auto Repair",
  "medical": "Medical", "legal": "Legal",
};

async function setupOutput() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  // Clear old screenshots so fresh run is unambiguous
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith(".png") || f.endsWith(".json")) fs.unlinkSync(path.join(OUT_DIR, f));
  }
}

async function shot(page, name) {
  const file = path.join(OUT_DIR, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

// Find a clickable element matching text on the page (case-insensitive contains)
async function clickByText(page, selector, textRegexes) {
  const handle = await page.evaluateHandle((sel, regexSrcs) => {
    const regexes = regexSrcs.map(s => new RegExp(s, "i"));
    const els = [...document.querySelectorAll(sel)];
    return els.find(el => regexes.some(r => r.test(el.textContent || "")));
  }, selector, textRegexes);
  if (handle.asElement()) {
    await handle.asElement().click();
    return true;
  }
  return false;
}

async function getConsoleErrors(page) {
  return page._tpConsoleErrors || [];
}

function attachConsoleCapture(page) {
  page._tpConsoleErrors = [];
  page.on("console", msg => {
    if (msg.type() === "error") page._tpConsoleErrors.push(msg.text().substring(0, 300));
  });
  page.on("pageerror", err => {
    page._tpConsoleErrors.push("[pageerror] " + (err.message || "").substring(0, 300));
  });
  page.on("requestfailed", req => {
    page._tpConsoleErrors.push("[requestfailed] " + req.url() + " :: " + (req.failure()?.errorText || ""));
  });
}

async function walkEstimatePath(browser, vertical, label) {
  const findings = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  attachConsoleCapture(page);

  try {
    // 1. Homepage
    await page.goto(BASE_URL + "/", { waitUntil: "networkidle0", timeout: 30000 });
    await shot(page, `${vertical}-1-home`);

    // 2. Click "Get an estimate" intent card
    const clicked = await clickByText(page, "a.tp-intent-card, a.tp-card-estimate, a", [
      "estimate", "Don't have a quote", "no quote yet"
    ]);
    if (!clicked) {
      findings.push({severity: "high", issue: "Could not find 'Get an estimate' intent card on homepage"});
      await page.close();
      return findings;
    }
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }).catch(() => {});
    await shot(page, `${vertical}-2-estimate-picker`);

    // 3. Click the vertical card on /get-an-estimate.html
    const verticalClicked = await clickByText(page, "a", [`\\b${label}\\b`]);
    if (!verticalClicked) {
      findings.push({severity: "high", issue: `Could not find ${label} card on get-an-estimate.html`});
      await page.close();
      return findings;
    }
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }).catch(() => {});
    await shot(page, `${vertical}-3-estimate-page`);

    // Capture the URL we landed on
    const finalUrl = page.url();
    findings.push({severity: "info", landed: finalUrl});

    // Check for common UX issues
    const pageData = await page.evaluate(() => {
      const h1 = document.querySelector("h1")?.textContent?.trim() || "";
      const buttons = [...document.querySelectorAll("button")].map(b => b.textContent.trim()).filter(Boolean);
      const visibleInputs = [...document.querySelectorAll("input:not([type='hidden'])")].length;
      const fileUpload = document.querySelector("input[type='file']") !== null;
      const addressInput = document.querySelector("input[placeholder*='address' i], input[name*='address' i], input[id*='address' i]") !== null;
      const hasError = document.body.textContent.toLowerCase().includes("error") || document.body.textContent.includes("404") || document.body.textContent.includes("500");
      return { h1, buttonCount: buttons.length, sampleButtons: buttons.slice(0, 5), visibleInputs, fileUpload, addressInput, hasError };
    });
    findings.push({severity: "info", pageData});

    if (pageData.fileUpload && !pageData.addressInput) {
      findings.push({severity: "high", issue: "Estimate path landed on file upload (should be address input)"});
    }
    const errs = await getConsoleErrors(page);
    if (errs.length) findings.push({severity: "med", consoleErrors: errs.slice(0, 5)});

  } catch (e) {
    findings.push({severity: "high", issue: "exception during walk", error: e.message});
  } finally {
    await page.close();
  }
  return findings;
}

async function walkAnalyzePath(browser, vertical, label) {
  const findings = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  attachConsoleCapture(page);

  try {
    await page.goto(BASE_URL + "/", { waitUntil: "networkidle0", timeout: 30000 });

    const clicked = await clickByText(page, "a", ["analyze.*quote", "have a quote", "upload"]);
    if (!clicked) {
      findings.push({severity: "high", issue: "Could not find 'Analyze' intent card on homepage"});
      await page.close();
      return findings;
    }
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }).catch(() => {});
    await shot(page, `${vertical}-analyze-picker`);

    const verticalClicked = await clickByText(page, "a", [`\\b${label}\\b`]);
    if (!verticalClicked) {
      findings.push({severity: "high", issue: `Could not find ${label} card on analyze-my-quote.html`});
      await page.close();
      return findings;
    }
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }).catch(() => {});
    await shot(page, `${vertical}-analyze-page`);

    const finalUrl = page.url();
    findings.push({severity: "info", landed: finalUrl});

    const pageData = await page.evaluate(() => {
      const fileUpload = document.querySelector("input[type='file']") !== null;
      const h1 = document.querySelector("h1")?.textContent?.trim() || "";
      const addressInput = document.querySelector("input[placeholder*='address' i]") !== null;
      const hasUploadCTA = [...document.querySelectorAll("button, label, a")].some(el =>
        /upload|drop.*file|choose.*file|select.*file/i.test(el.textContent || "")
      );
      return { fileUpload, h1, addressInput, hasUploadCTA };
    });
    findings.push({severity: "info", pageData});

    if (!pageData.fileUpload) {
      findings.push({severity: "high", issue: "Analyze path missing file upload input"});
    }
    if (!pageData.hasUploadCTA) {
      findings.push({severity: "med", issue: "Analyze path has no obvious upload CTA"});
    }

    const errs = await getConsoleErrors(page);
    if (errs.length) findings.push({severity: "med", consoleErrors: errs.slice(0, 5)});

  } catch (e) {
    findings.push({severity: "high", issue: "exception during walk", error: e.message});
  } finally {
    await page.close();
  }
  return findings;
}

async function walkComparePath(browser, vertical, label) {
  const findings = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  attachConsoleCapture(page);

  try {
    await page.goto(BASE_URL + "/", { waitUntil: "networkidle0", timeout: 30000 });

    const clicked = await clickByText(page, "a", ["compare", "multiple quotes"]);
    if (!clicked) {
      findings.push({severity: "high", issue: "Could not find 'Compare' intent card on homepage"});
      await page.close();
      return findings;
    }
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }).catch(() => {});
    await shot(page, `${vertical}-compare-picker`);

    const verticalClicked = await clickByText(page, "a", [`\\b${label}\\b`]);
    if (!verticalClicked) {
      findings.push({severity: "high", issue: `Could not find ${label} card on compare-quotes-picker`});
      await page.close();
      return findings;
    }
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }).catch(() => {});
    await shot(page, `${vertical}-compare-page`);

    const finalUrl = page.url();
    findings.push({severity: "info", landed: finalUrl});

    const pageData = await page.evaluate(() => {
      const fileInputs = document.querySelectorAll("input[type='file']").length;
      const h1 = document.querySelector("h1")?.textContent?.trim() || "";
      return { fileInputs, h1 };
    });
    findings.push({severity: "info", pageData});

    if (pageData.fileInputs < 2) {
      findings.push({severity: "med", issue: `Compare path has only ${pageData.fileInputs} file input(s) — expected 2+ for comparison`});
    }

    const errs = await getConsoleErrors(page);
    if (errs.length) findings.push({severity: "med", consoleErrors: errs.slice(0, 5)});

  } catch (e) {
    findings.push({severity: "high", issue: "exception during walk", error: e.message});
  } finally {
    await page.close();
  }
  return findings;
}

(async () => {
  await setupOutput();

  // Pick 6 random verticals
  const verticals = pickRandom(ALL_VERTICALS, 6);
  console.log(`\nQA walk for: ${verticals.join(", ")}\n`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const allFindings = {};

  for (const vertical of verticals) {
    const label = VERTICAL_LABELS[vertical] || vertical;
    console.log(`=== ${vertical} (${label}) ===`);
    allFindings[vertical] = {
      label,
      estimate: await walkEstimatePath(browser, vertical, label),
      analyze: await walkAnalyzePath(browser, vertical, label),
      compare: await walkComparePath(browser, vertical, label),
    };
    console.log(`  estimate findings: ${allFindings[vertical].estimate.length}`);
    console.log(`  analyze findings:  ${allFindings[vertical].analyze.length}`);
    console.log(`  compare findings:  ${allFindings[vertical].compare.length}`);
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(allFindings, null, 2));

  // Print summary
  console.log("\n=== SUMMARY ===");
  for (const v of Object.keys(allFindings)) {
    const f = allFindings[v];
    const issues = [...f.estimate, ...f.analyze, ...f.compare].filter(x => x.severity === "high" || x.severity === "med");
    console.log(`${v}: ${issues.length} issues`);
    for (const i of issues) {
      console.log(`  [${i.severity}] ${i.issue || JSON.stringify(i).substring(0, 120)}`);
    }
  }

  console.log(`\nScreenshots + report at ${OUT_DIR}`);
})();
