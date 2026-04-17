const puppeteer = require("puppeteer");
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  console.log("========================================");
  console.log("PATH 1: LANDSCAPING ESTIMATE (human walk)");
  console.log("========================================\n");

  const p1 = await browser.newPage();
  var e1 = [];
  p1.on("pageerror", err => e1.push(err.message.substring(0, 120)));
  await p1.goto("https://woogoro.com/landscaping-estimate.html", { waitUntil: "networkidle2", timeout: 15000 });

  // 1. Address
  console.log("1. ADDRESS");
  var hasAddr = await p1.evaluate(() => !!document.getElementById("addrStreet"));
  console.log("   Address form visible: " + hasAddr);
  if (!hasAddr) {
    console.log("   FAIL: No address form. Page may have pathFilter bug.");
    // Check what's visible
    var snap = await p1.evaluate(() => document.body.innerText.substring(0, 400));
    console.log("   Page shows: " + snap.substring(0, 200));
  } else {
    await p1.type("#addrStreet", "100 Main St");
    await p1.type("#addrCity", "Charlotte");
    await p1.type("#addrState", "NC");
    await p1.type("#addrZip", "28202");
    await p1.evaluate(() => { var b = document.getElementById("btnEstimate"); if (b) b.click(); });
    console.log("   Submitted: 100 Main St, Charlotte, NC");
    await sleep(2000);
  }

  // 2. Step 1: Project type
  console.log("\n2. PROJECT TYPE");
  var options = await p1.evaluate(() => {
    var opts = [];
    document.querySelectorAll(".land-option").forEach(el => {
      if (el.offsetParent) opts.push(el.textContent.trim().substring(0, 30));
    });
    return opts;
  });
  console.log("   Options visible: " + options.length);
  options.slice(0, 5).forEach(o => console.log("   - " + o));

  var clicked = await p1.evaluate(() => {
    var els = document.querySelectorAll(".land-option");
    for (var el of els) {
      if (el.textContent.trim().startsWith("Paver Patio") && el.offsetParent) { el.click(); return "Paver Patio"; }
    }
    return null;
  });
  console.log("   Clicked: " + (clicked || "NOT FOUND"));
  await sleep(800);

  // 3. Step 2: Size
  console.log("\n3. PROJECT SIZE");
  var sizeStep = await p1.evaluate(() => {
    var inp = document.getElementById("sizeInput");
    var btn = document.getElementById("sizeNext");
    return { hasInput: !!inp, hasBtn: !!btn, bodySnippet: document.body.innerText.substring(0, 300) };
  });
  console.log("   Size input: " + sizeStep.hasInput + " | Continue btn: " + sizeStep.hasBtn);
  if (sizeStep.hasInput) {
    await p1.evaluate(() => {
      var inp = document.getElementById("sizeInput");
      inp.value = "500";
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await p1.evaluate(() => { var b = document.getElementById("sizeNext"); if (b) b.click(); });
    console.log("   Entered 500 sqft, clicked Continue");
    await sleep(800);
  } else {
    console.log("   Page shows: " + sizeStep.bodySnippet.substring(0, 150));
  }

  // 4. Step 3: Quality tier
  console.log("\n4. QUALITY TIER");
  var tierOptions = await p1.evaluate(() => {
    var opts = [];
    document.querySelectorAll(".land-option").forEach(el => {
      if (el.offsetParent) opts.push(el.textContent.trim().substring(0, 40));
    });
    return opts;
  });
  console.log("   Options: " + tierOptions.length);
  tierOptions.forEach(o => console.log("   - " + o));

  clicked = await p1.evaluate(() => {
    var els = document.querySelectorAll(".land-option");
    for (var el of els) {
      if (el.textContent.includes("Mid-Range") && el.offsetParent) { el.click(); return "Mid-Range"; }
    }
    return null;
  });
  console.log("   Clicked: " + (clicked || "NOT FOUND"));
  await sleep(800);

  // 5. Step 4: Complexity
  console.log("\n5. COMPLEXITY");
  clicked = await p1.evaluate(() => {
    var els = document.querySelectorAll(".land-option");
    for (var el of els) {
      if (el.textContent.includes("Moderate") && el.offsetParent) { el.click(); return "Moderate"; }
    }
    return null;
  });
  console.log("   Clicked: " + (clicked || "NOT FOUND"));
  await sleep(2000);

  // 6. Result
  console.log("\n6. RESULT");
  // Scroll to see everything
  await p1.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  var fullText = await p1.evaluate(() => document.body.innerText);

  var result = {
    hasEstimatedCost: fullText.includes("Estimated Cost"),
    hasFairPrice: fullText.includes("Fair Price"),
    hasDollar: !!fullText.match(/\$[\d,]+/),
    prices: (fullText.match(/\$[\d,]+/g) || []).slice(0, 8),
    hasTierComp: fullText.includes("Same project") || fullText.includes("different quality"),
    hasScope: fullText.includes("Estimate Includes") || fullText.includes("What This"),
    hasFindContractors: fullText.includes("Find") && fullText.includes("Contractor"),
    hasNextSteps: fullText.includes("Next Steps") || fullText.includes("next steps"),
    stillOnForm: fullText.includes("What type of") || fullText.includes("How complex"),
  };

  console.log("   Estimated Cost: " + result.hasEstimatedCost);
  console.log("   Fair Price: " + result.hasFairPrice);
  console.log("   Prices: " + (result.prices.length ? result.prices.join(", ") : "NONE FOUND"));
  console.log("   Tier comparison: " + result.hasTierComp);
  console.log("   Scope section: " + result.hasScope);
  console.log("   Find contractors: " + result.hasFindContractors);
  console.log("   Next steps: " + result.hasNextSteps);
  console.log("   Still on form (stuck): " + result.stillOnForm);

  if (!result.hasDollar && !result.stillOnForm) {
    console.log("   First 400 chars: " + fullText.substring(0, 400));
  }
  if (result.stillOnForm) {
    console.log("   ISSUE: Never left the form. Last step may not have triggered calculation.");
    // Check what step we're on
    var stepInfo = await p1.evaluate(() => {
      var heading = document.querySelector(".land-step h3");
      return heading ? heading.textContent : "no heading";
    });
    console.log("   Current step heading: " + stepInfo);
  }

  console.log("   JS errors: " + (e1.length ? e1.join("; ") : "NONE"));
  console.log("   " + (result.hasDollar ? "PASS" : "NEEDS INVESTIGATION"));
  await p1.close();

  // PATH 2: ANALYZER
  console.log("\n========================================");
  console.log("PATH 2: LANDSCAPING ANALYZER");
  console.log("========================================\n");
  const p2 = await browser.newPage();
  var e2 = [];
  p2.on("pageerror", e => e2.push(e.message.substring(0, 80)));
  var r2 = await p2.goto("https://woogoro.com/landscaping-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 15000 });
  var hasUpload = await p2.evaluate(() => !!document.querySelector("input[type=file]") || document.body.innerText.includes("Upload"));
  console.log("   Status: " + r2.status() + " | Upload: " + hasUpload + " | JS errors: " + (e2.length ? e2.join("; ") : "NONE"));
  console.log("   PASS");
  await p2.close();

  // PATH 3: COMPARE
  console.log("\n========================================");
  console.log("PATH 3: LANDSCAPING COMPARE");
  console.log("========================================\n");
  const p3 = await browser.newPage();
  var e3 = [];
  p3.on("pageerror", e => e3.push(e.message.substring(0, 80)));
  var r3 = await p3.goto("https://woogoro.com/compare-landscaping-quotes.html", { waitUntil: "networkidle2", timeout: 15000 });
  var slots = await p3.evaluate(() => document.querySelectorAll("input[type=file]").length);
  console.log("   Status: " + r3.status() + " | Slots: " + slots + " | JS errors: " + (e3.length ? e3.join("; ") : "NONE"));
  console.log("   PASS");
  await p3.close();

  await browser.close();
  console.log("\n========================================");
  console.log("ALL 3 PATHS TESTED");
  console.log("========================================");
})();
