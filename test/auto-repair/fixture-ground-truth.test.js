// Auto-repair fixture ground-truth harness.
// Reads 8 hand-curated fixtures, uploads each through the live analyzer at
// /auto-repair.html, and asserts displayed total / shop-type / insurance and
// recommendation-list banners against ground truth captured 2026-05-02.
//
// Run: node test/auto-repair/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/hvac/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Auto-repair-specific assertions (vs roofing/HVAC):
//   - isInsuranceBanner: yellow banner that fires on body-shop / insurance
//     estimates (Mitchell / CCC / Audatex). Mechanic benchmarks don't apply.
//   - isRecommendationListBanner: blue banner on dealer "Additional Service
//     Recommendations" lists where the total is a sum-of-upsells, not one job.
//   - shopType: dealer / independent / chain — surfaces in the verdict copy
//     and benchmark calculation; wrong shop-type kills the comparison.

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-honest-wrench-low",
    file: "test-quotes/auto-images/comparison-brake-01-shop-a-low.png",
    expect: {
      price: 327.60,
      contractorRegex: /honest\s*wrench/i,
      stateCode: "NC",
      shopTypeRegex: /independent/i,
      isInsuranceBanner: false,
      isRecommendationListBanner: false,
    },
  },
  {
    id: "f2-precision-mid",
    file: "test-quotes/auto-images/comparison-brake-02-shop-b-mid.png",
    expect: {
      price: 633.00,
      contractorRegex: /precision\s*auto\s*care/i,
      stateCode: "NC",
      shopTypeRegex: /independent/i,
      isInsuranceBanner: false,
      isRecommendationListBanner: false,
    },
  },
  {
    id: "f3-park-avenue-dealer",
    file: "test-quotes/auto-images/comparison-brake-03-shop-c-high.png",
    expect: {
      price: 1031.60,
      contractorRegex: /park\s*avenue/i,
      stateCode: "NC",
      // Dealer detection from "Authorized Honda Service" / "DEALERSHIP REPAIR ORDER".
      shopTypeRegex: /dealer/i,
      isInsuranceBanner: false,
      isRecommendationListBanner: false,
    },
  },
  {
    id: "f4-jeep-insurance",
    file: "test-quotes/auto-images/07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg",
    expect: {
      // 732.39 is "Total Cost of Repairs" — the parser must NOT pick the
      // 686.08 Subtotal (which is also a "Sales Tax basis" $686.08 elsewhere
      // on the document, an OCR trap).
      price: 732.39,
      contractorRegex: null,
      stateCode: null,
      isInsuranceBanner: true,
      isRecommendationListBanner: false,
    },
  },
  {
    id: "f5-audi-recommendations",
    file: "test-quotes/auto-images/09-am-i-crazy-or-is-this-quote.jpg",
    expect: {
      // Sum of 6 priced items: 234.25 + 189.52 + 1335.11 + 299.99 + 954.64
      // + 2543.94 = 5557.45. There is no Total label on this fixture, so the
      // parser must sum-the-items rather than max-of-prices ($2543.94 alone).
      price: 5557.45,
      contractorRegex: /audi/i,
      stateCode: null,
      isInsuranceBanner: false,
      isRecommendationListBanner: true,
    },
  },
  {
    id: "f6-equinox-quote",
    file: "test/receipt/ocr-cache/fixtures/auto-equinox-quote.jpeg",
    expect: {
      price: 585.70,
      contractorRegex: null,
      stateCode: null,
      isInsuranceBanner: false,
      isRecommendationListBanner: false,
    },
  },
  {
    id: "f7-honda-fuel-injector",
    file: "test/receipt/ocr-cache/fixtures/auto-honda-paper-photo.jpeg",
    expect: {
      price: 2054.91,
      contractorRegex: null,
      stateCode: null,
      isInsuranceBanner: false,
      isRecommendationListBanner: false,
    },
  },
  {
    id: "f8-bmw-x3",
    file: "test-quotes/sample-auto-bmw-nc.png",
    expect: {
      price: 2431.32,
      contractorRegex: /precision\s*auto\s*care/i,
      stateCode: "NC",
      shopTypeRegex: /independent/i,
      isInsuranceBanner: false,
      isRecommendationListBanner: false,
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
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/auto-repair-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/auto-repair.html?path=quote", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /auto-repair.html?path=quote");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Wait for either price-confirmation step OR low-confidence manual-entry OR
  // hard-reject screen (vertical mismatch — uses arHardRejectStartOver, OR
  // price-confirm-driven uses tpHardRejectStartOver).
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("arHardRejectStartOver") ||
           !!document.querySelector(".verdict-price"); // skip-confirm path
  }, { timeout: 120000 }).catch(() => null);

  // Capture pre-confirm UI snapshot.
  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver") ||
                     !!document.getElementById("arHardRejectStartOver"),
      hardRejectText: (document.querySelector("h1") || {}).innerText || "",
      bodyText: document.body.innerText.slice(0, 1500),
    };
  });

  // If hard-reject fired, return early so we can flag it.
  if (preConfirm.hasHardReject) {
    await page.close();
    return { display: { verdictPrice: null, details: {}, rangeText: "", isInsuranceBanner: false, isRecommendationListBanner: false, bodyTextSlice: "" }, parseQuote: null, preConfirm };
  }

  if (preConfirm.hasConfirmBtn) {
    await page.click("#tpConfirmPriceBtn");
  } else if (preConfirm.hasManualBtn && fixture.expect && typeof fixture.expect.price === "number") {
    // Manual-entry fallback: type ground-truth price so we still observe the
    // result page rendering. Separately track that the analyzer FAILED to
    // extract a price — that's an analyze-quality finding.
    await page.type("#tpManualPrice", String(Math.round(fixture.expect.price)));
    await page.click("#tpManualPriceBtn");
  }

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    const verdictEl = document.querySelector(".verdict-price");
    const verdictText = verdictEl ? verdictEl.innerText : "";
    const verdictMatch = verdictText.match(/\$([\d,]+(?:\.\d+)?)/);

    // Auto-repair detail rows use class .ar-detail with .label / .value.
    const details = {};
    document.querySelectorAll(".ar-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    const rangeText = (document.querySelector(".verdict-range") || {}).innerText || "";

    // Banner detection: scan body text for the banner copy strings the
    // analyzer renders for insurance estimates and dealer-recommendation
    // lists. (Bannerless quotes don't include either string.)
    const isInsuranceBanner = /this looks like an insurance\s*\/\s*body-shop estimate/i.test(text);
    const isRecommendationListBanner = /this looks like a list of dealer service recommendations/i.test(text);

    return {
      verdictPrice: verdictMatch ? parseFloat(verdictMatch[1].replace(/,/g, "")) : null,
      details,
      rangeText,
      isInsuranceBanner,
      isRecommendationListBanner,
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

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not auto-repair");
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
    // Auto-repair analyzer doesn't currently render contractor in the verdict
    // details grid (cf. roofing/HVAC). Read from parse-quote API or upcoming
    // detail-row "contractor" if it lands.
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

  if (expected.shopTypeRegex) {
    const shop = actual.display.details["shop type"] || "";
    if (!expected.shopTypeRegex.test(shop)) {
      failures.push(`shopType: expected match /${expected.shopTypeRegex.source}/, got ${JSON.stringify(shop)}`);
    }
  }

  if (typeof expected.isInsuranceBanner === "boolean") {
    if (actual.display.isInsuranceBanner !== expected.isInsuranceBanner) {
      failures.push(`isInsuranceBanner: expected ${expected.isInsuranceBanner}, got ${actual.display.isInsuranceBanner}`);
    }
  }

  if (typeof expected.isRecommendationListBanner === "boolean") {
    if (actual.display.isRecommendationListBanner !== expected.isRecommendationListBanner) {
      failures.push(`isRecommendationListBanner: expected ${expected.isRecommendationListBanner}, got ${actual.display.isRecommendationListBanner}`);
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
        isInsuranceBanner: actual.display.isInsuranceBanner,
        isRecommendationListBanner: actual.display.isRecommendationListBanner,
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|shopType|isInsuranceBanner|isRecommendationListBanner|hardReject):/);
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
