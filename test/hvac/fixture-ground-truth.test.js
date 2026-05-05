// HVAC fixture ground-truth harness.
// Reads the 7 hand-curated fixtures, uploads each through the live analyzer,
// and asserts displayed total / contractor / state / brand / tonnage / SEER /
// warranty vs. ground truth captured by Lane in 2026-05-02.
//
// Run: node test/hvac/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/roofing/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

// [HARNESS-COVERAGE] 2026-05-05 round 3: assertions extended to include
// verdictMatches (label regex), pricingMatches (PRICING-row regex), and
// benchInBand ({low, high} bounds). Round 1's HVAC-CALC-2 bug (analyzer on
// 2019-era inline pricing producing $8,350 bench on a 22-SEER2 Trane that
// should be ~$13.5k) hid behind price/contractor/SEER assertions that
// passed with the wrong bench. Adding these three so the next analyzer
// drift fails CI before it reaches a user.
const FIXTURES = [
  {
    id: "f1-clean-invoice",
    file: "test/receipt/ocr-cache/fixtures/hvac-clean-invoice.jpeg",
    expect: {
      price: 610.0,
      contractorRegex: null,
      stateCode: null,
      isServiceJob: true,
      refrigerantContains: "R-22",
      verdictMatches: /service quote/i,
      pricingMatches: /south\s+regional\s+pricing/i,
      benchInBand: { low: 0, high: 0 },     // service: bench is zeroed
    },
  },
  {
    id: "f2-coil-quote",
    file: "test/receipt/ocr-cache/fixtures/hvac-coil-quote.jpeg",
    expect: {
      price: 3810.0,
      contractorRegex: null,
      stateCode: null,
      isServiceJob: true,
      verdictMatches: /service quote/i,
      pricingMatches: /south\s+regional\s+pricing/i,
      benchInBand: { low: 0, high: 0 },
    },
  },
  {
    id: "f3-arctic-low",
    file: "test-quotes/hvac-images/comparison-ac-01-low.png",
    expect: {
      price: 3456,
      contractorRegex: /arctic\s*air/i,
      stateCode: "GA",
      brandRegex: /goodman/i,
      tonnage: 3,
      seer: 14.3,
      warrantyParts: 10,
      warrantyLabor: 1,
      isServiceJob: false,
      verdictMatches: /below average|unusually low/i,
      pricingMatches: /(atlanta\s+local|southeast\s+regional)\s+pricing/i,
      // 14.3 SEER2 3-ton Atlanta GA — band aligns with calc-spot-check
      // ac-3ton-14seer-ga ($5500-$9000) plus city-mult headroom.
      benchInBand: { low: 5000, high: 10000 },
    },
  },
  {
    id: "f4-precision-mid",
    file: "test-quotes/hvac-images/comparison-ac-02-mid.png",
    expect: {
      price: 6620,
      contractorRegex: /precision\s*climate/i,
      stateCode: "GA",
      brandRegex: /carrier/i,
      tonnage: 3,
      seer: 16,
      warrantyParts: 10,
      warrantyLabor: 2,
      isServiceJob: false,
      verdictMatches: /(fair price|below average|above average)/i,
      pricingMatches: /(atlanta\s+local|southeast\s+regional)\s+pricing/i,
      // 16 SEER2 3-ton Atlanta — base $7800 × southeast 1.03 + seasonal.
      benchInBand: { low: 7000, high: 11000 },
    },
  },
  {
    id: "f5-elite-high",
    file: "test-quotes/hvac-images/comparison-ac-03-high.png",
    expect: {
      price: 13457,
      contractorRegex: /elite\s*comfort/i,
      stateCode: "GA",
      brandRegex: /trane/i,
      tonnage: 3,
      seer: 22,
      warrantyParts: 12,
      warrantyLabor: 5,
      isServiceJob: false,
      // [HVAC-CALC-2] guard: 2019 inline pricing yielded "$8,650 — 56%
      // above" / OVERPRICED here. Post-fix bench should be ~$13.6k and
      // verdict FAIR. If the analyzer ever drifts back, this asserts.
      verdictMatches: /fair price/i,
      pricingMatches: /(atlanta\s+local|southeast\s+regional)\s+pricing/i,
      benchInBand: { low: 11500, high: 16500 },
    },
  },
  {
    id: "f6-mini-split",
    file: "test-quotes/hvac-images/10-8k-for-mitsubishi-mini-split-leak-detection-just-t.png",
    expect: {
      price: 7943.56,
      contractorRegex: null,
      stateCode: null,
      isServiceJob: true,
      verdictMatches: /service quote/i,
      pricingMatches: /south\s+regional\s+pricing/i,
      benchInBand: { low: 0, high: 0 },
    },
  },
  {
    id: "f7-heat-pump-table",
    file: "test-quotes/hvac-images/09-every-quote-10-total-ive-gotten-for-a-heat-pump-in.png",
    expect: {
      lowConfidenceOrTableDetected: true,
      verdictMatches: /needs review/i,
      pricingMatches: /south\s+regional\s+pricing/i,
      benchInBand: { low: 0, high: 0 },     // bench zeroed on low-conf
    },
  },
];

const PRICE_TOLERANCE_PCT = 0.001;

async function uploadAndCapture(browser, fixture) {
  const page = await browser.newPage();
  await preparePage(page, BASE);
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1440, height: 900 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/hvac-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Wait for price-confirmation step OR low-confidence manual-entry OR hard-reject screen.
  const confirmStep = await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.querySelector(".verdict-price"); // skip-confirm path (high conf)
  }, { timeout: 90000 }).catch(() => null);

  // Capture pre-confirm UI snapshot before we click through (used for hard-reject + UX checks).
  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver"),
      hardRejectText: (document.querySelector("h1") || {}).innerText || "",
      bodyText: document.body.innerText.slice(0, 1500),
    };
  });

  // If price-confirm modal showed, click "Yes, analyze this price" to advance.
  if (preConfirm.hasConfirmBtn) {
    await page.click("#tpConfirmPriceBtn");
  } else if (preConfirm.hasManualBtn && fixture.expect && typeof fixture.expect.price === "number") {
    // Manual-entry fallback: type the ground-truth price so we can still observe
    // how the rest of the result page renders. (We separately track that the
    // analyzer FAILED to extract a price — that's an analyze-quality finding.)
    await page.type("#tpManualPrice", String(Math.round(fixture.expect.price)));
    await page.click("#tpManualPriceBtn");
  }

  // Wait for result render OR confirm modal stays (some fixtures may bail).
  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    const verdictEl = document.querySelector(".verdict-price");
    const verdictText = verdictEl ? verdictEl.innerText : "";
    const verdictMatch = verdictText.match(/\$([\d,]+(?:\.\d+)?)/);

    // [HARNESS-COVERAGE] verdict label lives in .verdict-label
    // ("Fair Price" / "Service Quote" / "Needs Review" / etc).
    const verdictLabelEl = document.querySelector(".verdict-label");
    const verdictLabel = verdictLabelEl ? verdictLabelEl.innerText.trim() : "";

    const details = {};
    document.querySelectorAll(".hvac-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim()] = value.trim();
    });

    const rangeText = (document.querySelector(".verdict-range") || {}).innerText || "";
    const isServiceJobCopy = /Service quote|Repair quote|Maintenance quote/i.test(rangeText);
    const isLowConfidenceCopy = /couldn't extract enough/i.test(rangeText);

    // [HARNESS-COVERAGE] parse bench dollar from rangeText
    // "Market benchmark: $13,600 — 1% below average".
    const benchMatch = rangeText.match(/Market benchmark:\s*\$([\d,]+(?:\.\d+)?)/i);
    const benchDollar = benchMatch ? parseFloat(benchMatch[1].replace(/,/g, "")) : 0;

    const detailsLc = {};
    Object.keys(details).forEach(k => { detailsLc[k.toLowerCase()] = details[k]; });

    return {
      verdictPrice: verdictMatch ? parseFloat(verdictMatch[1].replace(/,/g, "")) : null,
      verdictLabel,
      benchDollar,
      details: detailsLc,
      rangeText,
      isServiceJobCopy,
      isLowConfidenceCopy,
      bodyTextSlice: text.slice(0, 2500),
    };
  });

  let parseQuote = null;
  for (const r of apiResponses) {
    if (r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (typeof expected.price === "number") {
    const tol = Math.max(10, expected.price * PRICE_TOLERANCE_PCT);
    if (actual.display.verdictPrice == null) {
      failures.push(`displayPrice: expected ~${expected.price}, got null`);
    } else if (Math.abs(actual.display.verdictPrice - expected.price) > tol) {
      failures.push(`displayPrice: expected ${expected.price} ±${tol}, got ${actual.display.verdictPrice}`);
    }
  }

  if (expected.contractorRegex) {
    const contractor = actual.display.details["contractor"] || actual.parseQuote?.data?.contractor || actual.parseQuote?.data?.contractorName || null;
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

  if (expected.brandRegex) {
    const brand = actual.display.details["brand"] || actual.parseQuote?.data?.brand || "";
    if (!expected.brandRegex.test(brand)) {
      failures.push(`brand: expected match /${expected.brandRegex.source}/, got ${JSON.stringify(brand)}`);
    }
  }

  if (typeof expected.tonnage === "number") {
    const tonText = actual.display.details["system size"] || "";
    const m = tonText.match(/(\d+(?:\.\d+)?)/);
    const got = m ? parseFloat(m[1]) : null;
    if (got !== expected.tonnage) {
      failures.push(`tonnage: expected ${expected.tonnage}, got ${JSON.stringify(tonText)}`);
    }
  }

  if (typeof expected.seer === "number") {
    const seerText = actual.display.details["seer rating"] || "";
    const m = seerText.match(/(\d+(?:\.\d+)?)/);
    const got = m ? parseFloat(m[1]) : null;
    if (got !== expected.seer) {
      failures.push(`seer: expected ${expected.seer}, got ${JSON.stringify(seerText)}`);
    }
  }

  if (typeof expected.warrantyParts === "number") {
    const wp = actual.display.details["parts warranty"] || "";
    const m = wp.match(/(\d+)/);
    const got = m ? parseInt(m[1]) : null;
    if (got !== expected.warrantyParts) {
      failures.push(`warrantyParts: expected ${expected.warrantyParts}, got ${JSON.stringify(wp)}`);
    }
  }

  if (typeof expected.warrantyLabor === "number") {
    const wl = actual.display.details["labor warranty"] || "";
    const m = wl.match(/(\d+)/);
    const got = m ? parseInt(m[1]) : null;
    if (got !== expected.warrantyLabor) {
      failures.push(`warrantyLabor: expected ${expected.warrantyLabor}, got ${JSON.stringify(wl)}`);
    }
  }

  if (typeof expected.isServiceJob === "boolean") {
    if (actual.display.isServiceJobCopy !== expected.isServiceJob) {
      failures.push(`isServiceJob: expected ${expected.isServiceJob}, got ${actual.display.isServiceJobCopy} (range: "${(actual.display.rangeText || '').slice(0, 80)}")`);
    }
  }

  if (expected.refrigerantContains) {
    const rt = actual.display.details["refrigerant"] || actual.parseQuote?.data?.refrigerantType || "";
    if (!String(rt).toUpperCase().includes(expected.refrigerantContains.toUpperCase())) {
      failures.push(`refrigerant: expected to contain ${expected.refrigerantContains}, got ${JSON.stringify(rt)}`);
    }
  }

  if (expected.lowConfidenceOrTableDetected) {
    if (!actual.display.isLowConfidenceCopy) {
      failures.push(`lowConfidence: expected low-confidence copy on a comparison-table fixture, got rangeText="${(actual.display.rangeText || '').slice(0, 100)}"`);
    }
  }

  // [HARNESS-COVERAGE] verdict label assertion. Catches HVAC-CALC-2-class
  // bench drift that flips a FAIR PRICE verdict to OVERPRICED (or vice
  // versa) without the price assertion noticing.
  if (expected.verdictMatches) {
    const got = actual.display.verdictLabel || "";
    if (!expected.verdictMatches.test(got)) {
      failures.push(`verdictLabel: expected match /${expected.verdictMatches.source}/, got ${JSON.stringify(got)}`);
    }
  }

  // [HARNESS-COVERAGE] pricing-row label assertion. Catches HVAC-DT-2-class
  // city false-positives ("Quad Breaker local pricing") and the parser
  // race that swapped "Atlanta local" for "Southeast regional".
  if (expected.pricingMatches) {
    const got = actual.display.details["pricing"] || "";
    if (!expected.pricingMatches.test(got)) {
      failures.push(`pricingLabel: expected match /${expected.pricingMatches.source}/, got ${JSON.stringify(got)}`);
    }
  }

  // [HARNESS-COVERAGE] bench-in-band assertion. Catches inline-pricing
  // drift like the 2019 HVAC_PRICING table that was producing $8,350 bench
  // on a 22-SEER2 Trane that should be ~$13.5k. Service / low-confidence
  // fixtures use {low:0, high:0} since their bench is zeroed by design.
  if (expected.benchInBand) {
    const got = Number(actual.display.benchDollar) || 0;
    const lo = expected.benchInBand.low;
    const hi = expected.benchInBand.high;
    if (lo === 0 && hi === 0) {
      if (got !== 0) {
        failures.push(`benchInBand: expected zero bench (service/low-conf fixture), got $${got}`);
      }
    } else if (got < lo || got > hi) {
      failures.push(`benchInBand: expected $${lo}-$${hi}, got $${got}`);
    }
  }

  return failures;
}

(async () => {
  const browser = await launchHarnessBrowser();
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
        isServiceJobCopy: actual.display.isServiceJobCopy,
        isLowConfidenceCopy: actual.display.isLowConfidenceCopy,
        preConfirm: {
          hasConfirmBtn: actual.preConfirm?.hasConfirmBtn,
          hasManualBtn: actual.preConfirm?.hasManualBtn,
          hasHardReject: actual.preConfirm?.hasHardReject,
        },
        contractor: actual.display.details["contractor"] || actual.parseQuote?.data?.contractor || null,
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|brand|tonnage|seer|warrantyParts|warrantyLabor|isServiceJob|refrigerant|lowConfidence):/);
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
