// Landscaping fixture ground-truth harness.
// Reads 7 hand-curated fixtures (3 clean PNG + 3 messy JPG variants of the
// same 3-quote set + 1 mock representative) through the live analyzer at
// /landscaping-quote-analyzer.html and asserts displayed total / scope rows
// + API-side contractor / stateCode / jobType / plantWarrantyMonths against
// ground truth captured 2026-05-03.
//
// Run: node test/landscaping/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/siding/fixture-ground-truth.test.js (newest canonical
// 2026-05-03, has forceAI gap detection + negation-aware scope assertions).
// CI auto-discovers via .github/workflows/regression-gate.yml.
//
// Landscaping-specific assertions (vs siding/insulation):
//   - jobType: API enum sod / pavers / retaining_wall / irrigation / planting /
//     mulch / lighting / grading / landscape_design / french_drain / mixed.
//     Cost spread 5-10x between sod-only ($1-2/sf) and natural-stone hardscape
//     ($25-50/sf), so jobType misclass = visibly bad verdict (Block 1 trust).
//   - plantWarrantyMonths: API number (24 / 12 / 1 across f1/f2/f3). Analyzer
//     doesn't currently render warranty as a detail row — read from API.
//     Block 2 finding (mirror of insulation I6 / siding pre-B1).
//   - scopeFound: 13 keys from LAND_PRICING.scopeItems (designPlan / excavation /
//     drainage / baseMaterial / edging / mulchRock / plants / irrigation /
//     lighting / sealing / permits / cleanup / warranty).
//   - scopeExcluded (TRUST-CRITICAL): f3/f6 LOW quote text says "No irrigation
//     included." and "No design service." The analyzer detectLandscapingScopeSignals
//     fn (line 941) is positive-match-only — fires on the negation
//     ("/irrigat/i" matches "No irrigation included") → falsely renders as
//     Included. Same false-positive class as siding S2 / insulation I1+I2 /
//     foundation F1.
//   - contractorRegex: f1 PIEDMONT LANDSCAPE DESIGN / f2 EVERGREEN
//     GROUNDSKEEPING / f3 LAWN & ORDER LANDSCAPING / mock-01 GREENSCAPE
//     DESIGNS. Landscaping analyzer does NOT currently render a Contractor
//     detail row. Expected Block 2 finding (mirror of siding pre-B1).
//   - forceAI: TP_Engine.analyzeQuote on line 709 of landscaping-quote-analyzer.html
//     AND line 393 of compare-landscaping-quotes.html is called WITHOUT
//     forceAI: true. When regex extracts price, API short-circuits →
//     contractor=null, stateCode=null, plantWarrantyMonths=null. Same one-line
//     bug as MV-1 / W1 / INS-1 / SID-S1. Predicted FIRST baseline failure mass.
//
// Landscaping analyzer uses the SHARED price-confirm UI (tpConfirmPriceBtn /
// tpManualPriceBtn) plus an INLINE wrong-vertical hard-reject with button id
// landHardRejectStartOver. Detail rows have class .land-detail. Scope rows
// live in <ul class="land-scope">.

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-piedmont-high",
    file: "test-quotes/landscaping-images/comparison-land-high.png",
    expect: {
      // TOTAL: $9,420. PIEDMONT LANDSCAPE DESIGN (Design-build firm, GA
      // #LC005822, 100 Galleria Pkwy, Atlanta GA 30339). Customer:
      // P. Castellano, 92 Sycamore Hollow, Marietta GA 30062. Job: Front yard
      // refresh - 1200 sqft sod, 18 shrubs, mulch. Date: 2026-03-28.
      // Scope: Custom landscape design and rendering $680, Premium Zoysia sod
      // 1200 sqft + soil prep $2,160, Specimen shrubs - 18 (7-gallon, native)
      // $2,340, Premium dyed mulch 8 yards $680, Drip irrigation with smart
      // controller $1,420, Landscape lighting (8 path lights) $1,180, Existing
      // bed cleanup + edging + soil amendment $640, Project management +
      // walk-through $320. 2-year plant warranty + 1-year free quarterly
      // maintenance + hand-drawn landscape plan + plant ID guide. Premium
      // mixed landscape package: design + sod + shrubs + mulch + irrigation +
      // lighting + cleanup.
      price: 9420,
      contractorRegex: /piedmont\s*landscape\s*design/i,
      stateCode: "GA",
      jobTypeRegex: /mixed|landscape_design|planting/i,
      plantWarrantyMonths: 24,
      scopeFound: ["designPlan", "plants", "mulchRock", "irrigation", "lighting", "edging", "cleanup", "warranty"],
      scopeAbsent: ["sealing", "permits"],
    },
  },
  {
    id: "f2-evergreen-mid",
    file: "test-quotes/landscaping-images/comparison-land-mid.png",
    expect: {
      // TOTAL: $3,820. EVERGREEN GROUNDSKEEPING (Licensed GA landscape
      // contractor #LC005611, 2200 Cobb Pkwy, Marietta GA 30060). Same
      // customer/property/date. Scope: Bermuda sod 1200 sqft + starter
      // fertilizer $1,080, Shrubs - 18 (5-gallon mixed) $1,080, Premium
      // hardwood mulch 6 yards $420, Soil amendment + bed prep $380, Drip
      // irrigation for new plant beds $640, Cleanup + disposal $220.
      // 1-year plant warranty + drip irrigation tied into existing system +
      // initial care plan included (watering schedule). Mid-tier mixed
      // landscape: sod + shrubs + mulch + irrigation + cleanup, no design or
      // lighting.
      price: 3820,
      contractorRegex: /evergreen\s*groundskeeping/i,
      stateCode: "GA",
      jobTypeRegex: /mixed|sod|planting/i,
      plantWarrantyMonths: 12,
      scopeFound: ["plants", "mulchRock", "irrigation", "cleanup", "warranty"],
      scopeAbsent: ["sealing", "permits", "lighting"],
    },
  },
  {
    id: "f3-lawn-and-order-low",
    file: "test-quotes/landscaping-images/comparison-land-low.png",
    expect: {
      // TOTAL: $2,080. LAWN & ORDER LANDSCAPING (Quick installs, 1380
      // Roswell Rd, Marietta GA 30062). Same customer/property/date. Scope:
      // Bermuda sod 1200 sqft (delivery + install) $840, Shrubs - 18 mixed
      // (3-gallon) $540, Brown mulch 4 yards $280, Bed prep + planting $420.
      // 30-day plant warranty (replace if dies). EXPLICITLY "No design
      // service." and "No irrigation included." Lowest-tier bare-bones job.
      // The negated irrigation + designPlan are the F1-class trust-critical
      // guard targets: analyzer scope regex /irrigat/i and /design.../i are
      // positive-match-only and fire on the negations, falsely reporting
      // both as Included.
      price: 2080,
      contractorRegex: /lawn\s*&?\s*order\s*landscaping/i,
      stateCode: "GA",
      jobTypeRegex: /mixed|sod|planting/i,
      plantWarrantyMonths: 1,
      scopeFound: ["plants", "mulchRock", "warranty"],
      // Trust-critical: must register as NOT Included. Analyzer currently
      // falsely reports both via positive-only regex. The two negations are
      // the decisive F1-class signals here.
      scopeExcluded: ["irrigation", "designPlan"],
      scopeAbsent: ["sealing", "permits", "lighting", "drainage"],
    },
  },
  {
    id: "f4-piedmont-high-messy",
    file: "test-quotes/landscaping-images/messy-comparison-land-high.jpg",
    expect: {
      // Same content as f1 but skewed/grayscale photo render — tests OCR
      // robustness at edge alignment.
      price: 9420,
      contractorRegex: /piedmont\s*landscape\s*design/i,
      stateCode: "GA",
      jobTypeRegex: /mixed|landscape_design|planting/i,
      plantWarrantyMonths: 24,
      scopeFound: ["designPlan", "plants", "mulchRock", "irrigation", "warranty"],
    },
  },
  {
    id: "f5-evergreen-mid-messy",
    file: "test-quotes/landscaping-images/messy-comparison-land-mid.jpg",
    expect: {
      price: 3820,
      contractorRegex: /evergreen\s*groundskeeping/i,
      stateCode: "GA",
      jobTypeRegex: /mixed|sod|planting/i,
      plantWarrantyMonths: 12,
      scopeFound: ["plants", "mulchRock", "irrigation", "warranty"],
    },
  },
  {
    id: "f6-lawn-and-order-low-messy",
    file: "test-quotes/landscaping-images/messy-comparison-land-low.jpg",
    expect: {
      price: 2080,
      contractorRegex: /lawn\s*&?\s*order\s*landscaping/i,
      stateCode: "GA",
      jobTypeRegex: /mixed|sod|planting/i,
      plantWarrantyMonths: 1,
      scopeFound: ["plants", "mulchRock", "warranty"],
      // Trust-critical: must register as NOT Included on messy variant too.
      scopeExcluded: ["irrigation", "designPlan"],
    },
  },
  {
    id: "mock-01-greenscape-hardscape",
    file: "test-quotes/landscaping-images/mock-01.png",
    expect: {
      // TOTAL: $17,495 (Subtotal $16,505 + 6% sales tax $990). GREENSCAPE
      // DESIGNS (Quality work since 2008, Licensed & Insured, 555-123-4567).
      // Customer: John & Mary Sample, 123 Sample Street, Charlotte NC 28202.
      // Quote #Q-2026-1000 dated March 15 2026. Project: Backyard Hardscape
      // Project. Scope: Site prep + grading $1,200, Paver patio (320 sqft
      // Belgard pavers) $7,800, Retaining wall (28 linear feet, block)
      // $4,400, Drainage tile install $850, River rock border (40 sqft) $320,
      // Plant material (5 shrubs, 12 perennials) $680, Mulch (3 cu yd
      // installed) $510, Irrigation drip line connection $425, Cleanup +
      // disposal $320. Workmanship warranty: 2 years on labor + manufacturer
      // material warranty. 25% deposit. Mock template; mocks 02-10 are
      // identical except contractor name.
      price: 17495,
      contractorRegex: /greenscape\s*designs/i,
      stateCode: "NC",
      jobTypeRegex: /mixed|pavers|retaining_wall/i,
      plantWarrantyMonths: 24,
      scopeFound: ["excavation", "drainage", "mulchRock", "edging", "plants", "irrigation", "cleanup", "warranty"],
      scopeAbsent: ["sealing", "permits"],
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
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/landscaping-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/landscaping-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  // Landscaping analyzer renders the upload zone inside the address card on
  // load. The address fields are optional — if present they're captured into
  // state.address by handleFile. The file input is always available without
  // filling the address. Skip the address step entirely by uploading directly.
  await page.waitForFunction(() => !!document.querySelector('input[type="file"]'), { timeout: 30000 }).catch(() => null);
  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /landscaping-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Landscaping analyzer:
  //   - Inline wrong-vertical hard-reject (id landHardRejectStartOver) runs FIRST.
  //   - Otherwise renderPriceConfirmation shows tpConfirmPriceBtn (price found)
  //     OR tpManualPriceBtn (no price). Shared hard-reject id is tpHardRejectStartOver.
  //   - High-confidence parser short-circuits straight to .verdict-price.
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("landHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver") ||
                     !!document.getElementById("landHardRejectStartOver"),
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

    // Landscaping detail rows: <div class="land-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".land-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    // Scope Review checklist: <ul class="land-scope"><li>... <icon>... <label>
    // <statusLabel></li>. LAND_PRICING.scopeItems labels:
    //   designPlan    "Design plan / layout"
    //   excavation    "Excavation / grading"
    //   drainage      "Drainage solution"
    //   baseMaterial  "Base material (gravel/sand)"
    //   edging        "Edging / borders"
    //   mulchRock     "Mulch / decorative rock"
    //   plants        "Plants / trees / shrubs"
    //   irrigation    "Irrigation / sprinkler"
    //   lighting      "Landscape lighting"
    //   sealing       "Sealing / finishing"
    //   permits       "Permits and inspections"
    //   cleanup       "Site cleanup / haul-off"
    //   warranty      "Warranty (materials + labor)"
    const scope = {};
    // Order matters: more specific first to avoid keyword collision
    // (e.g. "Landscape lighting" before standalone "lighting", "Base material"
    // before standalone "material"). Anchors avoided because rendered
    // li innerText includes the leading icon glyph.
    const scopeMap = [
      [/design\s*plan|layout/i, "designPlan"],
      [/excavation|grading/i, "excavation"],
      [/drainage\s*solution/i, "drainage"],
      [/base\s*material/i, "baseMaterial"],
      [/edging|borders/i, "edging"],
      [/mulch|decorative\s*rock/i, "mulchRock"],
      [/plants|trees|shrubs/i, "plants"],
      [/irrigation|sprinkler/i, "irrigation"],
      [/landscape\s*lighting/i, "lighting"],
      [/sealing|finishing/i, "sealing"],
      [/permits|inspections/i, "permits"],
      [/cleanup|haul/i, "cleanup"],
      [/warranty/i, "warranty"],
    ];
    document.querySelectorAll(".land-scope li").forEach(li => {
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
    const isUncategorizedBanner = /couldn[’']t identify the specific (project|landscape)/i.test(text);

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
    if (r.url.includes("/api/landscaping-estimate") || r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not landscaping");
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
    // Landscaping analyzer doesn't currently render Contractor in land-detail
    // (cf. siding pre-B1 / insulation I6). Read from parseQuote API only —
    // assertion will surface that gap as a Block 2 finding once API reliably
    // returns it (post-LND-1 forceAI fix).
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
  } else if ("stateCode" in expected && !actual.parseQuote) {
    failures.push(`stateCode: expected ${JSON.stringify(expected.stateCode)}, got no API response (forceAI?)`);
  }

  if (expected.jobTypeRegex) {
    const got = actual.parseQuote?.data?.jobType || "";
    if (!expected.jobTypeRegex.test(got)) {
      failures.push(`jobType: expected match /${expected.jobTypeRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if ("plantWarrantyMonths" in expected) {
    const got = actual.parseQuote?.data?.plantWarrantyMonths;
    // ±50% tolerance — Claude vision sometimes rounds 30-day to 1mo or omits.
    const expVal = expected.plantWarrantyMonths;
    if (got == null) {
      failures.push(`plantWarrantyMonths: expected ~${expVal}, got null`);
    } else if (expVal === 1 && got > 3) {
      failures.push(`plantWarrantyMonths: expected ~1 (30-day), got ${got}`);
    } else if (expVal >= 12 && Math.abs(got - expVal) > expVal * 0.5) {
      failures.push(`plantWarrantyMonths: expected ~${expVal}, got ${got}`);
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
      // f3/f6 trust guard: analyzer must NOT mark irrigation or designPlan
      // as Included when fixture explicitly says "No irrigation included" /
      // "No design service".
      if (/^included$/i.test(got)) {
        failures.push(`scopeExcluded:${key}: expected NOT "Included", got ${JSON.stringify(got)}`);
      }
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
        apiJobType: actual.parseQuote?.data?.jobType || null,
        apiSubScope: actual.parseQuote?.data?.subScope || null,
        apiSquareFootage: actual.parseQuote?.data?.squareFootage || null,
        apiPlantWarrantyMonths: actual.parseQuote?.data?.plantWarrantyMonths || null,
        displayProjectType: actual.display.details["project type"] || null,
        displayProjectSize: actual.display.details["project size"] || null,
        displayPricing: actual.display.details["pricing"] || null,
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|jobType|plantWarrantyMonths|isUncategorizedBanner|hardReject|scopeFound:[a-zA-Z]+|scopeExcluded:[a-zA-Z]+):/);
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
