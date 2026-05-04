// Siding fixture ground-truth harness.
// Reads 6 hand-curated fixtures (3 clean PNG + 3 messy JPG variants of the
// same 3-quote set), uploads each through the live analyzer at
// /siding-quote-analyzer.html, and asserts displayed total / siding type /
// wall area / per-sqft + API-side contractor / stateCode / sidingType /
// scopeItems against ground truth captured 2026-05-03.
//
// Run: node test/siding/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/insulation/fixture-ground-truth.test.js (newest
// canonical, has negation-aware scope detection + STRONG/WEAK contractor
// two-pass + Claude sentinel filter + STRONG-first resolution chain).
// CI auto-discovers every test/*/fixture-ground-truth.test.js via
// .github/workflows/regression-gate.yml.
//
// Siding-specific assertions (vs insulation/foundation):
//   - sidingTypeRegex: vinyl / fiber_cement (James Hardie / Allura / Nichiha) /
//     wood (cedar/redwood) / engineered_wood (LP SmartSide) / stone_veneer /
//     stucco. Cost spread 2-3x between vinyl ($4-8/sf) and fiber_cement
//     ($8-14/sf), so material misclass = visibly bad verdict (same Block 1
//     trust class as insulation I3).
//   - wallAreaSqFt: parsed from text. Default benchmark uses 1800 sq ft when
//     not detected. All 6 fixtures happen to be 1800 sf so this won't fail
//     here, but harness covers it for future fixtures.
//   - scopeFound: removal, houseWrap, trimFascia, jChannel, disposal, warranty
//     (3 fixtures use different combos).
//   - scopeExcluded (TRUST-CRITICAL): f3/f6 LOW quote text says "House wrap
//     NOT included." and "Insulation backing NOT included." The analyzer
//     scope regex /house\s*wrap/i (line 600) is positive-match-only — fires
//     on the negation → falsely renders as Included. Same false-positive
//     class as insulation I1/I2 and foundation F1.
//   - contractorRegex: 3 distinct OH names (Greater Cincinnati Siding,
//     Queen City Exteriors, Ohio Vinyl Siding Direct). Siding analyzer
//     does NOT currently render a Contractor detail row. Expected Block 2
//     finding (mirror of insulation I6 / foundation pre-B1).
//   - warrantyRegex: f1 lifetime + JH 30-yr / f2 10-year + 50-year manuf /
//     f3 1-year only. Siding analyzer does NOT display Warranty. Block 2-3.
//   - forceAI: TP_Engine.analyzeQuote on line 788 of siding-quote-analyzer.html
//     is called WITHOUT forceAI: true. When regex extracts price, API short-
//     circuits → contractor=null, stateCode=null. Same one-line bug as
//     MV-1 / W1 / INS-1. Predicted FIRST baseline failure.
//
// Siding analyzer uses the SHARED price-confirm UI (tpConfirmPriceBtn /
// tpManualPriceBtn) plus an INLINE wrong-vertical hard-reject with button id
// sidingHardRejectStartOver. Detail rows have class .side-detail. Scope rows
// live in <ul class="side-scope">.

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-greater-cincinnati-high",
    file: "test-quotes/siding-images/comparison-siding-high.png",
    expect: {
      // TOTAL: $23,620. GREATER CINCINNATI SIDING & WINDOW (James Hardie elite
      // preferred, OH HIC.072144, 5240 Bridgetown Rd Cincinnati OH 45248).
      // Property: 7820 Forest Glen Drive, Cincinnati OH 45236. Job: 1800 sqft
      // 2-story home full siding replacement. Scope: James Hardie fiber cement
      // siding 1800 sqft $11,400, Removal/disposal of existing siding $1,400,
      // Tyvek house wrap with taped seams $820, Continuous rigid foam
      // insulation backing $2,200, Aluminum trim wraps for windows/doors
      // $1,800, Install labor (Hardie certified crew) $5,400, Permit/inspection
      // $320, Cleanup magnet sweep $280. Lifetime workmanship + James Hardie
      // 30-yr non-prorated finish + 4-yr free touch-up. Premium fiber-cement
      // job with full envelope and certified crew.
      price: 23620,
      contractorRegex: /greater\s*cincinnati\s*siding/i,
      stateCode: "OH",
      // detectSidingType matches "James Hardie" + "fiber cement" → fiber_cement
      sidingTypeRegex: /fiber\s*cement|hardie/i,
      wallAreaSqFt: 1800,
      scopeFound: ["removal", "houseWrap", "trimFascia", "disposal", "permits", "warranty"],
      // Trust-critical: f1 quote does mention permit, includes house wrap.
      // No painting (fiber cement comes pre-finished ColorPlus). No j-channel
      // line item.
      scopeAbsent: ["painting"],
      warrantyRegex: /lifetime|30[-\s]*year|hardie/i,
    },
  },
  {
    id: "f2-queen-city-mid",
    file: "test-quotes/siding-images/comparison-siding-mid.png",
    expect: {
      // TOTAL: $14,880. QUEEN CITY EXTERIORS (Licensed and insured, OH
      // HIC.066220, 9400 Montgomery Rd Cincinnati OH 45242). Same property as
      // f1. Scope: Premium .046 vinyl siding 1800 sqft $7,200, Removal/disposal
      // of existing siding $1,200, Tyvek house wrap installation $680,
      // Insulation backing board $1,400, Trim/J-channel/soffit refresh $1,200,
      // Install labor $3,200. 10-yr workmanship + vinyl manufacturer 50-yr
      // limited. Mid-tier premium-vinyl job with full envelope.
      price: 14880,
      contractorRegex: /queen\s*city\s*exteriors/i,
      stateCode: "OH",
      sidingTypeRegex: /vinyl/i,
      wallAreaSqFt: 1800,
      scopeFound: ["removal", "houseWrap", "trimFascia", "soffit", "jChannel", "disposal", "warranty"],
      scopeAbsent: ["painting"],
      warrantyRegex: /10[-\s]*year|10\s*yr|50[-\s]*year/i,
    },
  },
  {
    id: "f3-ohio-vinyl-low",
    file: "test-quotes/siding-images/comparison-siding-low.png",
    expect: {
      // TOTAL: $9,040. OHIO VINYL SIDING DIRECT (Bulk pricing on vinyl,
      // 8200 Reading Rd Cincinnati OH 45215). Same property. Scope: Standard
      // .042 vinyl siding 1800 sqft $5,400, Removal of existing siding $800,
      // Standard install labor $2,200, Trim and J-channel $640. 1-yr
      // workmanship only. EXPLICITLY "House wrap NOT included." and
      // "Insulation backing NOT included." Lowest-tier bare-bones vinyl job.
      // The negated houseWrap is the F1-class trust-critical guard target:
      // analyzer scope regex /house\s*wrap/i is positive-match-only and
      // fires on the negation, falsely reporting Included.
      price: 9040,
      contractorRegex: /ohio\s*vinyl\s*siding/i,
      stateCode: "OH",
      sidingTypeRegex: /vinyl/i,
      wallAreaSqFt: 1800,
      scopeFound: ["removal", "trimFascia", "jChannel", "warranty"],
      // Trust-critical: must register as NOT Included. Analyzer currently
      // falsely reports houseWrap as Included via positive-only regex.
      // Insulation backing board has no scope key, but house wrap absolutely
      // is the decisive F1-class signal here.
      scopeExcluded: ["houseWrap"],
      // No house wrap, no insulation, no painting line items — should NOT
      // surface those as Included.
      scopeAbsent: ["houseWrap", "painting"],
      warrantyRegex: /1[-\s]*year|1\s*yr/i,
    },
  },
  {
    id: "f4-greater-cincinnati-high-messy",
    file: "test-quotes/siding-images/messy-comparison-siding-high.jpg",
    expect: {
      // Same content as f1 but skewed/grayscale photo render — tests OCR
      // robustness at edge alignment.
      price: 23620,
      contractorRegex: /greater\s*cincinnati\s*siding/i,
      stateCode: "OH",
      sidingTypeRegex: /fiber\s*cement|hardie/i,
      wallAreaSqFt: 1800,
      scopeFound: ["removal", "houseWrap", "trimFascia", "warranty"],
      warrantyRegex: /lifetime|30[-\s]*year|hardie/i,
    },
  },
  {
    id: "f5-queen-city-mid-messy",
    file: "test-quotes/siding-images/messy-comparison-siding-mid.jpg",
    expect: {
      price: 14880,
      contractorRegex: /queen\s*city\s*exteriors/i,
      stateCode: "OH",
      sidingTypeRegex: /vinyl/i,
      wallAreaSqFt: 1800,
      scopeFound: ["removal", "houseWrap", "trimFascia", "warranty"],
      warrantyRegex: /10[-\s]*year|10\s*yr|50[-\s]*year/i,
    },
  },
  {
    id: "f6-ohio-vinyl-low-messy",
    file: "test-quotes/siding-images/messy-comparison-siding-low.jpg",
    expect: {
      price: 9040,
      contractorRegex: /ohio\s*vinyl\s*siding/i,
      stateCode: "OH",
      sidingTypeRegex: /vinyl/i,
      wallAreaSqFt: 1800,
      scopeFound: ["removal", "trimFascia", "warranty"],
      // Trust-critical: must register as NOT Included on messy variant too.
      scopeExcluded: ["houseWrap"],
      warrantyRegex: /1[-\s]*year|1\s*yr/i,
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
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/siding-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/siding-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  // Siding analyzer uses an address step before upload. Fill ZIP minimally
  // so the upload zone renders, then upload.
  const hasAddrStep = await page.evaluate(() => !!document.querySelector('#sideApp input[placeholder*="ZIP" i], #sideApp input[name*="zip" i]'));
  if (hasAddrStep) {
    // Try clicking through any "Skip" or "Continue" CTA, or fill ZIP if a field exists.
    await page.evaluate(() => {
      const zip = document.querySelector('input[placeholder*="ZIP" i], input[name*="zip" i]');
      if (zip) { zip.value = "45236"; zip.dispatchEvent(new Event("input", { bubbles: true })); }
      const city = document.querySelector('input[placeholder*="City" i], input[name*="city" i]');
      if (city) { city.value = "Cincinnati"; city.dispatchEvent(new Event("input", { bubbles: true })); }
      const st = document.querySelector('input[placeholder*="State" i], input[name*="state" i], select[name*="state" i]');
      if (st) { st.value = "OH"; st.dispatchEvent(new Event("input", { bubbles: true })); st.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    // Click any primary CTA on the address step
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, .side-btn, a.side-btn'));
      const cta = buttons.find(b => /upload|continue|next|start/i.test(b.innerText || ""));
      if (cta) { cta.click(); return true; }
      return false;
    });
    if (clicked) await new Promise(r => setTimeout(r, 1500));
  }

  await page.waitForFunction(() => !!document.querySelector('input[type="file"]'), { timeout: 30000 }).catch(() => null);
  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /siding-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Siding analyzer:
  //   - Inline wrong-vertical hard-reject (id sidingHardRejectStartOver) runs FIRST.
  //   - Otherwise renderPriceConfirmation shows tpConfirmPriceBtn (price found)
  //     OR tpManualPriceBtn (no price). Shared hard-reject id is tpHardRejectStartOver.
  //   - High-confidence parser short-circuits straight to .verdict-price.
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("sidingHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver") ||
                     !!document.getElementById("sidingHardRejectStartOver"),
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
    await page.type("#tpManualPrice", "12000");
    await page.click("#tpManualPriceBtn");
  }

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    const verdictEl = document.querySelector(".verdict-price");
    const verdictText = verdictEl ? verdictEl.innerText : "";
    const verdictMatch = verdictText.match(/\$([\d,]+(?:\.\d+)?)/);

    // Siding detail rows: <div class="side-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".side-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    // Scope Review checklist: <ul class="side-scope"><li>... <icon>... <label>
    // <statusLabel></li>. SIDE_PRICING.scopeItems labels:
    //   removal     "Old siding removal"
    //   houseWrap   "House wrap / weather barrier"
    //   flashing    "Flashing (windows, doors, corners)"
    //   trimFascia  "Trim and fascia"
    //   soffit      "Soffit"
    //   caulking    "Caulking and sealant"
    //   painting    "Painting / finishing"
    //   disposal    "Debris removal and disposal"
    //   permits     "Permits and inspections"
    //   warranty    "Warranty (materials + labor)"
    //   cornerPosts "Corner posts"
    //   jChannel    "J-channel"
    const scope = {};
    // Order matters: more specific first to avoid trim/jChannel collision
    // with the standalone "Soffit" label. Anchors avoided because rendered
    // li innerText includes the leading icon glyph.
    const scopeMap = [
      [/old\s*siding\s*removal/i, "removal"],
      [/house\s*wrap|weather\s*barrier/i, "houseWrap"],
      [/flashing/i, "flashing"],
      [/trim\s*and\s*fascia/i, "trimFascia"],
      [/j[-\s]*channel/i, "jChannel"],
      [/corner\s*posts/i, "cornerPosts"],
      [/soffit/i, "soffit"],
      [/caulking|sealant/i, "caulking"],
      [/painting|finishing/i, "painting"],
      [/debris\s*removal|disposal/i, "disposal"],
      [/permit/i, "permits"],
      [/warranty/i, "warranty"],
    ];
    document.querySelectorAll(".side-scope li").forEach(li => {
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
    const isUncategorizedBanner = /couldn[’']t identify the specific (siding|type)/i.test(text);

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
    if (r.url.includes("/api/siding-estimate") || r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not siding");
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
    // Siding analyzer doesn't currently render Contractor in side-detail
    // (cf. roofing/HVAC/auto-repair/plumbing/insulation post-fix). Read from
    // parseQuote API or upcoming detail-row "contractor" if it lands — this
    // assertion will surface that gap as a Block 2 finding.
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

  if (expected.sidingTypeRegex) {
    const got = actual.display.details["siding type"] || "";
    if (!expected.sidingTypeRegex.test(got)) {
      failures.push(`sidingType: expected match /${expected.sidingTypeRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.wallAreaSqFt === "number") {
    const aText = actual.display.details["wall area"] || "";
    const aMatch = aText.replace(/,/g, "").match(/\d+/);
    const got = aMatch ? parseInt(aMatch[0], 10) : null;
    if (got !== expected.wallAreaSqFt) {
      failures.push(`wallAreaSqFt: expected ${expected.wallAreaSqFt}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.warrantyRegex) {
    // Siding analyzer doesn't currently render a Warranty detail row.
    // Read from parseQuote API or upcoming detail-row if it lands —
    // surfaces as Block 2-3 finding.
    const apiGot = actual.parseQuote?.data?.warrantyTerms ||
                   actual.parseQuote?.data?.warrantyProduct ||
                   actual.parseQuote?.data?.warrantyLabor ||
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
      // f3/f6 trust guard: analyzer must NOT mark houseWrap as Included
      // when fixture explicitly says "House wrap NOT included".
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
        apiSidingType: actual.parseQuote?.data?.sidingType || null,
        apiSquareFootage: actual.parseQuote?.data?.squareFootage || null,
        apiWarranty: actual.parseQuote?.data?.warrantyProduct ||
                     actual.parseQuote?.data?.warrantyLabor ||
                     actual.parseQuote?.data?.warrantyTerms || null,
        displaySidingType: actual.display.details["siding type"] || null,
        displayWallArea: actual.display.details["wall area"] || null,
        displayPerSqft: actual.display.details["per sqft cost"] || null,
        displayBrand: actual.display.details["brand"] || null,
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|sidingType|wallAreaSqFt|warranty|isUncategorizedBanner|hardReject|scopeFound:[a-zA-Z]+|scopeExcluded:[a-zA-Z]+):/);
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
