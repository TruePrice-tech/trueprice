#!/usr/bin/env node
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOT = path.dirname(__dirname);
const OUT = path.join(ROOT, "output", "human-test");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  var browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ========== ESTIMATE ==========
  console.log("\n===== ROOFING ESTIMATE =====");
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto("https://woogoro.com/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(function() {});
  await sleep(8000);

  await page.evaluate(function() {
    function s(sel, v) { var el = document.querySelector(sel); if (el) { el.focus(); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } }
    s("input[placeholder*='Street' i], input[placeholder*='street' i], input[placeholder*='address' i]", "17064 Laurelmont Ct");
    s("input[placeholder*='City' i], input[placeholder*='city' i]", "Fort Mill");
    s("input[placeholder*='State' i], input[placeholder*='state' i]", "SC");
    s("input[placeholder*='ZIP' i], input[placeholder*='zip' i]", "29707");
  });
  await sleep(500);
  await page.evaluate(function() {
    var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /estimate|submit|go|next|continue/i.test(b.textContent); });
    if (b[0]) b[0].click();
  });
  await sleep(6000);

  // Click "Looks correct" or similar confirm
  await page.evaluate(function() {
    var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /looks correct|confirm|yes/i.test(b.textContent); });
    if (b[0]) b[0].click();
  });
  await sleep(5000);
  await page.screenshot({ path: path.join(OUT, "R1-roof-est-confirm.png") });

  // Click through estimator step options (first option each time)
  for (var step = 0; step < 8; step++) {
    var clicked = await page.evaluate(function() {
      var opts = Array.from(document.querySelectorAll("button, [role=button]")).filter(function(b) {
        if (!b.offsetParent) return false;
        var t = b.textContent.trim();
        if (/^(back|skip|get|start|estimate|submit|confirm|edit|looks|upload)/i.test(t)) return false;
        return t.length > 1 && t.length < 60;
      });
      if (opts[0]) { opts[0].click(); return opts[0].textContent.trim().substring(0, 40); }
      return null;
    });
    if (clicked) console.log("  Step: " + clicked);
    await sleep(1500);
  }

  // Click final estimate button
  await page.evaluate(function() {
    var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /estimate|calculate|get.*price|see.*result/i.test(b.textContent); });
    if (b[0]) b[0].click();
  });
  await sleep(8000);
  await page.screenshot({ path: path.join(OUT, "R2-roof-est-result.png"), fullPage: true });

  var estText = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 2000); });
  console.log("ESTIMATE OUTPUT:\n" + estText.substring(0, 1500));
  await page.close();

  // ========== ANALYZE ==========
  console.log("\n===== ROOFING ANALYZE (Jason.pdf) =====");
  page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto("https://woogoro.com/roofing-quote-analyzer.html", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(function() {});
  await sleep(8000);

  await page.evaluate(function() {
    var els = Array.from(document.querySelectorAll("button, a, div, label, span")).filter(function(el) {
      if (!el.offsetParent && el.tagName !== "INPUT") return false;
      return /upload.*here|upload.*quote|drop.*file/i.test(el.textContent.trim()) && el.textContent.trim().length < 100;
    });
    if (els[0]) els[0].click();
  });
  await sleep(2000);

  var fi = await page.$("input[type=file]");
  if (fi) {
    await fi.uploadFile("c:/Users/lanea/OneDrive/Desktop/Jason.pdf");
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", { bubbles: true })); }, fi);
    console.log("Uploaded Jason.pdf, polling...");

    for (var i = 0; i < 24; i++) {
      await sleep(5000);
      var st = await page.evaluate(function() {
        var body = document.body.innerText || "";
        return {
          analyzing: /analyzing|parsing|processing|reading|scanning/i.test(body.substring(0, 500)),
          result: /verdict|your.*quote|quote total|fair|overpriced|price check|scope/i.test(body.substring(0, 2000)),
        };
      });
      if (st.result && !st.analyzing) { console.log("Result at " + ((i + 1) * 5) + "s"); break; }
      if (i % 4 === 0) console.log("Poll " + ((i + 1) * 5) + "s: analyzing=" + st.analyzing + " result=" + st.result);
    }
    await sleep(2000);
    await page.screenshot({ path: path.join(OUT, "R3-roof-analyze-result.png"), fullPage: true });
    var anaText = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 3000); });
    console.log("ANALYZE OUTPUT:\n" + anaText.substring(0, 2500));
  } else {
    console.log("ERROR: No file input found");
  }
  await page.close();

  // ========== COMPARE ==========
  console.log("\n===== ROOFING COMPARE =====");
  var fix1 = path.join(ROOT, "test-quotes/roofing-images/03-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg");
  var fix2 = path.join(ROOT, "test-quotes/roofing-images/07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg");

  // Read these quotes so I know what to expect
  console.log("Quote 1: " + path.basename(fix1) + " (metal roof estimate, $136K)");
  console.log("Quote 2: " + path.basename(fix2) + " (handwritten, $10.5K)");

  page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto("https://woogoro.com/compare-roofing-quotes.html", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function() {});
  await sleep(6000);

  var fileInputs = await page.$$("input[type=file]");
  console.log("Upload slots: " + fileInputs.length);

  if (fileInputs.length >= 2) {
    await fileInputs[0].uploadFile(fix1);
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", { bubbles: true })); }, fileInputs[0]);
    await sleep(1500);
    await fileInputs[1].uploadFile(fix2);
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", { bubbles: true })); }, fileInputs[1]);
    console.log("Uploaded 2 files. Polling for OCR...");

    for (var i = 0; i < 24; i++) {
      await sleep(5000);
      var st = await page.evaluate(function() {
        var body = document.body.innerText || "";
        return { parsing: (body.match(/Parsing/g) || []).length };
      });
      if (st.parsing === 0) { console.log("OCR done at " + ((i + 1) * 5) + "s"); break; }
      if (i % 4 === 0) console.log("Poll " + ((i + 1) * 5) + "s: still parsing " + st.parsing);
    }

    await page.screenshot({ path: path.join(OUT, "R4-roof-compare-ocr.png") });

    var clicked = await page.evaluate(function() {
      var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /compare/i.test(b.textContent) && !b.disabled; });
      if (b[0]) { b[0].click(); return true; }
      return false;
    });
    console.log("Compare clicked: " + clicked);
    await sleep(8000);
    await page.screenshot({ path: path.join(OUT, "R5-roof-compare-result.png"), fullPage: true });

    var cmpText = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 3000); });
    console.log("COMPARE OUTPUT:\n" + cmpText.substring(0, 2500));
  }
  await page.close();

  await browser.close();
  console.log("\n===== ROOFING ALL 3 PATHS DONE =====");
})();
