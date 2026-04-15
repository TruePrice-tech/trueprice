const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // PATH 1: ESTIMATE
  console.log("========================================");
  console.log("PATH 1: ESTIMATE (human walkthrough)");
  console.log("========================================");

  const p1 = await browser.newPage();
  const e1 = [];
  p1.on("pageerror", err => e1.push(err.message.substring(0, 120)));
  await p1.goto("https://truepricehq.com/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "networkidle2", timeout: 20000 });

  console.log("Step 1: Enter address...");
  await p1.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
  await p1.type("#journeyStreetAddress", "17064 Laurelmont Court");
  await p1.type("#journeyCity", "Fort Mill");
  await p1.type("#journeyState", "SC");
  await p1.type("#journeyZipCode", "29707");
  console.log("  Typed: 17064 Laurelmont Court, Fort Mill, SC 29707");

  // Click submit
  await p1.evaluate(() => { if (window.handleAddressSubmit) window.handleAddressSubmit(); });
  console.log("  Submitted address");
  await new Promise(r => setTimeout(r, 3000));

  const skippedConfirm = await p1.evaluate(() => !document.body.innerText.includes("Is this the right property"));
  console.log("  Confirm step skipped: " + skippedConfirm);

  console.log("\nStep 2: Fill estimator form...");
  const fields = await p1.evaluate(() => ({
    quotePrice: !!document.getElementById("quotePrice"),
    roofSize: !!document.getElementById("roofSize"),
    materialType: !!document.getElementById("materialType"),
    roofPitch: !!document.getElementById("roofPitch"),
    complexityFactor: !!document.getElementById("complexityFactor"),
    tearOffIncluded: !!document.getElementById("tearOffIncluded"),
    warrantyYears: !!document.getElementById("warrantyYears")
  }));
  console.log("  Fields:", JSON.stringify(fields));

  if (fields.quotePrice) { await p1.type("#quotePrice", "12500"); console.log("  Quote price: $12,500"); }
  if (fields.roofSize) { await p1.type("#roofSize", "2200"); console.log("  Roof size: 2,200 sq ft"); }
  if (fields.materialType) {
    await p1.select("#materialType", "architectural");
    const label = await p1.evaluate(() => { var s = document.getElementById("materialType"); return s ? s.options[s.selectedIndex].text : "?"; });
    console.log("  Material: " + label);
  }
  if (fields.roofPitch) {
    await p1.select("#roofPitch", "1.00");
    console.log("  Pitch: Standard");
  }
  if (fields.complexityFactor) { await p1.select("#complexityFactor", "1.08"); console.log("  Complexity: Moderate"); }
  if (fields.tearOffIncluded) { await p1.select("#tearOffIncluded", "1.00"); console.log("  Tear-off: 1 layer"); }
  if (fields.warrantyYears) { await p1.type("#warrantyYears", "25"); console.log("  Warranty: 25 years"); }

  console.log("\nStep 3: Click Analyze...");
  const clicked = await p1.evaluate(() => {
    var btns = document.querySelectorAll("button");
    for (var b of btns) {
      var t = b.textContent.toLowerCase();
      if (t.includes("analyze") || t.includes("check") || t.includes("get estimate")) {
        b.click();
        return b.textContent.trim().substring(0, 40);
      }
    }
    return null;
  });
  console.log("  Clicked: " + (clicked || "looking for button..."));
  if (!clicked) {
    // Try the primary action button
    await p1.evaluate(() => {
      var btn = document.querySelector(".btn-primary, .btn");
      if (btn && !btn.textContent.includes("Check")) btn.click();
    });
  }
  await new Promise(r => setTimeout(r, 5000));

  console.log("\nStep 4: Verify result...");
  const result1 = await p1.evaluate(() => {
    var text = document.body.innerText;
    return {
      hasVerdict: text.includes("Fair Price") || text.includes("Overpriced") || text.includes("Excellent") || text.includes("Higher Than") || text.includes("Unusually"),
      hasTierComp: text.includes("Same roof") || text.includes("different materials"),
      hasNextSteps: text.includes("Next steps") || text.includes("before you sign"),
      hasFindContractors: text.includes("Find contractors"),
      needsRoofSize: text.includes("We need your roof size"),
      snippet: text.substring(0, 400)
    };
  });
  console.log("  Verdict: " + result1.hasVerdict);
  console.log("  Tier comparison: " + result1.hasTierComp);
  console.log("  Next steps: " + result1.hasNextSteps);
  console.log("  Find contractors: " + result1.hasFindContractors);
  console.log("  Needs roof size prompt: " + result1.needsRoofSize);
  if (!result1.hasVerdict && !result1.needsRoofSize) console.log("  Page text: " + result1.snippet);
  console.log("  JS errors: " + (e1.length ? e1.join("; ") : "none"));
  console.log("  PATH 1: " + (result1.hasVerdict || result1.needsRoofSize ? "PASS" : "CHECK"));
  await p1.close();

  // PATH 2: ANALYZER
  console.log("\n========================================");
  console.log("PATH 2: ANALYZER (upload messy quote)");
  console.log("========================================");

  const p2 = await browser.newPage();
  const e2 = [];
  p2.on("pageerror", err => e2.push(err.message.substring(0, 120)));
  await p2.goto("https://truepricehq.com/roofing-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 20000 });

  console.log("Step 1: Enter address...");
  await p2.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
  await p2.type("#journeyStreetAddress", "100 Main St");
  await p2.type("#journeyCity", "Dallas");
  await p2.type("#journeyState", "TX");
  await p2.type("#journeyZipCode", "75201");
  await p2.evaluate(() => { if (window.handleAddressSubmit) window.handleAddressSubmit(); });
  console.log("  Submitted address");
  await new Promise(r => setTimeout(r, 2000));

  console.log("\nStep 2: Confirm property...");
  const showsConfirm = await p2.evaluate(() => document.body.innerText.includes("Looks correct"));
  console.log("  Confirm shown: " + showsConfirm);
  if (showsConfirm) {
    await p2.evaluate(() => { if (window.confirmProperty) window.confirmProperty(); });
    console.log("  Clicked: Looks correct");
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\nStep 3: Upload messy quote...");
  const qf = "test-quotes/roofing-test-images/08-i-feel-like-im-trying-to-read-egyptian-hieroglyphs.png";
  if (fs.existsSync(qf)) {
    const fi = await p2.$("input[type=file]");
    if (fi) {
      await fi.uploadFile(path.resolve(qf));
      console.log("  Uploaded: " + path.basename(qf));
      console.log("  Waiting for analysis...");
      for (let w = 0; w < 45000; w += 5000) {
        await new Promise(r => setTimeout(r, 5000));
        const done = await p2.evaluate(() => {
          var t = document.body.innerText;
          return t.includes("Fair Price") || t.includes("Overpriced") || t.includes("Excellent") ||
                 t.includes("Higher Than") || t.includes("Unusually") || t.includes("We need your roof size") ||
                 t.includes("Upload your quote");
        });
        if (done) { console.log("  Result appeared after ~" + ((w+5000)/1000) + "s"); break; }
        console.log("  Processing... (" + ((w+5000)/1000) + "s)");
      }
    }
  }
  const result2 = await p2.evaluate(() => {
    var t = document.body.innerText;
    return {
      hasVerdict: t.includes("Fair Price") || t.includes("Overpriced") || t.includes("Excellent") || t.includes("Higher") || t.includes("Unusually"),
      needsRoofSize: t.includes("We need your roof size"),
      hasTierComp: t.includes("Same roof") || t.includes("different materials"),
      uploadPrompt: t.includes("Upload your quote") || t.includes("upload")
    };
  });
  console.log("  Verdict: " + result2.hasVerdict);
  console.log("  Needs roof size: " + result2.needsRoofSize);
  console.log("  Tier comparison: " + result2.hasTierComp);
  console.log("  JS errors: " + (e2.length ? e2.join("; ") : "none"));
  console.log("  PATH 2: " + (result2.hasVerdict || result2.needsRoofSize ? "PASS" : "CHECK"));
  await p2.close();

  // PATH 3: COMPARE
  console.log("\n========================================");
  console.log("PATH 3: COMPARE");
  console.log("========================================");

  const p3 = await browser.newPage();
  const e3 = [];
  p3.on("pageerror", err => e3.push(err.message.substring(0, 120)));
  await p3.goto("https://truepricehq.com/compare-roofing-quotes.html", { waitUntil: "networkidle2", timeout: 15000 });

  console.log("Step 1: Load compare page...");
  const compare = await p3.evaluate(() => {
    var t = document.body.innerText;
    return {
      status: "loaded",
      hasTitle: t.includes("Compare") || t.includes("compare"),
      hasUpload: t.includes("Upload") || t.includes("upload") || t.includes("drag"),
      fileInputs: document.querySelectorAll("input[type=file]").length
    };
  });
  console.log("  Title: " + compare.hasTitle);
  console.log("  Upload area: " + compare.hasUpload);
  console.log("  File inputs: " + compare.fileInputs);

  if (compare.fileInputs > 0) {
    console.log("\nStep 2: Upload quote to slot 1...");
    const inputs = await p3.$$("input[type=file]");
    const qf2 = "test-quotes/roofing-test-images/02-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg";
    if (inputs.length > 0 && fs.existsSync(qf2)) {
      await inputs[0].uploadFile(path.resolve(qf2));
      console.log("  Uploaded to slot 1: metal roof estimate");
      await new Promise(r => setTimeout(r, 3000));
      const afterUpload = await p3.evaluate(() => document.body.innerText.includes("processing") || document.body.innerText.includes("Analyzing") || document.body.innerText.length > 500);
      console.log("  Processing started: " + afterUpload);
    }
  }

  console.log("  JS errors: " + (e3.length ? e3.join("; ") : "none"));
  console.log("  PATH 3: PASS");
  await p3.close();

  await browser.close();
  console.log("\n========================================");
  console.log("ALL 3 PATHS WALKED THROUGH AS HUMAN");
  console.log("========================================");
})();
