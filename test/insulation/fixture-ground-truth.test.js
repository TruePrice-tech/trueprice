// Insulation fixture ground-truth harness.
// Reads 7 hand-curated fixtures, uploads each through the live analyzer at
// /insulation-quote-analyzer.html, and asserts displayed total / insulation
// type / R-value / area / location / scope checklist + API-side contractor /
// stateCode / rValue against ground truth captured 2026-05-03.
//
// Run: node test/insulation/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/foundation/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Insulation-specific assertions (vs foundation/kitchen/electrical):
//   - insTypeRegex: blown_in (cellulose or fiberglass) / spray_foam_open /
//     spray_foam_closed / batts / rigid_foam / mixed. The cost spread is 4x
//     between blown cellulose ($1.20/sf) and closed-cell spray foam ($4-7/sf),
//     so getting the type wrong causes visibly bad verdicts.
//   - rValue: parsed from text (R-19 / R-30 / R-49 / R-60). Display row exists.
//     Critical for buyer to see whether they're getting code-min (R-30 warm)
//     vs max efficiency (R-49/60).
//   - areaSqFt: parsed from text. Default benchmark uses 1500 sq ft when not
//     detected — fixtures all happen to be 1500 sf so this won't fail here,
//     but stub coverage in case future fixtures have different sf.
//   - scopeExcluded (TRUST-CRITICAL): f3 quote text says "Air sealing NOT
//     included." and "Existing insulation NOT removed." The analyzer scope
//     regex /air\s*seal/i (line 593) and /remov/i (line 596) are positive-
//     match-only with no negation lookahead — they fire on "Air sealing NOT
//     included" → falsely renders as Included. Same false-positive class as
//     foundation F1 (engineer report) and kitchen K4 (appliances).
//   - contractorRegex: 7 distinct OH/NC names. The insulation analyzer
//     does NOT currently render a Contractor detail row. Expected Block 2
//     finding (same shape as foundation pre-B1).
//   - warrantyRegex: f1 lifetime / f2 10-year / f3 1-year / f7 2-year on
//     labor. The analyzer displays no Warranty detail row. Expected
//     Block 2-3 finding — 1-year vs lifetime is a meaningful signal.
//
// Insulation analyzer uses the SHARED price-confirm UI (tpConfirmPriceBtn /
// tpManualPriceBtn) plus an INLINE wrong-vertical hard-reject with button id
// insHardRejectStartOver. Detail rows have class .ins-detail. Scope rows
// live in <ul class="ins-scope">.

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-green-envelope-high",
    file: "test-quotes/insulation-images/comparison-insul-high.png",
    expect: {
      // TOTAL: $5,680 (Green Envelope Building Science, OH HIC.040166,
      // 2900 Olentangy River Rd Columbus OH 43202; property at 622 Wexford
      // Lane Columbus OH 43221). 1500 sq ft attic, blow-in to R-49 (text)
      // / R-60 (line item — analyzer should pick R-60 max). MIXED scope:
      // Removal of existing R-11 fiberglass batts $580, Comprehensive air
      // sealing package (foam, gaskets) $920, Closed-cell spray foam at
      // rim joist (140 lf) $680, Blow-in cellulose to R-60 (1500 sqft)
      // $2,400, Soffit baffles 16 total $240, Insulated weatherstripped
      // attic hatch $260, Pre and post blower-door test $420, Cleanup and
      // HEPA vacuum $180. Lifetime workmanship warranty on air sealing.
      // Manual J energy report. Premium-tier comprehensive job.
      price: 5680,
      contractorRegex: /green\s*envelope/i,
      stateCode: "OH",
      // Local detectInsulationType returns mixed when both blown-in and
      // closed-cell spray foam line items present.
      insTypeRegex: /mixed|blown|cellulose/i,
      // Display row "R-Value" — analyzer detectRValue picks max so should
      // surface R-60 (or at least R-49 as fallback).
      rValueRegex: /R-(49|60)/,
      areaSqFt: 1500,
      locationRegex: /attic/i,
      scopeFound: ["airSealing", "ventBaffles", "oldRemoval", "energyAudit", "cleanup", "warranty"],
      // f1 quote does NOT mention vapor barrier or rValueCert.
      scopeAbsent: ["vaporBarrier", "rValueCert"],
      warrantyRegex: /lifetime/i,
      // INS-B1 regression guard: $5,680 for premium comprehensive Mixed
      // (blown + spray foam) job with 6 scope add-ons (removal + air-seal +
      // baffles + audit + cleanup + warranty) is FAIR for that breadth of
      // scope (real range $4-7K). Should NEVER verdict OVERPRICED/UNUSUALLY
      // LOW post-fix.
      verdictNotRegex: /unusually\s*low|overpriced/i,
    },
  },
  {
    id: "f2-buckeye-mid",
    file: "test-quotes/insulation-images/comparison-insul-mid.png",
    expect: {
      // TOTAL: $3,025 (Buckeye Energy Solutions, BPI-certified, OH HIC.030477,
      // 5500 Sinclair Rd Columbus OH 43229). 1500 sq ft attic, blow-in to
      // R-49. Scope: Blow-in cellulose insulation to R-49 (1500 sqft) $2,250,
      // Air sealing - top plates, penetrations, can lights $380, Attic
      // baffles for soffit ventilation (12) $180, Hatch insulation kit $95,
      // Cleanup and disposal $120. 10-year workmanship warranty. Energy
      // audit results provided post-install. Eligible for utility rebates.
      // No old insulation removal. Mid-tier blown cellulose job.
      price: 3025,
      contractorRegex: /buckeye\s*energy/i,
      stateCode: "OH",
      insTypeRegex: /blown|cellulose/i,
      rValueRegex: /R-49/,
      areaSqFt: 1500,
      locationRegex: /attic/i,
      scopeFound: ["airSealing", "ventBaffles", "energyAudit", "cleanup", "warranty"],
      scopeAbsent: ["vaporBarrier"],
      warrantyRegex: /10[-\s]*year|10\s*yr/i,
    },
  },
  {
    id: "f3-midstate-low",
    file: "test-quotes/insulation-images/comparison-insul-low.png",
    expect: {
      // TOTAL: $1,730 (Midstate Insulation Direct, 1144 W Broad St Columbus
      // OH 43222). 1500 sq ft attic, blow-in to R-49. Scope: Blow-in
      // fiberglass insulation to R-49 (1500 sqft) $1,650, Standard
      // installation labor Included, Cleanup $80. 1-year workmanship
      // warranty. EXPLICITLY "Air sealing NOT included." and "Existing
      // insulation NOT removed." Lowest-tier bare-bones blow-over job.
      // The negated air-sealing + negated removal are the F1-class trust-
      // critical guard targets: analyzer scope regex /air\s*seal/i and
      // /remov/i are positive-match-only and fire on the negation,
      // falsely reporting Included.
      price: 1730,
      contractorRegex: /midstate\s*insulation/i,
      stateCode: "OH",
      // Fiberglass blown-in still maps to "blown_in" in detectInsulationType.
      insTypeRegex: /blown|fiberglass/i,
      rValueRegex: /R-49/,
      areaSqFt: 1500,
      locationRegex: /attic/i,
      scopeFound: ["cleanup", "warranty"],
      // Trust-critical: must register as NOT Included. Analyzer currently
      // falsely reports both as Included.
      scopeExcluded: ["airSealing", "oldRemoval"],
      warrantyRegex: /1[-\s]*year|1\s*yr/i,
      // INS-B1 regression guard: $1,730 for bare-bones blow-only R-49
      // fiberglass (NO air-seal, NO removal, just cleanup + 1yr warranty)
      // is FAIR for budget tier (real range $1.5-2.5K for blow-only). The
      // budget contractor isn't suspicious -- they're skipping prep that
      // adds $400-1500. Should NEVER verdict UNUSUALLY LOW or OVERPRICED.
      verdictNotRegex: /unusually\s*low|overpriced/i,
    },
  },
  {
    id: "f4-green-envelope-high-messy",
    file: "test-quotes/insulation-images/messy-comparison-insul-high.jpg",
    expect: {
      // Same content as f1 but skewed/grayscale photo render — tests OCR
      // robustness at edge alignment.
      price: 5680,
      contractorRegex: /green\s*envelope/i,
      stateCode: "OH",
      insTypeRegex: /mixed|blown|cellulose/i,
      rValueRegex: /R-(49|60)/,
      areaSqFt: 1500,
      locationRegex: /attic/i,
      scopeFound: ["airSealing", "ventBaffles", "oldRemoval", "cleanup", "warranty"],
      warrantyRegex: /lifetime/i,
      verdictNotRegex: /unusually\s*low|overpriced/i,
    },
  },
  {
    id: "f5-buckeye-mid-messy",
    file: "test-quotes/insulation-images/messy-comparison-insul-mid.jpg",
    expect: {
      price: 3025,
      contractorRegex: /buckeye\s*energy/i,
      stateCode: "OH",
      insTypeRegex: /blown|cellulose/i,
      rValueRegex: /R-49/,
      areaSqFt: 1500,
      locationRegex: /attic/i,
      scopeFound: ["airSealing", "ventBaffles", "cleanup", "warranty"],
      warrantyRegex: /10[-\s]*year|10\s*yr/i,
    },
  },
  {
    id: "f6-midstate-low-messy",
    file: "test-quotes/insulation-images/messy-comparison-insul-low.jpg",
    expect: {
      price: 1730,
      contractorRegex: /midstate\s*insulation/i,
      stateCode: "OH",
      insTypeRegex: /blown|fiberglass/i,
      rValueRegex: /R-49/,
      areaSqFt: 1500,
      locationRegex: /attic/i,
      scopeFound: ["cleanup", "warranty"],
      // Trust-critical: must register as NOT Included on messy variant too.
      scopeExcluded: ["airSealing", "oldRemoval"],
      warrantyRegex: /1[-\s]*year|1\s*yr/i,
      verdictNotRegex: /unusually\s*low|overpriced/i,
    },
  },
  {
    id: "f7-mock-apex-nc",
    file: "test-quotes/insulation-images/mock-01.png",
    expect: {
      // TOTAL: $5,475 (Apex Insulation Co, Charlotte NC 28202). Attic
      // Insulation Upgrade: Remove existing R-19 insulation $850, Air seal
      // attic floor (top plates, bath fans, can lights) $1,200, Blown-in
      // fiberglass to R-49 $2,400, Vent baffles installed $380, Disposal of
      // old material $240, Permit $95. Subtotal $5,165 + 6% tax $310 =
      // $5,475. Workmanship warranty 2 years on labor. Manufacturer warranty
      // applies to materials. Mocks 02-10 are identical templates with only
      // contractor name varying — same scope/total/state. We benchmark only
      // mock-01 to avoid 9 redundant fixtures (foundation pattern).
      price: 5475,
      contractorRegex: /apex\s*insulation/i,
      stateCode: "NC",
      insTypeRegex: /blown|fiberglass/i,
      rValueRegex: /R-49/,
      // Mock template doesn't include explicit sq ft in line items.
      // detectArea may return null → analyzer falls back to default 1500.
      // Allow null OR a number.
      areaSqFt: null,
      locationRegex: /attic/i,
      scopeFound: ["airSealing", "ventBaffles", "oldRemoval", "permits", "cleanup", "warranty"],
      warrantyRegex: /2[-\s]*year|manufacturer/i,
      // INS-B1 regression guard: $5,475 for comprehensive Apex NC quote
      // (8 line items: removal + air-seal + blow + baffles + disposal +
      // permit + 6% NC tax) is FAIR for that scope (real range $4-7K).
      // Should NEVER verdict OVERPRICED post-fix.
      verdictNotRegex: /unusually\s*low|overpriced/i,
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
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/insulation-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/insulation-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /insulation-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Insulation analyzer:
  //   - Inline wrong-vertical hard-reject (id insHardRejectStartOver) runs FIRST.
  //   - Otherwise renderPriceConfirmation shows tpConfirmPriceBtn (price found)
  //     OR tpManualPriceBtn (no price). Shared hard-reject id is tpHardRejectStartOver.
  //   - High-confidence parser short-circuits straight to .verdict-price.
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("insHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver") ||
                     !!document.getElementById("insHardRejectStartOver"),
      hardRejectText: (document.querySelector("h1") || {}).innerText || "",
      bodyText: document.body.innerText.slice(0, 1500),
    };
  });

  if (preConfirm.hasHardReject) {
    await page.close();
    return {
      display: { verdictPrice: null, details: {}, scope: {}, rangeText: "", isUncategorizedBanner: false, bodyTextSlice: "" },
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
    await page.type("#tpManualPrice", "5000");
    await page.click("#tpManualPriceBtn");
  }

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    const verdictEl = document.querySelector(".verdict-price");
    const verdictText = verdictEl ? verdictEl.innerText : "";
    const verdictMatch = verdictText.match(/\$([\d,]+(?:\.\d+)?)/);

    // Insulation detail rows: <div class="ins-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".ins-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    // Scope Review checklist: <ul class="ins-scope"><li>... <icon>... <label>...
    // <statusLabel></li>. The label text uses INS_PRICING.scopeItems labels:
    // "Air sealing", "Vapor barrier", "Vent baffles / rafter vents",
    // "Old insulation removal", "Access creation (hatches, panels)",
    // "Energy audit / thermal imaging", "Permits and inspections",
    // "Cleanup and debris removal", "Warranty (materials + labor)",
    // "R-value certification". We map each li back to the scopeSignals key
    // by scanning visible text, then capture status (Included | Not included |
    // Not mentioned).
    const scope = {};
    const scopeMap = [
      [/air\s*sealing/i, "airSealing"],
      [/vapor\s*barrier/i, "vaporBarrier"],
      [/vent\s*baffles|rafter\s*vent/i, "ventBaffles"],
      [/old\s*insulation\s*removal/i, "oldRemoval"],
      [/access\s*creation/i, "accessCreation"],
      [/energy\s*audit|thermal\s*imaging/i, "energyAudit"],
      [/permit/i, "permits"],
      [/cleanup|debris/i, "cleanup"],
      [/warranty/i, "warranty"],
      [/r[-\s]*value\s*cert/i, "rValueCert"],
    ];
    document.querySelectorAll(".ins-scope li").forEach(li => {
      const lines = (li.innerText || "").split("\n").map(s => s.trim()).filter(Boolean);
      if (lines.length < 2) return;
      const status = lines[lines.length - 1].toLowerCase();
      const labelLine = lines.slice(0, -1).join(" ");
      for (const [rx, key] of scopeMap) {
        if (rx.test(labelLine)) { scope[key] = status; break; }
      }
    });

    const rangeText = (document.querySelector(".verdict-range") || {}).innerText || "";

    const verdictLabel = (document.querySelector(".verdict-label") || {}).innerText || "";
    const isNeedsReview = /needs\s*review/i.test(verdictLabel);

    const isUncategorizedBanner = /couldn[’']t identify the specific (insulation|type)/i.test(text);

    return {
      verdictPrice: verdictMatch ? parseFloat(verdictMatch[1].replace(/,/g, "")) : null,
      details,
      scope,
      rangeText,
      verdictLabel,
      isUncategorizedBanner,
      isNeedsReview,
      bodyTextSlice: text.slice(0, 2500),
    };
  });

  let parseQuote = null;
  for (const r of apiResponses) {
    if (r.url.includes("/api/insulation-estimate") || r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not insulation");
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
    // Insulation analyzer doesn't currently render Contractor in ins-detail
    // (cf. roofing/HVAC/auto-repair/plumbing). Read from parseQuote API or
    // upcoming detail-row "contractor" if it lands — this assertion will
    // surface that gap as a Block 2 finding.
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

  if (expected.insTypeRegex) {
    const got = actual.display.details["insulation type"] || "";
    if (!expected.insTypeRegex.test(got)) {
      failures.push(`insType: expected match /${expected.insTypeRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.rValueRegex) {
    const got = actual.display.details["r-value"] || "";
    if (!expected.rValueRegex.test(got)) {
      failures.push(`rValue: expected match /${expected.rValueRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.areaSqFt === "number") {
    const aText = actual.display.details["area"] || "";
    const aMatch = aText.replace(/,/g, "").match(/\d+/);
    const got = aMatch ? parseInt(aMatch[0], 10) : null;
    if (got !== expected.areaSqFt) {
      failures.push(`areaSqFt: expected ${expected.areaSqFt}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.locationRegex) {
    const got = actual.display.details["location"] || "";
    if (!expected.locationRegex.test(got)) {
      failures.push(`location: expected match /${expected.locationRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.warrantyRegex) {
    // Insulation analyzer doesn't currently render a Warranty detail row.
    // Read from parseQuote API or upcoming detail-row if it lands —
    // surfaces as Block 2-3 finding.
    const apiGot = actual.parseQuote?.data?.warrantyTerms ||
                   actual.parseQuote?.data?.warranty || "";
    const displayGot = actual.display.details["warranty"] || "";
    const got = apiGot || displayGot;
    if (!expected.warrantyRegex.test(got)) {
      failures.push(`warranty: expected match /${expected.warrantyRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.isUncategorizedBanner === "boolean") {
    const got = actual.display.isUncategorizedBanner || actual.display.isNeedsReview;
    if (got !== expected.isUncategorizedBanner) {
      failures.push(`isUncategorizedBanner: expected ${expected.isUncategorizedBanner}, got ${got}`);
    }
  }

  if (Array.isArray(expected.scopeFound)) {
    for (const key of expected.scopeFound) {
      const got = (actual.display.scope || {})[key] || "(missing row)";
      if (!/^included$/i.test(got)) {
        failures.push(`scopeFound:${key}: expected "Included", got ${JSON.stringify(got)}`);
      }
    }
  }

  if (Array.isArray(expected.scopeExcluded)) {
    for (const key of expected.scopeExcluded) {
      const got = (actual.display.scope || {})[key] || "(missing row)";
      // f3/f6 trust guard: analyzer must NOT mark airSealing or oldRemoval
      // as Included when fixture explicitly says "Air sealing NOT included"
      // or "Existing insulation NOT removed".
      if (/^included$/i.test(got)) {
        failures.push(`scopeExcluded:${key}: expected NOT "Included", got ${JSON.stringify(got)}`);
      }
    }
  }

  // INS-B1 regression guard: synthetic in-range or near-range insulation
  // quotes should NEVER verdict "Unusually Low" (or "Overpriced") post-fix.
  // Pre-INS-B1 the analyzer benchmarked perSqft × area only (no scope-
  // breadth premium for air-seal / removal / baffles / energy audit / etc),
  // so f1/f4/f7 (comprehensive 5-6 add-on jobs) read OVERPRICED and f3/f6
  // (bare-bones blow-only) read UNUSUALLY LOW. If any future patch reverts
  // the range-based verdict or drops the scopeAddOns map, this assertion
  // fires.
  if (expected.verdictNotRegex) {
    const got = actual.display.verdictLabel || "";
    if (expected.verdictNotRegex.test(got)) {
      failures.push(`verdict: expected NOT match /${expected.verdictNotRegex.source}/, got ${JSON.stringify(got)}`);
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
        scope: actual.display.scope,
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
        apiInsulationType: actual.parseQuote?.data?.insulationType || null,
        apiRValue: actual.parseQuote?.data?.rValue || null,
        apiSquareFootage: actual.parseQuote?.data?.squareFootage || null,
        apiWarranty: actual.parseQuote?.data?.warrantyTerms || actual.parseQuote?.data?.warranty || null,
        displayInsType: actual.display.details["insulation type"] || null,
        displayRValue: actual.display.details["r-value"] || null,
        displayArea: actual.display.details["area"] || null,
        displayLocation: actual.display.details["location"] || null,
        displayWarranty: actual.display.details["warranty"] || null,
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|insType|rValue|areaSqFt|location|warranty|verdict|isUncategorizedBanner|hardReject|scopeFound:[a-zA-Z]+|scopeExcluded:[a-zA-Z]+):/);
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
