var puppeteer = require("puppeteer");
var path = require("path");
var sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
var ROOT = path.dirname(__dirname);
var OUT = path.join(ROOT, "output", "human-test");

(async function() {
  var browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ===== ANALYZE =====
  console.log("\n===== PLUMBING ANALYZE (10 - $6,950 water heater swap) =====");
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on("console", function(msg) { if (msg.text().includes("TP_Engine")) console.log("  [ENGINE] " + msg.text()); });
  await page.goto("https://woogoro.com/plumbing-quote-analyzer.html?path=quote", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function(){});
  await sleep(6000);

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
    await fi.uploadFile(path.join(ROOT, "test-quotes/plumbing-images/10-is-this-estimate-crazy-or-am-i.jpeg"));
    await page.evaluate(function(inp){inp.dispatchEvent(new Event("change",{bubbles:true}));}, fi);
    console.log("  Uploaded. Polling...");
    for (var i = 0; i < 24; i++) {
      await sleep(5000);
      var st = await page.evaluate(function() {
        var b = document.body.innerText || "";
        return {
          confirm: /is this your quote|is this correct|we found your quote/i.test(b.substring(0, 1000)),
          result: /verdict|your.*quote.*is|fair price|overpriced|above average|below average/i.test(b.substring(0, 2000)),
          manual: /enter your quote total|couldn.t read/i.test(b.substring(0, 1000)),
        };
      });
      if (st.confirm) {
        console.log("  Price confirm step. Clicking yes...");
        await page.screenshot({ path: path.join(OUT, "PL-confirm.png") });
        await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button")).filter(function(b){return b.offsetParent&&/yes|correct|analyze this/i.test(b.textContent);});if(b[0])b[0].click();});
        await sleep(8000);
        break;
      }
      if (st.result) { console.log("  Result rendered directly"); break; }
      if (st.manual) { console.log("  Manual entry fallback"); break; }
    }
    await page.screenshot({ path: path.join(OUT, "PL-analyze-result.png"), fullPage: true });
    var txt = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 3000); });
    console.log("\n--- ANALYZE ---\n" + txt.substring(0, 2500) + "\n--- END ---");
  }
  await page.close();

  // ===== COMPARE =====
  console.log("\n===== PLUMBING COMPARE ($6,950 vs ~$782 Roto-Rooter) =====");
  page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on("console", function(msg) { if (msg.text().includes("TP_Engine")) console.log("  [ENGINE] " + msg.text()); });
  await page.goto("https://woogoro.com/compare-plumbing-quotes.html", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function(){});
  await sleep(6000);
  var fis = await page.$$("input[type=file]");
  console.log("  Slots: " + fis.length);
  if (fis.length >= 2) {
    await fis[0].uploadFile(path.join(ROOT, "test-quotes/plumbing-images/10-is-this-estimate-crazy-or-am-i.jpeg"));
    await page.evaluate(function(inp){inp.dispatchEvent(new Event("change",{bubbles:true}));}, fis[0]);
    await sleep(1500);
    await fis[1].uploadFile(path.join(ROOT, "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg"));
    await page.evaluate(function(inp){inp.dispatchEvent(new Event("change",{bubbles:true}));}, fis[1]);
    console.log("  Uploaded 2. Polling OCR...");
    for (var i = 0; i < 24; i++) {
      await sleep(5000);
      var st = await page.evaluate(function(){return{p:(document.body.innerText.match(/Parsing/g)||[]).length};});
      if (st.p === 0) { console.log("  OCR done at " + (i+1)*5 + "s"); break; }
      if (i%4===0) console.log("  [" + (i+1)*5 + "s] parsing " + st.p);
    }
    var clicked = await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button")).filter(function(b){return b.offsetParent&&/compare/i.test(b.textContent)&&!b.disabled;});if(b[0]){b[0].click();return true;}return false;});
    console.log("  Compare clicked: " + clicked);
    await sleep(8000);
    await page.screenshot({ path: path.join(OUT, "PL-compare-result.png"), fullPage: true });
    var txt = await page.evaluate(function() { return (document.body.innerText || "").substring(0, 3000); });
    console.log("\n--- COMPARE ---\n" + txt.substring(0, 2500) + "\n--- END ---");
  }
  await page.close();
  await browser.close();
  console.log("\n===== PLUMBING DONE =====");
})();
