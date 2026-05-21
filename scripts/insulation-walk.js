// Insulation deep-dive walker.
// - estimate path with Lane's address
// - analyze path with 2 real Reddit fixtures
// - compare path with 3 fixtures
// Stubs /api/geocode-suggest. Sets address fields directly via page.evaluate.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "insulation-walk-2026-04-27");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function newPage(browser, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/geocode-suggest")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    } else {
      req.continue();
    }
  });
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|TP_Engine|400|verdict|stuck/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function walkEstimate(browser) {
  console.log("\n=== ESTIMATE PATH ===");
  const page = await newPage(browser, "estimate");
  await page.goto(`${BASE}/insulation-estimate.html`, { waitUntil: "networkidle2", timeout: 45000 });
  await sleep(1500);
  await shot(page, "e-01-landing");

  // Set address directly (bypass autocomplete debounce)
  await page.evaluate(() => {
    const street = document.getElementById("addrStreet");
    const city = document.getElementById("addrCity");
    const st = document.getElementById("addrState");
    const zip = document.getElementById("addrZip");
    if (street) street.value = "17064 Laurelmont Ct";
    if (city) city.value = "Fort Mill";
    if (st) st.value = "SC";
    if (zip) zip.value = "29707";
  });
  await shot(page, "e-02-address-filled");

  await page.click("#btnEstimate");
  await sleep(2500);
  await shot(page, "e-03-step1-instype", true);

  // Pick blown_in
  const picked1 = await page.evaluate(() => {
    const opt = document.querySelector('[data-val="blown_in"]');
    if (opt) { opt.click(); return true; }
    return false;
  });
  console.log("  picked blown_in:", picked1);
  await sleep(1500);
  await shot(page, "e-04-after-instype", true);

  // Try to pick a home-type card or click Continue
  const stepInfo = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h3")).map(h => h.textContent.trim());
    const stepText = document.querySelector('[style*="Step "]')?.textContent || "";
    const cards = Array.from(document.querySelectorAll(".wg-hometype-card")).map(c => c.textContent.trim().substring(0, 80));
    const sizeInput = !!document.getElementById("sizeInput");
    const manualInput = !!document.getElementById("manualAreaInput");
    const continueBtn = !!document.getElementById("btnHtNext") || !!document.getElementById("btnSizeContinue");
    return { headings, stepText, cards, sizeInput, manualInput, continueBtn };
  });
  console.log("  current step:", JSON.stringify(stepInfo, null, 2));

  // Try clicking the first home-type card if present
  await page.evaluate(() => {
    const card = document.querySelector(".wg-hometype-card");
    if (card) card.click();
  });
  await sleep(800);
  await shot(page, "e-05-after-htpick", true);

  // Click Continue
  await page.evaluate(() => {
    const btn = document.getElementById("btnHtNext");
    if (btn) btn.click();
  });
  await sleep(2000);
  await shot(page, "e-06-after-htcontinue", true);

  // Capture state
  const stateAfterHt = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h3")).map(h => h.textContent.trim());
    const stepText = (document.body.innerText.match(/Step \d+ of \d+/g) || [])[0] || "";
    return { headings, stepText };
  });
  console.log("  after HT continue:", JSON.stringify(stateAfterHt));

  // If still on hometype, this is the bug. Try to force-set stories so we can continue.
  const stuck = stateAfterHt.headings.some(h => /Describe your home/i.test(h));
  if (stuck) {
    console.log("  ⚠ STUCK ON HOMETYPE PICKER — confirms getEstimatorStep bug");
  }

  // Try to proceed via the size input if available, then removal, then location
  // First: if size step shown
  await page.evaluate(() => {
    const inp = document.getElementById("sizeInput");
    if (inp) {
      inp.value = "1500";
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      const btn = document.getElementById("btnSizeContinue");
      if (btn) btn.click();
    }
  });
  await sleep(1500);
  await shot(page, "e-07-after-size", true);

  // Removal step
  await page.evaluate(() => {
    const opt = document.querySelector('[data-val="no"]');
    if (opt) opt.click();
  });
  await sleep(1500);
  await shot(page, "e-08-after-removal", true);

  // Location step
  await page.evaluate(() => {
    const opt = document.querySelector('[data-val="attic"]');
    if (opt) opt.click();
  });
  await sleep(2500);
  await shot(page, "e-09-result", true);

  // Capture final result text
  const resultText = await page.evaluate(() => {
    const verdict = document.querySelector(".ins-verdict");
    return verdict ? verdict.innerText : "(no verdict found)";
  });
  console.log("  RESULT VERDICT TEXT:");
  console.log("  " + resultText.split("\n").join("\n  "));

  await page.close();
}

async function walkAnalyze(browser, fixtureName) {
  console.log(`\n=== ANALYZE PATH (${fixtureName}) ===`);
  const page = await newPage(browser, "analyze");
  await page.goto(`${BASE}/insulation-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 45000 });
  await sleep(1500);
  const safeName = fixtureName.replace(/\.[^.]+$/, "");
  await shot(page, `a-${safeName}-01-landing`);

  // Find file input and upload
  const fixturePath = path.join(ROOT, "test-quotes", "insulation-images", fixtureName);
  if (!fs.existsSync(fixturePath)) {
    console.log("  fixture not found:", fixturePath);
    await page.close();
    return;
  }

  const inputHandle = await page.$('input[type=file]');
  if (!inputHandle) {
    console.log("  no file input found");
    await page.close();
    return;
  }
  await inputHandle.uploadFile(fixturePath);
  console.log("  uploaded:", fixtureName);

  // Wait for processing — up to 60s
  await sleep(10000);
  await shot(page, `a-${safeName}-02-mid-process`);
  await sleep(20000);
  await shot(page, `a-${safeName}-03-result`, true);

  const resultText = await page.evaluate(() => {
    const verdict = document.querySelector(".ins-verdict");
    return verdict ? verdict.innerText : "(no verdict found)";
  });
  console.log("  RESULT VERDICT TEXT:");
  console.log("  " + resultText.split("\n").join("\n  "));

  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    await walkEstimate(browser);

    // Walk analyze with the cleanest mock first to validate the path
    await walkAnalyze(browser, "mock-01.png");
    await walkAnalyze(browser, "mock-02.png");
  } catch (e) {
    console.error("WALK FAILED:", e);
  } finally {
    await browser.close();
  }
})();
