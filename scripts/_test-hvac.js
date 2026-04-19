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

  // ===== ESTIMATE =====
  console.log("\n===== HVAC ESTIMATE =====");
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto("https://woogoro.com/hvac-estimate.html", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function() {});
  await sleep(6000);

  // Fill address
  await page.evaluate(function() {
    function s(sel, v) { var el = document.querySelector(sel); if (el) { el.focus(); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } }
    s("input[placeholder*='address' i], input[placeholder*='street' i]", "17064 Laurelmont Ct");
    s("input[placeholder*='city' i]", "Fort Mill");
    s("input[placeholder*='state' i]", "SC");
    s("input[placeholder*='zip' i]", "29707");
  });
  await sleep(500);
  await page.evaluate(function() {
    var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /estimate|submit|go|next|continue/i.test(b.textContent); });
    if (b[0]) b[0].click();
  });
  await sleep(6000);

  // Click through multi-step (first option each step, up to 5 steps)
  for (var i = 0; i < 5; i++) {
    await page.evaluate(function() {
      var opts = Array.from(document.querySelectorAll("button")).filter(function(b) {
        if (!b.offsetParent) return false;
        var t = b.textContent.trim();
        if (/^(back|skip|get|start|estimate|submit|continue)/i.test(t)) return false;
        return t.length > 2 && t.length < 50;
      });
      if (opts[0]) opts[0].click();
    });
    await sleep(2000);
  }
  // Click estimate button
  await page.evaluate(function() {
    var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /estimate|calculate|see.*result|get.*price/i.test(b.textContent); });
    if (b[0]) b[0].click();
  });
  await sleep(5000);
  await page.screenshot({ path: path.join(OUT, "H1-hvac-est-result.png"), fullPage: true });
  var estText = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 1500); });
  console.log("ESTIMATE:\n" + estText.substring(0, 1200));
  await page.close();

  // ===== ANALYZE =====
  console.log("\n===== HVAC ANALYZE (04-is-this-reasonable.jpeg) =====");
  page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto("https://woogoro.com/hvac-quote-analyzer.html?path=quote", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function() {});
  await sleep(6000);

  // Fill address if needed
  var hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });
  if (!hasFile) {
    await page.evaluate(function() {
      function s(sel, v) { var el = document.querySelector(sel); if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } }
      s("input[placeholder*='address' i], input[placeholder*='street' i]", "17064 Laurelmont Ct");
      s("input[placeholder*='city' i]", "Fort Mill");
      s("input[placeholder*='state' i]", "SC");
      s("input[placeholder*='zip' i]", "29707");
    });
    await sleep(500);
    await page.evaluate(function() { var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /estimate|go|next|continue/i.test(b.textContent); }); if (b[0]) b[0].click(); });
    await sleep(6000);
    await page.evaluate(function() { var b = Array.from(document.querySelectorAll("button, a")).filter(function(b) { return b.offsetParent && /upload|quote|have|check|analyze/i.test(b.textContent); }); if (b[0]) b[0].click(); });
    await sleep(4000);
  }

  var fi = await page.$("input[type=file]");
  if (fi) {
    var fixture = path.join(ROOT, "test-quotes/hvac-images/04-is-this-reasonable.jpeg");
    await fi.uploadFile(fixture);
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", { bubbles: true })); }, fi);
    console.log("Uploaded, polling for result...");
    for (var i = 0; i < 24; i++) {
      await sleep(5000);
      var st = await page.evaluate(function() {
        var body = document.body.innerText || "";
        return { analyzing: /analyzing|parsing|processing|reading/i.test(body.substring(0, 500)), result: /verdict|your.*quote|fair|overpriced|price check|scope/i.test(body.substring(0, 2000)) };
      });
      if (st.result && !st.analyzing) { console.log("Result at " + ((i + 1) * 5) + "s"); break; }
      if (i % 4 === 0) console.log("Poll " + ((i + 1) * 5) + "s: " + JSON.stringify(st));
    }
    await sleep(2000);
    await page.screenshot({ path: path.join(OUT, "H2-hvac-analyze-result.png"), fullPage: true });
    var anaText = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 2500); });
    console.log("ANALYZE:\n" + anaText.substring(0, 2000));
  } else {
    console.log("ERROR: No file input");
  }
  await page.close();

  // ===== COMPARE =====
  console.log("\n===== HVAC COMPARE =====");
  var fix1 = path.join(ROOT, "test-quotes/hvac-images/04-is-this-reasonable.jpeg");
  var fix2 = path.join(ROOT, "test-quotes/hvac-images/07-had-a-leak-in-the-coil-of-my-air-handler-is-this-r.jpeg");
  console.log("Q1: $610 AC recharge + breaker  |  Q2: $3,810 evaporator coil + leak search");

  page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto("https://woogoro.com/compare-hvac-quotes.html", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function() {});
  await sleep(6000);

  var fileInputs = await page.$$("input[type=file]");
  console.log("Upload slots: " + fileInputs.length);
  if (fileInputs.length >= 2) {
    await fileInputs[0].uploadFile(fix1);
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", { bubbles: true })); }, fileInputs[0]);
    await sleep(1500);
    await fileInputs[1].uploadFile(fix2);
    await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", { bubbles: true })); }, fileInputs[1]);
    console.log("Uploaded. Polling for OCR...");
    for (var i = 0; i < 24; i++) {
      await sleep(5000);
      var st = await page.evaluate(function() { return { parsing: (document.body.innerText.match(/Parsing/g) || []).length }; });
      if (st.parsing === 0) { console.log("OCR done at " + ((i + 1) * 5) + "s"); break; }
      if (i % 4 === 0) console.log("Poll " + ((i + 1) * 5) + "s: parsing " + st.parsing);
    }
    await page.evaluate(function() { var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /compare/i.test(b.textContent) && !b.disabled; }); if (b[0]) b[0].click(); });
    await sleep(8000);
    await page.screenshot({ path: path.join(OUT, "H3-hvac-compare-result.png"), fullPage: true });
    var cmpText = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 2500); });
    console.log("COMPARE:\n" + cmpText.substring(0, 2000));
  }
  await page.close();

  await browser.close();
  console.log("\n===== HVAC ALL 3 PATHS DONE =====");
})();
