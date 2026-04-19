var puppeteer = require("puppeteer");
var path = require("path");
var sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
var ROOT = path.dirname(__dirname);
var OUT = path.join(ROOT, "output", "human-test");

(async function() {
  var browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  console.log("\n===== HVAC ANALYZE =====");
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on("console", function(msg) {
    var t = msg.text();
    if (t.includes("TP_Engine")) console.log("  [ENGINE] " + t);
  });

  await page.goto("https://woogoro.com/hvac-quote-analyzer.html?path=quote", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function(){});
  await sleep(6000);

  // Address flow
  var hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });
  if (!hasFile) {
    await page.evaluate(function() {
      function s(sel,v){var el=document.querySelector(sel);if(el){el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}}
      s("input[placeholder*='address' i],input[placeholder*='street' i]","17064 Laurelmont Ct");
      s("input[placeholder*='city' i]","Fort Mill");s("input[placeholder*='state' i]","SC");s("input[placeholder*='zip' i]","29707");
    });
    await sleep(500);
    await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button")).filter(function(b){return b.offsetParent&&/estimate|go|next/i.test(b.textContent);});if(b[0])b[0].click();});
    await sleep(6000);
    await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button,a")).filter(function(b){return b.offsetParent&&/upload|quote|have|check/i.test(b.textContent);});if(b[0])b[0].click();});
    await sleep(4000);
  }

  var fi = await page.$("input[type=file]");
  if (fi) {
    await fi.uploadFile(path.join(ROOT, "test-quotes/hvac-images/04-is-this-reasonable.jpeg"));
    await page.evaluate(function(inp){inp.dispatchEvent(new Event("change",{bubbles:true}));}, fi);
    console.log("  Uploaded. Waiting for OCR + price confirm...");

    // Poll for either result OR price confirmation step
    for (var i = 0; i < 20; i++) {
      await sleep(5000);
      var state = await page.evaluate(function() {
        var body = document.body.innerText || "";
        return {
          hasConfirm: /is this correct|confirm.*price|looks right|yes.*correct|verify.*price/i.test(body.substring(0, 1000)),
          hasResult: /verdict|your.*quote.*is|fair price|overpriced|above average|below average/i.test(body.substring(0, 2000)),
          hasManualEntry: /enter your quote total|couldn.t read/i.test(body.substring(0, 1000)),
          snippet: body.substring(0, 200)
        };
      });

      if (state.hasConfirm) {
        console.log("  Price confirmation step detected. Clicking confirm...");
        await page.screenshot({ path: path.join(OUT, "HV-price-confirm.png") });
        await page.evaluate(function() {
          var b = Array.from(document.querySelectorAll("button")).filter(function(b) {
            return b.offsetParent && /yes|correct|confirm|looks right|analyze|continue/i.test(b.textContent);
          });
          if (b[0]) b[0].click();
        });
        await sleep(5000);
        break;
      }
      if (state.hasResult) { console.log("  Direct result (no confirm step)"); break; }
      if (state.hasManualEntry) {
        console.log("  Manual entry fallback. Entering $610...");
        await page.evaluate(function() {
          var inp = document.getElementById("manualPrice");
          if (inp) { inp.value = "610"; inp.dispatchEvent(new Event("input", {bubbles:true})); }
          var btn = document.getElementById("manualPriceBtn");
          if (btn) btn.click();
        });
        await sleep(5000);
        break;
      }
      if (i % 3 === 0) console.log("  [" + (i+1)*5 + "s] " + state.snippet.substring(0, 80).replace(/\n/g, " | "));
    }

    // Wait for final result
    await sleep(3000);
    await page.screenshot({ path: path.join(OUT, "HV-analyze-final.png"), fullPage: true });
    var txt = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 3000); });
    console.log("\n--- RESULT ---\n" + txt.substring(0, 2500) + "\n--- END ---");
  }

  await page.close();
  await browser.close();
  console.log("\n===== DONE =====");
})();
