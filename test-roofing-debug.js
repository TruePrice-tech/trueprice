const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // =====================================================
  // PATH 1: ESTIMATOR - debug why result doesn't show
  // =====================================================
  console.log("========================================");
  console.log("PATH 1: ESTIMATOR DEBUG");
  console.log("========================================\n");

  const p1 = await browser.newPage();
  var jsErrors = [];
  var consoleLogs = [];
  p1.on("pageerror", err => jsErrors.push("JS_ERROR: " + err.message.substring(0, 200)));
  p1.on("console", msg => {
    var text = msg.text();
    // Capture warnings, errors, and anything with "estimate" or "result" or "journey"
    if (msg.type() === "error" || msg.type() === "warning" ||
        text.toLowerCase().includes("estimate") || text.toLowerCase().includes("result") ||
        text.toLowerCase().includes("journey") || text.toLowerCase().includes("step") ||
        text.toLowerCase().includes("roof") || text.toLowerCase().includes("build")) {
      consoleLogs.push("[" + msg.type() + "] " + text.substring(0, 200));
    }
  });

  await p1.goto("https://woogoro.com/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "networkidle2", timeout: 20000 });

  // Enter address
  await p1.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
  await p1.type("#journeyStreetAddress", "17064 Laurelmont Court");
  await p1.type("#journeyCity", "Fort Mill");
  await p1.type("#journeyState", "SC");
  await p1.type("#journeyZipCode", "29707");
  await p1.evaluate(() => window.handleAddressSubmit());
  await sleep(3000);
  console.log("Address submitted, confirm skipped");

  // Dump the full page structure to understand the estimator form
  console.log("\n--- FORM STRUCTURE ---");
  var structure = await p1.evaluate(() => {
    // Find ALL interactive elements and their data attributes
    var items = [];
    document.querySelectorAll("[data-value], [data-option], [data-category], [data-key]").forEach(el => {
      items.push({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 50),
        dataValue: el.dataset.value || "",
        dataOption: el.dataset.option || "",
        dataCategory: el.dataset.category || "",
        dataKey: el.dataset.key || "",
        visible: el.offsetParent !== null,
        classes: el.className.substring(0, 60)
      });
    });

    // Find the form/container
    var containers = [];
    document.querySelectorAll("[id*=est], [id*=Est], [class*=est], [class*=option]").forEach(el => {
      if (el.id || el.className) {
        containers.push({ tag: el.tagName, id: el.id, class: el.className.substring(0, 60), visible: el.offsetParent !== null });
      }
    });

    // Find the submit button
    var submitBtns = [];
    document.querySelectorAll("button").forEach(b => {
      if (b.offsetParent) submitBtns.push({ text: b.textContent.trim().substring(0, 50), onclick: (b.getAttribute("onclick") || "").substring(0, 80), classes: b.className.substring(0, 50) });
    });

    return { dataItems: items.slice(0, 30), containers: containers.slice(0, 20), buttons: submitBtns };
  });

  console.log("Data-attributed elements: " + structure.dataItems.length);
  structure.dataItems.forEach(item => {
    console.log("  " + item.tag + " [" + (item.dataCategory || item.dataKey || item.dataValue || item.dataOption) + "] " + item.text.substring(0, 40) + (item.visible ? "" : " (HIDDEN)"));
  });
  console.log("\nContainers with 'est' in id/class:");
  structure.containers.forEach(c => console.log("  " + c.tag + "#" + c.id + " ." + c.class + (c.visible ? "" : " (HIDDEN)")));
  console.log("\nVisible buttons:");
  structure.buttons.forEach(b => console.log("  [" + b.text + "] onclick=" + b.onclick + " class=" + b.classes));

  // Select options by clicking
  console.log("\n--- SELECTING OPTIONS ---");

  // Try clicking with data attributes
  async function selectByText(searchText) {
    return await p1.evaluate((text) => {
      var all = document.querySelectorAll("div, button, span, label, a");
      for (var el of all) {
        if (!el.offsetParent) continue;
        var t = el.textContent.trim();
        if (t.startsWith(text) && t.length < text.length + 40) {
          // Check it has cursor pointer or is interactive
          var cs = window.getComputedStyle(el);
          if (cs.cursor === "pointer" || el.tagName === "BUTTON" || el.onclick || el.dataset.value || el.dataset.category) {
            el.click();
            return { clicked: t.substring(0, 40), tag: el.tagName, dataset: JSON.stringify(el.dataset).substring(0, 100) };
          }
        }
      }
      return null;
    }, searchText);
  }

  var selections = [
    ["Time for a new", "Reason"],
    ["This summer", "Timeline"],
    ["Two story", "Home type"],
    ["Dimensional shingles", "Material"]
  ];

  for (var [text, label] of selections) {
    var result = await selectByText(text);
    if (result) {
      console.log(label + ": clicked '" + result.clicked + "' (" + result.tag + " dataset=" + result.dataset + ")");
    } else {
      console.log(label + ": NOT FOUND for '" + text + "'");
    }
    await sleep(300);
  }

  // Fill home size
  await p1.evaluate(() => {
    var inp = document.getElementById("estHomeSize");
    if (inp) { inp.value = "2200"; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  console.log("Home size: 2200");

  // Check which options are "selected" / "active"
  var selectedState = await p1.evaluate(() => {
    var selected = [];
    document.querySelectorAll("[class*=selected], [class*=active], [aria-selected=true], [data-selected]").forEach(el => {
      if (el.offsetParent) selected.push(el.textContent.trim().substring(0, 40));
    });
    // Also check by background color (selected cards often have different bg)
    document.querySelectorAll("div").forEach(el => {
      var cs = window.getComputedStyle(el);
      if (cs.cursor === "pointer" && el.offsetParent) {
        var bg = cs.backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "rgb(255, 255, 255)" && bg !== "transparent") {
          var t = el.textContent.trim();
          if (t.length > 3 && t.length < 80) selected.push("[bg:" + bg.substring(0, 20) + "] " + t.substring(0, 30));
        }
      }
    });
    return selected;
  });
  console.log("\nSelected/active elements: " + selectedState.length);
  selectedState.forEach(s => console.log("  " + s));

  // Now click "Build my estimate"
  console.log("\n--- CLICKING BUILD MY ESTIMATE ---");
  consoleLogs = []; // Reset to capture only post-click logs

  var buildResult = await p1.evaluate(() => {
    var btns = document.querySelectorAll("button");
    for (var b of btns) {
      if (b.offsetParent && b.textContent.trim().toLowerCase().includes("build my estimate")) {
        // Before clicking, check if form is valid
        var estSize = document.getElementById("estHomeSize");
        var sizeVal = estSize ? estSize.value : "none";

        b.click();
        return { clicked: true, sizeValue: sizeVal, buttonText: b.textContent.trim() };
      }
    }
    return { clicked: false };
  });
  console.log("Build button: " + JSON.stringify(buildResult));

  await sleep(3000);

  // Check what happened after clicking
  console.log("\n--- AFTER BUILD MY ESTIMATE ---");
  var afterBuild = await p1.evaluate(() => {
    var t = document.body.innerText;
    // Check journey state
    var journeyStep = "unknown";
    try { journeyStep = document.querySelector("[data-step]")?.dataset?.step || "no data-step attr"; } catch(e) {}

    // Check if result container exists
    var resultContainer = document.getElementById("resultContainer");
    var appRoot = document.getElementById("appRoot");

    // Check scroll position
    var scrollY = window.scrollY;
    var docHeight = document.documentElement.scrollHeight;
    var viewHeight = window.innerHeight;

    // Look for ANY price-like content anywhere on page
    var priceMatches = t.match(/\$[\d,]+/g) || [];

    // Check for hidden elements with results
    var hiddenResults = [];
    document.querySelectorAll("[style*=display], [style*=visibility]").forEach(el => {
      var s = el.style;
      if ((s.display === "none" || s.visibility === "hidden") && el.textContent.includes("$")) {
        hiddenResults.push(el.tagName + "#" + el.id + ": " + el.textContent.trim().substring(0, 60));
      }
    });

    return {
      bodyLength: t.length,
      hasVerdict: t.includes("Fair Price") || t.includes("Overpriced") || t.includes("Excellent") || t.includes("Higher Than") || t.includes("Unusually"),
      hasTierComp: t.includes("Same roof") || t.includes("different materials"),
      hasEstimate: t.includes("estimate") || t.includes("Estimate"),
      priceMatches: priceMatches.slice(0, 5),
      resultContainerExists: !!resultContainer,
      resultContainerContent: resultContainer ? resultContainer.textContent.trim().substring(0, 200) : "N/A",
      appRootContent: appRoot ? appRoot.textContent.trim().substring(0, 300) : "N/A",
      scrollY: scrollY,
      docHeight: docHeight,
      viewHeight: viewHeight,
      hiddenResults: hiddenResults.slice(0, 5),
      topOfPage: t.substring(0, 300),
      bottomOfPage: t.substring(Math.max(0, t.length - 500))
    };
  });

  console.log("Body length: " + afterBuild.bodyLength);
  console.log("Verdict found: " + afterBuild.hasVerdict);
  console.log("Tier comparison: " + afterBuild.hasTierComp);
  console.log("Prices on page: " + JSON.stringify(afterBuild.priceMatches));
  console.log("Result container exists: " + afterBuild.resultContainerExists);
  if (afterBuild.resultContainerExists) console.log("Result container: " + afterBuild.resultContainerContent);
  console.log("Scroll: Y=" + afterBuild.scrollY + " docH=" + afterBuild.docHeight + " viewH=" + afterBuild.viewHeight);
  console.log("Hidden result elements: " + afterBuild.hiddenResults.length);
  afterBuild.hiddenResults.forEach(h => console.log("  " + h));

  // Scroll to bottom to check
  await p1.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(1000);
  var bottomContent = await p1.evaluate(() => {
    var t = document.body.innerText;
    return t.substring(Math.max(0, t.length - 800));
  });
  console.log("\nBottom of page (last 800 chars):");
  console.log(bottomContent.substring(0, 400));

  // Console logs captured
  console.log("\nConsole logs after Build click:");
  consoleLogs.forEach(l => console.log("  " + l));
  console.log("JS errors: " + (jsErrors.length ? jsErrors.join("; ") : "NONE"));

  await p1.close();

  // =====================================================
  // PATH 2: ANALYZER with file upload (not manual entry)
  // =====================================================
  console.log("\n========================================");
  console.log("PATH 2: ANALYZER (file upload)");
  console.log("========================================\n");

  const p2 = await browser.newPage();
  var jsErrors2 = [];
  var consoleLogs2 = [];
  p2.on("pageerror", err => jsErrors2.push("JS_ERROR: " + err.message.substring(0, 200)));
  p2.on("console", msg => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleLogs2.push("[" + msg.type() + "] " + msg.text().substring(0, 200));
    }
  });

  await p2.goto("https://woogoro.com/roofing-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 20000 });

  // Address
  await p2.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
  await p2.type("#journeyStreetAddress", "100 Main St");
  await p2.type("#journeyCity", "Dallas");
  await p2.type("#journeyState", "TX");
  await p2.type("#journeyZipCode", "75201");
  await p2.evaluate(() => window.handleAddressSubmit());
  await sleep(2000);

  // Confirm
  await p2.evaluate(() => { if (window.confirmProperty) window.confirmProperty(); });
  console.log("Address entered, property confirmed");
  await sleep(2000);

  // Check: is there a file upload or the estimator questionnaire?
  var pageState = await p2.evaluate(() => {
    var hasFileInput = !!document.querySelector("input[type=file]");
    var hasUploadBtn = document.body.innerText.includes("Upload") || document.body.innerText.includes("upload");
    var hasEstimator = document.body.innerText.includes("What would your roof");
    var hasQuotePrice = !!document.getElementById("quotePrice");
    return { hasFileInput, hasUploadBtn, hasEstimator, hasQuotePrice, snippet: document.body.innerText.substring(0, 400) };
  });
  console.log("After confirm: fileInput=" + pageState.hasFileInput + " uploadBtn=" + pageState.hasUploadBtn + " estimator=" + pageState.hasEstimator + " manualForm=" + pageState.hasQuotePrice);

  if (pageState.hasFileInput) {
    // Upload a real messy quote
    var qf = "test-quotes/roofing-test-images/02-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg";
    if (fs.existsSync(qf)) {
      var fi = await p2.$("input[type=file]");
      await fi.uploadFile(path.resolve(qf));
      console.log("Uploaded: " + path.basename(qf));

      // Wait for processing
      for (var w = 0; w < 60000; w += 5000) {
        await sleep(5000);
        var status = await p2.evaluate(() => {
          var t = document.body.innerText;
          return {
            processing: t.includes("Analyzing") || t.includes("Processing") || t.includes("Reading") || t.includes("Scanning"),
            hasVerdict: t.includes("Fair Price") || t.includes("Overpriced") || t.includes("Excellent") || t.includes("Higher Than") || t.includes("Unusually"),
            needsSize: t.includes("We need your roof size"),
            hasPrice: !!t.match(/\$[\d,]+/),
            hasTierComp: t.includes("Same roof") || t.includes("different materials"),
            hasScope: t.includes("tear-off") || t.includes("underlayment") || t.includes("Scope"),
            hasNextSteps: t.includes("Next steps") || t.includes("before you sign"),
          };
        });
        console.log("  " + ((w+5000)/1000) + "s: proc=" + status.processing + " verdict=" + status.hasVerdict + " needsSize=" + status.needsSize + " price=" + status.hasPrice);
        if (status.hasVerdict || status.needsSize) {
          console.log("\n  RESULT REACHED!");
          console.log("  Verdict: " + status.hasVerdict);
          console.log("  Tier comparison: " + status.hasTierComp);
          console.log("  Scope: " + status.hasScope);
          console.log("  Next steps: " + status.hasNextSteps);

          if (status.hasVerdict) {
            // Scroll down and check for tier comp
            await p2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await sleep(1000);
            var fullCheck = await p2.evaluate(() => {
              var t = document.body.innerText;
              return {
                hasTierComp: t.includes("Same roof") || t.includes("different materials"),
                prices: (t.match(/\$[\d,]+/g) || []).slice(0, 8),
                hasContractors: t.includes("Find contractors")
              };
            });
            console.log("  After scroll - tier comp: " + fullCheck.hasTierComp);
            console.log("  Prices found: " + JSON.stringify(fullCheck.prices));
            console.log("  Find contractors: " + fullCheck.hasContractors);
          }
          break;
        }
      }
    }
  } else if (pageState.hasEstimator) {
    console.log("NOTE: Analyzer path showed estimator form instead of upload. This is the current UX flow.");
  }

  console.log("Console errors: " + (consoleLogs2.length ? consoleLogs2.join("; ") : "NONE"));
  console.log("JS errors: " + (jsErrors2.length ? jsErrors2.join("; ") : "NONE"));
  await p2.close();

  await browser.close();
  console.log("\n========================================");
  console.log("DEBUG WALKTHROUGH COMPLETE");
  console.log("========================================");
})();
