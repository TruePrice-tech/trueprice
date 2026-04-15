const puppeteer = require("puppeteer");
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Walk through estimate flow for each vertical, get to results, check for garbage
const VERTICALS = [
  { name: "hvac", url: "/hvac-estimate.html", steps: [
    { type: "click", text: "Central AC" },
    { type: "click", text: "Standard" },
    { type: "sqft", value: "2000" },
    { type: "click", text: "Good" },
    { type: "click", text: "This season" }
  ]},
  { name: "plumbing", url: "/plumbing-estimate.html", steps: [
    { type: "click", text: "Water Heater" }
  ]},
  { name: "electrical", url: "/electrical-estimate.html", steps: [
    { type: "click", text: "Panel Upgrade" }
  ]},
  { name: "fencing", url: "/fencing-estimate.html", steps: [
    { type: "click", text: "Cedar" },
    { type: "click", text: "200" },
    { type: "click", text: "6 ft" },
    { type: "click", text: "Yes" },
    { type: "click", text: "Flat" },
    { type: "click", text: "No old" }
  ]},
  { name: "painting", url: "/painting-estimate.html", steps: [
    { type: "click", text: "Exterior" }
  ]},
  { name: "landscaping", url: "/landscaping-estimate.html", steps: [
    { type: "click", text: "Paver Patio" }
  ]},
  { name: "solar", url: "/solar-estimate.html", steps: [
    { type: "click", text: "Medium" }
  ]},
  { name: "windows", url: "/window-estimate.html", steps: [
    { type: "click", text: "4 - 8" }
  ]},
  { name: "kitchen", url: "/kitchen-estimate.html", steps: [
    { type: "click", text: "Mid-Range" }
  ]},
  { name: "concrete", url: "/concrete-estimate.html", steps: [
    { type: "click", text: "Standard Driveway" }
  ]},
  { name: "siding", url: "/siding-estimate.html", steps: [
    { type: "click", text: "Vinyl" }
  ]},
  { name: "insulation", url: "/insulation-estimate.html", steps: [
    { type: "click", text: "Blown-In" }
  ]},
  { name: "gutters", url: "/gutters-estimate.html", steps: [
    { type: "click", text: "Aluminum 5" }
  ]},
  { name: "foundation", url: "/foundation-estimate.html", steps: [
    { type: "click", text: "Pier" }
  ]},
  { name: "garage-door", url: "/garage-door-estimate.html", steps: [
    { type: "click", text: "Single Car" }
  ]},
  { name: "moving", url: "/moving-estimate.html", steps: [
    { type: "click", text: "Local" }
  ]},
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const BASE = "https://truepricehq.com";
  var issues = [];

  for (const v of VERTICALS) {
    const page = await browser.newPage();
    var errors = [];
    page.on("pageerror", e => errors.push(e.message.substring(0, 80)));

    try {
      await page.goto(BASE + v.url, { waitUntil: "networkidle2", timeout: 15000 });
    } catch(e) {
      issues.push(v.name + ": TIMEOUT loading page");
      await page.close();
      continue;
    }

    // Enter address
    var hasAddr = await page.evaluate(() => !!document.getElementById("addrStreet"));
    if (hasAddr) {
      await page.type("#addrStreet", "100 Main St");
      await page.type("#addrCity", "Charlotte");
      await page.type("#addrState", "NC");
      await page.type("#addrZip", "28202");
      await page.evaluate(() => { var b = document.getElementById("btnEstimate"); if (b) b.click(); });
      await sleep(2000);
    }

    // Click through first step to get past the form
    for (const step of v.steps) {
      if (step.type === "click") {
        await page.evaluate((text) => {
          var els = document.querySelectorAll("[class*=-option], .hvac-option, button");
          for (var el of els) {
            if (el.textContent.trim().startsWith(text) && el.offsetParent) { el.click(); return; }
          }
        }, step.text);
        await sleep(400);
      } else if (step.type === "sqft") {
        await page.evaluate((val) => {
          var inp = document.getElementById("sqftInput") || document.getElementById("sizeInput") || document.getElementById("estHomeSize");
          if (inp) { inp.value = val; inp.dispatchEvent(new Event("input", {bubbles:true})); }
          var btn = document.getElementById("sqftNext") || document.getElementById("sizeNext");
          if (btn) btn.click();
        }, step.value);
        await sleep(400);
      }
    }

    // Wait for result to render
    await sleep(3000);

    // Scroll to bottom and capture full page text
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(500);
    var fullText = await page.evaluate(() => document.body.innerText);

    // CHECK FOR GARBAGE
    var checks = [];

    // 1. Find-contractors links in result area
    var hasContractorLink = await page.evaluate(() => {
      var links = document.querySelectorAll("a[href*='find-contractors']");
      for (var l of links) {
        // Skip footer links
        if (l.closest("footer") || l.closest(".site-footer") || l.closest(".tp-footer-links")) continue;
        if (l.offsetParent) return l.textContent.trim().substring(0, 50);
      }
      return null;
    });
    if (hasContractorLink) {
      checks.push("STILL HAS find-contractors CTA: " + hasContractorLink);
    }

    // 2. Broken images
    var brokenImages = await page.evaluate(() => {
      var broken = [];
      document.querySelectorAll("img").forEach(img => {
        if (img.naturalWidth === 0 && img.offsetParent) broken.push(img.src);
      });
      return broken;
    });
    if (brokenImages.length > 0) {
      checks.push("BROKEN IMAGES: " + brokenImages.join(", "));
    }

    // 3. "undefined" or "null" or "NaN" visible in text
    if (fullText.includes("undefined") && !fullText.includes("undefined;")) {
      checks.push("VISIBLE 'undefined' IN TEXT");
    }
    if (fullText.match(/\bnull\b/) && !fullText.includes("= null") && !fullText.includes("|| null")) {
      checks.push("VISIBLE 'null' IN TEXT");
    }
    if (fullText.includes("NaN")) {
      checks.push("VISIBLE 'NaN' IN TEXT");
    }
    if (fullText.includes("$0") && !fullText.includes("$0.")) {
      checks.push("ZERO DOLLAR AMOUNT ($0)");
    }

    // 4. Error messages visible
    if (fullText.includes("error") && fullText.length < 500) {
      checks.push("ERROR MESSAGE VISIBLE");
    }

    // 5. Empty result sections
    if (fullText.includes("Loading") || fullText.includes("loading")) {
      checks.push("STILL SHOWING LOADING STATE");
    }

    // 6. JS errors
    if (errors.length > 0) {
      checks.push("JS ERRORS: " + errors[0]);
    }

    // 7. Check for placeholder text that shouldn't be visible
    if (fullText.includes("[object Object]")) {
      checks.push("VISIBLE [object Object]");
    }

    // Report
    if (checks.length > 0) {
      console.log("ISSUES " + v.name + ":");
      checks.forEach(c => { console.log("  " + c); issues.push(v.name + ": " + c); });
    } else {
      console.log("CLEAN  " + v.name);
    }

    await page.close();
  }

  await browser.close();

  console.log("\n========================================");
  if (issues.length === 0) {
    console.log("ALL " + VERTICALS.length + " VERTICALS CLEAN");
  } else {
    console.log(issues.length + " ISSUES FOUND:");
    issues.forEach(i => console.log("  " + i));
  }
  console.log("========================================");
})();
