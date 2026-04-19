#!/usr/bin/env node
/**
 * Deep human-like test of every vertical, every path.
 * - Estimate: fill ALL form fields step by step, submit, read pricing result, verify sanity
 * - Analyze: upload a real messy image, wait for OCR, read full result text
 * - Compare: upload 2 different images, wait for OCR, click compare, read result
 * - Screenshots at every step
 * - Captures full rendered text for review
 */
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const ROOT = path.dirname(__dirname);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OUT = path.join(ROOT, "output", "deep-test");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const VERTICALS = [
  { name: "roofing", est: "/roofing-quote-analyzer.html?mode=estimator", ana: "/roofing-quote-analyzer.html?path=quote", cmp: "/compare-roofing-quotes.html", fx: "roofing-images" },
  { name: "hvac", est: "/hvac-estimate.html", ana: "/hvac-quote-analyzer.html?path=quote", cmp: "/compare-hvac-quotes.html", fx: "hvac-images" },
  { name: "plumbing", est: "/plumbing-estimate.html", ana: "/plumbing-quote-analyzer.html?path=quote", cmp: "/compare-plumbing-quotes.html", fx: "plumbing-images" },
  { name: "electrical", est: "/electrical-estimate.html", ana: "/electrical-quote-analyzer.html?path=quote", cmp: "/compare-electrical-quotes.html", fx: "electrical-images" },
  { name: "solar", est: "/solar-estimate.html", ana: "/solar-quote-analyzer.html?path=quote", cmp: "/compare-solar-quotes.html", fx: "solar-images" },
  { name: "windows", est: "/window-estimate.html", ana: "/window-quote-analyzer.html?path=quote", cmp: "/compare-windows-quotes.html", fx: "windows-images" },
  { name: "siding", est: "/siding-estimate.html", ana: "/siding-quote-analyzer.html?path=quote", cmp: "/compare-siding-quotes.html", fx: "siding-images" },
  { name: "painting", est: "/painting-estimate.html", ana: "/painting-quote-analyzer.html?path=quote", cmp: "/compare-painting-quotes.html", fx: "painting-images" },
  { name: "concrete", est: "/concrete-estimate.html", ana: "/concrete-quote-analyzer.html?path=quote", cmp: "/compare-concrete-quotes.html", fx: "concrete-images" },
  { name: "fencing", est: "/fencing-estimate.html", ana: "/fencing-quote-analyzer.html?path=quote", cmp: "/compare-fencing-quotes.html", fx: "fencing-images" },
  { name: "gutters", est: "/gutters-estimate.html", ana: "/gutters-quote-analyzer.html?path=quote", cmp: "/compare-gutters-quotes.html", fx: "gutters-images" },
  { name: "insulation", est: "/insulation-estimate.html", ana: "/insulation-quote-analyzer.html?path=quote", cmp: "/compare-insulation-quotes.html", fx: "insulation-images" },
  { name: "foundation", est: "/foundation-estimate.html", ana: "/foundation-quote-analyzer.html?path=quote", cmp: "/compare-foundation-quotes.html", fx: "foundation-images" },
  { name: "garage-door", est: "/garage-door-estimate.html", ana: "/garage-door-quote-analyzer.html?path=quote", cmp: "/compare-garage-door-quotes.html", fx: "garage-door-images" },
  { name: "kitchen", est: "/kitchen-estimate.html", ana: "/kitchen-quote-analyzer.html?path=quote", cmp: "/compare-kitchen-quotes.html", fx: "kitchen-images" },
  { name: "landscaping", est: "/landscaping-estimate.html", ana: "/landscaping-quote-analyzer.html?path=quote", cmp: "/compare-landscaping-quotes.html", fx: "landscaping-images" },
  { name: "moving", est: "/moving-estimate.html", ana: "/moving-quote-analyzer.html?path=quote", cmp: "/compare-moving-quotes.html", fx: "moving-images" },
  { name: "auto", est: "/auto-estimate.html", ana: "/auto-repair.html?path=quote", cmp: "/compare-auto-quotes.html", fx: "auto-images" },
  { name: "medical", est: "/medical-estimate.html", ana: "/medical-bill-analyzer.html?path=quote", cmp: "/compare-medical-quotes.html", fx: "medical-images" },
  { name: "legal", est: "/legal-estimate.html", ana: "/legal-fee-analyzer.html?path=quote", cmp: "/compare-legal-quotes.html", fx: "legal-images" },
];

function getFixtures(fxDir) {
  const dir = path.join(ROOT, "test-quotes", fxDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(jpe?g|png)$/i.test(f)).map(f => path.join(dir, f));
}

const findings = [];
const results = {};

async function testEstimate(browser, v) {
  const tag = v.name + "/estimate";
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  const errs = [];
  page.on("pageerror", e => errs.push(e.message.substring(0, 150)));
  page.on("console", msg => { if (msg.type() === "error" && !msg.text().includes("favicon")) errs.push(msg.text().substring(0, 150)); });

  try {
    await page.goto("https://woogoro.com" + v.est, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(5000);
    await page.screenshot({ path: path.join(OUT, v.name + "-est-01-initial.png"), fullPage: true });

    // Describe what we see
    const initial = await page.evaluate(() => {
      var body = document.body.innerText || "";
      var h1 = document.querySelector("h1");
      var h2 = document.querySelector("h2");
      var heading = (h1 ? h1.textContent.trim() : "") || (h2 ? h2.textContent.trim() : "");
      var inputs = Array.from(document.querySelectorAll("input:not([type=hidden]), select, textarea")).filter(function(el) { return el.offsetParent !== null; });
      var buttons = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent !== null; }).map(function(b) { return b.textContent.trim().substring(0, 50); });
      var hasTrustBanner = body.includes("Free") && body.includes("No email");
      var hasDualPath = body.includes("estimate") && (body.includes("Analyze") || body.includes("quote"));
      var hasDisclaimer = /disclaimer|informational|not.*guarantee/i.test(body);
      return {
        heading: heading,
        inputCount: inputs.length,
        inputTypes: inputs.map(function(i) { return (i.placeholder || i.name || i.id || i.type).substring(0, 30); }),
        buttonTexts: buttons.slice(0, 8),
        hasTrustBanner: hasTrustBanner,
        hasDualPath: hasDualPath,
        hasDisclaimer: hasDisclaimer,
        wordCount: body.split(/\s+/).length,
        bodyFirst500: body.substring(0, 500),
      };
    });

    console.log("  [EST] " + v.name);
    console.log("    Heading: " + initial.heading);
    console.log("    Inputs: " + initial.inputCount + " (" + initial.inputTypes.join(", ") + ")");
    console.log("    Buttons: " + initial.buttonTexts.join(" | "));
    console.log("    Trust banner: " + initial.hasTrustBanner + " | Dual-path: " + initial.hasDualPath);
    console.log("    Words: " + initial.wordCount);

    if (!initial.hasTrustBanner) findings.push({ sev: "MED", tag: tag, issue: "Missing trust banner" });
    if (!initial.hasDualPath) findings.push({ sev: "MED", tag: tag, issue: "No dual-path UX visible" });
    if (initial.inputCount === 0) findings.push({ sev: "HIGH", tag: tag, issue: "No inputs visible on estimate page" });

    // Fill address fields
    await page.evaluate(() => {
      function setF(sel, val) {
        var el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { el.focus(); el.value = val; el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true})); return true; }
        return false;
      }
      setF("input[placeholder*='street' i], input[name*='street' i], input[id*='street' i], input[placeholder*='address' i]", "17064 Laurelmont Ct");
      setF("input[placeholder*='city' i], input[name*='city' i]", "Fort Mill");
      setF("input[placeholder*='state' i], input[name*='state' i]", "SC");
      setF("input[placeholder*='zip' i], input[name*='zip' i]", "29707");
    });
    await sleep(500);

    // Click the primary submit button
    await page.evaluate(() => {
      var btns = Array.from(document.querySelectorAll("button")).filter(function(b) {
        return b.offsetParent !== null && /estimate|continue|next|go|calculate|get.*price/i.test(b.textContent);
      });
      if (btns[0]) btns[0].click();
    });
    await sleep(5000);
    await page.screenshot({ path: path.join(OUT, v.name + "-est-02-after-submit.png"), fullPage: true });

    // Click first option button if multi-step
    var hasSteps = await page.evaluate(() => {
      var body = document.body.innerText || "";
      return /step \d|what type|what kind|select/i.test(body);
    });
    if (hasSteps) {
      // Click the first option in whatever step we're on
      for (var step = 0; step < 5; step++) {
        await page.evaluate(() => {
          // Find clickable option buttons (not nav buttons)
          var opts = Array.from(document.querySelectorAll("button, [role=button], .option-btn, .step-option")).filter(function(b) {
            if (!b.offsetParent) return false;
            var t = b.textContent.trim();
            // Skip nav buttons
            if (/^(back|next|continue|submit|get|start|estimate)/i.test(t)) return false;
            // Must be a short option label
            return t.length > 1 && t.length < 60;
          });
          if (opts[0]) { opts[0].click(); return true; }
          return false;
        });
        await sleep(1500);
      }
      await page.screenshot({ path: path.join(OUT, v.name + "-est-03-after-steps.png"), fullPage: true });

      // Try clicking estimate/calculate button again
      await page.evaluate(() => {
        var btns = Array.from(document.querySelectorAll("button")).filter(function(b) {
          return b.offsetParent !== null && /estimate|calculate|get.*price|see.*result|submit/i.test(b.textContent);
        });
        if (btns[0]) btns[0].click();
      });
      await sleep(5000);
    }

    await page.screenshot({ path: path.join(OUT, v.name + "-est-04-result.png"), fullPage: true });

    // Read the result
    const result = await page.evaluate(() => {
      var body = document.body.innerText || "";
      var dollars = body.match(/\$[\d,]+/g) || [];
      var hasDollar = dollars.length > 0;
      var hasRange = /\$[\d,]+\s*[-\u2013\u2014to]+\s*\$?[\d,]+/i.test(body);
      // Extract actual dollar amounts
      var amounts = dollars.map(function(d) { return parseFloat(d.replace(/[$,]/g, "")); }).filter(function(v) { return v > 0; });
      return {
        hasDollar: hasDollar,
        hasRange: hasRange,
        dollarAmounts: amounts.slice(0, 6),
        bodyText: body.substring(0, 1000),
      };
    });

    console.log("    Result has $: " + result.hasDollar + " | Range: " + result.hasRange);
    if (result.dollarAmounts.length) console.log("    Amounts found: " + result.dollarAmounts.map(function(a) { return "$" + a.toLocaleString(); }).join(", "));

    // Pricing sanity check
    if (result.dollarAmounts.length > 0) {
      var maxPrice = Math.max.apply(null, result.dollarAmounts);
      var minPrice = Math.min.apply(null, result.dollarAmounts.filter(function(a) { return a > 50; }));
      if (maxPrice > 500000) findings.push({ sev: "HIGH", tag: tag, issue: "Unreasonably high price: $" + maxPrice.toLocaleString() });
      if (minPrice < 10 && v.name !== "medical") findings.push({ sev: "MED", tag: tag, issue: "Suspiciously low price: $" + minPrice });
    }

    if (errs.length) {
      console.log("    JS errors: " + errs.slice(0, 3).join(" | "));
      for (var i = 0; i < errs.length; i++) {
        findings.push({ sev: "HIGH", tag: tag, issue: "JS error: " + errs[i].substring(0, 100) });
      }
    }

    results[tag] = { heading: initial.heading, inputs: initial.inputCount, hasDollar: result.hasDollar, amounts: result.dollarAmounts, trustBanner: initial.hasTrustBanner, dualPath: initial.hasDualPath, jsErrors: errs.length };
  } catch (e) {
    console.log("    EXCEPTION: " + e.message.substring(0, 100));
    findings.push({ sev: "HIGH", tag: tag, issue: "Exception: " + e.message.substring(0, 100) });
  }
  await page.close();
}

async function testAnalyze(browser, v, fixture) {
  var tag = v.name + "/analyze";
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  var errs = [];
  page.on("pageerror", e => errs.push(e.message.substring(0, 150)));

  try {
    await page.goto("https://woogoro.com" + v.ana, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(5000);
    await page.screenshot({ path: path.join(OUT, v.name + "-ana-01-initial.png") });

    // Check for address-first flow
    var hasFile = await page.evaluate(() => !!document.querySelector("input[type=file]"));
    var hasAddr = await page.evaluate(() => !!document.querySelector("input[placeholder*='street' i], input[placeholder*='address' i]"));

    if (hasAddr && !hasFile) {
      await page.evaluate(() => {
        function setF(s, v) { var el = document.querySelector(s); if (el) { el.value = v; el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true})); } }
        setF("input[placeholder*='street' i], input[name*='street' i], input[id*='street' i], input[placeholder*='address' i]", "17064 Laurelmont Ct");
        setF("input[placeholder*='city' i], input[name*='city' i]", "Fort Mill");
        setF("input[placeholder*='state' i], input[name*='state' i]", "SC");
        setF("input[placeholder*='zip' i], input[name*='zip' i]", "29707");
      });
      await sleep(500);
      await page.evaluate(() => {
        var btns = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /estimate|continue|go|next/i.test(b.textContent); });
        if (btns[0]) btns[0].click();
      });
      await sleep(6000);
      // Click through confirm/upload steps
      await page.evaluate(() => {
        var btns = Array.from(document.querySelectorAll("button, a")).filter(function(b) { return b.offsetParent && /confirm|yes|upload|quote|have|analyze/i.test(b.textContent); });
        if (btns[0]) btns[0].click();
      });
      await sleep(4000);
      hasFile = await page.evaluate(() => !!document.querySelector("input[type=file]"));
    }

    await page.screenshot({ path: path.join(OUT, v.name + "-ana-02-ready.png") });

    if (!hasFile) {
      console.log("  [ANA] " + v.name + " -- NO FILE INPUT FOUND");
      findings.push({ sev: "HIGH", tag: tag, issue: "No file input found after address flow" });
      await page.close();
      return;
    }

    // Upload the fixture
    var fileInput = await page.$("input[type=file]");
    await fileInput.uploadFile(fixture);
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", {bubbles:true})); }, fileInput);
    console.log("  [ANA] " + v.name + " -- uploaded " + path.basename(fixture) + ", waiting for OCR...");
    await sleep(35000);
    await page.screenshot({ path: path.join(OUT, v.name + "-ana-03-result.png"), fullPage: true });

    // Read full result
    var result = await page.evaluate(() => {
      var body = document.body.innerText || "";
      var dollars = body.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
      return {
        hasDollar: dollars.length > 0,
        dollars: dollars.slice(0, 8),
        hasVerdict: /verdict|fair|high|low|reasonable|overpriced|above.*average|below.*average/i.test(body),
        hasScope: /scope|checklist|included|missing/i.test(body),
        hasRedFlag: /red flag|warning|caution|concern/i.test(body),
        hasNextSteps: /next step|recommend|ask.*contractor|request/i.test(body),
        bodyText: body.substring(0, 1500),
      };
    });

    console.log("    Dollar: " + result.hasDollar + " (" + result.dollars.join(", ") + ")");
    console.log("    Verdict: " + result.hasVerdict + " | Scope: " + result.hasScope + " | Red flags: " + result.hasRedFlag);

    if (!result.hasDollar && !result.hasVerdict) {
      findings.push({ sev: "HIGH", tag: tag, issue: "No dollar or verdict rendered after OCR -- possibly stalled" });
    }

    results[tag] = { hasDollar: result.hasDollar, hasVerdict: result.hasVerdict, hasScope: result.hasScope, dollars: result.dollars, jsErrors: errs.length };

    if (errs.length) {
      console.log("    JS errors: " + errs.slice(0, 2).join(" | "));
      findings.push({ sev: "MED", tag: tag, issue: "JS error: " + errs[0].substring(0, 100) });
    }
  } catch (e) {
    console.log("  [ANA] " + v.name + " EXCEPTION: " + e.message.substring(0, 100));
    findings.push({ sev: "HIGH", tag: tag, issue: "Exception: " + e.message.substring(0, 100) });
  }
  await page.close();
}

async function testCompare(browser, v, fixtures) {
  var tag = v.name + "/compare";
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  var errs = [];
  page.on("pageerror", e => errs.push(e.message.substring(0, 150)));

  try {
    await page.goto("https://woogoro.com" + v.cmp, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(5000);
    await page.screenshot({ path: path.join(OUT, v.name + "-cmp-01-initial.png") });

    var fileInputs = await page.$$("input[type=file]");
    console.log("  [CMP] " + v.name + " -- " + fileInputs.length + " upload slots");

    if (fileInputs.length < 2) {
      findings.push({ sev: "HIGH", tag: tag, issue: "Only " + fileInputs.length + " file input(s), need 2+" });
      await page.close();
      return;
    }

    // Upload 2 files
    for (var i = 0; i < Math.min(2, fileInputs.length, fixtures.length); i++) {
      await fileInputs[i].uploadFile(fixtures[i]);
      await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", {bubbles:true})); }, fileInputs[i]);
      await sleep(1000);
    }
    console.log("    Uploaded 2 files (" + path.basename(fixtures[0]) + ", " + path.basename(fixtures[1]) + "), waiting for OCR...");
    await sleep(40000);
    await page.screenshot({ path: path.join(OUT, v.name + "-cmp-02-after-ocr.png") });

    // Click compare button
    await page.evaluate(() => {
      var btns = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /compare/i.test(b.textContent) && !b.disabled; });
      if (btns[0]) btns[0].click();
    });
    await sleep(6000);
    await page.screenshot({ path: path.join(OUT, v.name + "-cmp-03-result.png"), fullPage: true });

    var result = await page.evaluate(() => {
      var body = document.body.innerText || "";
      var dollars = body.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
      return {
        hasDollar: dollars.length > 0,
        dollars: dollars.slice(0, 8),
        hasScore: /score|winner|best.*value|\/100/i.test(body),
        hasTable: document.querySelectorAll("table").length > 0,
        bodyText: body.substring(0, 1000),
      };
    });

    console.log("    Dollar: " + result.hasDollar + " | Score: " + result.hasScore + " | Table: " + result.hasTable);
    console.log("    Amounts: " + result.dollars.join(", "));

    results[tag] = { hasDollar: result.hasDollar, hasScore: result.hasScore, dollars: result.dollars, jsErrors: errs.length };

    if (errs.length) {
      console.log("    JS errors: " + errs.slice(0, 2).join(" | "));
    }
  } catch (e) {
    console.log("  [CMP] " + v.name + " EXCEPTION: " + e.message.substring(0, 100));
    findings.push({ sev: "HIGH", tag: tag, issue: "Exception: " + e.message.substring(0, 100) });
  }
  await page.close();
}

(async () => {
  var browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  var startIdx = 0;
  var verticalArg = process.argv[2];
  if (verticalArg) {
    startIdx = parseInt(verticalArg) || 0;
    console.log("Starting from vertical index " + startIdx);
  }

  for (var vi = startIdx; vi < VERTICALS.length; vi++) {
    var v = VERTICALS[vi];
    var fixtures = getFixtures(v.fx);
    console.log("\n" + "=".repeat(50));
    console.log("=== " + v.name.toUpperCase() + " (" + (vi+1) + "/" + VERTICALS.length + ") === fixtures: " + fixtures.length);
    console.log("=".repeat(50));

    // ESTIMATE
    await testEstimate(browser, v);

    // ANALYZE (with upload)
    if (fixtures.length > 0) {
      await testAnalyze(browser, v, fixtures[0]);
    } else {
      console.log("  [ANA] " + v.name + " -- NO FIXTURES, skipping upload test");
      findings.push({ sev: "INFO", tag: v.name + "/analyze", issue: "No test fixtures available" });
    }

    // COMPARE (with 2 uploads)
    if (fixtures.length >= 2) {
      await testCompare(browser, v, fixtures);
    } else {
      console.log("  [CMP] " + v.name + " -- need 2+ fixtures, only have " + fixtures.length);
      findings.push({ sev: "INFO", tag: v.name + "/compare", issue: "Not enough fixtures for compare test" });
    }
  }

  await browser.close();

  // Save results
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results: results, findings: findings }, null, 2));

  // Print summary
  console.log("\n\n" + "=".repeat(60));
  console.log("DEEP TEST SUMMARY");
  console.log("=".repeat(60));

  var bySev = {};
  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    if (!bySev[f.sev]) bySev[f.sev] = [];
    bySev[f.sev].push(f);
  }

  var sevOrder = ["HIGH", "MED", "LOW", "INFO"];
  for (var si = 0; si < sevOrder.length; si++) {
    var sev = sevOrder[si];
    if (bySev[sev] && bySev[sev].length > 0) {
      console.log("\n--- " + sev + " (" + bySev[sev].length + ") ---");
      for (var fi = 0; fi < bySev[sev].length; fi++) {
        console.log("  [" + bySev[sev][fi].tag + "] " + bySev[sev][fi].issue);
      }
    }
  }

  // Results table
  console.log("\n--- RESULTS TABLE ---");
  console.log("Vertical        | EST inputs | EST $ | ANA $ | ANA verdict | CMP $ | CMP score | JS errs");
  console.log("----------------|------------|-------|-------|-------------|-------|-----------|--------");
  for (var vi2 = 0; vi2 < VERTICALS.length; vi2++) {
    var vn = VERTICALS[vi2].name;
    var est = results[vn + "/estimate"] || {};
    var ana = results[vn + "/analyze"] || {};
    var cmp = results[vn + "/compare"] || {};
    var totalErrs = (est.jsErrors || 0) + (ana.jsErrors || 0) + (cmp.jsErrors || 0);
    var pad = vn + "                ".substring(0, 16 - vn.length);
    console.log(pad + "| " + (est.inputs || "?") + "          | " + (est.hasDollar ? "YES" : "no ") + "   | " + (ana.hasDollar ? "YES" : "no ") + "   | " + (ana.hasVerdict ? "YES" : "no ") + "         | " + (cmp.hasDollar ? "YES" : "no ") + "   | " + (cmp.hasScore ? "YES" : "no ") + "       | " + totalErrs);
  }

  console.log("\nTotal findings: " + findings.length);
  console.log("Screenshots: " + OUT);
})();
