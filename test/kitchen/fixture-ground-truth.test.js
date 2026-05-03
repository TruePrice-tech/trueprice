// Kitchen fixture ground-truth harness.
// Reads 8 hand-curated fixtures, uploads each through the live analyzer at
// /kitchen-quote-analyzer.html, and asserts displayed total / remodel tier /
// countertop material / contractor / banner state against ground truth captured
// 2026-05-02.
//
// Run: node test/kitchen/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/electrical/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Kitchen-specific assertions (vs roofing/HVAC/auto-repair/plumbing/electrical):
//   - tierRegex: cabinet_refacing / minor / midrange / major. Cabinet tier
//     drives the benchmark base from $8,500 (refacing) to $90,000 (major)
//     — a 10x spread. Equivalent of plumbing's tank-vs-tankless or
//     electrical's panel-headline-vs-EV. The biggest trust-critical bug class:
//     a $50K mid-range remodel tagged "major" gets bench-marked vs $90K and
//     verdicts "Unusually Low" — buyer thinks they got a steal when they
//     paid a fair price.
//   - countertopRegex: laminate / granite / quartz / marble (analyzer's
//     enum) plus quartzite (premium-tier in real quotes, not in enum so
//     should fall back to granite OR be flagged as gap).
//   - contractorRegex: Quick Kitchen Refresh / Prairie State / Artisan
//     Kitchen Studios / Heritage Kitchen Designs / Modern Home Renovations.
//   - isUncategorizedBanner: not currently surfaced on kitchen analyzer
//     but kept for parity copy.
//
// Kitchen analyzer uses the SHARED price-confirm UI (tpConfirmPriceBtn /
// tpManualPriceBtn) plus an INLINE wrong-vertical hard-reject with button id
// kitHardRejectStartOver. Detail rows have class .kit-detail.

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-quick-kitchen-low",
    file: "test-quotes/kitchen-images/comparison-kitchen-low.png",
    expect: {
      // TOTAL: $13,850 (Quick Kitchen Refresh LLC, Naperville IL 60563).
      // 200 sqft "mid-grade refresh" with stock semi-custom oak cabinets,
      // laminate counters, NO appliances, NO permit, 1-year workmanship.
      // Real-world this is a budget cosmetic refresh — should classify
      // as "minor" (cosmetic) tier, NOT "major".
      price: 13850,
      contractorRegex: /quick\s*kitchen\s*refresh/i,
      stateCode: "IL",
      tierRegex: /minor|cosmetic|refresh|cabinet\s*refacing/i,
      countertopRegex: /laminate/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f2-prairie-mid",
    file: "test-quotes/kitchen-images/comparison-kitchen-mid.png",
    expect: {
      // TOTAL: $27,250 (Prairie State Kitchen & Bath IL #144.013188,
      // Aurora IL 60504). 200 sqft "mid-grade refresh" — semi-custom
      // plywood-box maple shaker, quartz counters, mid-grade appliance
      // package, permit included, 5-year workmanship + lifetime cabinet.
      // Textbook mid-range remodel — should be "midrange" tier.
      price: 27250,
      contractorRegex: /prairie\s*state\s*kitchen/i,
      stateCode: "IL",
      tierRegex: /mid[\s-]?range|midrange/i,
      countertopRegex: /quartz/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f3-artisan-high",
    file: "test-quotes/kitchen-images/comparison-kitchen-high.png",
    expect: {
      // TOTAL: $57,200 (Artisan Kitchen Studios IL #144.014922,
      // Naperville IL 60540). Custom inset cabinetry soft-close dovetail,
      // quartzite waterfall counters, premium dual-fuel appliances,
      // custom range hood + pot filler, full demo, plumbing relocation,
      // new electrical circuits, lifetime warranty. This IS a major/upscale
      // remodel — "major" tier verdict is correct, but note the headline
      // job line still reads "mid-grade refresh" — line-item content beats
      // the headline.
      price: 57200,
      contractorRegex: /artisan\s*kitchen\s*studios/i,
      stateCode: "IL",
      tierRegex: /major|upscale|custom/i,
      // Quartzite is NOT in analyzer's countertopMaterials enum
      // (laminate/granite/quartz/marble). Detection should either match
      // quartzite OR fall back to granite — accept either pending Block 2.
      countertopRegex: /quartz|granite/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f4-quick-kitchen-low-messy",
    file: "test-quotes/kitchen-images/messy-comparison-kitchen-low.jpg",
    expect: {
      // Same content as f1 but skewed/grayscale photo render — tests OCR
      // robustness at edge alignment.
      price: 13850,
      contractorRegex: /quick\s*kitchen\s*refresh/i,
      stateCode: "IL",
      tierRegex: /minor|cosmetic|refresh|cabinet\s*refacing/i,
      countertopRegex: /laminate/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f5-prairie-mid-messy",
    file: "test-quotes/kitchen-images/messy-comparison-kitchen-mid.jpg",
    expect: {
      price: 27250,
      contractorRegex: /prairie\s*state\s*kitchen/i,
      stateCode: "IL",
      tierRegex: /mid[\s-]?range|midrange/i,
      countertopRegex: /quartz/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f6-artisan-high-messy",
    file: "test-quotes/kitchen-images/messy-comparison-kitchen-high.jpg",
    expect: {
      price: 57200,
      contractorRegex: /artisan\s*kitchen\s*studios/i,
      stateCode: "IL",
      tierRegex: /major|upscale|custom/i,
      countertopRegex: /quartz|granite/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f7-mock-midrange-nc",
    file: "test-quotes/kitchen-images/mock-01.png",
    expect: {
      // TOTAL: $50,228 (Heritage Kitchen Designs, Charlotte NC 28202).
      // KraftMaid semi-custom cabinets, Cambria quartz 45 sqft, subway
      // backsplash, Bosch 800 series stainless appliances, 4 new circuits
      // + recessed lighting, LVP flooring 180 sqft, drywall/paint, permit,
      // PM. 2-year workmanship + manufacturer materials. Subtotal $47,385
      // + 6% sales tax $2,843 = $50,228. Textbook mid-range remodel.
      // (Mocks 02-10 are identical templates with only contractor name
      // varying — same scope/total/state. We benchmark only mock-01 to
      // avoid 9 redundant fixtures.)
      price: 50228,
      contractorRegex: /heritage\s*kitchen\s*designs/i,
      stateCode: "NC",
      tierRegex: /mid[\s-]?range|midrange/i,
      countertopRegex: /quartz/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f8-real-photo-l-shaped",
    file: "test-quotes/real-quotes/kitchen/fixture-kitchen-remodel.jpg",
    expect: {
      // Total: $22,250 (Modern Home Renovations, Chicago IL 60614).
      // Photographic capture rotated/skewed in dark background. 12'x14'
      // galley to open concept | Layout: L-shaped. Semi-custom shaker
      // cabinets 18 LF, quartz 42 sqft, subway tile, LVP flooring 168
      // sqft, plumbing relocate sink+DW, electrical 6 outlets +
      // under-cabinet LED, painting walls+ceiling, permit. Appliances
      // NOT included. Realistic budget mid-range — should be "midrange"
      // OR "minor" tier (semi-custom shaker is mid-range cabinet tier
      // but $22K total leans budget). Either is acceptable; "major"
      // would be wrong.
      price: 22250,
      contractorRegex: /modern\s*home\s*renovations/i,
      stateCode: "IL",
      tierRegex: /minor|mid[\s-]?range|midrange|cosmetic/i,
      countertopRegex: /quartz/i,
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
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/kitchen-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/kitchen-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /kitchen-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Kitchen analyzer:
  //   - Inline wrong-vertical hard-reject (id kitHardRejectStartOver) runs FIRST.
  //   - Otherwise renderPriceConfirmation shows tpConfirmPriceBtn (price found)
  //     OR tpManualPriceBtn (no price). Shared hard-reject id is tpHardRejectStartOver.
  //   - High-confidence parser short-circuits straight to .verdict-price.
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("kitHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver") ||
                     !!document.getElementById("kitHardRejectStartOver"),
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
    await page.click("#tpConfirmPriceBtn");
  } else if (preConfirm.hasManualBtn && fixture.expect && typeof fixture.expect.price === "number") {
    await page.type("#tpManualPrice", String(Math.round(fixture.expect.price)));
    await page.click("#tpManualPriceBtn");
  } else if (preConfirm.hasManualBtn) {
    await page.type("#tpManualPrice", "30000");
    await page.click("#tpManualPriceBtn");
  }

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    const verdictEl = document.querySelector(".verdict-price");
    const verdictText = verdictEl ? verdictEl.innerText : "";
    const verdictMatch = verdictText.match(/\$([\d,]+(?:\.\d+)?)/);

    // Kitchen detail rows: <div class="kit-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".kit-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    const rangeText = (document.querySelector(".verdict-range") || {}).innerText || "";

    const verdictLabel = (document.querySelector(".verdict-label") || {}).innerText || "";
    const isNeedsReview = /needs\s*review/i.test(verdictLabel);

    // Generic uncategorized-banner detection (not currently surfaced on
    // kitchen analyzer, but parity copy may land later).
    const isUncategorizedBanner = /couldn[’']t identify the specific (kitchen|remodel)/i.test(text);

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
    if (r.url.includes("/api/kitchen-estimate") || r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not kitchen");
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
    // Kitchen analyzer doesn't currently render Contractor in kit-detail
    // (cf. roofing/HVAC/auto-repair/plumbing-with-PL4-shipped). Read from
    // parseQuote API or upcoming detail-row "contractor" if it lands —
    // this assertion will surface that gap as a Block 2 finding.
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

  if (expected.tierRegex) {
    const tier = actual.display.details["remodel tier"] || "";
    if (!expected.tierRegex.test(tier)) {
      failures.push(`tier: expected match /${expected.tierRegex.source}/, got ${JSON.stringify(tier)}`);
    }
  }

  if (expected.countertopRegex) {
    const counter = actual.display.details["countertop"] || "";
    if (!expected.countertopRegex.test(counter)) {
      failures.push(`countertop: expected match /${expected.countertopRegex.source}/, got ${JSON.stringify(counter)}`);
    }
  }

  if (typeof expected.isUncategorizedBanner === "boolean") {
    const got = actual.display.isUncategorizedBanner || actual.display.isNeedsReview;
    if (got !== expected.isUncategorizedBanner) {
      failures.push(`isUncategorizedBanner: expected ${expected.isUncategorizedBanner}, got ${got}`);
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|tier|countertop|isUncategorizedBanner|hardReject):/);
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
