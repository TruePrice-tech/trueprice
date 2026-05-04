// Plumbing deep-test 2026-05-04 walk — exercises all 3 paths with real
// fixtures + mobile viewport against woogoro.com. Captures screenshots +
// rendered text per step for human review.
//
// Output: output/plumbing-deeptest-2026-05-04/<step>.png + .txt
//
// Run: node scripts/plumbing-deeptest-walk.js

const fs = require("fs");
const path = require("path");
const { launchHarnessBrowser, preparePage } = require("../test/lib/harness-browser");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const OUT_DIR = path.resolve(__dirname, "..", "output", "plumbing-deeptest-2026-05-04");
fs.mkdirSync(OUT_DIR, { recursive: true });

const FIXTURES_DIR = path.resolve(__dirname, "..");

async function snap(page, label) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const stem = `${ts}_${label}`;
  await page.screenshot({ path: path.join(OUT_DIR, `${stem}.png`), fullPage: true });
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT_DIR, `${stem}.txt`), text);
  console.log(`  → ${label}`);
}

async function setAddress(page, street, city, state, zip) {
  await page.evaluate((s, c, st, z) => {
    const el = document.getElementById.bind(document);
    el("addrStreet").value = s;
    el("addrCity").value = c;
    el("addrState").value = st;
    el("addrZip").value = z;
  }, street, city, state, zip);
}

async function walkEstimate(browser, label, opts) {
  console.log(`\n=== ESTIMATE: ${label} ===`);
  const page = await browser.newPage();
  await preparePage(page, BASE);
  await page.setViewport({ width: opts.viewport === "mobile" ? 390 : 1440, height: opts.viewport === "mobile" ? 844 : 900 });
  page.setDefaultTimeout(60000);

  // Stub geocode-suggest so autocomplete doesn't intercept clicks
  await page.evaluateOnNewDocument(() => {
    const _f = window.fetch;
    window.fetch = (url, init) => {
      if (typeof url === "string" && url.includes("/api/geocode-suggest")) {
        return Promise.resolve(new Response(JSON.stringify({ suggestions: [] }), { status: 200 }));
      }
      return _f(url, init);
    };
  });

  await page.goto(BASE + "/plumbing-estimate.html", { waitUntil: "networkidle2" });
  await snap(page, `${label}_01_landing`);

  await setAddress(page, opts.street, opts.city, opts.state, opts.zip);
  await page.click("#btnEstimate");
  await new Promise(r => setTimeout(r, 1500));
  await snap(page, `${label}_02_after_address`);

  // Click service-type tile (uses .plumb-option[data-val="..."])
  await page.evaluate((svc) => {
    const t = document.querySelector('.plumb-option[data-val="' + svc + '"]');
    if (t) t.click();
  }, opts.serviceType);
  await new Promise(r => setTimeout(r, 1200));
  await snap(page, `${label}_03_after_service`);

  // Advance past service step (Next button)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const next = btns.find(b => /^(next|continue)/i.test((b.innerText || "").trim()));
    if (next) next.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click sub-type tile
  if (opts.subType) {
    await page.evaluate((sub) => {
      const t = document.querySelector('.plumb-option[data-val="' + sub + '"]');
      if (t) t.click();
    }, opts.subType);
    await new Promise(r => setTimeout(r, 1200));
    await snap(page, `${label}_04_after_subtype`);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const next = btns.find(b => /^(next|continue)/i.test((b.innerText || "").trim()));
      if (next) next.click();
    });
    await new Promise(r => setTimeout(r, 1000));
  }

  // Try to advance / submit
  for (let i = 0; i < 6; i++) {
    const advanced = await page.evaluate(() => {
      const btn = document.querySelector("button.plumb-btn-primary, #estSubmit, button[data-cta]");
      if (btn && /next|continue|submit|estimate|calculate|see/i.test(btn.innerText || "")) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!advanced) break;
    await new Promise(r => setTimeout(r, 1200));
  }
  await snap(page, `${label}_05_final_result`);

  await page.close();
}

async function walkAnalyze(browser, label, fixturePath) {
  console.log(`\n=== ANALYZE: ${label} ===`);
  const page = await browser.newPage();
  await preparePage(page, BASE);
  await page.setViewport({ width: 1440, height: 900 });
  page.setDefaultTimeout(120000);

  await page.goto(BASE + "/plumbing-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  await snap(page, `analyze_${label}_01_landing`);

  const inp = await page.$('input[type="file"]');
  if (!inp) throw new Error("file input not found");
  await inp.uploadFile(path.join(FIXTURES_DIR, fixturePath));

  await page.waitForFunction(() => {
    return !!document.getElementById("confirmPriceBtn") ||
           !!document.getElementById("manualPriceBtn") ||
           !!document.getElementById("plumbHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  await snap(page, `analyze_${label}_02_pre_confirm`);

  const hasConfirm = await page.evaluate(() => !!document.getElementById("confirmPriceBtn"));
  if (hasConfirm) await page.click("#confirmPriceBtn");

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));
  await snap(page, `analyze_${label}_03_verdict`);

  await page.close();
}

(async () => {
  const browser = await launchHarnessBrowser();
  try {
    // PATH 1: Estimate — Lane's address (Fort Mill SC) — water_heater tank_50_gas
    await walkEstimate(browser, "estimate_wh_tank_sc", {
      street: "17064 Laurelmont Court",
      city: "Fort Mill",
      state: "SC",
      zip: "29707",
      serviceType: "water_heater",
      subType: "tank_50_gas",
    });

    // PATH 1b: Estimate — west region (CA) — tankless gas
    await walkEstimate(browser, "estimate_wh_tankless_ca", {
      street: "100 Main St",
      city: "Los Angeles",
      state: "CA",
      zip: "90043",
      serviceType: "water_heater",
      subType: "tankless_gas",
    });

    // PATH 1c: Estimate — repipe northeast (NY) — copper, mobile viewport
    await walkEstimate(browser, "estimate_repipe_ny_mobile", {
      street: "100 Madison Ave",
      city: "New York",
      state: "NY",
      zip: "10016",
      serviceType: "repipe",
      subType: "copper",
      viewport: "mobile",
    });

    // PATH 2: Analyze — clean tank fixture
    await walkAnalyze(browser, "f1_budget_tank", "test-quotes/plumbing-images/comparison-wh-01-low.png");

    // PATH 2b: Analyze — tankless premium fixture
    await walkAnalyze(browser, "f3_premier_tankless", "test-quotes/plumbing-images/comparison-wh-03-high.png");

    // PATH 2c: Analyze — indirect WH (page 1 of 3, no contractor)
    await walkAnalyze(browser, "f8_indirect", "test-quotes/plumbing-images/10-is-this-estimate-crazy-or-am-i.jpeg");

    // PATH 2d: Analyze — Roto-Rooter messy invoice
    await walkAnalyze(browser, "f7_rotorooter", "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg");

    console.log("\nWalk complete. Output:", OUT_DIR);
  } finally {
    await browser.close();
  }
})();
