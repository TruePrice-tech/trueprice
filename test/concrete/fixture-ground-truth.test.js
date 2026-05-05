// Concrete fixture ground-truth harness.
// Reads 7 hand-curated fixtures (3 clean PNG + 3 messy JPG variants of the
// same 3-quote set + 1 real-world reddit-scraped multi-slab driveway widening)
// through the live analyzer at /concrete-quote-analyzer.html and asserts
// displayed total / scope rows + API-side contractor / stateCode / psiRating
// against ground truth captured 2026-05-03.
//
// Run: node test/concrete/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/landscaping/fixture-ground-truth.test.js (newest
// canonical 2026-05-03, has forceAI gap detection + negation-aware scope
// assertions). CI auto-discovers via .github/workflows/regression-gate.yml.
//
// Concrete-specific assertions (vs landscaping/foundation):
//   - thicknessRegex: 4 / 5 / 6+ inch. Detector currently buckets to 4 or 6
//     ONLY (line 579-594), so 5" pours get benchmarked as 4" → premium-spec
//     quotes read OVERPRICED. Same Block 1 trust class as foundation pre-FND-B1.
//   - psiRating: API returns 3000/3500/4000/4500/5000. Local detector has
//     NO PSI detection — premium PSI quotes get benchmarked at standard
//     spec. Block 1 trust gap.
//   - scopeFound: 13 keys from CONC_PRICING.scopeItems (demolition / grading /
//     basePrep / forms / rebarMesh / concretePour / finishing / sealing /
//     expansionJoints / permits / cleanup / warranty / cureTime).
//   - scopeExcluded (TRUST-CRITICAL): f3/f6 LOW quote text says "Sealer NOT
//     included." The detectConcreteScope fn (line 596) is positive-only — fires
//     on the negation → falsely shows Included. Same false-positive class as
//     siding S2 / insulation I1+I2 / landscaping LND-2 / foundation F1.
//   - contractorRegex: f1 PRECISION FLATWORK SOLUTIONS / f2 LONE STAR
//     CONCRETE WORKS / f3 QUICK POUR CONCRETE / reddit-06 unique.
//     Concrete analyzer does NOT currently render a Contractor detail row.
//     Block 2 finding (mirror of landscaping pre-LND-1).
//   - forceAI: TP_Engine.analyzeQuote on line 789 of concrete-quote-analyzer.html
//     is called WITHOUT forceAI: true. When regex extracts price, API short-
//     circuits → contractor=null, stateCode=null, psiRating=null. Same
//     one-line bug as MV-1 / W1 / INS-1 / SID-S1 / LND-1. Predicted FIRST
//     baseline failure mass.
//
// Concrete analyzer uses the SHARED price-confirm UI (tpConfirmPriceBtn /
// tpManualPriceBtn) plus an INLINE wrong-vertical hard-reject with button id
// concreteHardRejectStartOver. Detail rows have class .conc-detail. Scope rows
// live in <ul class="conc-scope">.

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-precision-flatwork-high",
    file: "test-quotes/concrete-images/comparison-conc-high.png",
    expect: {
      // TOTAL: $12,100. PRECISION FLATWORK SOLUTIONS (Decorative concrete
      // specialists, TX licensed, 2200 W Park Blvd, Plano TX 75075).
      // Customer: L. Tedeschi, 612 Hawkridge Drive, Plano TX 75025. Job:
      // 800 sqft 4" concrete patio, broom finish (job ticket says 4" but
      // the actual line item is 5"). Date: 2026-04-05. Scope: 5" pour,
      // 800 sqft, 4500 PSI fiber-reinforced $6,400, #4 rebar grid 16" oc
      // $880, Compacted gravel base 6" deep with geotextile $1,400, Form
      // work + broom finish + decorative edge tooling $1,800, Sawcut control
      // joints $320, Penetrating sealer (2 coats) $540, Drainage planning
      // and slope grading $420, Cleanup + sod replacement + site protection
      // $340. LIFETIME workmanship warranty against settling cracks +
      // 5-year sealer reapply + drainage engineered to spec. Premium
      // upgraded patio: 5" thick + 4500 PSI + fiber + rebar + 6" base +
      // sealer + drainage. $12,100 / 800 = $15.13/sqft (high end of fair).
      price: 12100,
      contractorRegex: /precision\s*flatwork/i,
      stateCode: "TX",
      concreteTypeRegex: /patio/i,
      thicknessInches: 5,
      psiRating: 4500,
      areaSqft: 800,
      scopeFound: ["basePrep", "rebarMesh", "concretePour", "finishing", "sealing", "expansionJoints", "cleanup", "warranty"],
      // Aspirational verdict — post-CONC-2 (5" thickness mult) + CONC-3
      // (sealer + drainage scope add-ons) + CONC-4 (range-based verdict),
      // benchmark range should be ~$11K-$15K and $12,100 should land in
      // FAIR PRICE. Pre-fix the analyzer treats 5" as 4" + ignores 4500 PSI
      // + ignores fiber + ignores sealer/drainage scope, producing a
      // ~$7,500 benchmark and "Overpriced" verdict — the trust-flip target.
      verdictNotMatch: /overpriced/i,
      // CONC-REGION-2 (2026-05-05) trust guard: Plano TX 75075 letterhead
      // — buyer must see a regional or local label, not "National typical
      // pricing". Pre-CONC-REGION-1 the silent 'south' fallback produced
      // "South regional pricing"; post-CONC-REGION-1 the local parser miss
      // exposed the gap → "National typical pricing"; post-CONC-REGION-2
      // the apiResult.stateCode fallback restores "South regional pricing"
      // (or "Plano local pricing" if cityMult ever covers it).
      pricingRegex: /(south\s+regional|plano\s+local)\s+pricing/i,
    },
  },
  {
    id: "f2-lone-star-mid",
    file: "test-quotes/concrete-images/comparison-conc-mid.png",
    expect: {
      // TOTAL: $7,800. LONE STAR CONCRETE WORKS (Licensed and insured TX,
      // 4800 Independence Pkwy, Plano TX 75023). Same customer/property/job/
      // date. Scope: 4" pour 800 sqft 4000 PSI $4,800, #3 rebar grid 18" oc
      // $640, Compacted gravel base 4" deep $680, Form work + broom finish
      // $1,200, Control joints (sawcut at 24-hour cure) $240, Site cleanup
      // and haul-off $240. 5-year workmanship warranty. Sealer optional
      // ($380 extra, recommended). Mid-tier: 4" + 4000 PSI + standard rebar
      // + base + joints, no sealer included. $7,800 / 800 = $9.75/sqft —
      // the canonical "fair" for plain 4" patio per the 4f5e79c2156
      // calibration commit.
      // CONC-DT-2 (2026-05-05) trust-critical: "Sealer optional ($380 extra,
      // recommended)" must NOT render as Included. Pre-fix detector matched
      // /seal/ positively → false-positive Included. Same false-positive
      // class as f3 "Sealer NOT included" (excluded) but the qualifier here
      // is "optional", not negation. Buyer must see Optional / extra cost.
      price: 7800,
      contractorRegex: /lone\s*star\s*concrete/i,
      stateCode: "TX",
      concreteTypeRegex: /patio/i,
      thicknessInches: 4,
      psiRating: 4000,
      areaSqft: 800,
      scopeFound: ["basePrep", "rebarMesh", "concretePour", "finishing", "expansionJoints", "cleanup", "warranty"],
      scopeOptional: ["sealing"],
    },
  },
  {
    id: "f3-quick-pour-low",
    file: "test-quotes/concrete-images/comparison-conc-low.png",
    expect: {
      // TOTAL: $4,840. QUICK POUR CONCRETE (Cash-friendly, 1820 Coit Rd,
      // Plano TX 75075). Same customer/property/job/date. Scope: 4" pour
      // 800 sqft 3000 PSI $3,200, Wire mesh reinforcement $240, Broom
      // finish (Included), Labor $1,400. 1-year workmanship warranty.
      // "Base prep limited to existing grade." (effectively no base prep)
      // EXPLICITLY "Sealer NOT included." (F1-class trust target — local
      // detectConcreteScope.sealing /seal(ant|er|ing)?/ matches "Sealer NOT
      // included" positively → falsely renders as Included). Lowest-tier
      // bare-bones job. The negated sealer is the decisive trust signal.
      price: 4840,
      contractorRegex: /quick\s*pour\s*concrete/i,
      stateCode: "TX",
      concreteTypeRegex: /patio/i,
      thicknessInches: 4,
      psiRating: 3000,
      areaSqft: 800,
      scopeFound: ["rebarMesh", "concretePour", "finishing", "warranty"],
      // Trust-critical: must register as NOT Included. Analyzer currently
      // falsely reports sealer Included via positive-only regex.
      scopeExcluded: ["sealing"],
    },
  },
  {
    id: "f4-precision-flatwork-high-messy",
    file: "test-quotes/concrete-images/messy-comparison-conc-high.jpg",
    expect: {
      // Same content as f1 but skewed/grayscale photo render — tests OCR
      // robustness at edge alignment.
      price: 12100,
      contractorRegex: /precision\s*flatwork/i,
      stateCode: "TX",
      concreteTypeRegex: /patio/i,
      areaSqft: 800,
      scopeFound: ["basePrep", "rebarMesh", "concretePour", "finishing", "sealing", "warranty"],
      verdictNotMatch: /overpriced/i,
      // CONC-REGION-2 trust guard on the messy variant — same as f1.
      pricingRegex: /(south\s+regional|plano\s+local)\s+pricing/i,
    },
  },
  {
    id: "f5-lone-star-mid-messy",
    file: "test-quotes/concrete-images/messy-comparison-conc-mid.jpg",
    expect: {
      // CONC-DT-2: same trust assertion as f2 on the messy variant. OCR may
      // mangle "$380" or "extra" but should still catch \boptional\b.
      price: 7800,
      contractorRegex: /lone\s*star\s*concrete/i,
      stateCode: "TX",
      concreteTypeRegex: /patio/i,
      areaSqft: 800,
      scopeFound: ["basePrep", "rebarMesh", "concretePour", "finishing", "warranty"],
      scopeOptional: ["sealing"],
    },
  },
  {
    id: "f6-quick-pour-low-messy",
    file: "test-quotes/concrete-images/messy-comparison-conc-low.jpg",
    expect: {
      price: 4840,
      contractorRegex: /quick\s*pour\s*concrete/i,
      stateCode: "TX",
      concreteTypeRegex: /patio/i,
      areaSqft: 800,
      scopeFound: ["rebarMesh", "concretePour", "finishing", "warranty"],
      // Trust-critical: must register as NOT Included on messy variant too.
      scopeExcluded: ["sealing"],
    },
  },
  {
    id: "f7-driveway-widening-multislab",
    file: "test-quotes/concrete-images/06-quote-to-widen-driveway-pour-cement-pad-for-shed-p.png",
    expect: {
      // Real-world reddit-scraped quote: Concrete Addition driveway widening
      // + multiple slabs (front door, sidewalk, side fence, back slab, gap
      // fill, driveway-to-TC pad, shed, trashcan pad, street parking).
      // Subtotal $11,673.50 + 8.25% tax $963.06 = TOTAL $12,636.56.
      // Aggregate area ~3,500 sqft across all slabs (mixed inch/foot
      // dimensions in source, real OCR challenge). Single line item
      // "Concrete Addition" at $11,673.50 with QTY 1; no per-slab
      // breakdown. Loose assertions — this fixture stress-tests area
      // detection and multi-line totals against analyzer-parser.js.
      // No contractor letterhead in cropped fixture.
      // Post-CONC-1 forceAI the API picks the tax-inclusive TOTAL
      // ($12,636.56) which is the right buyer-facing bottom-line.
      // Pre-fix the regex-only path picked the subtotal ($11,673.50).
      // CONC-DT-3 (2026-05-05) trust-critical: pre-fix Area row showed
      // 66 sq ft (first dimension "3'x22'" = sidewalk slab) while the
      // benchmark internally used the re-estimated ~1,415 sq ft from
      // price ÷ $/sqft. Buyer saw $191/sq ft per-sqft cost paired with
      // 66 sq ft area — incoherent. Post-fix: Area row reflects the
      // re-estimated value with "(estimated)" annotation when the
      // area-from-price fallback overrode local detection.
      // CONC-REGION-1 (2026-05-05) trust-critical: pre-fix the cropped
      // f7 fixture (no state) silently rendered "South regional pricing".
      // Mirror of KIT-REGION-1. Post-fix: r.region null when state
      // unknown → "National typical pricing" label. Reject any
      // regression to a confidently-wrong "South regional pricing".
      price: 12637,
      displayAreaMin: 1000,
      pricingRegex: /^national\s+typical\s+pricing$/i,
      // No contractorRegex — cropped fixture starts at the line items
      // table, contractor letterhead is above the crop.
      // No stateCode — no city/state in cropped fixture.
      // No scope assertions — multi-slab driveway widening doesn't fit
      // the 13-key scope template cleanly.
    },
  },
];

const PRICE_TOLERANCE_PCT = 0.005; // looser tolerance for tax-inclusive reddit-06

async function uploadAndCapture(browser, fixture) {
  const page = await browser.newPage();
  await preparePage(page, BASE);
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1440, height: 900 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/concrete-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/concrete-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  // Concrete analyzer renders the upload zone inside the address card on
  // load (same shape as landscaping). Skip the address step by uploading
  // directly — handleFile captures address fields if present, optional.
  await page.waitForFunction(() => !!document.querySelector('input[type="file"]'), { timeout: 30000 }).catch(() => null);
  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /concrete-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Concrete analyzer:
  //   - Inline wrong-vertical hard-reject (id concreteHardRejectStartOver) runs FIRST.
  //   - Otherwise renderPriceConfirmation shows tpConfirmPriceBtn (price found)
  //     OR tpManualPriceBtn (no price). Shared hard-reject id is tpHardRejectStartOver.
  //   - High-confidence parser short-circuits straight to .verdict-price.
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("concreteHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver") ||
                     !!document.getElementById("concreteHardRejectStartOver"),
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

    // Concrete detail rows: <div class="conc-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".conc-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    // Scope Review checklist: <ul class="conc-scope"><li>... <icon>... <label>
    // <statusLabel></li>. CONC_PRICING.scopeItems labels:
    //   demolition       "Demolition of existing surface"
    //   grading          "Grading and leveling"
    //   basePrep         "Base preparation (gravel/compaction)"
    //   forms            "Formwork"
    //   rebarMesh        "Rebar or wire mesh reinforcement"
    //   concretePour     "Concrete pour and placement"
    //   finishing        "Finishing (broom, smooth, or stamped)"
    //   sealing          "Sealing / curing compound"
    //   expansionJoints  "Expansion joints"
    //   permits          "Permits and inspections"
    //   cleanup          "Site cleanup"
    //   warranty         "Warranty"
    //   cureTime         "Cure time / restrictions noted"
    const scope = {};
    // Order matters: more specific first to avoid keyword collision
    // (e.g. "Concrete pour and placement" before "Formwork" since both
    // contain words; "Sealing / curing compound" before standalone "compound").
    // Anchors avoided because rendered li innerText includes the leading
    // icon glyph.
    const scopeMap = [
      [/demolition\s*of\s*existing/i, "demolition"],
      [/grading\s*and\s*leveling/i, "grading"],
      [/base\s*preparation|gravel\/compaction/i, "basePrep"],
      [/formwork/i, "forms"],
      [/rebar\s*or\s*wire\s*mesh|reinforcement/i, "rebarMesh"],
      [/concrete\s*pour\s*and\s*placement/i, "concretePour"],
      [/finishing.*broom|finishing.*stamp|finishing\s*\(/i, "finishing"],
      [/sealing\s*\/\s*curing|sealing\s*compound/i, "sealing"],
      [/expansion\s*joints/i, "expansionJoints"],
      [/permits\s*and\s*inspections/i, "permits"],
      [/site\s*cleanup/i, "cleanup"],
      [/\bwarranty\b/i, "warranty"],
      [/cure\s*time/i, "cureTime"],
    ];
    document.querySelectorAll(".conc-scope li").forEach(li => {
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
    const isUncategorizedBanner = /couldn[’']t identify the specific (project|concrete)/i.test(text);

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
    if (r.url.includes("/api/concrete-estimate") || r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not concrete");
    return failures;
  }

  if (typeof expected.price === "number") {
    const tol = Math.max(50, expected.price * PRICE_TOLERANCE_PCT);
    if (actual.display.verdictPrice == null) {
      failures.push(`displayPrice: expected ~${expected.price}, got null`);
    } else if (Math.abs(actual.display.verdictPrice - expected.price) > tol) {
      failures.push(`displayPrice: expected ${expected.price} ±${tol}, got ${actual.display.verdictPrice}`);
    }
  }

  if (expected.contractorRegex) {
    // Concrete analyzer doesn't currently render Contractor in conc-detail.
    // Read from parseQuote API only — assertion will surface that gap as a
    // Block 2 finding once API reliably returns it (post-CONC-1 forceAI fix).
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

  if (expected.concreteTypeRegex) {
    const got = actual.display.details["project type"] || "";
    if (!expected.concreteTypeRegex.test(got)) {
      failures.push(`concreteType: expected match /${expected.concreteTypeRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.thicknessInches === "number") {
    // Detail row "Thickness" displays as "4 inch (standard)" or "5 inch ..." etc.
    // Pre-fix detector (line 579-594) only buckets to 4 or 6, so 5" reads as 4.
    const tText = actual.display.details["thickness"] || "";
    const tMatch = tText.match(/(\d+)\s*inch/i);
    const got = tMatch ? parseInt(tMatch[1], 10) : null;
    if (got !== expected.thicknessInches) {
      failures.push(`thicknessInches: expected ${expected.thicknessInches}, got ${JSON.stringify(got)} (display: ${JSON.stringify(tText)})`);
    }
  }

  if (typeof expected.psiRating === "number") {
    const got = actual.parseQuote?.data?.psiRating;
    if (got !== expected.psiRating) {
      failures.push(`psiRating: expected ${expected.psiRating}, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.areaSqft === "number") {
    const aText = actual.display.details["area"] || "";
    const aMatch = aText.replace(/,/g, "").match(/\d+/);
    const got = aMatch ? parseInt(aMatch[0], 10) : null;
    if (got !== expected.areaSqft) {
      failures.push(`areaSqft: expected ${expected.areaSqft}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.verdictNotMatch) {
    const got = actual.display.verdictLabel || "";
    if (expected.verdictNotMatch.test(got)) {
      failures.push(`verdictNotMatch:expected NOT match /${expected.verdictNotMatch.source}/, got ${JSON.stringify(got)}`);
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
      // f3/f6 trust guard: analyzer must NOT mark sealing as Included
      // when fixture explicitly says "Sealer NOT included".
      if (/^included$/i.test(got)) {
        failures.push(`scopeExcluded:${key}: expected NOT "Included", got ${JSON.stringify(got)}`);
      }
    }
  }

  if (Array.isArray(expected.scopeOptional)) {
    for (const key of expected.scopeOptional) {
      const got = (actual.display.scope || {})[key] || "(missing row)";
      // CONC-DT-2 (2026-05-05) f2/f5 trust guard: "Sealer optional ($380
      // extra, recommended)" must render as "Optional (extra)", not
      // "Included". Buyer must see the upcharge isn't in base price.
      if (!/optional/i.test(got)) {
        failures.push(`scopeOptional:${key}: expected match /optional/, got ${JSON.stringify(got)}`);
      }
    }
  }

  if (typeof expected.displayAreaMin === "number") {
    // CONC-DT-3 (2026-05-05) f7 trust guard: multi-slab fixture aggregates
    // ~3,500 sq ft. Pre-fix the displayed Area row showed the misleading
    // first-dimension misread (66 sq ft) even though the benchmark used
    // the re-estimated value. Post-fix: Area row uses effectiveArea with
    // "(estimated)" annotation when overridden.
    const aText = actual.display.details["area"] || "";
    const aMatch = aText.replace(/,/g, "").match(/\d+/);
    const got = aMatch ? parseInt(aMatch[0], 10) : null;
    if (got == null || got < expected.displayAreaMin) {
      failures.push(`displayAreaMin: expected >= ${expected.displayAreaMin}, got ${JSON.stringify(got)} (display: ${JSON.stringify(aText)})`);
    }
  }

  if (expected.pricingRegex) {
    // CONC-REGION-1 (2026-05-05) trust guard: when stateCode unknown the
    // analyzer must not synthesize a confidently-wrong "South regional
    // pricing" label. Mirror KIT-REGION-1 / kitchen f4 assertion.
    const got = actual.display.details["pricing source"] || "";
    if (!expected.pricingRegex.test(got)) {
      failures.push(`pricingRegex: expected match /${expected.pricingRegex.source}/, got ${JSON.stringify(got)}`);
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
        apiPsiRating: actual.parseQuote?.data?.psiRating || null,
        apiSquareFootage: actual.parseQuote?.data?.squareFootage || null,
        apiJobType: actual.parseQuote?.data?.jobType || null,
        displayProjectType: actual.display.details["project type"] || null,
        displayArea: actual.display.details["area"] || null,
        displayThickness: actual.display.details["thickness"] || null,
        displayPerSqft: actual.display.details["per sq ft cost"] || null,
        displayPricing: actual.display.details["pricing source"] || null,
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|concreteType|thicknessInches|psiRating|areaSqft|displayAreaMin|pricingRegex|verdictNotMatch|isUncategorizedBanner|hardReject|scopeFound:[a-zA-Z]+|scopeExcluded:[a-zA-Z]+|scopeOptional:[a-zA-Z]+):/);
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
