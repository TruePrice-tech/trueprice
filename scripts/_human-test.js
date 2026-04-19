#!/usr/bin/env node
/**
 * Human-like test: upload ONE quote on the live site, wait until the result
 * ACTUALLY renders (poll for it), then take a full-page screenshot and dump
 * the entire visible result text so it can be READ.
 *
 * Tests one vertical at a time via CLI arg: node _human-test.js roofing
 */
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const ROOT = path.dirname(__dirname);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OUT = path.join(ROOT, "output", "human-test");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const VERTICALS = {
  roofing: { ana: "/roofing-quote-analyzer.html?path=quote", cmp: "/compare-roofing-quotes.html", fx: "roofing-images" },
  hvac: { ana: "/hvac-quote-analyzer.html?path=quote", cmp: "/compare-hvac-quotes.html", fx: "hvac-images" },
  plumbing: { ana: "/plumbing-quote-analyzer.html?path=quote", cmp: "/compare-plumbing-quotes.html", fx: "plumbing-images" },
  electrical: { ana: "/electrical-quote-analyzer.html?path=quote", cmp: "/compare-electrical-quotes.html", fx: "electrical-images" },
  solar: { ana: "/solar-quote-analyzer.html?path=quote", cmp: "/compare-solar-quotes.html", fx: "solar-images" },
  windows: { ana: "/window-quote-analyzer.html?path=quote", cmp: "/compare-windows-quotes.html", fx: "windows-images" },
  siding: { ana: "/siding-quote-analyzer.html?path=quote", cmp: "/compare-siding-quotes.html", fx: "siding-images" },
  painting: { ana: "/painting-quote-analyzer.html?path=quote", cmp: "/compare-painting-quotes.html", fx: "painting-images" },
  concrete: { ana: "/concrete-quote-analyzer.html?path=quote", cmp: "/compare-concrete-quotes.html", fx: "concrete-images" },
  fencing: { ana: "/fencing-quote-analyzer.html?path=quote", cmp: "/compare-fencing-quotes.html", fx: "fencing-images" },
  gutters: { ana: "/gutters-quote-analyzer.html?path=quote", cmp: "/compare-gutters-quotes.html", fx: "gutters-images" },
  insulation: { ana: "/insulation-quote-analyzer.html?path=quote", cmp: "/compare-insulation-quotes.html", fx: "insulation-images" },
  foundation: { ana: "/foundation-quote-analyzer.html?path=quote", cmp: "/compare-foundation-quotes.html", fx: "foundation-images" },
  "garage-door": { ana: "/garage-door-quote-analyzer.html?path=quote", cmp: "/compare-garage-door-quotes.html", fx: "garage-door-images" },
  kitchen: { ana: "/kitchen-quote-analyzer.html?path=quote", cmp: "/compare-kitchen-quotes.html", fx: "kitchen-images" },
  landscaping: { ana: "/landscaping-quote-analyzer.html?path=quote", cmp: "/compare-landscaping-quotes.html", fx: "landscaping-images" },
  moving: { ana: "/moving-quote-analyzer.html?path=quote", cmp: "/compare-moving-quotes.html", fx: "moving-images" },
  auto: { ana: "/auto-repair.html?path=quote", cmp: "/compare-auto-quotes.html", fx: "auto-images" },
  medical: { ana: "/medical-bill-analyzer.html?path=quote", cmp: "/compare-medical-quotes.html", fx: "medical-images" },
  legal: { ana: "/legal-fee-analyzer.html?path=quote", cmp: "/compare-legal-quotes.html", fx: "legal-images" },
};

function getFixtures(fxDir) {
  var dir = path.join(ROOT, "test-quotes", fxDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function(f) { return /\.(jpe?g|png)$/i.test(f); }).map(function(f) { return path.join(dir, f); });
}

// Wait until a condition is true on the page, polling every 2s, up to maxMs
async function waitForCondition(page, conditionFn, maxMs) {
  var start = Date.now();
  while (Date.now() - start < maxMs) {
    var result = await page.evaluate(conditionFn).catch(function() { return false; });
    if (result) return true;
    await sleep(2000);
  }
  return false;
}

async function testAnalyze(browser, name, v, fixture) {
  console.log("\n--- ANALYZE: " + name + " ---");
  console.log("Fixture: " + path.basename(fixture));
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  var errs = [];
  page.on("pageerror", function(e) { errs.push(e.message.substring(0, 150)); });

  await page.goto("https://woogoro.com" + v.ana, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function() {});
  await sleep(6000);

  // Handle address-first flow
  var hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });
  if (!hasFile) {
    console.log("  Address-first flow, filling...");
    await page.evaluate(function() {
      function setF(s, v) { var el = document.querySelector(s); if (el) { el.value = v; el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true})); } }
      setF("input[placeholder*='street' i], input[name*='street' i], input[id*='street' i], input[placeholder*='address' i]", "17064 Laurelmont Ct");
      setF("input[placeholder*='city' i], input[name*='city' i]", "Fort Mill");
      setF("input[placeholder*='state' i], input[name*='state' i]", "SC");
      setF("input[placeholder*='zip' i], input[name*='zip' i]", "29707");
    });
    await sleep(500);
    await page.evaluate(function() {
      var btns = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /estimate|continue|go|next/i.test(b.textContent); });
      if (btns[0]) btns[0].click();
    });
    await sleep(8000);
    // Try clicking through to quote upload
    await page.evaluate(function() {
      var btns = Array.from(document.querySelectorAll("button, a")).filter(function(b) { return b.offsetParent && /confirm|yes|upload|quote|have|analyze|check/i.test(b.textContent); });
      if (btns[0]) btns[0].click();
    });
    await sleep(5000);
    hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });
  }

  if (!hasFile) {
    console.log("  ERROR: No file input found");
    await page.screenshot({ path: path.join(OUT, name + "-ana-NO-FILE-INPUT.png"), fullPage: true });
    await page.close();
    return;
  }

  // Upload
  var fileInput = await page.$("input[type=file]");
  await fileInput.uploadFile(fixture);
  await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", {bubbles:true})); }, fileInput);
  console.log("  Uploaded. Polling for result (up to 90s)...");

  // Wait until OCR result appears (look for verdict/price/result section)
  var gotResult = await waitForCondition(page, function() {
    var body = document.body.innerText || "";
    // Look for actual result indicators (not static content)
    return /verdict|your quote|quote total|analyzed|analysis complete|fair price|above average|below average|overpriced/i.test(body.substring(0, 3000));
  }, 90000);

  await sleep(2000);
  await page.screenshot({ path: path.join(OUT, name + "-ana-result.png"), fullPage: true });

  // Dump the visible result text
  var resultText = await page.evaluate(function() {
    // Try to find the result container specifically
    var resultEl = document.querySelector("[class*='result'], [id*='result'], [class*='verdict'], [class*='report']");
    if (resultEl) return resultEl.innerText.substring(0, 3000);
    // Fallback: first 3000 chars of body
    return (document.body.innerText || "").substring(0, 3000);
  });

  console.log("  Got result: " + gotResult);
  console.log("  --- VISIBLE TEXT (first 2000 chars) ---");
  console.log(resultText.substring(0, 2000));
  console.log("  --- END ---");
  if (errs.length) console.log("  JS ERRORS: " + errs.join(" | "));

  await page.close();
}

async function testCompare(browser, name, v, fixtures) {
  console.log("\n--- COMPARE: " + name + " ---");
  console.log("Fixtures: " + fixtures.slice(0, 2).map(function(f) { return path.basename(f); }).join(", "));
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  var errs = [];
  page.on("pageerror", function(e) { errs.push(e.message.substring(0, 150)); });

  await page.goto("https://woogoro.com" + v.cmp, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function() {});
  await sleep(6000);

  var fileInputs = await page.$$("input[type=file]");
  console.log("  Upload slots: " + fileInputs.length);

  // Upload 2 files
  for (var i = 0; i < Math.min(2, fileInputs.length, fixtures.length); i++) {
    await fileInputs[i].uploadFile(fixtures[i]);
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", {bubbles:true})); }, fileInputs[i]);
    await sleep(1500);
  }

  console.log("  Uploaded 2 files. Polling for OCR completion (up to 120s)...");

  // Wait until BOTH slots show parsed (not "Parsing...")
  var ocrDone = await waitForCondition(page, function() {
    var body = document.body.innerText || "";
    // Check that we don't have "Parsing" visible anymore
    var parsing = body.match(/Parsing/g);
    return !parsing || parsing.length === 0;
  }, 120000);

  console.log("  OCR done: " + ocrDone);
  await page.screenshot({ path: path.join(OUT, name + "-cmp-after-ocr.png"), fullPage: true });

  // Now click compare button
  var clicked = await page.evaluate(function() {
    var btns = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /compare/i.test(b.textContent) && !b.disabled; });
    if (btns[0]) { btns[0].click(); return true; }
    return false;
  });
  console.log("  Compare button clicked: " + clicked);

  if (clicked) {
    await sleep(8000);
    await page.screenshot({ path: path.join(OUT, name + "-cmp-result.png"), fullPage: true });

    var resultText = await page.evaluate(function() {
      return (document.body.innerText || "").substring(0, 3000);
    });
    console.log("  --- COMPARE RESULT TEXT (first 2000 chars) ---");
    console.log(resultText.substring(0, 2000));
    console.log("  --- END ---");
  } else {
    console.log("  Compare button not clickable (still disabled or not found)");
  }

  if (errs.length) console.log("  JS ERRORS: " + errs.join(" | "));
  await page.close();
}

(async function() {
  var verticalName = process.argv[2] || "all";
  var browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  var toTest = [];
  if (verticalName === "all") {
    toTest = Object.keys(VERTICALS);
  } else {
    toTest = verticalName.split(",");
  }

  for (var i = 0; i < toTest.length; i++) {
    var name = toTest[i].trim();
    var v = VERTICALS[name];
    if (!v) { console.log("Unknown vertical: " + name); continue; }
    var fixtures = getFixtures(v.fx);

    console.log("\n" + "=".repeat(50));
    console.log("=== " + name.toUpperCase() + " (" + (i+1) + "/" + toTest.length + ") ===");
    console.log("=".repeat(50));

    if (fixtures.length > 0) {
      await testAnalyze(browser, name, v, fixtures[0]);
    }
    if (fixtures.length >= 2) {
      await testCompare(browser, name, v, fixtures.slice(0, 2));
    }
  }

  await browser.close();
  console.log("\nDone. Screenshots in " + OUT);
})();
