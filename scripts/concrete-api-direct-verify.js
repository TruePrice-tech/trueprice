// Direct API call to /api/concrete-estimate from the puppeteer page context
// (so Vercel sees the request from a "real" browser session). Verifies that
// pricingContext.expectedRange now populates and detectedUpsells is gone.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "concrete-analyze-postfix-2026-04-27");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sampleText = `LONE STAR CONCRETE WORKS
4800 Independence Pkwy, Plano, TX 75023

Job: 800 sqft 4 inch concrete patio, broom finish
Date: 2026-04-05

4 concrete pour, 800 sqft, 4000 PSI: $4,800
#3 rebar grid, 18 on center: $640
Compacted gravel base, 4 deep: $680
Form work and broom finish: $1,200
Control joints (sawcut at 24-hour cure): $240
Site cleanup and haul-off: $240

Subtotal: $7,800
TOTAL: $7,800

5-year workmanship warranty.
Includes rebar reinforcement and compacted base.
Sealer optional ($380 extra, recommended).
Payment: 25/50/25 schedule.`;

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );

  console.log("=== concrete-estimate API direct call ===");
  // Land on the analyzer page first so Vercel cookies / origin are set
  await page.goto("https://woogoro.com/concrete-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('input[type="file"]', { timeout: 90000 });
  await sleep(1000);
  console.log("  page loaded; calling /api/concrete-estimate directly");

  const apiResponse = await page.evaluate(async (text) => {
    const r = await fetch("/api/concrete-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    return { status: r.status, body: await r.json() };
  }, sampleText);

  console.log("  status:", apiResponse.status);
  fs.writeFileSync(path.join(OUT, "api-direct-response.json"), JSON.stringify(apiResponse.body, null, 2));

  if (apiResponse.status !== 200) {
    console.log("  body:", JSON.stringify(apiResponse.body).substring(0, 400));
    await browser.close();
    return;
  }

  const data = apiResponse.body.data || {};
  const pc = data.pricingContext || {};
  console.log("\n=== Response shape ===");
  console.log("  source:", apiResponse.body.source);
  console.log("  totalPrice:", data.totalPrice);
  console.log("  jobType:", data.jobType);
  console.log("  finish:", data.finish);
  console.log("  squareFootage:", data.squareFootage);
  console.log("  costPerSqFt:", data.costPerSqFt);
  console.log("  pricingContext.matchedJob:", pc.matchedJob);
  console.log("  pricingContext.expectedRange:", JSON.stringify(pc.expectedRange));
  console.log("  pricingContext.stateMultiplier:", pc.stateMultiplier);
  console.log("  detectedUpsells (should be undefined):", data.detectedUpsells);

  console.log("\n=== Verification ===");
  const passed = [];
  const failed = [];
  if (pc.expectedRange && typeof pc.expectedRange.low === "number" && typeof pc.expectedRange.high === "number" && pc.expectedRange.low > 0 && pc.expectedRange.high > pc.expectedRange.low) {
    passed.push("Bug 5: expectedRange populated with reasonable low/high (" + pc.expectedRange.low + "-" + pc.expectedRange.high + ")");
  } else {
    failed.push("Bug 5: expectedRange invalid — " + JSON.stringify(pc.expectedRange));
  }
  if (data.detectedUpsells === undefined) {
    passed.push("Bug 6: detectedUpsells absent (dead loop removed)");
  } else {
    failed.push("Bug 6: detectedUpsells present — " + JSON.stringify(data.detectedUpsells));
  }
  passed.forEach((p) => console.log("  PASS:", p));
  failed.forEach((p) => console.log("  FAIL:", p));

  await browser.close();
  console.log("\nDONE. Saved to:", path.join(OUT, "api-direct-response.json"));
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
