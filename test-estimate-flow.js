const puppeteer = require("puppeteer");

const VERTICALS = [
  { name: "hvac", url: "/hvac-estimate.html", service: "hvac" },
  { name: "plumbing", url: "/plumbing-estimate.html", service: "plumbing" },
  { name: "electrical", url: "/electrical-estimate.html", service: "electrical" },
  { name: "solar", url: "/solar-estimate.html", service: "solar" },
  { name: "fencing", url: "/fencing-estimate.html", service: "fencing" },
  { name: "concrete", url: "/concrete-estimate.html", service: "concrete" },
  { name: "foundation", url: "/foundation-estimate.html", service: "foundation" },
  { name: "garage-door", url: "/garage-door-estimate.html", service: "garage-door" },
  { name: "gutters", url: "/gutters-estimate.html", service: "gutters" },
  { name: "insulation", url: "/insulation-estimate.html", service: "insulation" },
  { name: "kitchen", url: "/kitchen-estimate.html", service: "kitchen" },
  { name: "landscaping", url: "/landscaping-estimate.html", service: "landscaping" },
  { name: "painting", url: "/painting-estimate.html", service: "painting" },
  { name: "siding", url: "/siding-estimate.html", service: "siding" },
  { name: "windows", url: "/window-estimate.html", service: "windows" },
  { name: "auto", url: "/auto-estimate.html", service: "auto" },
  { name: "moving", url: "/moving-estimate.html", service: "moving" },
  { name: "medical", url: "/medical-estimate.html", service: "medical" },
  { name: "legal", url: "/legal-estimate.html", service: "legal" },
];

const requested = process.argv.slice(2);
const toTest = requested.length ? VERTICALS.filter(v => requested.includes(v.name)) : VERTICALS;

function pad(s, n) { return (s + " ".repeat(n)).slice(0, n); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--window-size=1280,900"] });

  for (const v of toTest) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 100)));

    console.log("\n" + "=".repeat(60));
    console.log("TESTING: " + v.name.toUpperCase());
    console.log("=".repeat(60));

    try {
      // Load estimate page
      await page.goto("https://truepricehq.com" + v.url, { waitUntil: "networkidle2", timeout: 20000 });

      // Fill address
      const allInputs = await page.$$("input");
      for (const inp of allInputs) {
        const ph = await page.evaluate(el => el.placeholder, inp);
        if (ph.includes("address") || ph.includes("Start typing")) await inp.type("17064 Laurelmont Court");
        if (ph === "City") await inp.type("Fort Mill");
        if (ph === "State") await inp.type("SC");
        if (ph.includes("ZIP") || ph.includes("Zip")) await inp.type("29707");
      }

      // Click estimate button
      await page.evaluate(() => {
        const btns = document.querySelectorAll("button");
        for (const b of btns) {
          if (b.innerText.includes("Estimate") || b.innerText.includes("estimate")) {
            b.click(); return;
          }
        }
      });
      await new Promise(r => setTimeout(r, 2000));

      // Track steps
      let stepCount = 0;
      let lastQuestion = "";
      let reachedResult = false;

      for (let attempt = 0; attempt < 15; attempt++) {
        const state = await page.evaluate(() => {
          const h3 = document.querySelector("h3");
          const body = document.body.innerText;
          const hasResult = body.includes("Expected range") || body.includes("ESTIMATED COST") || body.includes("Your ") && body.includes("Estimate");
          const dots = document.querySelectorAll("span[style*='border-radius:50%']").length;
          return {
            question: h3 ? h3.innerText : null,
            hasResult,
            dots,
            hasOptions: !!document.querySelector("[data-val]"),
            hasContinue: !!document.getElementById("sqftNext") || !!document.getElementById("detailsNext") || !!document.getElementById("homeSizeNext") || !!document.getElementById("sizeNext") || !!document.getElementById("areaNext") || !!document.querySelector("button[id*='Next'], button[id*='next']"),
          };
        });

        if (state.hasResult) {
          reachedResult = true;
          console.log("  RESULT reached after " + stepCount + " steps");

          // Check result content
          const resultCheck = await page.evaluate(() => {
            const body = document.body.innerText;
            return {
              hasPrice: /\$[\d,]+/.test(body),
              hasRange: body.includes("Expected range"),
              hasDetails: body.includes("Details") || body.includes("DETAILS") || body.includes("Service"),
              hasScope: body.includes("Includes") || body.includes("includes") || body.includes("Scope"),
              hasNextSteps: body.includes("Next") || body.includes("steps") || body.includes("Steps"),
              priceMatch: (body.match(/\$[\d,]+/) || [""])[0]
            };
          });
          console.log("  Price: " + (resultCheck.hasPrice ? resultCheck.priceMatch : "MISSING"));
          console.log("  Range: " + (resultCheck.hasRange ? "YES" : "NO"));
          console.log("  Details: " + (resultCheck.hasDetails ? "YES" : "NO"));
          console.log("  Scope: " + (resultCheck.hasScope ? "YES" : "NO"));
          console.log("  Next steps: " + (resultCheck.hasNextSteps ? "YES" : "NO"));
          break;
        }

        if (state.question && state.question !== lastQuestion) {
          stepCount++;
          lastQuestion = state.question;
          console.log("  Step " + stepCount + ": " + state.question);
        }

        // When both options and continue button exist, fill input and click continue
        // When only options exist, click an option (auto-advances)
        if (state.hasContinue) {
          // Fill any number inputs first, then click continue
          await page.evaluate(() => {
            const numInputs = document.querySelectorAll("input[type='number']");
            numInputs.forEach(inp => { if (!inp.value) inp.value = "2000"; });
            const nextBtn = document.getElementById("sqftNext") || document.getElementById("detailsNext") || document.getElementById("homeSizeNext") || document.getElementById("sizeNext") || document.getElementById("areaNext") || document.querySelector("button[id*='Next'], button[id*='next']");
            if (nextBtn) nextBtn.click();
          });
          await new Promise(r => setTimeout(r, 800));
        } else if (state.hasOptions) {
          await page.evaluate(() => {
            const opt = document.querySelector("[data-val]:not(.selected)");
            if (opt) opt.click();
          });
          await new Promise(r => setTimeout(r, 800));
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (!reachedResult) {
        console.log("  FAIL: Never reached result page (stuck at step " + stepCount + ")");
      }

    } catch (e) {
      console.log("  ERROR: " + e.message.slice(0, 100));
    }

    if (errors.length) {
      console.log("  JS ERRORS: " + errors.join(" | "));
    }

    await page.close();
  }

  await browser.close();
  console.log("\nDone.");
})();
