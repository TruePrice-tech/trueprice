// Gutters deep-dive walk: estimate (Lane's address, full permutations) + analyze (valid fixtures) + compare (3 fixtures)
// Temp script for the 2026-04-27 deep dive. Not committed.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "gutters-walk-2026-04-27");
const BASE = process.env.BASE || "https://woogoro.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, full = false) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log(`  shot${full ? " (full)" : ""}: ${name}`);
}

async function dumpResultText(page, name, sel) {
  const txt = await page.evaluate((s) => {
    const el = (s && document.querySelector(s)) || document.getElementById("gutApp") || document.querySelector("main");
    return el ? (el.innerText || "").slice(0, 6000) : "(no element)";
  }, sel);
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
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
    if (/error|fail|verdict|400|500|404|warn/i.test(t)) console.log(`  [${label} console]`, m.type(), t.substring(0, 280));
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function fillAddress(page) {
  await page.evaluate(() => {
    const street = document.getElementById("addrStreet");
    const city = document.getElementById("addrCity");
    const state = document.getElementById("addrState");
    const zip = document.getElementById("addrZip");
    if (street) { street.value = "17064 Laurelmont Ct"; street.dispatchEvent(new Event("input", {bubbles: true})); }
    if (city) city.value = "Fort Mill";
    if (state) state.value = "SC";
    if (zip) zip.value = "29707";
  });
  await sleep(200);
}

async function clickEstimateAndAnswer(page, label, picks) {
  // picks: { gutterType, linearFeet, stories, guards }
  // Click "Get Gutter Estimate" then walk the 4 estimator steps
  await page.evaluate(() => { const b = document.getElementById("btnEstimate"); if (b) b.click(); });
  await sleep(800);
  await shot(page, `est-${label}-step1`);

  // Step 1: gutterType — pick by data-val
  await page.evaluate((val) => {
    const opts = document.querySelectorAll(".gut-option");
    for (const o of opts) {
      if ((o.getAttribute("data-val") || "").toLowerCase() === val.toLowerCase()) { o.click(); return; }
    }
  }, picks.gutterType);
  await sleep(500);
  await shot(page, `est-${label}-step2`);

  // Step 2: linearFeet — could be options OR an input
  await page.evaluate((val) => {
    const lfInput = document.querySelector(".gut-lf-input, input[type='number'][placeholder*='linear' i], input[type='number']");
    if (lfInput) { lfInput.value = String(val); lfInput.dispatchEvent(new Event("input", {bubbles:true})); lfInput.dispatchEvent(new Event("change", {bubbles:true})); }
    // Look for a "Continue" button after entering LF
    const btns = Array.from(document.querySelectorAll("button"));
    const cont = btns.find(b => /continue|next/i.test(b.textContent));
    if (cont) cont.click();
  }, picks.linearFeet);
  await sleep(500);
  await shot(page, `est-${label}-step3`);

  // Step 3: stories
  await page.evaluate((val) => {
    const opts = document.querySelectorAll(".gut-option");
    for (const o of opts) {
      if (o.getAttribute("data-val") === String(val)) { o.click(); return; }
    }
  }, picks.stories);
  await sleep(500);
  await shot(page, `est-${label}-step4`);

  // Step 4: guards
  await page.evaluate((val) => {
    const opts = document.querySelectorAll(".gut-option");
    for (const o of opts) {
      if ((o.getAttribute("data-val") || "").toLowerCase() === val.toLowerCase()) { o.click(); return; }
    }
  }, picks.guards);
  await sleep(1500);
  await shot(page, `est-${label}-result`, true);
  await dumpResultText(page, `est-${label}-result`);
}

async function walkEstimatePermutation(browser, label, picks) {
  console.log(`\n=== ESTIMATE: ${label} (${JSON.stringify(picks)}) ===`);
  const page = await newPage(browser, label);
  await page.goto(`${BASE}/gutters-estimate.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(800);
  await fillAddress(page);
  await shot(page, `est-${label}-address`);
  await clickEstimateAndAnswer(page, label, picks);
  await page.close();
}

async function walkAnalyze(browser, label, fixturePath, expected) {
  console.log(`\n=== ANALYZE: ${label} (${path.basename(fixturePath)}) — expected: ${expected || "?"} ===`);
  const page = await newPage(browser, label);
  await page.goto(`${BASE}/gutters-quote-analyzer.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(800);
  await shot(page, `anl-${label}-landing`);

  // Find file input — analyzer page uses gut-upload-zone + hidden file input
  const fileInput = await page.$("input[type='file']");
  if (!fileInput) { console.log(`  no file input on analyze page`); await page.close(); return; }
  await fileInput.uploadFile(fixturePath);
  // Wait for result to render — up to 90s
  let rendered = false;
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    const hasResult = await page.evaluate(() => /verdict|fair price|above average|overpriced|unusually|unable|couldn|error/i.test(document.body.innerText));
    if (hasResult) { rendered = true; break; }
  }
  console.log(`  rendered: ${rendered}`);
  await sleep(800);
  await shot(page, `anl-${label}-result`, true);
  await dumpResultText(page, `anl-${label}-result`);
  await page.close();
}

async function walkCompare(browser, fixtures) {
  console.log(`\n=== COMPARE: ${fixtures.map(f => path.basename(f)).join(", ")} ===`);
  const page = await newPage(browser, "cmp");
  await page.goto(`${BASE}/compare-gutters-quotes.html`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(800);
  await shot(page, "cmp-landing");

  for (let i = 0; i < fixtures.length; i++) {
    const slot = await page.$(`#file${i}`);
    if (slot) {
      await slot.uploadFile(fixtures[i]);
      console.log(`  uploaded slot ${i}: ${path.basename(fixtures[i])}`);
      await sleep(1000);
    } else {
      console.log(`  no #file${i} input`);
    }
  }
  // Wait until all slots parsed (up to 120s)
  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    const ready = await page.evaluate((n) => {
      const btn = document.getElementById("compareBtn");
      return btn && !btn.disabled && /compare \d/i.test(btn.textContent);
    }, fixtures.length);
    if (ready) break;
  }
  await shot(page, "cmp-uploaded", true);
  // Click Compare
  await page.evaluate(() => { const b = document.getElementById("compareBtn"); if (b && !b.disabled) b.click(); });
  await sleep(2500);
  await shot(page, "cmp-results", true);
  await dumpResultText(page, "cmp-results", "#resultsContent");
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ── ESTIMATE permutations ──
  // Default: aluminum_seamless 5", 150 LF, 1-story, no guards
  await walkEstimatePermutation(browser, "default-5in-150lf-1story-noguards", {
    gutterType: "aluminum_seamless", linearFeet: 150, stories: "1", guards: "no"
  });
  // Lane's home approximation: 6", 200 LF, 2-story, no guards
  await walkEstimatePermutation(browser, "lane-6in-200lf-2story-noguards", {
    gutterType: "aluminum_6inch", linearFeet: 200, stories: "2", guards: "no"
  });
  // Premium: copper, 200 LF, 2-story, with guards
  await walkEstimatePermutation(browser, "copper-200lf-2story-guards", {
    gutterType: "copper", linearFeet: 200, stories: "2", guards: "yes"
  });
  // Vinyl budget: vinyl, 100 LF, 1-story, no guards
  await walkEstimatePermutation(browser, "vinyl-100lf-1story-noguards", {
    gutterType: "vinyl", linearFeet: 100, stories: "1", guards: "no"
  });
  // Steel + guards 3-story
  await walkEstimatePermutation(browser, "steel-250lf-3story-guards", {
    gutterType: "steel", linearFeet: 250, stories: "3", guards: "yes"
  });

  // ── ANALYZE — only fixtures with extractable gutter content ──
  const FIX = path.join(ROOT, "test-quotes", "gutters-images");
  // real-05: roof contract w/ $4,100 seamless gutters line item
  await walkAnalyze(browser, "real-05", path.join(FIX, "real-05-fl-hip-roof-quote-discrepancy-22k-vs-28k-the-expen.jpeg"), "$4,100 seamless gutters line item");
  // real-09: roofing contract with gutter line items
  await walkAnalyze(browser, "real-09", path.join(FIX, "real-09-another-estimate-im-going-broke-from-just-reading.jpeg"), "$18,692 total roof+gutter");
  // real-10: comparison table for 6 roofing+gutter quotes
  await walkAnalyze(browser, "real-10", path.join(FIX, "real-10-help-me-pick-a-quote.jpeg"), "table of 6 quotes, gutter cost $1,900-$3,024");

  // ── COMPARE — synthetic comparison fixtures ──
  await walkCompare(browser, [
    path.join(FIX, "comparison-gutters-low.png"),
    path.join(FIX, "comparison-gutters-mid.png"),
    path.join(FIX, "comparison-gutters-high.png")
  ]);

  await browser.close();
  console.log("\nDONE — output dir:", OUT);
})();
