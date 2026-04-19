#!/usr/bin/env node
var puppeteer = require("puppeteer");
var path = require("path");
var fs = require("fs");
var sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
var ROOT = path.dirname(__dirname);
var OUT = path.join(ROOT, "output", "human-test");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async function() {
  var browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ===== 1. ESTIMATE =====
  console.log("\n===== ROOFING ESTIMATE =====");
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  var errs = [];
  page.on("pageerror", function(e) { errs.push(e.message.substring(0, 100)); });

  await page.goto("https://woogoro.com/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(function() {});
  await sleep(8000);

  // Step 1: Fill address
  console.log("  Filling address...");
  await page.evaluate(function() {
    function s(sel, v) { var el = document.querySelector(sel); if (el) { el.focus(); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } }
    s("input[placeholder*='Street' i], input[placeholder*='address' i]", "17064 Laurelmont Ct");
    s("input[placeholder*='City' i]", "Fort Mill");
    s("input[placeholder*='State' i]", "SC");
    s("input[placeholder*='ZIP' i]", "29707");
  });
  await sleep(500);
  await page.evaluate(function() {
    var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /estimate/i.test(b.textContent); });
    if (b[0]) b[0].click();
  });
  await sleep(6000);
  await page.screenshot({ path: path.join(OUT, "RF1-est-address.png") });

  // Step 2: Confirm property
  console.log("  Confirming property...");
  await page.evaluate(function() {
    var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /looks correct|confirm/i.test(b.textContent); });
    if (b[0]) { b[0].click(); return "clicked confirm"; }
    return "no confirm button";
  });
  await sleep(5000);
  await page.screenshot({ path: path.join(OUT, "RF2-est-confirmed.png") });

  // Step 3: Walk through estimator questions by clicking specific options
  var steps = [
    { label: "roof condition", match: "Time for a new one|new one" },
    { label: "urgency", match: "This fall|fall" },
    { label: "material", match: "Dimensional|dimensional" },
    { label: "pitch", match: "Visible at an angle|angle" },
    { label: "shape", match: "Some detail|detail" },
    { label: "insurance", match: "^No$|paying out" },
    { label: "stories", match: "Two story|two" },
  ];

  for (var si = 0; si < steps.length; si++) {
    var stepDef = steps[si];
    var result = await page.evaluate(function(pattern) {
      var re = new RegExp(pattern, "i");
      var btns = Array.from(document.querySelectorAll("button, [role=button]")).filter(function(b) {
        return b.offsetParent && re.test(b.textContent.trim());
      });
      if (btns[0]) {
        btns[0].click();
        return "clicked: " + btns[0].textContent.trim().substring(0, 40);
      }
      // If specific match fails, list what's available
      var avail = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent; }).map(function(b) { return b.textContent.trim().substring(0, 30); }).slice(0, 8);
      return "NOT FOUND. Available: " + avail.join(" | ");
    }, stepDef.match);
    console.log("  " + stepDef.label + ": " + result);
    await sleep(2000);
  }

  await page.screenshot({ path: path.join(OUT, "RF3-est-steps-done.png") });

  // Wait for estimate result
  console.log("  Waiting for estimate result...");
  for (var i = 0; i < 12; i++) {
    await sleep(3000);
    var hasPrice = await page.evaluate(function() {
      var body = document.body.innerText || "";
      return /\$[\d,]+.*estimate|estimate.*\$[\d,]+|your.*roof.*cost|estimated.*range/i.test(body.substring(0, 2000));
    });
    if (hasPrice) { console.log("  Price found at " + ((i + 1) * 3) + "s"); break; }
  }

  await page.screenshot({ path: path.join(OUT, "RF4-est-result.png"), fullPage: true });
  var estText = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 2000); });
  console.log("\n--- ESTIMATE OUTPUT ---");
  console.log(estText.substring(0, 1500));
  console.log("--- END ESTIMATE ---");
  if (errs.length) console.log("JS ERRORS: " + errs.join(" | "));
  await page.close();

  // ===== 2. ANALYZE (Jason.pdf) =====
  console.log("\n===== ROOFING ANALYZE (Jason.pdf) =====");
  page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  errs = [];
  page.on("pageerror", function(e) { errs.push(e.message.substring(0, 100)); });

  await page.goto("https://woogoro.com/roofing-quote-analyzer.html", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(function() {});
  await sleep(8000);

  // Click upload area
  await page.evaluate(function() {
    var els = Array.from(document.querySelectorAll("button, a, div, label, span")).filter(function(el) {
      if (!el.offsetParent && el.tagName !== "INPUT") return false;
      return /upload/i.test(el.textContent.trim()) && el.textContent.trim().length < 100;
    });
    if (els[0]) els[0].click();
  });
  await sleep(2000);

  var fi = await page.$("input[type=file]");
  if (fi) {
    await fi.uploadFile("c:/Users/lanea/OneDrive/Desktop/Jason.pdf");
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", { bubbles: true })); }, fi);
    console.log("  Uploaded Jason.pdf. Polling...");

    for (var i = 0; i < 24; i++) {
      await sleep(5000);
      var st = await page.evaluate(function() {
        var body = document.body.innerText || "";
        return {
          analyzing: /analyzing|parsing|processing|reading|scanning/i.test(body.substring(0, 500)),
          result: /verdict|your.*quote|fair|overpriced|price check|scope/i.test(body.substring(0, 2000)),
        };
      });
      if (st.result && !st.analyzing) { console.log("  Result at " + ((i + 1) * 5) + "s"); break; }
    }
    await sleep(2000);
    await page.screenshot({ path: path.join(OUT, "RF5-analyze-result.png"), fullPage: true });
    var anaText = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 3000); });
    console.log("\n--- ANALYZE OUTPUT ---");
    console.log(anaText.substring(0, 2500));
    console.log("--- END ANALYZE ---");
  } else {
    console.log("  ERROR: No file input");
  }
  if (errs.length) console.log("JS ERRORS: " + errs.join(" | "));
  await page.close();

  // ===== 3. COMPARE (2 real quotes) =====
  console.log("\n===== ROOFING COMPARE =====");
  var fix1 = path.join(ROOT, "test-quotes/roofing-images/03-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg");
  var fix2 = path.join(ROOT, "test-quotes/roofing-images/07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg");
  console.log("  Q1: Standing seam metal, $136,375");
  console.log("  Q2: Handwritten shingle, $10,500");

  page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  errs = [];
  page.on("pageerror", function(e) { errs.push(e.message.substring(0, 100)); });

  await page.goto("https://woogoro.com/compare-roofing-quotes.html", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function() {});
  await sleep(6000);

  var fileInputs = await page.$$("input[type=file]");
  console.log("  Upload slots: " + fileInputs.length);

  if (fileInputs.length >= 2) {
    await fileInputs[0].uploadFile(fix1);
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", { bubbles: true })); }, fileInputs[0]);
    await sleep(1500);
    await fileInputs[1].uploadFile(fix2);
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", { bubbles: true })); }, fileInputs[1]);
    console.log("  Uploaded 2 quotes. Polling for OCR (up to 120s)...");

    for (var i = 0; i < 24; i++) {
      await sleep(5000);
      var st = await page.evaluate(function() { return { parsing: (document.body.innerText.match(/Parsing/g) || []).length }; });
      if (st.parsing === 0) { console.log("  OCR done at " + ((i + 1) * 5) + "s"); break; }
      if (i % 4 === 0) console.log("  Poll " + ((i + 1) * 5) + "s: parsing " + st.parsing);
    }

    await page.screenshot({ path: path.join(OUT, "RF6-compare-ocr-done.png") });

    var clicked = await page.evaluate(function() {
      var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /compare/i.test(b.textContent) && !b.disabled; });
      if (b[0]) { b[0].click(); return true; }
      return false;
    });
    console.log("  Compare clicked: " + clicked);
    await sleep(8000);
    await page.screenshot({ path: path.join(OUT, "RF7-compare-result.png"), fullPage: true });

    var cmpText = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 3000); });
    console.log("\n--- COMPARE OUTPUT ---");
    console.log(cmpText.substring(0, 2500));
    console.log("--- END COMPARE ---");
  }
  if (errs.length) console.log("JS ERRORS: " + errs.join(" | "));
  await page.close();

  await browser.close();
  console.log("\n===== ROOFING ALL 3 PATHS COMPLETE =====");
})();
