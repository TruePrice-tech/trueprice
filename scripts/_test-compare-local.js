#!/usr/bin/env node
// Tests compare path for a vertical against local server
// Usage: node _test-compare-local.js <vertical>
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
  roofing: { cmp: "/compare-roofing-quotes.html", fx: "roofing-images" },
  hvac: { cmp: "/compare-hvac-quotes.html", fx: "hvac-images" },
  plumbing: { cmp: "/compare-plumbing-quotes.html", fx: "plumbing-images" },
  electrical: { cmp: "/compare-electrical-quotes.html", fx: "electrical-images" },
  solar: { cmp: "/compare-solar-quotes.html", fx: "solar-images" },
  windows: { cmp: "/compare-windows-quotes.html", fx: "windows-images" },
  siding: { cmp: "/compare-siding-quotes.html", fx: "siding-images" },
  painting: { cmp: "/compare-painting-quotes.html", fx: "painting-images" },
  concrete: { cmp: "/compare-concrete-quotes.html", fx: "concrete-images" },
  fencing: { cmp: "/compare-fencing-quotes.html", fx: "fencing-images" },
  gutters: { cmp: "/compare-gutters-quotes.html", fx: "gutters-images" },
  insulation: { cmp: "/compare-insulation-quotes.html", fx: "insulation-images" },
  foundation: { cmp: "/compare-foundation-quotes.html", fx: "foundation-images" },
  "garage-door": { cmp: "/compare-garage-door-quotes.html", fx: "garage-door-images" },
  kitchen: { cmp: "/compare-kitchen-quotes.html", fx: "kitchen-images" },
  landscaping: { cmp: "/compare-landscaping-quotes.html", fx: "landscaping-images" },
  moving: { cmp: "/compare-moving-quotes.html", fx: "moving-images" },
  auto: { cmp: "/compare-auto-quotes.html", fx: "auto-images" },
  medical: { cmp: "/compare-medical-quotes.html", fx: "medical-images" },
  legal: { cmp: "/compare-legal-quotes.html", fx: "legal-images" },
};

function getFixtures(fxDir, count) {
  var dir = path.join(ROOT, "test-quotes", fxDir);
  if (!fs.existsSync(dir)) return [];
  var files = fs.readdirSync(dir).filter(function(f) { return /\.(jpe?g|png)$/i.test(f) && !/manifest|README|test-result/i.test(f); });
  // Prefer comparison synthetics (designed for compare testing)
  var synth = files.filter(function(f) { return /^comparison-/.test(f); });
  if (synth.length >= count) return synth.slice(0, count).map(function(f) { return path.join(dir, f); });
  // Then real + synth combined
  return files.slice(0, count).map(function(f) { return path.join(dir, f); });
}

async function testCompare(browser, vertName, BASE) {
  var v = VERT[vertName];
  var fixtures = getFixtures(v.fx, 2);
  if (fixtures.length < 2) { console.log("  Not enough fixtures for " + vertName + " compare"); return; }

  console.log("\n===== " + vertName.toUpperCase() + " COMPARE =====");
  console.log("  Q1: " + path.basename(fixtures[0]));
  console.log("  Q2: " + path.basename(fixtures[1]));

  var page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on("console", function(msg) { if (msg.text().includes("TP_Engine")) console.log("  [ENGINE] " + msg.text()); });

  await page.goto(BASE + v.cmp, { waitUntil: "networkidle2", timeout: 30000 }).catch(function() {});
  await sleep(5000);

  var fis = await page.$$("input[type=file]");
  console.log("  Upload slots: " + fis.length);
  if (fis.length < 2) { console.log("  NOT ENOUGH UPLOAD SLOTS"); await page.close(); return; }

  await fis[0].uploadFile(fixtures[0]);
  await page.evaluate(function(inp){inp.dispatchEvent(new Event("change",{bubbles:true}));}, fis[0]);
  await sleep(1500);
  await fis[1].uploadFile(fixtures[1]);
  await page.evaluate(function(inp){inp.dispatchEvent(new Event("change",{bubbles:true}));}, fis[1]);
  console.log("  Uploaded. Polling OCR (up to 120s)...");

  for (var i = 0; i < 24; i++) {
    await sleep(5000);
    var st = await page.evaluate(function(){return{p:(document.body.innerText.match(/Parsing/g)||[]).length};});
    if (st.p === 0) { console.log("  OCR done at " + (i+1)*5 + "s"); break; }
    if (i % 4 === 0) console.log("  [" + (i+1)*5 + "s] parsing " + st.p);
  }

  var clicked = await page.evaluate(function(){
    var b = Array.from(document.querySelectorAll("button")).filter(function(b){return b.offsetParent&&/compare/i.test(b.textContent)&&!b.disabled;});
    if(b[0]){b[0].click();return true;}return false;
  });
  console.log("  Compare clicked: " + clicked);
  if (!clicked) { console.log("  COMPARE BUTTON DISABLED"); await page.close(); return; }

  await sleep(8000);
  await page.screenshot({ path: path.join(OUT, vertName + "-compare-local.png"), fullPage: true });
  var txt = await page.evaluate(function(){return(document.body.innerText||"").substring(0,2500);});
  console.log("\n--- " + vertName.toUpperCase() + " COMPARE RESULT ---");
  console.log(txt.substring(0, 2000));
  console.log("--- END ---\n");
  await page.close();
}

(async function() {
  var args = process.argv.slice(2);
  var verticals = args.length ? args[0].split(",") : Object.keys(VERT);

  var server = await serve();
  var BASE = "http://127.0.0.1:" + PORT;
  var browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  for (var i = 0; i < verticals.length; i++) {
    var vn = verticals[i].trim();
    if (!VERT[vn]) { console.log("Unknown: " + vn); continue; }
    await testCompare(browser, vn, BASE);
  }

  await browser.close();
  server.close();
  console.log("\n===== ALL COMPARE TESTS DONE =====");
})();
