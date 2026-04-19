var puppeteer = require("puppeteer");
var path = require("path");
var fs = require("fs");
var sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
var ROOT = path.dirname(__dirname);
var OUT = path.join(ROOT, "output", "human-test");

(async function() {
  var browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ===== ANALYZE =====
  console.log("\n===== HVAC ANALYZE (04 - $610 repair) =====");
  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto("https://woogoro.com/hvac-quote-analyzer.html?path=quote", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(function(){});
  await sleep(6000);

  // Handle address flow
  var hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });
  if (!hasFile) {
    await page.evaluate(function() {
      function s(sel,v){var el=document.querySelector(sel);if(el){el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}}
      s("input[placeholder*='address' i], input[placeholder*='street' i]","17064 Laurelmont Ct");
      s("input[placeholder*='city' i]","Fort Mill");s("input[placeholder*='state' i]","SC");s("input[placeholder*='zip' i]","29707");
    });
    await sleep(500);
    await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button")).filter(function(b){return b.offsetParent&&/estimate|go|next|continue/i.test(b.textContent);});if(b[0])b[0].click();});
    await sleep(6000);
    await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button,a")).filter(function(b){return b.offsetParent&&/upload|quote|have|check|analyze/i.test(b.textContent);});if(b[0])b[0].click();});
    await sleep(4000);
  }

  var fi = await page.$("input[type=file]");
  if (fi) {
    await fi.uploadFile(path.join(ROOT, "test-quotes/hvac-images/04-is-this-reasonable.jpeg"));
    await page.evaluate(function(inp){inp.dispatchEvent(new Event("change",{bubbles:true}));}, fi);
    console.log("Uploaded. Polling...");
    for (var i=0;i<30;i++) {
      await sleep(5000);
      var st = await page.evaluate(function(){var b=document.body.innerText||"";return{a:/analyzing|parsing|processing|reading/i.test(b.substring(0,500)),r:/verdict|your.*quote|fair|overpriced|price check|enter your quote/i.test(b.substring(0,2000))};});
      if (st.r) { console.log("Result at "+(i+1)*5+"s (analyzing="+st.a+")"); break; }
    }
    await sleep(2000);
    await page.screenshot({path:path.join(OUT,"HV1-analyze.png"),fullPage:true});
    var txt = await page.evaluate(function(){return(document.body.innerText||"").substring(0,2500);});
    console.log("\n--- ANALYZE OUTPUT ---\n"+txt.substring(0,2000)+"\n--- END ---");
  }
  await page.close();

  // ===== COMPARE =====
  console.log("\n===== HVAC COMPARE ($610 vs $3,810) =====");
  var fix1 = path.join(ROOT,"test-quotes/hvac-images/04-is-this-reasonable.jpeg");
  var fix2 = path.join(ROOT,"test-quotes/hvac-images/07-had-a-leak-in-the-coil-of-my-air-handler-is-this-r.jpeg");
  page = await browser.newPage();
  await page.setViewport({width:1366,height:900});
  await page.goto("https://woogoro.com/compare-hvac-quotes.html",{waitUntil:"domcontentloaded",timeout:30000}).catch(function(){});
  await sleep(6000);
  var fis = await page.$$("input[type=file]");
  console.log("Upload slots: "+fis.length);
  if (fis.length>=2) {
    await fis[0].uploadFile(fix1);
    await page.evaluate(function(inp){inp.dispatchEvent(new Event("change",{bubbles:true}));},fis[0]);
    await sleep(1500);
    await fis[1].uploadFile(fix2);
    await page.evaluate(function(inp){inp.dispatchEvent(new Event("change",{bubbles:true}));},fis[1]);
    console.log("Uploaded 2. Polling for OCR...");
    for(var i=0;i<24;i++){await sleep(5000);var st=await page.evaluate(function(){return{p:(document.body.innerText.match(/Parsing/g)||[]).length};});if(st.p===0){console.log("OCR done at "+(i+1)*5+"s");break;}if(i%4===0)console.log("Poll "+(i+1)*5+"s: parsing "+st.p);}
    var clicked=await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button")).filter(function(b){return b.offsetParent&&/compare/i.test(b.textContent)&&!b.disabled;});if(b[0]){b[0].click();return true;}return false;});
    console.log("Compare clicked: "+clicked);
    await sleep(8000);
    await page.screenshot({path:path.join(OUT,"HV2-compare.png"),fullPage:true});
    var txt = await page.evaluate(function(){return(document.body.innerText||"").substring(0,3000);});
    console.log("\n--- COMPARE OUTPUT ---\n"+txt.substring(0,2500)+"\n--- END ---");
  }
  await page.close();
  await browser.close();
  console.log("\n===== HVAC DONE =====");
})();
