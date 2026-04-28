// Moving deep-dive walk: estimate (Lane's SC address, 4 permutations) + analyze
// (7 real Reddit fixtures) + compare (united-vs-mayflower triplet) + mobile estimate.
// Reads result text and screenshots so a human can verify the rendered output.
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const ROOT = "c:/Users/lanea/OneDrive/Desktop/TrueP Misc/trueprice";
const OUT = path.join(ROOT, "output", "moving-walk-2026-04-27");
const FIX = path.join(ROOT, "test-quotes", "moving-images");
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
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36");
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|verdict|TP_Engine|400|500|ReferenceError|TypeError|undefined/i.test(t)) {
      console.log(`  [${label} console]`, m.type(), t.substring(0, 240));
    }
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  return page;
}

async function dumpText(page, selector, name) {
  const txt = await page.evaluate((sel) => {
    const el = document.querySelector(sel) || document.querySelector("main");
    return el ? (el.innerText || "").slice(0, 8000) : "(no match)";
  }, selector);
  fs.writeFileSync(path.join(OUT, `${name}.txt`), txt);
  console.log(`  dump: ${name}.txt (${txt.length} chars)`);
  return txt;
}

async function fillEstimateAddressAndStart(page) {
  await page.waitForSelector("#addrStreet", { timeout: 15000 });
  await page.evaluate(() => {
    document.getElementById("addrStreet").value = "17064 Laurelmont Ct";
    document.getElementById("addrCity").value = "Fort Mill";
    document.getElementById("addrState").value = "SC";
    document.getElementById("addrZip").value = "29707";
  });
  await sleep(300);
  await page.click("#btnEstimate");
  await sleep(1500);
}

async function pickEstOption(page, containerId, val) {
  const ok = await page.evaluate((cid, v) => {
    const o = document.querySelector(`#${cid} [data-val="${v}"]`);
    if (o) { o.click(); return true; }
    return false;
  }, containerId, val);
  if (!ok) console.log(`  [pick] could not click ${containerId} ${val}`);
  await sleep(700);
}

async function gotoWithCheckpoint(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Vercel security checkpoint sets a JS challenge cookie; without request
  // interception this clears in ~2s, but we wait up to 30s to be safe.
  for (let attempt = 0; attempt < 15; attempt++) {
    await sleep(2000);
    const hasApp = await page.evaluate(() => !!(document.getElementById("moveApp") || document.getElementById("mvApp") || document.getElementById("uploadStep"))).catch(() => false);
    if (hasApp) {
      // Stub geocode-suggest response now that the app shell is loaded so the
      // autocomplete dropdown can't intercept clicks during programmatic input.
      await page.evaluate(() => {
        const _origFetch = window.fetch;
        window.fetch = function(url, opts) {
          if (typeof url === "string" && url.includes("/api/geocode-suggest")) {
            return Promise.resolve(new Response(JSON.stringify({ suggestions: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
          }
          return _origFetch.apply(this, arguments);
        };
      }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function runEstimateWalk(browser, label, picks) {
  const page = await newPage(browser, label);
  console.log(`\n=== ESTIMATE: ${label} ===`);
  await gotoWithCheckpoint(page, `${BASE}/moving-estimate.html`);
  await sleep(1500);
  await shot(page, `est-${label}-01-landing`);
  await fillEstimateAddressAndStart(page);
  await shot(page, `est-${label}-02-step1-movetype`);

  await pickEstOption(page, "optMoveType", picks.moveType);
  await sleep(800);
  await shot(page, `est-${label}-03-step2-homesize`);
  await pickEstOption(page, "optHomeSize", picks.homeSize);
  await sleep(800);

  if (picks.moveType !== "same_building") {
    await shot(page, `est-${label}-04-step3-distance`);
    await pickEstOption(page, "optDistance", picks.distance);
    await sleep(800);
  }

  await shot(page, `est-${label}-05-step-packing`);
  await pickEstOption(page, "optPacking", picks.packing);
  await sleep(800);
  await shot(page, `est-${label}-06-step-special`);
  await pickEstOption(page, "optSpecial", picks.specialItems);
  await sleep(2500);
  await shot(page, `est-${label}-07-result-top`);
  await shot(page, `est-${label}-08-result-full`, true);
  await dumpText(page, "#moveApp", `est-${label}-08-result`);
  await page.close();
}

async function uploadAndAnalyze(browser, label, fixtureFile) {
  const page = await newPage(browser, label);
  console.log(`\n=== ANALYZE: ${label} (${fixtureFile}) ===`);
  await gotoWithCheckpoint(page, `${BASE}/moving-quote-analyzer.html`);
  await sleep(2000);
  await shot(page, `an-${label}-01-landing`);

  const fileInput = await page.$("#fileInput");
  if (!fileInput) {
    console.log(`  [an] could not find fileInput`);
    await shot(page, `an-${label}-no-input`);
    await page.close();
    return;
  }
  const fixturePath = path.join(FIX, fixtureFile);
  await fileInput.uploadFile(fixturePath);
  await sleep(2000);
  await shot(page, `an-${label}-02-uploading`);

  // Wait up to 60s for either price-confirmation prompt OR final verdict
  const reached = await page.waitForFunction(() => {
    const t = document.body && document.body.innerText || "";
    return /yes,? analyze this price|we found your quote total|enter your quote total|fair price|above average|higher than expected|below average|unusually low|woogoro moving verdict/i.test(t);
  }, { timeout: 75000 }).catch(() => false);
  if (!reached) {
    await shot(page, `an-${label}-03-stuck`, true);
    await dumpText(page, "#mvApp", `an-${label}-03-stuck`);
    console.log(`  [an] stuck: did not reach price-confirm or verdict in 75s`);
    await page.close();
    return;
  }
  await sleep(1500);

  // Click "Yes, analyze this price" on the confirmation prompt if shown
  const confirmed = await page.evaluate(() => {
    const btn = document.getElementById("tpConfirmPriceBtn");
    if (btn) { btn.click(); return "yes-analyze"; }
    const btns = Array.from(document.querySelectorAll("button"));
    const c = btns.find((b) => /yes,? analyze this price|analyze this price|looks right|confirm price/i.test(b.textContent || ""));
    if (c) { c.click(); return "fallback-button"; }
    return null;
  });
  if (confirmed) {
    console.log(`  [an] clicked confirm-price (${confirmed})`);
    await sleep(3500);
  }

  // After confirm, wait for final verdict text
  await page.waitForFunction(() => {
    const t = document.body && document.body.innerText || "";
    return /fair price|above average|higher than expected|below average|unusually low|woogoro moving verdict/i.test(t);
  }, { timeout: 30000 }).catch(() => null);

  await shot(page, `an-${label}-04-result-top`);
  await shot(page, `an-${label}-05-result-full`, true);
  const txt = await dumpText(page, "#mvApp", `an-${label}-05-result`);
  // Quick console sanity: surface verdict + price + market range
  const summary = txt.split("\n").filter((l) => /verdict|fair|higher|lower|above|below|expected|market range|distance|home size|move type|moverInfo|usdot|long.distance|local move/i.test(l)).slice(0, 15).join(" | ");
  if (summary) console.log(`  [an] summary: ${summary.substring(0, 320)}`);
  await page.close();
}

async function runCompareWalk(browser, label, files) {
  const page = await newPage(browser, label);
  console.log(`\n=== COMPARE: ${label} ===`);
  await gotoWithCheckpoint(page, `${BASE}/compare-moving-quotes.html`);
  await sleep(2000);
  await shot(page, `cmp-${label}-01-landing`);

  for (let i = 0; i < files.length; i++) {
    const input = await page.$(`#file${i}`);
    if (!input) { console.log(`  [cmp] could not find #file${i}`); continue; }
    await input.uploadFile(path.join(FIX, files[i]));
    await sleep(1500);
    console.log(`  [cmp] uploaded slot ${i}: ${files[i]}`);
  }

  // Wait for all slots to finish parsing (compareBtn enabled)
  const ready = await page.waitForFunction(() => {
    const b = document.getElementById("compareBtn");
    return b && !b.disabled;
  }, { timeout: 180000 }).catch(() => false);
  if (!ready) {
    await shot(page, `cmp-${label}-02-stuck`, true);
    console.log(`  [cmp] stuck: compareBtn never enabled`);
    await page.close();
    return;
  }
  await shot(page, `cmp-${label}-02-uploaded`);
  await page.click("#compareBtn");
  await sleep(2500);
  await shot(page, `cmp-${label}-03-results-top`);
  await shot(page, `cmp-${label}-04-results-full`, true);
  await dumpText(page, "#resultsContent", `cmp-${label}-04-results`);
  await page.close();
}

async function runMobileEstimate(browser) {
  const page = await newPage(browser, "mobile");
  await page.setViewport({ width: 390, height: 844 });
  console.log(`\n=== MOBILE ESTIMATE ===`);
  await gotoWithCheckpoint(page, `${BASE}/moving-estimate.html`);
  await sleep(1500);
  await shot(page, `mob-01-landing`);
  await fillEstimateAddressAndStart(page);
  await pickEstOption(page, "optMoveType", "long_distance");
  await pickEstOption(page, "optHomeSize", "3br");
  await pickEstOption(page, "optDistance", "250_1000");
  await pickEstOption(page, "optPacking", "partial");
  await pickEstOption(page, "optSpecial", "none");
  await sleep(2500);
  await shot(page, `mob-02-result-top`);
  await shot(page, `mob-03-result-full`, true);
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"]
  });
  try {
    // Estimate permutations covering each top-level option
    await runEstimateWalk(browser, "local-2br", { moveType: "local", homeSize: "2br", distance: "under_50", packing: "none", specialItems: "none" });
    await runEstimateWalk(browser, "ld-3br", { moveType: "long_distance", homeSize: "3br", distance: "250_1000", packing: "partial", specialItems: "piano" });
    await runEstimateWalk(browser, "same-building-1br", { moveType: "same_building", homeSize: "studio_1br", distance: "under_50", packing: "none", specialItems: "stairs" });
    await runEstimateWalk(browser, "office-4br", { moveType: "office", homeSize: "office", distance: "50_250", packing: "full", specialItems: "none" });

    // Analyze: all 7 real fixtures
    await uploadAndAnalyze(browser, "real-01-atlanta-dc", "01-atlanta-dc-3k-estimate.jpeg");
    await uploadAndAnalyze(browser, "real-02-thoughts", "02-thoughts-on-quote.jpeg");
    await uploadAndAnalyze(browser, "real-03-two-men", "03-two-men-truck-doubled.jpg");
    await uploadAndAnalyze(browser, "real-04-allied-18k", "04-allied-socal-denver-18k.jpeg");
    await uploadAndAnalyze(browser, "real-05-brightside", "05-brightside-quote.jpeg");
    await uploadAndAnalyze(browser, "real-06-united-vs-may", "06-united-vs-mayflower.jpeg");
    await uploadAndAnalyze(browser, "real-07-mayflower", "07-mayflower-quote.jpeg");

    // Compare: real triplet + synthetic triplet
    await runCompareWalk(browser, "real-triplet", ["01-atlanta-dc-3k-estimate.jpeg", "03-two-men-truck-doubled.jpg", "07-mayflower-quote.jpeg"]);
    await runCompareWalk(browser, "synthetic-triplet", ["comparison-move-low.png", "comparison-move-mid.png", "comparison-move-high.png"]);

    // Mobile spot-check
    await runMobileEstimate(browser);
  } catch (e) {
    console.error("Walk error:", e);
  } finally {
    await browser.close();
    console.log(`\nDone. Screenshots in ${OUT}`);
  }
})();
