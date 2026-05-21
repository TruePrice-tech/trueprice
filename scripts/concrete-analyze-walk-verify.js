// Walk-test for concrete-analyze post bugs 5 + 6 fix.
// Uploads comparison-conc-mid.png (Lone Star, 800 sqft patio, $7,800) and
// captures the /api/concrete-estimate response to confirm:
//  - bug 5: pricingContext.expectedRange now populates (not null)
//  - bug 6: parsed.detectedUpsells is gone (or empty)
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "concrete-analyze-postfix-2026-04-27");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

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

  // Capture concrete-estimate API response so we can inspect pricingContext
  let apiResponse = null;
  page.on("response", async (res) => {
    if (res.url().includes("/api/concrete-estimate") && res.request().method() === "POST") {
      try { apiResponse = await res.json(); } catch (e) { console.log("  (api parse error)", e.message); }
    }
  });

  page.on("console", (m) => {
    const t = m.text();
    if (/TP_Engine|verdict|error|fail|undefined/i.test(t)) console.log("  console:", t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log("  pageerror:", e.message));

  console.log("=== concrete-analyze post-fix walk ===");
  await page.goto("https://woogoro.com/concrete-quote-analyzer.html", { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('input[type="file"]', { timeout: 90000 });
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT, "00-landing.png") });

  // Upload Lone Star ($7,800, 800 sqft patio, broom finish) — full scope, should produce
  // a meaningful expectedRange comparison
  const fixturePath = path.join(ROOT, "test-quotes/concrete-images/comparison-conc-mid.png");
  await (await page.$('input[type="file"]')).uploadFile(fixturePath);
  console.log("  uploaded comparison-conc-mid.png at", new Date().toISOString());

  // Wait for confirm step
  const start1 = Date.now();
  let confirmReady = false;
  while (Date.now() - start1 < 90000) {
    await sleep(2500);
    confirmReady = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find((b) => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
      return !!(target && !target.disabled && target.offsetParent !== null);
    });
    if (confirmReady) break;
  }
  console.log("  confirm ready:", confirmReady, "after", Math.round((Date.now() - start1) / 1000) + "s");
  await page.screenshot({ path: path.join(OUT, "01-confirm.png") });

  if (confirmReady) {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find((b) => /yes,?\s+analyze\s+this\s+price/i.test((b.textContent || "").trim()));
      if (target) target.click();
    });

    // Wait for verdict to render
    const start2 = Date.now();
    let done = false;
    while (Date.now() - start2 < 90000) {
      await sleep(2500);
      done = await page.evaluate(() => {
        const v = document.querySelector('[class*="-verdict"]');
        return !!v && /(Fair|Above|Below|Overpriced|Higher|Unusually|Estimated|Verdict)/i.test(v.innerText);
      });
      if (done) break;
    }
    console.log("  verdict rendered:", done, "after", Math.round((Date.now() - start2) / 1000) + "s");
    await page.screenshot({ path: path.join(OUT, "02-result-top.png") });
    await page.screenshot({ path: path.join(OUT, "03-result-full.png"), fullPage: true });
  }

  await sleep(1500);

  // ==== Verify the API response ====
  console.log("\n=== /api/concrete-estimate response inspection ===");
  if (!apiResponse) {
    console.log("  WARN: no API response captured (regex parser may have short-circuited the API call)");
  } else {
    const data = apiResponse.data || apiResponse;
    const pc = data.pricingContext || {};
    console.log("  source:", apiResponse.source || data._source);
    console.log("  totalPrice:", data.totalPrice);
    console.log("  jobType:", data.jobType);
    console.log("  finish:", data.finish);
    console.log("  squareFootage:", data.squareFootage);
    console.log("  pricingContext.matchedJob:", pc.matchedJob);
    console.log("  pricingContext.expectedRange:", JSON.stringify(pc.expectedRange));
    console.log("  pricingContext.stateMultiplier:", pc.stateMultiplier);
    console.log("  detectedUpsells (should be undefined):", data.detectedUpsells);
    fs.writeFileSync(path.join(OUT, "04-api-response.json"), JSON.stringify(apiResponse, null, 2));
    console.log("  full response saved to 04-api-response.json");

    // Verify the bugs are fixed
    const passed = [];
    const failed = [];
    if (pc.expectedRange && typeof pc.expectedRange.low === "number" && typeof pc.expectedRange.high === "number") {
      passed.push("Bug 5: expectedRange populated with low/high numbers");
    } else if (apiResponse.source === "regex" && !apiResponse.aiCalled) {
      passed.push("Bug 5: N/A (no API call — regex short-circuited)");
    } else {
      failed.push("Bug 5: expectedRange still null/missing — " + JSON.stringify(pc.expectedRange));
    }
    if (data.detectedUpsells === undefined) {
      passed.push("Bug 6: detectedUpsells absent (dead loop removed)");
    } else {
      failed.push("Bug 6: detectedUpsells present — " + JSON.stringify(data.detectedUpsells));
    }
    console.log("\n  PASSED:", passed.length, "FAILED:", failed.length);
    passed.forEach((p) => console.log("    PASS:", p));
    failed.forEach((p) => console.log("    FAIL:", p));
  }

  await browser.close();
  console.log("\nDONE. Output:", OUT);
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
