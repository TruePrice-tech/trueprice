const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function screenshot(page, label) {
  // Capture what the user sees
  const snap = await page.evaluate(() => {
    var t = document.body.innerText;
    // Find visible headings
    var h = [];
    document.querySelectorAll("h1,h2,h3").forEach(el => {
      if (el.offsetParent !== null) h.push(el.textContent.trim().substring(0, 80));
    });
    // Find visible buttons
    var b = [];
    document.querySelectorAll("button").forEach(el => {
      if (el.offsetParent !== null && el.textContent.trim().length > 1)
        b.push(el.textContent.trim().substring(0, 50));
    });
    // Find visible inputs
    var inp = [];
    document.querySelectorAll("input,select,textarea").forEach(el => {
      if (el.offsetParent !== null)
        inp.push((el.id || el.name || el.type) + "=" + (el.value || "").substring(0, 20));
    });
    return { headings: h, buttons: b.slice(0, 10), inputs: inp.slice(0, 10), length: t.length, text: t.substring(0, 500) };
  });
  console.log("  [" + label + "]");
  if (snap.headings.length) console.log("  Headings: " + snap.headings.slice(0, 5).join(" | "));
  if (snap.buttons.length) console.log("  Buttons: " + snap.buttons.join(" | "));
  if (snap.inputs.length) console.log("  Inputs: " + snap.inputs.join(", "));
  return snap;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // =====================================================
  // PATH 1: ESTIMATOR
  // =====================================================
  console.log("========================================");
  console.log("PATH 1: ESTIMATOR");
  console.log("========================================\n");

  const p1 = await browser.newPage();
  var jsErrors1 = [];
  p1.on("pageerror", err => jsErrors1.push(err.message.substring(0, 100)));
  await p1.goto("https://woogoro.com/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "networkidle2", timeout: 20000 });

  console.log("1. ADDRESS PAGE");
  await screenshot(p1, "Initial load");

  await p1.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
  await p1.type("#journeyStreetAddress", "17064 Laurelmont Court");
  await p1.type("#journeyCity", "Fort Mill");
  await p1.type("#journeyState", "SC");
  await p1.type("#journeyZipCode", "29707");
  await p1.evaluate(() => window.handleAddressSubmit());
  await sleep(3000);

  console.log("\n2. AFTER ADDRESS SUBMIT");
  var snap = await screenshot(p1, "Post-address");
  var skippedConfirm = !snap.text.includes("Is this the right property");
  console.log("  Confirm skipped: " + skippedConfirm + (skippedConfirm ? " (GOOD)" : " (BAD - should skip in estimator mode)"));

  // The estimator is a single-page form. Select each category.
  console.log("\n3. FILLING ESTIMATOR FORM");

  // Select "Time for a new one"
  var clicked = await p1.evaluate(() => {
    var els = document.querySelectorAll("[data-value], [data-option], .option-card, div[onclick]");
    for (var el of els) {
      if (el.textContent.includes("Time for a new") && el.offsetParent) { el.click(); return el.textContent.trim().substring(0, 40); }
    }
    // Try broader search
    var all = document.querySelectorAll("div, button, span");
    for (var el of all) {
      var style = window.getComputedStyle(el);
      if (style.cursor === "pointer" && el.textContent.trim().startsWith("Time for a new") && el.offsetParent) {
        el.click(); return "clicked: " + el.textContent.trim().substring(0, 40);
      }
    }
    return null;
  });
  console.log("  Reason: " + (clicked || "NOT FOUND"));
  await sleep(500);

  // Select timeline "This summer"
  clicked = await p1.evaluate(() => {
    var all = document.querySelectorAll("div, button");
    for (var el of all) {
      var style = window.getComputedStyle(el);
      if (style.cursor === "pointer" && el.textContent.trim().startsWith("This summer") && el.offsetParent && el.children.length < 5) {
        el.click(); return el.textContent.trim().substring(0, 40);
      }
    }
    return null;
  });
  console.log("  Timeline: " + (clicked || "NOT FOUND"));
  await sleep(500);

  // Select "Two story"
  clicked = await p1.evaluate(() => {
    var all = document.querySelectorAll("div, button");
    for (var el of all) {
      var style = window.getComputedStyle(el);
      if (style.cursor === "pointer" && el.textContent.trim().startsWith("Two story") && el.offsetParent && el.children.length < 5) {
        el.click(); return el.textContent.trim().substring(0, 40);
      }
    }
    return null;
  });
  console.log("  Home type: " + (clicked || "NOT FOUND"));
  await sleep(500);

  // Select "Dimensional shingles"
  clicked = await p1.evaluate(() => {
    var all = document.querySelectorAll("div, button");
    for (var el of all) {
      var style = window.getComputedStyle(el);
      if (style.cursor === "pointer" && el.textContent.trim().startsWith("Dimensional") && el.offsetParent && el.children.length < 5) {
        el.click(); return el.textContent.trim().substring(0, 40);
      }
    }
    return null;
  });
  console.log("  Material: " + (clicked || "NOT FOUND"));
  await sleep(500);

  // Fill home size
  var sizeInput = await p1.evaluate(() => {
    var inp = document.getElementById("estHomeSize");
    if (inp) { inp.value = "2200"; inp.dispatchEvent(new Event("input", {bubbles:true})); return "2200"; }
    return null;
  });
  console.log("  Home size: " + (sizeInput || "NOT FOUND"));

  await screenshot(p1, "Form filled");

  // Find and click the submit/estimate button
  console.log("\n4. SUBMIT ESTIMATE");
  clicked = await p1.evaluate(() => {
    var btns = document.querySelectorAll("button");
    for (var b of btns) {
      var t = b.textContent.trim().toLowerCase();
      if (b.offsetParent && (t.includes("estimate") || t.includes("get my") || t.includes("calculate") || t.includes("see my") || t.includes("check"))) {
        if (t.includes("guide") || t.includes("about") || t.includes("contact")) continue;
        b.click();
        return b.textContent.trim().substring(0, 60);
      }
    }
    // List all visible buttons for debugging
    var visible = [];
    btns.forEach(b => { if (b.offsetParent) visible.push(b.textContent.trim().substring(0, 40)); });
    return "NO SUBMIT FOUND. Visible buttons: " + visible.join(" | ");
  });
  console.log("  Clicked: " + clicked);
  await sleep(5000);

  console.log("\n5. RESULT PAGE");
  snap = await screenshot(p1, "Result");
  var hasVerdict = snap.text.includes("Fair Price") || snap.text.includes("Overpriced") || snap.text.includes("Excellent") || snap.text.includes("Higher Than") || snap.text.includes("Unusually") || snap.text.includes("Estimated");
  var hasTierComp = snap.text.includes("Same roof") || snap.text.includes("different materials");
  var hasNextSteps = snap.text.includes("Next steps") || snap.text.includes("before you sign");
  var priceMatch = snap.text.match(/\$[\d,]+/);

  console.log("  Verdict shown: " + hasVerdict);
  console.log("  Price shown: " + (priceMatch ? priceMatch[0] : "none"));
  console.log("  Tier comparison card: " + hasTierComp);
  console.log("  Next steps: " + hasNextSteps);
  console.log("  JS errors: " + (jsErrors1.length ? jsErrors1.join("; ") : "NONE"));

  // UX ISSUES
  console.log("\n  === UX OBSERVATIONS ===");
  if (!skippedConfirm) console.log("  ISSUE: Confirm step should be skipped in estimator mode");
  if (!hasVerdict) console.log("  ISSUE: No verdict reached -- user may be stuck");
  if (!hasTierComp) console.log("  NOTE: Tier comparison not visible (may need scroll or may not render for estimator path)");

  await p1.close();

  // =====================================================
  // PATH 2: ANALYZER (manual entry, not upload)
  // =====================================================
  console.log("\n========================================");
  console.log("PATH 2: ANALYZER (manual entry path)");
  console.log("========================================\n");

  const p2 = await browser.newPage();
  var jsErrors2 = [];
  p2.on("pageerror", err => jsErrors2.push(err.message.substring(0, 100)));
  await p2.goto("https://woogoro.com/roofing-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 20000 });

  console.log("1. ADDRESS");
  await p2.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
  await p2.type("#journeyStreetAddress", "100 Main St");
  await p2.type("#journeyCity", "Dallas");
  await p2.type("#journeyState", "TX");
  await p2.type("#journeyZipCode", "75201");
  await p2.evaluate(() => window.handleAddressSubmit());
  await sleep(2000);

  console.log("\n2. CONFIRM PROPERTY");
  snap = await screenshot(p2, "Confirm step");
  var showsConfirm = snap.text.includes("Looks correct");
  console.log("  Shows confirm: " + showsConfirm + (showsConfirm ? " (GOOD for analyzer)" : ""));
  if (showsConfirm) {
    await p2.evaluate(() => window.confirmProperty());
    await sleep(2000);
  }

  console.log("\n3. UPLOAD/MANUAL ENTRY PAGE");
  snap = await screenshot(p2, "After confirm");
  console.log("  Shows upload prompt: " + snap.text.includes("upload"));

  // Instead of uploading, fill the manual entry form
  console.log("\n4. FILL MANUAL ENTRY FORM");
  var formFields = await p2.evaluate(() => {
    var results = {};
    var qp = document.getElementById("quotePrice");
    if (qp) { qp.value = "11500"; qp.dispatchEvent(new Event("input", {bubbles:true})); results.quotePrice = "11500"; }

    var rs = document.getElementById("roofSize");
    if (rs) { rs.value = "2200"; rs.dispatchEvent(new Event("input", {bubbles:true})); results.roofSize = "2200"; }

    var mt = document.getElementById("materialType");
    if (mt) { mt.value = "architectural"; mt.dispatchEvent(new Event("change", {bubbles:true})); results.materialType = mt.options[mt.selectedIndex].text; }

    var rp = document.getElementById("roofPitch");
    if (rp) { rp.value = "1.20"; rp.dispatchEvent(new Event("change", {bubbles:true})); results.roofPitch = rp.options[rp.selectedIndex].text; }

    var cf = document.getElementById("complexityFactor");
    if (cf) { cf.value = "1.08"; cf.dispatchEvent(new Event("change", {bubbles:true})); results.complexityFactor = cf.options[cf.selectedIndex].text; }

    var tf = document.getElementById("tearOffIncluded");
    if (tf) { tf.value = "1.00"; tf.dispatchEvent(new Event("change", {bubbles:true})); results.tearOff = tf.options[tf.selectedIndex].text; }

    var wy = document.getElementById("warrantyYears");
    if (wy) { wy.value = "25"; wy.dispatchEvent(new Event("input", {bubbles:true})); results.warranty = "25"; }

    var cn = document.getElementById("cityName");
    if (cn) { cn.value = "Dallas"; cn.dispatchEvent(new Event("input", {bubbles:true})); results.city = "Dallas"; }

    var sc = document.getElementById("stateCode");
    if (sc) { sc.value = "TX"; sc.dispatchEvent(new Event("input", {bubbles:true})); results.state = "TX"; }

    return results;
  });
  console.log("  Fields filled: " + JSON.stringify(formFields));

  // Click analyze button
  console.log("\n5. CLICK ANALYZE");
  clicked = await p2.evaluate(() => {
    var btns = document.querySelectorAll("button");
    for (var b of btns) {
      var t = b.textContent.trim().toLowerCase();
      if (b.offsetParent && (t.includes("analyze") || t.includes("check this"))) {
        b.click();
        return b.textContent.trim().substring(0, 50);
      }
    }
    var visible = [];
    btns.forEach(b => { if (b.offsetParent) visible.push(b.textContent.trim().substring(0, 30)); });
    return "NOT FOUND. Visible: " + visible.join(" | ");
  });
  console.log("  Clicked: " + clicked);
  await sleep(6000);

  console.log("\n6. RESULT PAGE");
  snap = await screenshot(p2, "Result");

  // Scroll down to find tier comparison
  await p2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(1000);
  var fullText = await p2.evaluate(() => document.body.innerText);

  hasVerdict = fullText.includes("Fair Price") || fullText.includes("Overpriced") || fullText.includes("Excellent") || fullText.includes("Higher Than") || fullText.includes("Unusually");
  hasTierComp = fullText.includes("Same roof") || fullText.includes("different materials");
  hasNextSteps = fullText.includes("Next steps") || fullText.includes("before you sign");
  var hasScope = fullText.includes("Scope") || fullText.includes("tear") || fullText.includes("underlayment");
  priceMatch = fullText.match(/\$[\d,]+/);
  var hasFindContractors = fullText.includes("Find contractors");

  console.log("  Verdict: " + hasVerdict);
  console.log("  Price: " + (priceMatch ? priceMatch[0] : "none"));
  console.log("  Tier comparison: " + hasTierComp);
  console.log("  Scope section: " + hasScope);
  console.log("  Next steps: " + hasNextSteps);
  console.log("  Find contractors: " + hasFindContractors);
  console.log("  JS errors: " + (jsErrors2.length ? jsErrors2.join("; ") : "NONE"));

  console.log("\n  === UX OBSERVATIONS ===");
  if (Object.keys(formFields).length === 0) console.log("  ISSUE: Manual entry form not found after confirm");
  if (!formFields.roofPitch) console.log("  ISSUE: Pitch dropdown not present in form");
  if (!hasVerdict) console.log("  ISSUE: No verdict shown after manual entry");
  if (!hasTierComp) console.log("  NOTE: Tier comparison not found in result");
  if (hasVerdict) console.log("  OK: Manual entry -> verdict flow works");

  await p2.close();

  // =====================================================
  // PATH 3: COMPARE
  // =====================================================
  console.log("\n========================================");
  console.log("PATH 3: COMPARE");
  console.log("========================================\n");

  const p3 = await browser.newPage();
  var jsErrors3 = [];
  p3.on("pageerror", err => jsErrors3.push(err.message.substring(0, 100)));
  await p3.goto("https://woogoro.com/compare-roofing-quotes.html", { waitUntil: "networkidle2", timeout: 15000 });

  console.log("1. COMPARE PAGE LOAD");
  snap = await screenshot(p3, "Compare page");

  var fileInputCount = await p3.evaluate(() => document.querySelectorAll("input[type=file]").length);
  console.log("  File upload slots: " + fileInputCount);

  // Upload 2 quotes
  var quotes = [
    "test-quotes/roofing-test-images/02-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg",
    "test-quotes/roofing-test-images/05-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg"
  ];
  var inputs = await p3.$$("input[type=file]");

  for (var i = 0; i < Math.min(quotes.length, inputs.length); i++) {
    if (fs.existsSync(quotes[i])) {
      console.log("\n" + (i+2) + ". UPLOAD QUOTE " + (i+1));
      await inputs[i].uploadFile(path.resolve(quotes[i]));
      console.log("  Uploaded: " + path.basename(quotes[i]));
      await sleep(3000);
      var afterUpload = await p3.evaluate(() => {
        var t = document.body.innerText;
        return {
          processing: t.includes("Analyzing") || t.includes("Processing") || t.includes("Reading"),
          hasPrice: !!t.match(/\$[\d,]+/),
          snippet: t.substring(0, 200)
        };
      });
      console.log("  Processing: " + afterUpload.processing + " | Price visible: " + afterUpload.hasPrice);
    }
  }

  // Wait for processing
  console.log("\n4. WAIT FOR COMPARISON...");
  for (var w = 0; w < 30000; w += 5000) {
    await sleep(5000);
    var status = await p3.evaluate(() => {
      var t = document.body.innerText;
      return {
        hasComparison: t.includes("Winner") || t.includes("winner") || t.includes("Best") || t.includes("recommended"),
        hasTable: t.includes("Price") && t.includes("Material"),
        processing: t.includes("Analyzing") || t.includes("Processing"),
        snippet: t.substring(0, 200)
      };
    });
    console.log("  " + ((w+5000)/1000) + "s: comparison=" + status.hasComparison + " table=" + status.hasTable + " processing=" + status.processing);
    if (status.hasComparison || status.hasTable) break;
  }

  console.log("  JS errors: " + (jsErrors3.length ? jsErrors3.join("; ") : "NONE"));

  console.log("\n  === UX OBSERVATIONS ===");
  if (fileInputCount < 2) console.log("  ISSUE: Need at least 2 upload slots for comparison");
  if (fileInputCount >= 2) console.log("  OK: " + fileInputCount + " upload slots present");

  await p3.close();
  await browser.close();

  console.log("\n========================================");
  console.log("COMPLETE: ALL 3 PATHS WALKED AS HUMAN");
  console.log("========================================");
})();
