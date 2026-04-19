#!/usr/bin/env node
// Usage: node _test-vertical.js <vertical-name>
// Tests analyze path with the first available real fixture
var puppeteer = require("puppeteer");
var path = require("path");
var fs = require("fs");
var sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
var ROOT = path.dirname(__dirname);
var OUT = path.join(ROOT, "output", "human-test");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

var VERT = {
  roofing: { ana: "/roofing-quote-analyzer.html", fx: "roofing-images" },
  hvac: { ana: "/hvac-quote-analyzer.html", fx: "hvac-images" },
  plumbing: { ana: "/plumbing-quote-analyzer.html", fx: "plumbing-images" },
  electrical: { ana: "/electrical-quote-analyzer.html", fx: "electrical-images" },
  solar: { ana: "/solar-quote-analyzer.html", fx: "solar-images" },
  windows: { ana: "/window-quote-analyzer.html", fx: "windows-images" },
  siding: { ana: "/siding-quote-analyzer.html", fx: "siding-images" },
  painting: { ana: "/painting-quote-analyzer.html", fx: "painting-images" },
  concrete: { ana: "/concrete-quote-analyzer.html", fx: "concrete-images" },
  fencing: { ana: "/fencing-quote-analyzer.html", fx: "fencing-images" },
  gutters: { ana: "/gutters-quote-analyzer.html", fx: "gutters-images" },
  insulation: { ana: "/insulation-quote-analyzer.html", fx: "insulation-images" },
  foundation: { ana: "/foundation-quote-analyzer.html", fx: "foundation-images" },
  "garage-door": { ana: "/garage-door-quote-analyzer.html", fx: "garage-door-images" },
  kitchen: { ana: "/kitchen-quote-analyzer.html", fx: "kitchen-images" },
  landscaping: { ana: "/landscaping-quote-analyzer.html", fx: "landscaping-images" },
  moving: { ana: "/moving-quote-analyzer.html", fx: "moving-images" },
  auto: { ana: "/auto-repair.html", fx: "auto-images" },
  medical: { ana: "/medical-bill-analyzer.html", fx: "medical-images" },
  legal: { ana: "/legal-fee-analyzer.html", fx: "legal-images" },
};

function getFixture(fxDir) {
  var dir = path.join(ROOT, "test-quotes", fxDir);
  if (!fs.existsSync(dir)) return null;
  // Prefer real quotes, then comparison synthetics
  var files = fs.readdirSync(dir).filter(function(f) { return /\.(jpe?g|png|pdf)$/i.test(f) && !/manifest|README|test-result/i.test(f); });
  // Real quotes first (numbered or real-*)
  var real = files.filter(function(f) { return /^\d+|^real-/.test(f); });
  if (real.length) return path.join(dir, real[0]);
  // Then comparison synthetics
  var synth = files.filter(function(f) { return /^comparison-/.test(f); });
  if (synth.length) return path.join(dir, synth[0]);
  // Then mocks
  var mock = files.filter(function(f) { return /^mock-/.test(f); });
  if (mock.length) return path.join(dir, mock[0]);
  return null;
}

(async function() {
  var vertName = process.argv[2];
  if (!vertName || !VERT[vertName]) {
    console.log("Usage: node _test-vertical.js <vertical>");
    console.log("Available:", Object.keys(VERT).join(", "));
    process.exit(1);
  }

  var v = VERT[vertName];
  var fixture = getFixture(v.fx);
  if (!fixture) {
    console.log("No fixtures for " + vertName);
    process.exit(1);
  }

  console.log("===== " + vertName.toUpperCase() + " ANALYZE =====");
  console.log("Fixture: " + path.basename(fixture));

  var browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on("console", function(msg) { if (msg.text().includes("TP_Engine")) console.log("  [ENGINE] " + msg.text()); });
  page.on("pageerror", function(e) { console.log("  [ERROR] " + e.message.substring(0, 100)); });

  // Navigate to analyzer with ?path=quote
  var url = "https://woogoro.com" + v.ana + (v.ana.includes("?") ? "&path=quote" : "?path=quote");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(function(e) { console.log("  Nav error: " + e.message.substring(0, 80)); });
  await sleep(8000);

  // Try to find file input directly
  var hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });

  // If no file input, try filling address and advancing
  if (!hasFile) {
    console.log("  No file input yet, trying address flow...");
    await page.evaluate(function() {
      function s(sel,v){var el=document.querySelector(sel);if(el){el.focus();el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return true;}return false;}
      var filled = s("input[placeholder*='street' i], input[placeholder*='address' i], input[id*='street' i], input[name*='street' i]","17064 Laurelmont Ct");
      s("input[placeholder*='city' i], input[id*='city' i], input[name*='city' i]","Fort Mill");
      s("input[placeholder*='state' i], input[id*='state' i], input[name*='state' i]","SC");
      s("input[placeholder*='zip' i], input[id*='zip' i], input[name*='zip' i]","29707");
    });
    await sleep(500);

    // Click any visible submit-like button
    await page.evaluate(function() {
      var btns = Array.from(document.querySelectorAll("button, input[type=submit]")).filter(function(b) {
        return b.offsetParent && /estimate|go|next|continue|submit|check|analyze|get/i.test(b.textContent || b.value || "");
      });
      if (btns[0]) btns[0].click();
    });
    await sleep(8000);

    // Check for confirm step
    await page.evaluate(function() {
      var btns = Array.from(document.querySelectorAll("button, a")).filter(function(b) {
        return b.offsetParent && /confirm|yes|looks correct|upload|quote|have|check|analyze/i.test(b.textContent || "");
      });
      if (btns[0]) btns[0].click();
    });
    await sleep(5000);

    hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });
  }

  // Try clicking upload area trigger
  if (!hasFile) {
    await page.evaluate(function() {
      var els = Array.from(document.querySelectorAll("button, a, div, label, span")).filter(function(el) {
        return (el.offsetParent || el.tagName === "INPUT") && /upload/i.test(el.textContent || "") && (el.textContent || "").length < 100;
      });
      if (els[0]) els[0].click();
    });
    await sleep(2000);
    hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });
  }

  if (!hasFile) {
    console.log("  ERROR: Could not find file input after all attempts");
    await page.screenshot({ path: path.join(OUT, vertName + "-NO-FILE-INPUT.png"), fullPage: true });
    await browser.close();
    process.exit(1);
  }

  // Upload fixture
  var fi = await page.$("input[type=file]");
  await fi.uploadFile(fixture);
  await page.evaluate(function(inp) { inp.dispatchEvent(new Event("change", { bubbles: true })); }, fi);
  console.log("  Uploaded. Polling for result (up to 150s)...");

  // Poll for price confirm, result, or manual entry
  var finalState = "timeout";
  for (var i = 0; i < 30; i++) {
    await sleep(5000);
    var st = await page.evaluate(function() {
      var b = document.body.innerText || "";
      var top = b.substring(0, 1500);
      return {
        confirm: /we found your quote|is this your quote|is this correct/i.test(top),
        result: /verdict|your.*quote.*is|fair price|overpriced|above average|below average|woogoro.*verdict/i.test(top),
        manual: /enter your quote total|couldn.t read a price/i.test(top),
      };
    });

    if (st.confirm) {
      finalState = "confirm";
      console.log("  Price confirm step detected at " + (i+1)*5 + "s");
      await page.screenshot({ path: path.join(OUT, vertName + "-price-confirm.png") });
      // Click yes
      await page.evaluate(function() {
        var b = Array.from(document.querySelectorAll("button")).filter(function(b) { return b.offsetParent && /yes|correct|analyze this price/i.test(b.textContent); });
        if (b[0]) b[0].click();
      });
      await sleep(8000);
      break;
    }
    if (st.result) { finalState = "result"; console.log("  Result at " + (i+1)*5 + "s"); break; }
    if (st.manual) { finalState = "manual"; console.log("  Manual entry fallback at " + (i+1)*5 + "s"); break; }
  }

  await sleep(2000);
  await page.screenshot({ path: path.join(OUT, vertName + "-analyze-final.png"), fullPage: true });
  var txt = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 3000); });
  console.log("\n--- " + vertName.toUpperCase() + " RESULT (state=" + finalState + ") ---");
  console.log(txt.substring(0, 2500));
  console.log("--- END ---");

  await browser.close();
  console.log("\n===== " + vertName.toUpperCase() + " DONE =====");
})();
