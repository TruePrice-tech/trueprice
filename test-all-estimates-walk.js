const puppeteer = require("puppeteer");
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const VERTICALS = [
  { name: "plumbing", url: "/plumbing-estimate.html", firstOption: "Water Heater" },
  { name: "electrical", url: "/electrical-estimate.html", firstOption: "Panel" },
  { name: "concrete", url: "/concrete-estimate.html", firstOption: "Driveway" },
  { name: "siding", url: "/siding-estimate.html", firstOption: "Vinyl" },
  { name: "insulation", url: "/insulation-estimate.html", firstOption: "Attic" },
  { name: "gutters", url: "/gutters-estimate.html", firstOption: "Gutter" },
  { name: "foundation", url: "/foundation-estimate.html", firstOption: "Pier" },
  { name: "garage-door", url: "/garage-door-estimate.html", firstOption: "Garage" },
  { name: "moving", url: "/moving-estimate.html", firstOption: "Local" },
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const BASE = "https://truepricehq.com";

  for (const v of VERTICALS) {
    console.log("========================================");
    console.log(v.name.toUpperCase() + " ESTIMATE");
    console.log("========================================");

    const page = await browser.newPage();
    var errors = [];
    page.on("pageerror", e => errors.push(e.message.substring(0, 80)));

    try {
      await page.goto(BASE + v.url, { waitUntil: "networkidle2", timeout: 15000 });
    } catch(e) {
      console.log("  TIMEOUT loading page");
      await page.close();
      continue;
    }

    // 1. Check address form visible
    var hasAddr = await page.evaluate(() => {
      var street = document.getElementById("addrStreet");
      var btn = document.getElementById("btnEstimate");
      var form = document.querySelector("[class*=address-form]");
      return {
        street: !!street,
        btn: !!btn,
        formVisible: form ? form.style.display !== "none" : false,
        bodySnippet: document.body.innerText.substring(0, 200)
      };
    });

    if (!hasAddr.street || !hasAddr.formVisible) {
      console.log("  ADDRESS FORM: MISSING or HIDDEN");
      console.log("  street input: " + hasAddr.street + " | form visible: " + hasAddr.formVisible);
      console.log("  Page shows: " + hasAddr.bodySnippet.substring(0, 100));
      console.log("  JS errors: " + (errors.length ? errors.join("; ") : "none"));
      console.log("  STATUS: NEEDS FIX\n");
      await page.close();
      continue;
    }

    // 2. Enter address
    await page.type("#addrStreet", "100 Main St");
    await page.type("#addrCity", "Charlotte");
    await page.type("#addrState", "NC");
    await page.type("#addrZip", "28202");
    await page.evaluate(() => { var b = document.getElementById("btnEstimate"); if (b) b.click(); });
    await sleep(2000);

    // 3. Count steps and check first option
    var stepInfo = await page.evaluate((firstOpt) => {
      var options = [];
      document.querySelectorAll("[class*=-option]").forEach(el => {
        if (el.offsetParent) options.push(el.textContent.trim().substring(0, 30));
      });
      var heading = document.querySelector("[class*=-step] h3");
      return {
        optionCount: options.length,
        firstOptions: options.slice(0, 5),
        heading: heading ? heading.textContent : "no heading",
        hasFirstOption: options.some(o => o.includes(firstOpt))
      };
    }, v.firstOption);

    console.log("  Address: OK");
    console.log("  Step 1: " + stepInfo.heading);
    console.log("  Options: " + stepInfo.optionCount + " (" + stepInfo.firstOptions.join(", ") + ")");
    console.log("  JS errors: " + (errors.length ? errors.join("; ") : "none"));
    console.log("  STATUS: " + (stepInfo.optionCount > 0 ? "PASS" : "FAIL") + "\n");

    await page.close();
  }

  await browser.close();
  console.log("========================================");
  console.log("ALL 9 ESTIMATE PAGES CHECKED");
  console.log("========================================");
})();
