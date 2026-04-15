const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // =====================================================
  // PATH 1: ESTIMATOR - answer ALL questions
  // =====================================================
  console.log("========================================");
  console.log("PATH 1: ESTIMATOR (all questions)");
  console.log("========================================\n");

  const p1 = await browser.newPage();
  var jsErrors = [];
  p1.on("pageerror", err => jsErrors.push(err.message.substring(0, 150)));
  await p1.goto("https://truepricehq.com/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "networkidle2", timeout: 20000 });

  // Address
  await p1.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
  await p1.type("#journeyStreetAddress", "17064 Laurelmont Court");
  await p1.type("#journeyCity", "Fort Mill");
  await p1.type("#journeyState", "SC");
  await p1.type("#journeyZipCode", "29707");
  await p1.evaluate(() => window.handleAddressSubmit());
  await sleep(3000);
  console.log("1. Address submitted, confirm skipped: " + !(await p1.evaluate(() => document.body.innerText.includes("Is this the right"))));

  // Select ALL required options using data-value attributes
  async function selectOption(group, value) {
    var result = await p1.evaluate((g, v) => {
      var btns = document.querySelectorAll("button.est-option");
      for (var b of btns) {
        if (b.dataset.group === g && b.dataset.value === v) {
          b.click();
          return b.textContent.trim().substring(0, 40);
        }
      }
      // Fallback: first button with matching data-value
      for (var b of btns) {
        if (b.dataset.value === v) {
          b.click();
          return "[fallback] " + b.textContent.trim().substring(0, 40);
        }
      }
      return null;
    }, group, value);
    return result;
  }

  // Work type
  var r = await selectOption("workType", "replacement");
  console.log("2. Work type: " + (r || "NOT FOUND"));

  // Season/timeline
  r = await selectOption("season", "summer");
  console.log("3. Timeline: " + (r || "NOT FOUND"));

  // Property type
  r = await selectOption("propertyType", "two_story");
  console.log("4. Property type: " + (r || "NOT FOUND"));

  // Material
  r = await selectOption("material", "architectural");
  console.log("5. Material: " + (r || "NOT FOUND"));

  // Pitch
  r = await selectOption("pitch", "normal");
  console.log("6. Pitch: " + (r || "NOT FOUND"));

  // Complexity
  r = await selectOption("complexity", "normal");
  console.log("7. Complexity: " + (r || "NOT FOUND"));

  // Insurance
  r = await selectOption("insurance", "no");
  console.log("8. Insurance: " + (r || "NOT FOUND"));

  // Ownership
  r = await selectOption("ownership", "yes");
  console.log("9. Ownership: " + (r || "NOT FOUND"));

  // Home size
  await p1.evaluate(() => {
    var inp = document.getElementById("estHomeSize");
    if (inp) { inp.value = "2200"; inp.dispatchEvent(new Event("input", {bubbles:true})); inp.dispatchEvent(new Event("change", {bubbles:true})); }
  });
  console.log("10. Home size: 2200 sqft");

  // Verify all selected
  var selected = await p1.evaluate(() => {
    var s = [];
    document.querySelectorAll("button.est-option").forEach(b => {
      if (b.classList.contains("selected") || b.getAttribute("aria-selected") === "true" ||
          window.getComputedStyle(b).borderColor.includes("59, 130, 246")) {
        s.push(b.dataset.group + "=" + b.dataset.value);
      }
    });
    return s;
  });
  console.log("\nSelected options: " + selected.join(", "));

  // Check for validation message
  var validation = await p1.evaluate(() => {
    var t = document.body.innerText;
    if (t.includes("Please answer all")) return "VALIDATION: not all answered";
    return "OK";
  });
  console.log("Validation: " + validation);

  // Click Build
  console.log("\n11. Clicking 'Build my estimate'...");
  await p1.evaluate(() => {
    var btns = document.querySelectorAll("button");
    for (var b of btns) {
      if (b.textContent.trim().includes("Build my estimate")) { b.click(); return; }
    }
  });
  await sleep(5000);

  // Check result
  console.log("\n12. CHECKING RESULT...");
  // Scroll down
  await p1.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(1000);

  var result = await p1.evaluate(() => {
    var t = document.body.innerText;
    return {
      hasVerdict: t.includes("Fair Price") || t.includes("Overpriced") || t.includes("Excellent") || t.includes("Higher") || t.includes("Unusually"),
      hasEstimatedCost: t.includes("Estimated") || t.includes("estimated"),
      hasDollarAmount: !!t.match(/\$[\d,]+/),
      dollarAmounts: (t.match(/\$[\d,]+/g) || []).slice(0, 10),
      hasTierComp: t.includes("Same roof") || t.includes("different materials"),
      hasNextSteps: t.includes("Next steps") || t.includes("before you sign"),
      hasFindContractors: t.includes("Find contractors"),
      hasScope: t.includes("tear") || t.includes("underlayment"),
      hasValidation: t.includes("Please answer all"),
      bodyLength: t.length,
      last500: t.substring(Math.max(0, t.length - 500))
    };
  });

  console.log("  Verdict: " + result.hasVerdict);
  console.log("  Estimated cost: " + result.hasEstimatedCost);
  console.log("  Dollar amounts: " + JSON.stringify(result.dollarAmounts));
  console.log("  Tier comparison: " + result.hasTierComp);
  console.log("  Next steps: " + result.hasNextSteps);
  console.log("  Scope items: " + result.hasScope);
  console.log("  Find contractors: " + result.hasFindContractors);
  console.log("  Still showing validation: " + result.hasValidation);
  console.log("  Body length: " + result.bodyLength);
  if (!result.hasVerdict && !result.hasDollarAmount) {
    console.log("  Last 500 chars: " + result.last500);
  }
  console.log("  JS errors: " + (jsErrors.length ? jsErrors.join("; ") : "NONE"));

  // Take a full page dump for analysis
  if (result.hasDollarAmount) {
    console.log("\n  === ESTIMATE RESULT FOUND ===");
    var fullResult = await p1.evaluate(() => {
      // Find the result section specifically
      var sections = document.querySelectorAll("section, .result, [class*=result], [class*=verdict], [class*=estimate]");
      var content = [];
      sections.forEach(s => {
        if (s.offsetParent && s.textContent.trim().length > 50) {
          content.push(s.textContent.trim().substring(0, 200));
        }
      });
      return content;
    });
    fullResult.forEach((c, i) => console.log("  Section " + i + ": " + c.substring(0, 150)));
  }

  await p1.close();

  // =====================================================
  // PATH 2: ANALYZER (upload from address page)
  // =====================================================
  console.log("\n========================================");
  console.log("PATH 2: ANALYZER (upload from address page)");
  console.log("========================================\n");

  const p2 = await browser.newPage();
  var jsErrors2 = [];
  p2.on("pageerror", err => jsErrors2.push(err.message.substring(0, 150)));
  await p2.goto("https://truepricehq.com/roofing-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 20000 });

  console.log("1. Looking for upload on address page...");
  var hasUploadOnAddress = await p2.evaluate(() => {
    return {
      fileInput: !!document.querySelector("input[type=file]"),
      uploadBtn: !!document.getElementById("uploadQuoteBtn"),
      bodyHasUpload: document.body.innerText.includes("Upload") || document.body.innerText.includes("upload")
    };
  });
  console.log("  File input: " + hasUploadOnAddress.fileInput);
  console.log("  Upload button: " + hasUploadOnAddress.uploadBtn);

  if (hasUploadOnAddress.fileInput) {
    var qf = "test-quotes/roofing-test-images/02-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg";
    if (fs.existsSync(qf)) {
      console.log("\n2. Uploading messy quote from address page...");
      var fi = await p2.$("input[type=file]");
      await fi.uploadFile(path.resolve(qf));
      console.log("  Uploaded: " + path.basename(qf));

      for (var w = 0; w < 90000; w += 5000) {
        await sleep(5000);
        var status = await p2.evaluate(() => {
          var t = document.body.innerText;
          return {
            processing: t.includes("Analyzing") || t.includes("Processing") || t.includes("Reading") || t.includes("Scanning") || t.includes("Extracting"),
            confirm: t.includes("Is this the right") || t.includes("Looks correct"),
            hasVerdict: t.includes("Fair Price") || t.includes("Overpriced") || t.includes("Excellent") || t.includes("Higher Than") || t.includes("Unusually"),
            needsSize: t.includes("We need your roof size"),
            hasTierComp: t.includes("Same roof") || t.includes("different materials"),
            hasScope: t.includes("tear-off") || t.includes("underlayment") || t.includes("Before you sign"),
            hasNextSteps: t.includes("Next steps") || t.includes("before you sign"),
            prices: (t.match(/\$[\d,]+/g) || []).slice(0, 5),
            snippet: t.substring(0, 200)
          };
        });
        var elapsed = ((w+5000)/1000) + "s";
        if (status.processing) { console.log("  " + elapsed + ": Processing..."); continue; }
        if (status.confirm) {
          console.log("  " + elapsed + ": Confirm property shown - clicking Looks correct");
          await p2.evaluate(() => { if (window.confirmProperty) window.confirmProperty(); });
          continue;
        }
        if (status.hasVerdict) {
          console.log("  " + elapsed + ": VERDICT REACHED!");
          // Scroll and get full details
          await p2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(1000);
          var fullDetails = await p2.evaluate(() => {
            var t = document.body.innerText;
            return {
              hasTierComp: t.includes("Same roof") || t.includes("different materials"),
              hasScope: t.includes("Before you sign") || t.includes("tear-off") || t.includes("underlayment"),
              hasNextSteps: t.includes("Next steps") || t.includes("before you sign"),
              hasContractors: t.includes("Find contractors"),
              prices: (t.match(/\$[\d,]+/g) || []).slice(0, 10)
            };
          });
          console.log("  Prices: " + JSON.stringify(fullDetails.prices));
          console.log("  Tier comparison: " + fullDetails.hasTierComp);
          console.log("  Scope/Before you sign: " + fullDetails.hasScope);
          console.log("  Next steps: " + fullDetails.hasNextSteps);
          console.log("  Find contractors: " + fullDetails.hasContractors);
          break;
        }
        if (status.needsSize) {
          console.log("  " + elapsed + ": Needs roof size (expected for some photos)");
          break;
        }
        console.log("  " + elapsed + ": waiting... prices=" + JSON.stringify(status.prices));
      }
    }
  } else {
    console.log("  No file input on address page");
  }

  console.log("  JS errors: " + (jsErrors2.length ? jsErrors2.join("; ") : "NONE"));
  await p2.close();

  await browser.close();
  console.log("\n========================================");
  console.log("FINAL WALKTHROUGH COMPLETE");
  console.log("========================================");
})();
