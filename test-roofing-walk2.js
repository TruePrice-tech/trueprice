const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // =====================================================
  // PATH 1: ESTIMATE - click through every question
  // =====================================================
  console.log("========================================");
  console.log("PATH 1: ESTIMATOR QUESTIONNAIRE");
  console.log("========================================");

  const p1 = await browser.newPage();
  const e1 = [];
  p1.on("pageerror", err => e1.push(err.message.substring(0, 150)));
  await p1.goto("https://truepricehq.com/roofing-quote-analyzer.html?mode=estimator", { waitUntil: "networkidle2", timeout: 20000 });

  // Enter address
  console.log("1. Enter address...");
  await p1.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
  await p1.type("#journeyStreetAddress", "17064 Laurelmont Court");
  await p1.type("#journeyCity", "Fort Mill");
  await p1.type("#journeyState", "SC");
  await p1.type("#journeyZipCode", "29707");
  await p1.evaluate(() => { if (window.handleAddressSubmit) window.handleAddressSubmit(); });
  await new Promise(r => setTimeout(r, 3000));

  // Screenshot the current state
  async function describeState(label) {
    const state = await p1.evaluate(() => {
      // Get all visible buttons/options
      var buttons = [];
      document.querySelectorAll("button, [role=button], .option-card, [onclick]").forEach(el => {
        var t = (el.textContent || "").trim().substring(0, 60);
        var vis = el.offsetParent !== null;
        if (t && vis) buttons.push(t);
      });
      // Get headings
      var headings = [];
      document.querySelectorAll("h1, h2, h3").forEach(el => {
        var t = (el.textContent || "").trim().substring(0, 80);
        var vis = el.offsetParent !== null;
        if (t && vis) headings.push(t);
      });
      // Get inputs
      var inputs = [];
      document.querySelectorAll("input, select, textarea").forEach(el => {
        var vis = el.offsetParent !== null;
        if (vis) inputs.push({ tag: el.tagName, id: el.id || "", type: el.type || "", placeholder: el.placeholder || "" });
      });
      return { buttons: buttons.slice(0, 15), headings, inputs: inputs.slice(0, 10), bodySnippet: document.body.innerText.substring(0, 600) };
    });
    console.log("\n  [" + label + "]");
    console.log("  Headings: " + (state.headings.join(" | ") || "none"));
    console.log("  Buttons/options: " + (state.buttons.join(" | ") || "none"));
    if (state.inputs.length) console.log("  Inputs: " + state.inputs.map(i => i.id || i.type).join(", "));
    return state;
  }

  var s = await describeState("After address submit");

  // Click through the estimator questions
  async function clickOption(textMatch) {
    const clicked = await p1.evaluate((match) => {
      // Try buttons first
      var els = document.querySelectorAll("button, [role=button], .option-card, [onclick], div[style*=cursor]");
      for (var el of els) {
        var t = (el.textContent || "").trim().toLowerCase();
        if (t.includes(match.toLowerCase()) && el.offsetParent !== null) {
          el.click();
          return el.textContent.trim().substring(0, 50);
        }
      }
      // Try any clickable div
      var divs = document.querySelectorAll("div");
      for (var d of divs) {
        var t = (d.textContent || "").trim().toLowerCase();
        var cs = window.getComputedStyle(d).cursor;
        if (t.includes(match.toLowerCase()) && cs === "pointer" && d.offsetParent !== null && t.length < 100) {
          d.click();
          return d.textContent.trim().substring(0, 50);
        }
      }
      return null;
    }, textMatch);
    if (clicked) {
      console.log("  Clicked: " + clicked);
    } else {
      console.log("  WARNING: Could not find clickable element matching '" + textMatch + "'");
    }
    await new Promise(r => setTimeout(r, 2000));
    return clicked;
  }

  // The estimator questionnaire starts with "What's going on with your roof?"
  // Options: "Time for a new one" or "Aging, worn, or damage"
  console.log("\n2. Questionnaire: What's going on with your roof?");
  await clickOption("Time for a new");
  s = await describeState("After 'Time for a new one'");

  // Next question should appear - click through whatever comes up
  console.log("\n3. Next question...");
  // Look at what's available and click the first reasonable option
  var bodyText = await p1.evaluate(() => document.body.innerText);

  // Try to find and click options based on what's visible
  if (bodyText.includes("material") || bodyText.includes("Material") || bodyText.includes("shingle")) {
    console.log("  Looks like material selection");
    await clickOption("architectural") || await clickOption("Architectural") || await clickOption("asphalt");
  } else if (bodyText.includes("stories") || bodyText.includes("story")) {
    console.log("  Looks like stories question");
    await clickOption("2 stor") || await clickOption("two stor") || await clickOption("1 story");
  } else {
    // Just click the first option-like element
    const firstOption = await p1.evaluate(() => {
      var cards = document.querySelectorAll("[onclick], .option-card, div[style*=cursor]");
      for (var c of cards) {
        if (c.offsetParent && c.textContent.trim().length > 3 && c.textContent.trim().length < 100) {
          c.click();
          return c.textContent.trim().substring(0, 60);
        }
      }
      return null;
    });
    if (firstOption) console.log("  Clicked first option: " + firstOption);
  }
  s = await describeState("After question 3");

  // Continue clicking through questions
  for (let step = 4; step <= 10; step++) {
    bodyText = await p1.evaluate(() => document.body.innerText);

    // Check if we've reached a result
    if (bodyText.includes("Fair Price") || bodyText.includes("Overpriced") ||
        bodyText.includes("Excellent Value") || bodyText.includes("Higher Than") ||
        bodyText.includes("Unusually") || bodyText.includes("Estimated Cost") ||
        bodyText.includes("Your Roof Estimate") || bodyText.includes("your estimate")) {
      console.log("\n" + step + ". RESULT REACHED!");
      s = await describeState("Result page");

      // Check for specific result elements
      const resultDetails = await p1.evaluate(() => {
        var t = document.body.innerText;
        return {
          hasTierComp: t.includes("Same roof") || t.includes("different materials"),
          hasPrice: !!t.match(/\$[\d,]+/),
          hasNextSteps: t.includes("Next steps") || t.includes("before you sign"),
          hasFindContractors: t.includes("Find contractors"),
          hasScope: t.includes("tear") || t.includes("underlayment") || t.includes("flashing"),
          priceMatch: (t.match(/\$[\d,]+/) || [null])[0]
        };
      });
      console.log("  Price shown: " + (resultDetails.priceMatch || "none"));
      console.log("  Tier comparison: " + resultDetails.hasTierComp);
      console.log("  Scope items: " + resultDetails.hasScope);
      console.log("  Next steps: " + resultDetails.hasNextSteps);
      console.log("  Find contractors: " + resultDetails.hasFindContractors);
      break;
    }

    // Not at result yet - find and click next option
    console.log("\n" + step + ". Next question...");

    // Try common option patterns
    const optionClicked = await p1.evaluate(() => {
      // Find clickable option-like elements
      var candidates = [];
      document.querySelectorAll("button, [onclick], [role=button]").forEach(el => {
        if (el.offsetParent && el.textContent.trim().length > 2 && el.textContent.trim().length < 120) {
          var t = el.textContent.trim().toLowerCase();
          // Skip nav/header buttons
          if (t === "guides" || t === "about" || t === "contact" || t.includes("start over")) return;
          candidates.push({ el, text: el.textContent.trim() });
        }
      });
      // Also check styled divs (option cards)
      document.querySelectorAll("div").forEach(el => {
        var cs = window.getComputedStyle(el);
        if (cs.cursor === "pointer" && el.offsetParent && el.textContent.trim().length > 3 && el.textContent.trim().length < 120) {
          var t = el.textContent.trim().toLowerCase();
          if (t === "guides" || t === "about" || t === "contact") return;
          // Check it's not a parent of another candidate
          if (!el.querySelector("button, [onclick]")) {
            candidates.push({ el, text: el.textContent.trim() });
          }
        }
      });

      if (candidates.length > 0) {
        // Click the first non-nav candidate
        candidates[0].el.click();
        return candidates[0].text.substring(0, 60);
      }
      return null;
    });

    if (optionClicked) {
      console.log("  Clicked: " + optionClicked);
    } else {
      // Maybe there's an input + continue button
      const hasInput = await p1.evaluate(() => {
        var inputs = document.querySelectorAll("input[type=number], input[type=text]");
        for (var inp of inputs) {
          if (inp.offsetParent && !inp.value) {
            inp.value = "2000";
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            return "Filled input with 2000";
          }
        }
        return null;
      });
      if (hasInput) {
        console.log("  " + hasInput);
        // Click continue/next/submit
        await clickOption("continue") || await clickOption("next") || await clickOption("submit") || await clickOption("get");
      } else {
        console.log("  No options found - may be stuck");
        s = await describeState("Stuck state");
        break;
      }
    }

    await new Promise(r => setTimeout(r, 2000));
    s = await describeState("After step " + step);
  }

  console.log("\n  JS errors: " + (e1.length ? e1.join("; ") : "none"));
  await p1.close();

  // =====================================================
  // PATH 2: ANALYZER with messy upload - click through
  // =====================================================
  console.log("\n========================================");
  console.log("PATH 2: ANALYZER (messy upload)");
  console.log("========================================");

  const p2 = await browser.newPage();
  const e2 = [];
  p2.on("pageerror", err => e2.push(err.message.substring(0, 150)));
  await p2.goto("https://truepricehq.com/roofing-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 20000 });

  console.log("1. Enter address...");
  await p2.waitForSelector("#journeyStreetAddress", { timeout: 5000 });
  await p2.type("#journeyStreetAddress", "100 Main St");
  await p2.type("#journeyCity", "Dallas");
  await p2.type("#journeyState", "TX");
  await p2.type("#journeyZipCode", "75201");
  await p2.evaluate(() => { if (window.handleAddressSubmit) window.handleAddressSubmit(); });
  await new Promise(r => setTimeout(r, 2000));

  console.log("\n2. Confirm property...");
  var confirmShown = await p2.evaluate(() => document.body.innerText.includes("Looks correct"));
  console.log("  Confirm dialog: " + confirmShown);
  if (confirmShown) {
    await p2.evaluate(() => { if (window.confirmProperty) window.confirmProperty(); });
    console.log("  Confirmed property");
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n3. Upload messy quote...");
  var s2 = await describeState.call({ evaluate: p2.evaluate.bind(p2) }, "Before upload");
  // Need to redefine describeState for p2
  const s2state = await p2.evaluate(() => {
    var btns = [];
    document.querySelectorAll("button, input[type=file]").forEach(el => {
      if (el.offsetParent !== null || el.type === "file") btns.push(el.tagName + "#" + el.id + " " + (el.textContent || "").trim().substring(0, 30));
    });
    return { buttons: btns, hasFileInput: !!document.querySelector("input[type=file]"), bodySnippet: document.body.innerText.substring(0, 400) };
  });
  console.log("  File input present: " + s2state.hasFileInput);
  console.log("  Page says: " + s2state.bodySnippet.substring(0, 200));

  const qf = "test-quotes/roofing-test-images/05-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg";
  if (s2state.hasFileInput && fs.existsSync(qf)) {
    const fi = await p2.$("input[type=file]");
    await fi.uploadFile(path.resolve(qf));
    console.log("  Uploaded: " + path.basename(qf));

    console.log("  Waiting for processing...");
    for (let w = 0; w < 60000; w += 5000) {
      await new Promise(r => setTimeout(r, 5000));
      const status = await p2.evaluate(() => {
        var t = document.body.innerText;
        return {
          processing: t.includes("Analyzing") || t.includes("Processing") || t.includes("Reading"),
          result: t.includes("Fair Price") || t.includes("Overpriced") || t.includes("Excellent") || t.includes("Higher Than") || t.includes("Unusually"),
          needsSize: t.includes("We need your roof size"),
          uploadPrompt: t.includes("Upload your quote") || t.includes("Now upload"),
          snippet: t.substring(0, 200)
        };
      });
      console.log("  " + ((w+5000)/1000) + "s: processing=" + status.processing + " result=" + status.result + " needsSize=" + status.needsSize);
      if (status.result || status.needsSize || status.uploadPrompt) {
        if (status.result) {
          console.log("  GOT VERDICT!");
          const details = await p2.evaluate(() => {
            var t = document.body.innerText;
            return {
              hasTierComp: t.includes("Same roof") || t.includes("different materials"),
              price: (t.match(/\$[\d,]+/) || [null])[0],
              hasScope: t.includes("tear") || t.includes("Scope")
            };
          });
          console.log("  Price: " + details.price);
          console.log("  Tier comparison: " + details.hasTierComp);
          console.log("  Scope section: " + details.hasScope);
        }
        if (status.needsSize) console.log("  System needs roof size (expected for messy photo)");
        break;
      }
    }
  }
  console.log("  JS errors: " + (e2.length ? e2.join("; ") : "none"));
  await p2.close();

  // =====================================================
  // PATH 3: COMPARE - upload 2 quotes
  // =====================================================
  console.log("\n========================================");
  console.log("PATH 3: COMPARE (upload 2 quotes)");
  console.log("========================================");

  const p3 = await browser.newPage();
  const e3 = [];
  p3.on("pageerror", err => e3.push(err.message.substring(0, 150)));
  await p3.goto("https://truepricehq.com/compare-roofing-quotes.html", { waitUntil: "networkidle2", timeout: 15000 });

  console.log("1. Page loaded...");
  const compareState = await p3.evaluate(() => {
    var fileInputs = document.querySelectorAll("input[type=file]");
    return {
      fileSlots: fileInputs.length,
      hasTitle: document.body.innerText.includes("Compare"),
      bodySnippet: document.body.innerText.substring(0, 300)
    };
  });
  console.log("  Upload slots: " + compareState.fileSlots);
  console.log("  Title: " + compareState.hasTitle);

  const quotes = [
    "test-quotes/roofing-test-images/02-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg",
    "test-quotes/roofing-test-images/05-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg"
  ];
  const inputs = await p3.$$("input[type=file]");
  for (let i = 0; i < Math.min(quotes.length, inputs.length); i++) {
    if (fs.existsSync(quotes[i])) {
      await inputs[i].uploadFile(path.resolve(quotes[i]));
      console.log("  Slot " + (i+1) + ": uploaded " + path.basename(quotes[i]));
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log("  Waiting for comparison processing...");
  await new Promise(r => setTimeout(r, 5000));
  const compareResult = await p3.evaluate(() => {
    var t = document.body.innerText;
    return {
      processing: t.includes("Analyzing") || t.includes("Processing"),
      hasComparison: t.includes("winner") || t.includes("Winner") || t.includes("comparison") || t.includes("vs"),
      snippet: t.substring(0, 300)
    };
  });
  console.log("  Comparison visible: " + compareResult.hasComparison);
  console.log("  JS errors: " + (e3.length ? e3.join("; ") : "none"));
  await p3.close();

  await browser.close();
  console.log("\n========================================");
  console.log("ALL 3 PATHS HUMAN WALKTHROUGH COMPLETE");
  console.log("========================================");
})();
