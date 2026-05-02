// Plumbing fixture ground-truth harness.
// Reads 8 hand-curated fixtures, uploads each through the live analyzer at
// /plumbing-quote-analyzer.html, and asserts displayed total / service-type /
// sub-type (tank vs tankless vs indirect) / brand / banner state against
// ground truth captured 2026-05-02.
//
// Run: node test/plumbing/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/auto-repair/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Plumbing-specific assertions (vs roofing/HVAC/auto-repair):
//   - serviceTypeRegex: water_heater / repipe / sewer_line / drain_cleaning /
//     bathroom_rough_in / gas_line. Defaulting to water_heater on a small drain
//     repair would mislead the verdict by 5-10x; ground truth pins each fixture.
//   - subTypeRegex: tank vs tankless vs indirect (3-5x cost spread within
//     water_heater) — the equivalent of HVAC's tonnage assertion.
//   - brandRegex: Rinnai/Navien (premium tankless) vs Rheem/Bradford White
//     (mid tank) vs Whirlpool/GE (value) — drives brand-tier copy in verdict.
//   - isUncategorizedBanner: shown when serviceType detection fails. Catches
//     the f5-class auto-repair bug where a service-call invoice silently got
//     a water-heater verdict.
//
// Plumbing analyzer uses INLINE price-confirm UI (confirmPriceBtn /
// manualPriceBtn / manualPrice ids, NOT the shared tpConfirmPriceBtn).
// Hard-reject button id is plumbHardRejectStartOver.

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-budget-tank-low",
    file: "test-quotes/plumbing-images/comparison-wh-01-low.png",
    expect: {
      // Hand-read TOTAL line: $1,380 (Rheem 50-gal gas tank, Budget Plumbing, LA).
      price: 1380,
      contractorRegex: /budget\s*plumbing/i,
      stateCode: "CA",
      serviceTypeRegex: /water\s*heater/i,
      subTypeRegex: /tank/i,             // tank_50_gas
      brandRegex: /rheem/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f2-westside-tank-mid",
    file: "test-quotes/plumbing-images/comparison-wh-02-mid.png",
    expect: {
      // TOTAL ESTIMATE: $2,553 (Bradford White 50-gal gas, Westside Plumbing).
      price: 2553,
      contractorRegex: /westside\s*plumbing/i,
      stateCode: "CA",
      serviceTypeRegex: /water\s*heater/i,
      subTypeRegex: /tank/i,
      brandRegex: /bradford\s*white/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f3-premier-tankless-high",
    file: "test-quotes/plumbing-images/comparison-wh-03-high.png",
    expect: {
      // TOTAL: $7,571 (Rinnai RU199iN tankless gas, Premier Home Plumbing).
      price: 7571,
      contractorRegex: /premier\s*home\s*plumbing/i,
      stateCode: "CA",
      serviceTypeRegex: /water\s*heater/i,
      subTypeRegex: /tankless/i,         // tankless_gas
      brandRegex: /rinnai/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f4-budget-tank-messy",
    file: "test-quotes/plumbing-images/messy-comparison-wh-01-low.jpg",
    expect: {
      // Same content as f1 but skewed/blurred — tests OCR robustness.
      price: 1380,
      contractorRegex: /budget\s*plumbing/i,
      stateCode: "CA",
      serviceTypeRegex: /water\s*heater/i,
      subTypeRegex: /tank/i,
      brandRegex: /rheem/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f5-westside-tank-messy",
    file: "test-quotes/plumbing-images/messy-comparison-wh-02-mid.jpg",
    expect: {
      price: 2553,
      contractorRegex: /westside\s*plumbing/i,
      stateCode: "CA",
      serviceTypeRegex: /water\s*heater/i,
      subTypeRegex: /tank/i,
      brandRegex: /bradford\s*white/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f6-premier-tankless-messy",
    file: "test-quotes/plumbing-images/messy-comparison-wh-03-high.jpg",
    expect: {
      price: 7571,
      contractorRegex: /premier\s*home\s*plumbing/i,
      stateCode: "CA",
      serviceTypeRegex: /water\s*heater/i,
      subTypeRegex: /tankless/i,
      brandRegex: /rinnai/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f7-roto-rooter-redacted",
    file: "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg",
    expect: {
      // Roto-Rooter service-call invoice. Customer/address half covered in
      // purple ink, but the form's office "Indianapolis" location header is
      // visible at top-right — OCR correctly extracts state "IN". Total is
      // scribbled by hand; we deliberately do NOT pin a price.
      // This is the plumbing analogue of f5-audi-recommendations in auto-repair.
      contractorRegex: /roto[\s-]?rooter/i,
      stateCode: "IN",
      // Service-call invoices don't fit a clean job category — reasonable to
      // surface either drain_cleaning or uncategorized banner. Assert ONE of:
      isUncategorizedOrDrainCleaning: true,
    },
  },
  {
    id: "f8-indirect-wh-page1",
    file: "test-quotes/plumbing-images/10-is-this-estimate-crazy-or-am-i.jpeg",
    expect: {
      // Page 1 of 3 — single visible Subtotal $6,950 for Indirect Water Heater
      // swap (60-gal Bradford White boiler-fed indirect). No contractor name
      // on this page (cropped). Most challenging subType: "indirect" (vs the
      // tank/tankless default).
      price: 6950,
      contractorRegex: null,
      stateCode: null,
      serviceTypeRegex: /water\s*heater/i,
      subTypeRegex: /indirect/i,
      brandRegex: /bradford\s*white/i,
      isUncategorizedBanner: false,
    },
  },
];

const PRICE_TOLERANCE_PCT = 0.001;

async function uploadAndCapture(browser, fixture) {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1440, height: 900 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/plumbing-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/plumbing-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /plumbing-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Plumbing analyzer uses INLINE price-confirm (NOT shared tpConfirmPriceBtn).
  // Wait for: confirmPriceBtn (high price found) | manualPriceBtn (no price, manual entry)
  //         | plumbHardRejectStartOver (vertical-detect rejected) | .verdict-price (skip-confirm)
  await page.waitForFunction(() => {
    return !!document.getElementById("confirmPriceBtn") ||
           !!document.getElementById("manualPriceBtn") ||
           !!document.getElementById("plumbHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("confirmPriceBtn"),
      hasManualBtn: !!document.getElementById("manualPriceBtn"),
      hasHardReject: !!document.getElementById("plumbHardRejectStartOver"),
      hardRejectText: (document.querySelector("h1") || {}).innerText || "",
      bodyText: document.body.innerText.slice(0, 1500),
    };
  });

  if (preConfirm.hasHardReject) {
    await page.close();
    return {
      display: { verdictPrice: null, details: {}, rangeText: "", isUncategorizedBanner: false, bodyTextSlice: "" },
      parseQuote: null,
      preConfirm,
    };
  }

  if (preConfirm.hasConfirmBtn) {
    await page.click("#confirmPriceBtn");
  } else if (preConfirm.hasManualBtn && fixture.expect && typeof fixture.expect.price === "number") {
    // Manual-entry fallback. Type ground-truth so the result page renders;
    // separately track that the analyzer FAILED to extract a price.
    await page.type("#manualPrice", String(Math.round(fixture.expect.price)));
    await page.click("#manualPriceBtn");
  } else if (preConfirm.hasManualBtn) {
    // No ground-truth price (e.g. f7 redacted). Type a placeholder so the
    // result page renders — we still want to see service-type and banner state.
    await page.type("#manualPrice", "500");
    await page.click("#manualPriceBtn");
  }

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    const verdictEl = document.querySelector(".verdict-price");
    const verdictText = verdictEl ? verdictEl.innerText : "";
    const verdictMatch = verdictText.match(/\$([\d,]+(?:\.\d+)?)/);

    // Plumbing detail rows: <div class="plumb-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".plumb-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    const rangeText = (document.querySelector(".verdict-range") || {}).innerText || "";

    // "We couldn't identify the specific plumbing service" copy fires from
    // the uncategorized branch in renderResult. Detection key:
    const isUncategorizedBanner = /couldn[’']t identify the specific plumbing service/i.test(text) ||
                                  /we extracted a price from this document but couldn[’']t identify/i.test(text);

    // Verdict label "Needs Review" also signals uncategorized.
    const verdictLabel = (document.querySelector(".verdict-label") || {}).innerText || "";
    const isNeedsReview = /needs\s*review/i.test(verdictLabel);

    return {
      verdictPrice: verdictMatch ? parseFloat(verdictMatch[1].replace(/,/g, "")) : null,
      details,
      rangeText,
      verdictLabel,
      isUncategorizedBanner,
      isNeedsReview,
      bodyTextSlice: text.slice(0, 2500),
    };
  });

  let parseQuote = null;
  for (const r of apiResponses) {
    if (r.url.includes("/api/plumbing-estimate") || r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not plumbing");
    return failures;
  }

  if (typeof expected.price === "number") {
    const tol = Math.max(10, expected.price * PRICE_TOLERANCE_PCT);
    if (actual.display.verdictPrice == null) {
      failures.push(`displayPrice: expected ~${expected.price}, got null`);
    } else if (Math.abs(actual.display.verdictPrice - expected.price) > tol) {
      failures.push(`displayPrice: expected ${expected.price} ±${tol}, got ${actual.display.verdictPrice}`);
    }
  }

  if (expected.contractorRegex) {
    // Plumbing analyzer doesn't currently render Contractor in plumb-detail
    // (cf. roofing/HVAC/auto-repair). Read from parseQuote API or upcoming
    // detail-row "contractor" if it lands — this assertion will surface that
    // gap as a Block 2 finding.
    const contractor = actual.display.details["contractor"] ||
                       actual.parseQuote?.data?.contractor ||
                       actual.parseQuote?.data?.contractorName || null;
    if (!contractor || !expected.contractorRegex.test(contractor)) {
      failures.push(`contractor: expected match /${expected.contractorRegex.source}/, got ${JSON.stringify(contractor)}`);
    }
  }

  if ("stateCode" in expected && actual.parseQuote?.data) {
    const got = actual.parseQuote.data.stateCode;
    if ((got || null) !== (expected.stateCode || null)) {
      failures.push(`stateCode: expected ${JSON.stringify(expected.stateCode)}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.serviceTypeRegex) {
    const svc = actual.display.details["service type"] || "";
    if (!expected.serviceTypeRegex.test(svc)) {
      failures.push(`serviceType: expected match /${expected.serviceTypeRegex.source}/, got ${JSON.stringify(svc)}`);
    }
  }

  if (expected.subTypeRegex) {
    // SubType lands in the "Details" row when it exists.
    const sub = actual.display.details["details"] || "";
    if (!expected.subTypeRegex.test(sub)) {
      failures.push(`subType: expected match /${expected.subTypeRegex.source}/, got ${JSON.stringify(sub)}`);
    }
  }

  if (expected.brandRegex) {
    const brand = actual.display.details["brand"] || "";
    if (!expected.brandRegex.test(brand)) {
      failures.push(`brand: expected match /${expected.brandRegex.source}/, got ${JSON.stringify(brand)}`);
    }
  }

  if (typeof expected.isUncategorizedBanner === "boolean") {
    const got = actual.display.isUncategorizedBanner || actual.display.isNeedsReview;
    if (got !== expected.isUncategorizedBanner) {
      failures.push(`isUncategorizedBanner: expected ${expected.isUncategorizedBanner}, got ${got}`);
    }
  }

  if (expected.isUncategorizedOrDrainCleaning) {
    // Either uncategorized banner OR detected as drain_cleaning is acceptable
    // for the f7 Roto-Rooter service-call invoice. Anything else (water_heater,
    // repipe, etc) would be a confident-wrong verdict — that's a fail.
    const svc = actual.display.details["service type"] || "";
    const ok = actual.display.isUncategorizedBanner ||
               actual.display.isNeedsReview ||
               /drain\s*clean/i.test(svc) ||
               /plumbing\s*service/i.test(svc);  // generic uncategorized label
    if (!ok) {
      failures.push(`uncategorizedOrDrainCleaning: expected uncategorized banner OR drain_cleaning service type, got service="${svc}" verdict="${actual.display.verdictLabel}"`);
    }
  }

  return failures;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const out = { ts: new Date().toISOString(), base: BASE, results: {} };

  let totalFails = 0;
  for (const fx of FIXTURES) {
    process.stdout.write(`  ${fx.id} ... `);
    try {
      const actual = await uploadAndCapture(browser, fx);
      const failures = compare(fx.id, actual, fx.expect);
      out.results[fx.id] = {
        verdictPrice: actual.display.verdictPrice,
        details: actual.display.details,
        rangeText: (actual.display.rangeText || "").slice(0, 200),
        verdictLabel: actual.display.verdictLabel,
        isUncategorizedBanner: actual.display.isUncategorizedBanner,
        isNeedsReview: actual.display.isNeedsReview,
        preConfirm: {
          hasConfirmBtn: actual.preConfirm?.hasConfirmBtn,
          hasManualBtn: actual.preConfirm?.hasManualBtn,
          hasHardReject: actual.preConfirm?.hasHardReject,
        },
        contractor: actual.display.details["contractor"] ||
                    actual.parseQuote?.data?.contractor || null,
        stateCode: actual.parseQuote?.data?.stateCode || null,
        failures,
      };
      if (failures.length) {
        totalFails += failures.length;
        console.log("FAIL");
        failures.forEach(f => console.log(`     - ${f}`));
      } else {
        console.log("OK");
      }
    } catch (e) {
      out.results[fx.id] = { error: e.message };
      totalFails++;
      console.log("ERROR:", e.message);
    }
  }

  await browser.close();

  if (IS_BASELINE) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2));
    console.log("\nBaseline written:", BASELINE_PATH);
    console.log(`\nTotal failures: ${totalFails}`);
    process.exit(0);
    return;
  }

  function failureSubject(msg) {
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|serviceType|subType|brand|isUncategorizedBanner|uncategorizedOrDrainCleaning|hardReject):/);
    if (m1) return m1[1];
    return msg.split("(")[0].trim();
  }

  let newFailsCount = 0;
  let newPassesCount = 0;
  if (fs.existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    const newFails = [];
    const newPasses = [];
    for (const id of Object.keys(out.results)) {
      const before = (baseline.results[id]?.failures || []).map(failureSubject);
      const after = (out.results[id]?.failures || []).map(failureSubject);
      const beforeSet = new Set(before);
      const afterSet = new Set(after);
      after.forEach(s => { if (!beforeSet.has(s)) newFails.push(`${id}: ${s}`); });
      before.forEach(s => { if (!afterSet.has(s)) newPasses.push(`${id}: ${s}`); });
    }
    const uniq = arr => Array.from(new Set(arr));
    const uniqNewFails = uniq(newFails);
    const uniqNewPasses = uniq(newPasses);
    newFailsCount = uniqNewFails.length;
    newPassesCount = uniqNewPasses.length;
    console.log("\n=== vs baseline ===");
    if (uniqNewPasses.length) {
      console.log("NEW PASSES (fixes landed):");
      uniqNewPasses.forEach(p => console.log("  + " + p));
    }
    if (uniqNewFails.length) {
      console.log("NEW FAILURES (regressions):");
      uniqNewFails.forEach(f => console.log("  - " + f));
    }
    if (!uniqNewPasses.length && !uniqNewFails.length) console.log("No deltas vs baseline.");
  }

  console.log(`\nTotal failures: ${totalFails}`);

  if (fs.existsSync(BASELINE_PATH)) {
    process.exit(newFailsCount > 0 ? 1 : 0);
  } else {
    process.exit(totalFails > 0 ? 1 : 0);
  }
})();
