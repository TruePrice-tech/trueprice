const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // =====================================================
  // PATH 1: ESTIMATOR
  // =====================================================
  console.log("========================================");
  console.log("PATH 1: ESTIMATOR");
  console.log("========================================\n");

  const p1 = await browser.newPage();
  var e1 = [];
  p1.on("pageerror", err => e1.push(err.message.substring(0, 150)));
  p1.on("dialog", async dialog => {
    console.log("  DIALOG: " + dialog.type() + " - " + dialog.message().substring(0, 100));
    await dialog.accept("2200");
  });
  await p1.goto("https://woogoro.com/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "networkidle2", timeout: 20000 });

  // Address
  console.log("1. Enter address");
  await p1.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
  await p1.type("#journeyStreetAddress", "17064 Laurelmont Court");
  await p1.type("#journeyCity", "Fort Mill");
  await p1.type("#journeyState", "SC");
  await p1.type("#journeyZipCode", "29707");
  await p1.evaluate(() => window.handleAddressSubmit());
  await sleep(4000);
  console.log("   Confirm skipped: " + !(await p1.evaluate(() => document.body.innerText.includes("Is this the right"))));

  // Check if OSM pre-filled
  var osmPrefill = await p1.evaluate(() => {
    var inp = document.getElementById("estHomeSize");
    return inp ? inp.value : "NOT FOUND";
  });
  console.log("   OSM pre-filled sqft: " + (osmPrefill || "empty"));

  // Select all options
  console.log("\n2. Select all options");
  async function sel(group, value) {
    return await p1.evaluate((g, v) => {
      var btns = document.querySelectorAll("button.est-option");
      for (var b of btns) {
        if (b.dataset.group === g && b.dataset.value === v) { b.click(); return true; }
      }
      return false;
    }, group, value);
  }

  var selections = {
    workType: "replacement",
    season: "summer",
    propertyType: "two_story",
    material: "architectural",
    steepness: "normal",
    complexity: "normal",
    insurance: "no",
    ownership: "yes"
  };
  for (var [group, value] of Object.entries(selections)) {
    var ok = await sel(group, value);
    console.log("   " + group + " = " + value + ": " + (ok ? "OK" : "FAILED"));
    await sleep(200);
  }

  // Enter sqft if not pre-filled
  if (!osmPrefill) {
    await p1.evaluate(() => {
      var inp = document.getElementById("estHomeSize");
      if (inp) { inp.value = "3200"; inp.dispatchEvent(new Event("input", {bubbles:true})); }
    });
    console.log("   Manually entered sqft: 3200");
  }

  // Click Build
  console.log("\n3. Click Build my estimate");
  await p1.evaluate(() => {
    var btns = document.querySelectorAll("button");
    for (var b of btns) { if (b.textContent.includes("Build my estimate")) { b.click(); return; } }
  });

  // Wait for result (may take a few seconds for API calls)
  console.log("   Waiting for result...");
  var gotResult = false;
  var gotPrompt = false;
  for (var w = 0; w < 20000; w += 2000) {
    await sleep(2000);
    var state = await p1.evaluate(() => {
      var t = document.body.innerText;
      return {
        loading: t.includes("Crunching") || t.includes("Checking satellite"),
        result: t.includes("ESTIMATED COST") || t.includes("estimated cost") || t.includes("Midpoint"),
        prices: (t.match(/\$[\d,]+/g) || []).slice(0, 5)
      };
    });
    if (state.result) {
      console.log("   Result appeared after " + ((w+2000)/1000) + "s");
      gotResult = true;
      break;
    }
    if (state.loading) {
      console.log("   " + ((w+2000)/1000) + "s: loading...");
    }
  }

  // Analyze result
  console.log("\n4. Result analysis");
  if (gotResult) {
    // Scroll through entire page and capture all content
    await p1.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);
    var fullText = await p1.evaluate(() => document.body.innerText);

    var checks = {
      "Estimated cost range": !!fullText.match(/\$[\d,]+ . \$[\d,]+/),
      "Midpoint price": fullText.includes("Midpoint"),
      "Roof size shown": fullText.includes("sq ft"),
      "Material shown": fullText.includes("architectural") || fullText.includes("shingle"),
      "Cost per sq ft": fullText.includes("per sq ft") || fullText.includes("Cost Per"),
      "Confidence level": fullText.includes("Confidence") || fullText.includes("confidence"),
      "Scope checklist": fullText.includes("Tear-off") || fullText.includes("tear-off") || fullText.includes("typical roof"),
      "Tier comparison": fullText.includes("Same roof") || fullText.includes("different materials"),
      "Next steps": fullText.includes("Next steps") || fullText.includes("before you sign"),
      "Find contractors": fullText.includes("Find contractors"),
      "Methodology link": fullText.includes("How we calculate"),
      "Price slider/bar": fullText.includes("Midpoint:")
    };

    var prices = fullText.match(/\$[\d,]+/g) || [];
    console.log("   Prices found: " + prices.slice(0, 6).join(", "));

    for (var [check, passed] of Object.entries(checks)) {
      console.log("   " + (passed ? "PASS" : "MISS") + " " + check);
    }

    // Check for the prompt dialog (shouldn't have appeared)
    console.log("   Prompt dialog appeared: " + (gotPrompt ? "YES (BAD)" : "NO (GOOD)"));
  } else {
    console.log("   FAIL: No result appeared after 20s");
    var pageText = await p1.evaluate(() => document.body.innerText.substring(0, 500));
    console.log("   Page shows: " + pageText.substring(0, 300));
  }
  console.log("   JS errors: " + (e1.length ? e1.join("; ") : "NONE"));
  await p1.close();

  // =====================================================
  // PATH 2: ANALYZER (upload messy quote)
  // =====================================================
  console.log("\n========================================");
  console.log("PATH 2: ANALYZER (upload quote)");
  console.log("========================================\n");

  const p2 = await browser.newPage();
  var e2 = [];
  p2.on("pageerror", err => e2.push(err.message.substring(0, 150)));
  await p2.goto("https://woogoro.com/roofing-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 20000 });

  // Check for file input on address page
  console.log("1. Address page");
  var hasUpload = await p2.evaluate(() => !!document.querySelector("input[type=file]"));
  console.log("   File input on address page: " + hasUpload);

  if (hasUpload) {
    // Enter address first
    await p2.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
    await p2.type("#journeyStreetAddress", "100 Main St");
    await p2.type("#journeyCity", "Dallas");
    await p2.type("#journeyState", "TX");
    await p2.type("#journeyZipCode", "75201");

    // Upload quote
    console.log("\n2. Upload messy quote");
    var qf = "test-quotes/roofing-test-images/02-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg";
    if (fs.existsSync(qf)) {
      var fi = await p2.$("input[type=file]");
      await fi.uploadFile(path.resolve(qf));
      console.log("   Uploaded: " + path.basename(qf));

      // Wait for processing
      console.log("   Processing...");
      for (var w = 0; w < 90000; w += 5000) {
        await sleep(5000);
        var status = await p2.evaluate(() => {
          var t = document.body.innerText;
          return {
            processing: t.includes("Analyzing") || t.includes("Processing") || t.includes("Reading") || t.includes("Scanning") || t.includes("Extracting"),
            confirm: t.includes("Is this the right") || t.includes("Looks correct"),
            verdict: t.includes("Fair Price") || t.includes("Overpriced") || t.includes("Excellent") || t.includes("Higher Than") || t.includes("Unusually"),
            needsSize: t.includes("We need your roof size"),
            estimator: t.includes("What would your roof"),
            prices: (t.match(/\$[\d,]+/g) || []).slice(0, 5)
          };
        });
        var elapsed = ((w+5000)/1000) + "s";

        if (status.confirm) {
          console.log("   " + elapsed + ": Confirm property shown - clicking Looks correct");
          await p2.evaluate(() => { if (window.confirmProperty) window.confirmProperty(); });
          continue;
        }
        if (status.processing) { console.log("   " + elapsed + ": Processing..."); continue; }
        if (status.verdict) {
          console.log("   " + elapsed + ": VERDICT!");
          // Scroll and check all result sections
          await p2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(1000);
          var fullText = await p2.evaluate(() => document.body.innerText);
          var resultChecks = {
            "Verdict": fullText.includes("Fair Price") || fullText.includes("Overpriced") || fullText.includes("Excellent"),
            "Tier comparison": fullText.includes("Same roof") || fullText.includes("different materials"),
            "Before you sign": fullText.includes("Before you sign") || fullText.includes("before you sign"),
            "Next steps": fullText.includes("Next steps") || fullText.includes("before you sign"),
            "Find contractors": fullText.includes("Find contractors"),
            "Scope items": fullText.includes("tear") || fullText.includes("underlayment")
          };
          var prices = fullText.match(/\$[\d,]+/g) || [];
          console.log("   Prices: " + prices.slice(0, 6).join(", "));
          for (var [check, passed] of Object.entries(resultChecks)) {
            console.log("   " + (passed ? "PASS" : "MISS") + " " + check);
          }
          break;
        }
        if (status.needsSize) {
          console.log("   " + elapsed + ": Needs roof size (expected for some photos)");
          break;
        }
        if (status.estimator) {
          console.log("   " + elapsed + ": Showing estimator form (quote didn't parse, user can enter manually)");
          break;
        }
        console.log("   " + elapsed + ": waiting... prices=" + JSON.stringify(status.prices));
      }
    }
  } else {
    console.log("   No file input found on address page");
  }
  console.log("   JS errors: " + (e2.length ? e2.join("; ") : "NONE"));
  await p2.close();

  // =====================================================
  // PATH 3: COMPARE
  // =====================================================
  console.log("\n========================================");
  console.log("PATH 3: COMPARE");
  console.log("========================================\n");

  const p3 = await browser.newPage();
  var e3 = [];
  p3.on("pageerror", err => e3.push(err.message.substring(0, 150)));
  await p3.goto("https://woogoro.com/compare-roofing-quotes.html", { waitUntil: "networkidle2", timeout: 15000 });

  console.log("1. Compare page loaded");
  var slots = await p3.evaluate(() => document.querySelectorAll("input[type=file]").length);
  console.log("   Upload slots: " + slots);

  // Upload 2 quotes
  var quotes = [
    "test-quotes/roofing-test-images/02-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg",
    "test-quotes/roofing-test-images/05-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg"
  ];
  var inputs = await p3.$$("input[type=file]");
  for (var i = 0; i < Math.min(quotes.length, inputs.length); i++) {
    if (fs.existsSync(quotes[i])) {
      console.log("\n" + (i+2) + ". Upload quote " + (i+1) + ": " + path.basename(quotes[i]));
      await inputs[i].uploadFile(path.resolve(quotes[i]));
      await sleep(3000);
    }
  }

  // Wait for comparison
  console.log("\n4. Waiting for comparison...");
  for (var w = 0; w < 60000; w += 5000) {
    await sleep(5000);
    var cmpStatus = await p3.evaluate(() => {
      var t = document.body.innerText;
      return {
        processing: t.includes("Analyzing") || t.includes("Processing"),
        hasComparison: t.includes("Winner") || t.includes("winner") || t.includes("Best value") || t.includes("recommended"),
        hasTable: (t.includes("Price") || t.includes("$")) && (t.includes("Material") || t.includes("Scope")),
        prices: (t.match(/\$[\d,]+/g) || []).slice(0, 8)
      };
    });
    var elapsed = ((w+5000)/1000) + "s";
    if (cmpStatus.hasComparison || cmpStatus.hasTable) {
      console.log("   " + elapsed + ": Comparison ready!");
      console.log("   Prices: " + cmpStatus.prices.join(", "));
      console.log("   Winner shown: " + cmpStatus.hasComparison);
      console.log("   Table shown: " + cmpStatus.hasTable);
      break;
    }
    console.log("   " + elapsed + ": processing=" + cmpStatus.processing + " prices=" + cmpStatus.prices.length);
  }
  console.log("   JS errors: " + (e3.length ? e3.join("; ") : "NONE"));
  await p3.close();

  await browser.close();
  console.log("\n========================================");
  console.log("FULL WALKTHROUGH COMPLETE");
  console.log("========================================");
})();
