// Verify estimate path results match inputs for all verticals.
const puppeteer = require("puppeteer");

const VERTICALS = [
  { name: "hvac", url: "/hvac-estimate.html",
    steps: [
      { val: "central_ac" }, { val: "16" },
      { val: "2" }, // stories
      { type: "sqft", val: "2500", btnId: "sqftNext" },
      { val: "good" }, { val: "planning" }
    ],
    verify: { minPrice: 4000, maxPrice: 8000 }
  },
  { name: "plumbing", url: "/plumbing-estimate.html",
    steps: [ { val: "water_heater" }, { val: "tank_50_gas" }, { val: "garage" }, { val: "planning" } ],
    verify: { minPrice: 1200, maxPrice: 4000 }
  },
  { name: "electrical", url: "/electrical-estimate.html",
    steps: [ { val: "panel_upgrade" }, { type: "sqft", val: "2500", btnId: "sqftNext" }, { val: "2000_plus" }, { val: "routine" } ],
    verify: { minPrice: 2000, maxPrice: 6000 }
  },
  { name: "solar", url: "/solar-estimate.html",
    steps: [ { val: "medium" }, { val: "mid" }, { val: "microinverter" }, { val: "none" }, { val: "good" }, { val: "exploring" } ],
    verify: { minPrice: 15000, maxPrice: 35000 }
  },
  { name: "fencing", url: "/fencing-estimate.html",
    steps: [ { val: "wood_privacy" }, { type: "sqft", val: "150", btnId: "sizeNext" }, { val: "6" }, { val: "yes" } ],
    verify: { minPrice: 2500, maxPrice: 10000 }
  },
  { name: "concrete", url: "/concrete-estimate.html",
    steps: [ { val: "standard_driveway" }, { type: "sqft", val: "600", btnId: "sizeNext" }, { val: "4" }, { val: "no" } ],
    verify: { minPrice: 2000, maxPrice: 10000 }
  },
  { name: "foundation", url: "/foundation-estimate.html",
    steps: [ { val: "pier_installation" }, { val: "moderate" }, { val: "1990_plus" } ],
    verify: { minPrice: 2000, maxPrice: 12000 }
  },
  { name: "garage-door", url: "/garage-door-estimate.html",
    steps: [ { val: "single_car" }, { val: "steel_insulated" }, { val: "yes" } ],
    verify: { minPrice: 800, maxPrice: 4000 }
  },
  { name: "gutters", url: "/gutters-estimate.html",
    steps: [ { val: "aluminum_seamless" }, { type: "sqft", val: "150", btnId: "sizeNext" }, { val: "1" }, { val: "no" } ],
    verify: { minPrice: 800, maxPrice: 4000 }
  },
  { name: "insulation", url: "/insulation-estimate.html",
    steps: [ { val: "blown_in" }, { type: "sqft", val: "1000", btnId: "sizeNext" }, { val: "no" }, { val: "attic" } ],
    verify: { minPrice: 800, maxPrice: 4000 }
  },
  { name: "kitchen", url: "/kitchen-estimate.html",
    steps: [ { val: "midrange" }, { val: "medium" }, { val: "quartz" } ],
    verify: { minPrice: 10000, maxPrice: 50000 }
  },
  { name: "landscaping", url: "/landscaping-estimate.html",
    steps: [ { val: "sod_installation" }, { type: "sqft", val: "2000", btnId: "sizeNext" }, { val: "basic" } ],
    verify: { minPrice: 800, maxPrice: 6000 }
  },
  { name: "painting", url: "/painting-estimate.html",
    steps: [ { val: "interior" }, { type: "sqft", val: "2500", btnId: "sqftNext" }, { val: "standard" }, { val: "good" } ],
    verify: { minPrice: 1500, maxPrice: 8000 }
  },
  { name: "siding", url: "/siding-estimate.html",
    steps: [ { val: "vinyl" }, { type: "sqft", val: "1800", btnId: "sqftNext" }, { val: "1" }, { val: "good" } ],
    verify: { minPrice: 5000, maxPrice: 20000 }
  },
  { name: "windows", url: "/window-estimate.html",
    steps: [ { val: "4-8" }, { val: "vinyl" }, { val: "double-hung" }, { val: "double-lowe" }, { val: "pocket" } ],
    verify: { minPrice: 2000, maxPrice: 10000 }
  },
  { name: "auto", url: "/auto-estimate.html",
    steps: [ { val: "brakes" }, { val: "pads_rotors" }, { val: "standard" }, { val: "independent" }, { val: "schedule_ahead" } ],
    verify: { minPrice: 200, maxPrice: 1000 }
  },
  { name: "moving", url: "/moving-estimate.html",
    steps: [ { val: "local" }, { val: "3br" }, { val: "under_50" }, { val: "none" }, { val: "none" } ],
    verify: { minPrice: 800, maxPrice: 4000 }
  },
  { name: "medical", url: "/medical-estimate.html",
    steps: [ { val: "imaging" }, { val: "mri" }, { val: "insured" }, { val: "in" } ],
    verify: { minPrice: 100, maxPrice: 2000 }
  },
  { name: "legal", url: "/legal-estimate.html",
    steps: [ { val: "estate_planning" }, { val: "basic_will" }, { val: "simple" }, { val: "flat_fee" } ],
    verify: { minPrice: 300, maxPrice: 4000 }
  }
];

const requested = process.argv.slice(2);
const toTest = requested.length ? VERTICALS.filter(v => requested.includes(v.name)) : VERTICALS;
function pad(s, n) { return (s + " ".repeat(n)).slice(0, n); }

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--window-size=1280,900"] });
  const results = [];

  for (const v of toTest) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message.slice(0, 80)));
    let status = "?", price = 0, issues = [];

    try {
      await page.goto("https://woogoro.com" + v.url, { waitUntil: "networkidle2", timeout: 20000 });

      // Fill address
      const allInputs = await page.$$("input");
      for (const inp of allInputs) {
        const ph = await page.evaluate(el => el.placeholder, inp);
        if (ph.includes("address") || ph.includes("Start typing")) await inp.type("17064 Laurelmont Court");
        if (ph === "City") await inp.type("Fort Mill");
        if (ph === "State") await inp.type("SC");
        if (ph.includes("ZIP") || ph.includes("Zip")) await inp.type("29707");
      }
      await page.evaluate(() => {
        document.querySelectorAll("button").forEach(b => { if (b.innerText.includes("Estimate") || b.innerText.includes("estimate")) b.click(); });
      });
      await new Promise(r => setTimeout(r, 3000));

      // Walk steps
      for (const step of v.steps) {
        if (step.type === "sqft") {
          await page.evaluate((val, btnId) => {
            const inputs = document.querySelectorAll("input[type='number']");
            inputs.forEach(inp => { inp.value = val; inp.dispatchEvent(new Event("input")); });
            const btn = document.getElementById(btnId) || document.querySelector("button[id*='Next'], button[id*='next']");
            if (btn) btn.click();
          }, step.val, step.btnId);
        } else {
          await page.evaluate(val => {
            const opt = document.querySelector('[data-val="' + val + '"]');
            if (opt) opt.click();
          }, step.val);
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      await new Promise(r => setTimeout(r, 2000));

      // Check result
      const result = await page.evaluate(() => {
        const body = document.body.innerText;
        const priceMatch = body.match(/\$[\d,]+/);
        return {
          hasResult: body.includes("Expected range") || body.includes("ESTIMATED") || (body.includes("Your") && body.includes("Estimate")),
          price: priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, "")) : 0,
          hasDetails: body.includes("Details") || body.includes("SERVICE") || body.includes("Type"),
          hasScope: body.includes("Includes") || body.includes("includes") || body.includes("Scope"),
          hasNextSteps: body.includes("Next") || body.includes("Steps") || body.includes("steps"),
          snippet: body.slice(0, 300)
        };
      });

      price = result.price;

      if (price === 0 && !result.hasResult) {
        status = "STUCK";
        issues.push("Never reached result");
      } else if (price === 0) {
        status = "NO PRICE";
        issues.push("No price found");
      } else {
        if (price < v.verify.minPrice) issues.push("LOW: $" + price.toLocaleString() + " < $" + v.verify.minPrice.toLocaleString());
        if (price > v.verify.maxPrice) issues.push("HIGH: $" + price.toLocaleString() + " > $" + v.verify.maxPrice.toLocaleString());
        if (!result.hasDetails) issues.push("No details");
        if (!result.hasScope) issues.push("No scope");
        if (!result.hasNextSteps) issues.push("No next steps");
        status = issues.length === 0 ? "PASS" : "WARN";
      }
    } catch (e) {
      status = "ERROR";
      issues.push(e.message.slice(0, 60));
    }

    if (errors.length) issues.push("JS:" + errors[0].slice(0, 30));
    console.log(pad(status, 6) + pad(v.name, 14) + pad(price > 0 ? "$" + price.toLocaleString() : "-", 12) + (issues.length ? issues.join(" | ") : "All checks pass"));
    results.push({ name: v.name, status, price, issues });
    await page.close();
  }

  console.log("\n" + "=".repeat(70));
  const pass = results.filter(r => r.status === "PASS").length;
  const warn = results.filter(r => r.status === "WARN").length;
  const fail = results.filter(r => r.status !== "PASS" && r.status !== "WARN").length;
  console.log(pass + " PASS  " + warn + " WARN  " + fail + " FAIL  out of " + results.length);

  if (warn + fail > 0) {
    console.log("\nISSUES:");
    results.filter(r => r.status !== "PASS").forEach(r => console.log("  " + r.name + ": " + r.issues.join(" | ")));
  }
  await browser.close();
})();
