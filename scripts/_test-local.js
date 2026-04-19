#!/usr/bin/env node
// Tests analyze path for a vertical against local server
// Usage: node _test-local.js <vertical> [fixture-path]
var puppeteer = require("puppeteer");
var path = require("path");
var fs = require("fs");
var http = require("http");
var sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
var ROOT = path.dirname(__dirname);
var OUT = path.join(ROOT, "output", "human-test");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
var PORT = 4399;

function serve() {
  var server = http.createServer(function(req, res) {
    var urlPath = req.url.split("?")[0];
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
    var fp = path.join(ROOT, decodeURIComponent(urlPath));
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404); res.end("404"); return;
    }
    var ext = path.extname(fp).toLowerCase();
    var types = { ".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",
      ".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",
      ".woff2":"font/woff2",".ico":"image/x-icon",".txt":"text/plain",".wasm":"application/wasm" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise(function(r) { server.listen(PORT, "127.0.0.1", function() { r(server); }); });
}

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
  var files = fs.readdirSync(dir).filter(function(f) { return /\.(jpe?g|png|pdf)$/i.test(f) && !/manifest|README|test-result/i.test(f); });
  var real = files.filter(function(f) { return /^\d+|^real-/.test(f); });
  if (real.length) return path.join(dir, real[0]);
  var synth = files.filter(function(f) { return /^comparison-/.test(f); });
  if (synth.length) return path.join(dir, synth[0]);
  var mock = files.filter(function(f) { return /^mock-/.test(f); });
  if (mock.length) return path.join(dir, mock[0]);
  return null;
}

async function testVertical(browser, vertName, BASE, fixturePath) {
  var v = VERT[vertName];
  var fixture = fixturePath || getFixture(v.fx);
  if (!fixture) { console.log("  No fixtures for " + vertName); return; }

  console.log("\n===== " + vertName.toUpperCase() + " =====");
  console.log("  Fixture: " + path.basename(fixture));

  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on("console", function(msg) { if (msg.text().includes("TP_Engine")) console.log("  [ENGINE] " + msg.text()); });
  page.on("pageerror", function(e) { console.log("  [ERROR] " + e.message.substring(0, 100)); });

  var url = BASE + v.ana + (v.ana.includes("?") ? "&path=quote" : "?path=quote");
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 }).catch(function() {});
  await sleep(5000);

  // Find file input (try direct, then address flow, then upload trigger)
  var hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });
  if (!hasFile) {
    await page.evaluate(function() {
      function s(sel,v){var el=document.querySelector(sel);if(el){el.focus();el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}}
      s("input[placeholder*='street' i],input[placeholder*='address' i],input[id*='street' i]","17064 Laurelmont Ct");
      s("input[placeholder*='city' i],input[id*='city' i]","Fort Mill");
      s("input[placeholder*='state' i],input[id*='state' i]","SC");
      s("input[placeholder*='zip' i],input[id*='zip' i]","29707");
    });
    await sleep(500);
    await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button,input[type=submit]")).filter(function(b){return b.offsetParent&&/estimate|go|next|continue|submit|check|analyze|get/i.test(b.textContent||b.value||"");});if(b[0])b[0].click();});
    await sleep(6000);
    await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button,a")).filter(function(b){return b.offsetParent&&/confirm|yes|looks correct|upload|quote|have|check|analyze/i.test(b.textContent||"");});if(b[0])b[0].click();});
    await sleep(4000);
    hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });
  }
  if (!hasFile) {
    await page.evaluate(function(){var els=Array.from(document.querySelectorAll("button,a,div,label,span")).filter(function(el){return(el.offsetParent||el.tagName==="INPUT")&&/upload/i.test(el.textContent||"")&&(el.textContent||"").length<100;});if(els[0])els[0].click();});
    await sleep(2000);
    hasFile = await page.evaluate(function() { return !!document.querySelector("input[type=file]"); });
  }
  if (!hasFile) { console.log("  NO FILE INPUT"); await page.close(); return; }

  var fi = await page.$("input[type=file]");
  await fi.uploadFile(fixture);
  await page.evaluate(function(inp){inp.dispatchEvent(new Event("change",{bubbles:true}));}, fi);
  console.log("  Uploaded. Polling (up to 150s)...");

  var finalState = "timeout";
  for (var i = 0; i < 30; i++) {
    await sleep(5000);
    var st = await page.evaluate(function(){var b=document.body.innerText||"";var top=b.substring(0,1500);return{
      confirm:/we found your quote|is this your quote|is this correct/i.test(top),
      result:/verdict|your.*quote.*is|fair price|overpriced|above average|below average|woogoro.*verdict/i.test(top),
      manual:/enter your quote total|couldn.t read a price/i.test(top)};});
    if (st.confirm) {
      finalState = "confirm";
      console.log("  Price confirm at " + (i+1)*5 + "s");
      await page.evaluate(function(){var b=Array.from(document.querySelectorAll("button")).filter(function(b){return b.offsetParent&&/yes|correct|analyze this/i.test(b.textContent);});if(b[0])b[0].click();});
      await sleep(8000);
      break;
    }
    if (st.result) { finalState = "result"; console.log("  Result at " + (i+1)*5 + "s"); break; }
    if (st.manual) { finalState = "manual"; console.log("  Manual entry at " + (i+1)*5 + "s"); break; }
  }

  await sleep(2000);
  await page.screenshot({ path: path.join(OUT, vertName + "-local-result.png"), fullPage: true });
  var txt = await page.evaluate(function(){return(document.body.innerText||"").substring(0,3000);});
  console.log("\n--- " + vertName.toUpperCase() + " (state=" + finalState + ") ---");
  console.log(txt.substring(0, 2500));
  console.log("--- END ---\n");
  await page.close();
}

(async function() {
  var args = process.argv.slice(2);
  var verticals = args.length ? args[0].split(",") : Object.keys(VERT);

  var server = await serve();
  var BASE = "http://127.0.0.1:" + PORT;
  var browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-web-security"] });

  for (var i = 0; i < verticals.length; i++) {
    var vn = verticals[i].trim();
    if (!VERT[vn]) { console.log("Unknown: " + vn); continue; }
    await testVertical(browser, vn, BASE);
  }

  await browser.close();
  server.close();
  console.log("\n===== ALL DONE =====");
})();
