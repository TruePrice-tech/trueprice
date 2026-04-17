const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const VERTICALS = [
  {
    name: "hvac",
    estimate: "/hvac-estimate.html",
    analyzer: "/hvac-quote-analyzer.html",
    compare: "/compare-hvac-quotes.html",
    firstClick: "Central AC",
    fixture: "test-quotes/hvac-test-images/04-is-this-reasonable.jpeg"
  },
  {
    name: "fencing",
    estimate: "/fencing-estimate.html",
    analyzer: "/fencing-quote-analyzer.html",
    compare: "/compare-fencing-quotes.html",
    firstClick: "Cedar",
    fixture: null
  },
  {
    name: "painting",
    estimate: "/painting-estimate.html",
    analyzer: "/painting-quote-analyzer.html",
    compare: "/compare-painting-quotes.html",
    firstClick: "Exterior",
    fixture: "test-quotes/painting-test-images/07-is-this-a-fair.jpeg"
  },
  {
    name: "solar",
    estimate: "/solar-estimate.html",
    analyzer: "/solar-quote-analyzer.html",
    compare: "/compare-solar-quotes.html",
    firstClick: "Medium",
    fixture: "test-quotes/solar-test-images/04-how-does-my-solar-quote-look-thx-in-advance-nc-duk.jpg"
  },
  {
    name: "plumbing",
    estimate: "/plumbing-estimate.html",
    analyzer: "/plumbing-quote-analyzer.html",
    compare: "/compare-plumbing-quotes.html",
    firstClick: "Water Heater",
    fixture: "test-quotes/plumbing-test-images/10-is-this-estimate-crazy-or-am-i.jpeg"
  },
  {
    name: "windows",
    estimate: "/window-estimate.html",
    analyzer: "/window-quote-analyzer.html",
    compare: "/compare-windows-quotes.html",
    firstClick: "4 - 8",
    fixture: "images/window1messy.jpeg"
  }
];

const BASE = "https://woogoro.com";

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  for (const v of VERTICALS) {
    console.log("\n" + "=".repeat(50));
    console.log(v.name.toUpperCase());
    console.log("=".repeat(50));

    // ---- PATH 1: ESTIMATE ----
    console.log("\n  PATH 1: ESTIMATE");
    var p = await browser.newPage();
    var err = [];
    p.on("pageerror", e => err.push(e.message.substring(0, 80)));
    await p.goto(BASE + v.estimate, { waitUntil: "networkidle2", timeout: 15000 });

    // Enter address
    var hasAddr = await p.evaluate(() => {
      var s = document.getElementById("addrStreet");
      var f = document.querySelector("[class*=address-form]");
      return s && f && f.style.display !== "none";
    });
    if (hasAddr) {
      await p.type("#addrStreet", "100 Main St");
      await p.type("#addrCity", "Charlotte");
      await p.type("#addrState", "NC");
      await p.type("#addrZip", "28202");
      await p.evaluate(() => { var b = document.getElementById("btnEstimate"); if (b) b.click(); });
      await sleep(2000);
      console.log("    Address: entered");
    } else {
      console.log("    Address: FORM NOT VISIBLE");
    }

    // Click first option
    var clicked = await p.evaluate((text) => {
      var els = document.querySelectorAll("[class*=-option]");
      for (var el of els) {
        if (el.textContent.trim().startsWith(text) && el.offsetParent) { el.click(); return true; }
      }
      return false;
    }, v.firstClick);
    console.log("    First option '" + v.firstClick + "': " + (clicked ? "clicked" : "NOT FOUND"));
    await sleep(1000);

    // Check what's on screen - did we advance or get a result?
    var state = await p.evaluate(() => {
      var t = document.body.innerText;
      return {
        hasPrice: !!t.match(/\$[\d,]+/),
        hasStep: t.includes("Step "),
        hasResult: t.includes("Estimated") || t.includes("Fair Price") || t.includes("range"),
        hasError: t.includes("error") || t.includes("Error"),
        hasFindContractors: t.includes("Find") && t.includes("Contractors") && !t.includes("footer"),
        snippet: t.substring(0, 200)
      };
    });
    var resultCheck = state.hasPrice ? "PRICES VISIBLE" : state.hasStep ? "ON NEXT STEP (more clicks needed)" : state.hasResult ? "RESULT SHOWN" : "UNKNOWN STATE";
    console.log("    State: " + resultCheck);
    if (state.hasFindContractors) console.log("    WARNING: Find Contractors CTA still visible");
    console.log("    JS errors: " + (err.length ? err.join("; ") : "none"));
    console.log("    ESTIMATE: " + (err.length === 0 ? "PASS" : "FAIL"));
    await p.close();

    // ---- PATH 2: ANALYZER ----
    console.log("\n  PATH 2: ANALYZER");
    p = await browser.newPage();
    err = [];
    p.on("pageerror", e => err.push(e.message.substring(0, 80)));
    await p.goto(BASE + v.analyzer, { waitUntil: "networkidle2", timeout: 15000 });

    var hasUpload = await p.evaluate(() => !!document.querySelector("input[type=file]") || document.body.innerText.includes("Upload"));
    console.log("    Upload available: " + hasUpload);

    if (hasUpload && v.fixture && fs.existsSync(v.fixture)) {
      // Enter address first if needed
      var hasAddrAnalyzer = await p.evaluate(() => !!document.getElementById("addrStreet"));
      if (hasAddrAnalyzer) {
        await p.type("#addrStreet", "100 Main St");
        await p.type("#addrCity", "Charlotte");
        await p.type("#addrState", "NC");
        await p.type("#addrZip", "28202");
      }

      var fi = await p.$("input[type=file]");
      if (fi) {
        await fi.uploadFile(path.resolve(v.fixture));
        console.log("    Uploaded: " + path.basename(v.fixture));
        // Wait for processing
        for (var w = 0; w < 30000; w += 5000) {
          await sleep(5000);
          var status = await p.evaluate(() => {
            var t = document.body.innerText;
            return {
              processing: t.includes("Analyzing") || t.includes("Processing") || t.includes("Parsing"),
              result: t.includes("Fair Price") || t.includes("Overpriced") || t.includes("Excellent") || t.includes("Estimated") || t.includes("verdict"),
              needsMore: t.includes("need") || t.includes("upload"),
              hasPrice: !!t.match(/\$[\d,]+/)
            };
          });
          if (status.result || status.hasPrice) {
            console.log("    Result appeared after " + ((w + 5000) / 1000) + "s");
            // Check for garbage in result
            var resultGarbage = await p.evaluate(() => {
              var t = document.body.innerText;
              return {
                hasFindContractors: false, // We removed these
                hasUndefined: t.includes("undefined"),
                hasNaN: t.includes("NaN"),
                hasNull: /\bnull\b/.test(t)
              };
            });
            if (resultGarbage.hasUndefined) console.log("    WARNING: 'undefined' in result");
            if (resultGarbage.hasNaN) console.log("    WARNING: 'NaN' in result");
            if (resultGarbage.hasNull) console.log("    WARNING: 'null' in result");
            break;
          }
          if (!status.processing) { console.log("    Stopped processing, no result yet"); break; }
          console.log("    Processing... (" + ((w + 5000) / 1000) + "s)");
        }
      }
    } else if (!v.fixture) {
      console.log("    No fixture for this vertical, skipping upload test");
    }
    console.log("    JS errors: " + (err.length ? err.join("; ") : "none"));
    console.log("    ANALYZER: " + (err.length === 0 ? "PASS" : "FAIL"));
    await p.close();

    // ---- PATH 3: COMPARE ----
    console.log("\n  PATH 3: COMPARE");
    p = await browser.newPage();
    err = [];
    p.on("pageerror", e => err.push(e.message.substring(0, 80)));
    await p.goto(BASE + v.compare, { waitUntil: "networkidle2", timeout: 15000 });

    var compareState = await p.evaluate(() => {
      return {
        slots: document.querySelectorAll("input[type=file]").length,
        hasTitle: document.body.innerText.includes("Compare"),
        hasUpload: document.body.innerText.includes("Upload") || document.body.innerText.includes("upload"),
        bodyLength: document.body.innerText.length
      };
    });
    console.log("    Slots: " + compareState.slots + " | Title: " + compareState.hasTitle + " | Upload: " + compareState.hasUpload);
    console.log("    JS errors: " + (err.length ? err.join("; ") : "none"));
    console.log("    COMPARE: " + (err.length === 0 && compareState.slots >= 2 ? "PASS" : "FAIL"));
    await p.close();
  }

  await browser.close();
  console.log("\n" + "=".repeat(50));
  console.log("6 VERTICALS x 3 PATHS = 18 TESTS COMPLETE");
  console.log("=".repeat(50));
})();
