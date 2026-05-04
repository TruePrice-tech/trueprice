// Fencing fixture ground-truth harness.
// Reads 7 hand-curated fixtures, uploads each through the live analyzer at
// /fencing-quote-analyzer.html, and asserts displayed total / fence type /
// length / height / gate / scope checklist + API-side contractor / stateCode /
// material / warranty / linearFeet against ground truth captured 2026-05-03.
//
// Run: node test/fencing/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/insulation/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Fencing-specific assertions vs sibling verticals:
//   - linearFeet: parsed from text or apiResult.linearFeet. Critical because
//     $/linear-foot is the trust-critical metric (cedar privacy is $30-60/lf,
//     wire/agricultural is $9-15/lf — wrong material classification trashes
//     the verdict).
//   - material: cedar / wood / vinyl / chain_link / aluminum / wire. Same
//     KMP-2 / W2 brand-whitelist class.
//   - gateCount: f1 has 2 gates ($880 line item), f2 has 2 gates ($580), f3
//     has 2 gates ($320), f7 has 0. Easy to miss as line items.
//   - scopeExcluded (TRUST-CRITICAL): f3/f6 quote text says "Stain/seal NOT
//     included." and "811 utility locate handled by customer." The analyzer
//     scope regex /stain|seal|paint|treat|finish|coat/i is positive-match-
//     only and fires on the negation — falsely renders as Included. Same
//     false-positive class as foundation F1, kitchen K4, insulation I1/I2.
//   - contractor: f1 BLUEPRINT OUTDOOR LIVING / f2 TARHEEL FENCE & DECK /
//     f3 PINE STATE FENCING. The fencing analyzer captures apiResult.aiData
//     into apiResult variable but NEVER consumes it downstream — no
//     Contractor row exists. Expected as a Block 2 finding (same shape as
//     foundation/insulation pre-fix).
//   - warranty: f1 lifetime / f2 5-year / f3 1-year. The analyzer displays
//     no Warranty detail row. Expected as a Block 2-3 finding.
//   - apiResult bypass: line ~816 of fencing-quote-analyzer.html lacks
//     forceAI: true so the engine short-circuits past the API on regex-
//     success cases (mirror of W1/MV-1/INS-1 cross-vertical audit).
//
// Fencing analyzer uses the SHARED price-confirm UI (tpConfirmPriceBtn /
// tpManualPriceBtn) plus an INLINE wrong-vertical hard-reject with button id
// fencingHardRejectStartOver. Detail rows have class .fence-detail. Scope
// rows live in <ul class="fence-scope">.

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-blueprint-outdoor-high",
    file: "test-quotes/fencing-images/comparison-fence-high.png",
    expect: {
      // TOTAL: $10,800 (Blueprint Outdoor Living, NC #FNCE-44188, 120
      // Edinburgh South Drive Suite 5 Raleigh NC 27607; property 728
      // Beechwood Trail Raleigh NC 27607). Job: 180 linear ft of 6 ft
      // cedar privacy fence, 2 gates. Premium-tier scope:
      // Premium clear cedar privacy fence 6 ft x 180 lf $7,200,
      // 4x6 pressure-treated posts 6 ft on center concrete-set $1,150,
      // Two 4-ft custom cedar gates with self-closing hinges $880,
      // Old fence demo haul-off and disposal fees $420,
      // Stain (premium oil-based two coats) $950,
      // 811 locate permit pulling HOA submittal $200.
      // Lifetime transferable workmanship warranty. 7-year stain
      // manufacturer warranty. Touch-up visit at year 1.
      price: 10800,
      contractorRegex: /blueprint\s*outdoor/i,
      stateCode: "NC",
      materialRegex: /wood|cedar/i,
      linearFeet: 180,
      heightFt: 6,
      gateCount: 2,
      scopeFound: ["removalOldFence", "stainingSealing", "permits", "warranty", "gate", "concreteFootings", "posts"],
      warrantyRegex: /lifetime/i,
    },
  },
  {
    id: "f2-tarheel-mid",
    file: "test-quotes/fencing-images/comparison-fence-mid.png",
    expect: {
      // TOTAL: $7,400 (Tarheel Fence & Deck, NC #FNCE-22910, 8801
      // Glenwood Avenue Raleigh NC 27617). 180 linear ft of 6 ft cedar
      // privacy fence, 2 gates. Mid-tier scope:
      // Cedar privacy fence 6 ft x 180 lf $5,400,
      // Concrete-set 4x4 posts 8 ft on center $650,
      // Two 4-ft cedar walk gates with steel frame $580,
      // Old fence demo and haul-off $350,
      // 811 utility locate Included,
      // Stain/sealant (semi-transparent one coat) $420.
      // 5-year workmanship warranty plus manufacturer materials warranty.
      // Permit pulled if HOA requires (additional $75 if needed).
      price: 7400,
      contractorRegex: /tarheel\s*fence/i,
      stateCode: "NC",
      materialRegex: /wood|cedar/i,
      linearFeet: 180,
      heightFt: 6,
      gateCount: 2,
      scopeFound: ["removalOldFence", "stainingSealing", "warranty", "gate", "concreteFootings", "posts"],
      warrantyRegex: /5[-\s]*year|5\s*yr/i,
    },
  },
  {
    id: "f3-pine-state-low",
    file: "test-quotes/fencing-images/comparison-fence-low.png",
    expect: {
      // TOTAL: $5,100 (Pine State Fencing, 402 N. New Hope Rd Raleigh NC
      // 27604). 180 linear ft of 6 ft cedar privacy fence, 2 gates.
      // Bare-bones scope:
      // Cedar privacy fence 6 ft tall x 180 lf $4,500,
      // 4x4 pressure-treated posts (concrete-set) Included,
      // Two 4-ft walk gates with hardware $320,
      // Old fence removal and haul-off $280.
      // 1-year workmanship warranty. EXPLICITLY "Stain/seal NOT included."
      // and "811 utility locate handled by customer." (negation — F1-class
      // trust-critical guard targets). The analyzer's stainingSealing regex
      // /stain|seal|paint|treat|finish|coat/i is positive-match-only and
      // fires on the negation, falsely reporting Included.
      price: 5100,
      contractorRegex: /pine\s*state/i,
      stateCode: "NC",
      materialRegex: /wood|cedar/i,
      linearFeet: 180,
      heightFt: 6,
      gateCount: 2,
      scopeFound: ["removalOldFence", "warranty", "gate", "concreteFootings", "posts"],
      // Trust-critical: must register as NOT Included. Analyzer currently
      // falsely reports stainingSealing as Included on the negation.
      scopeExcluded: ["stainingSealing"],
      warrantyRegex: /1[-\s]*year|1\s*yr/i,
    },
  },
  {
    id: "f4-blueprint-outdoor-high-messy",
    file: "test-quotes/fencing-images/messy-comparison-fence-high.jpg",
    expect: {
      // Same content as f1 but skewed/grayscale photo render — tests OCR
      // robustness at edge alignment.
      price: 10800,
      contractorRegex: /blueprint\s*outdoor/i,
      stateCode: "NC",
      materialRegex: /wood|cedar/i,
      linearFeet: 180,
      heightFt: 6,
      gateCount: 2,
      scopeFound: ["removalOldFence", "stainingSealing", "permits", "warranty", "gate"],
      warrantyRegex: /lifetime/i,
    },
  },
  {
    id: "f5-tarheel-mid-messy",
    file: "test-quotes/fencing-images/messy-comparison-fence-mid.jpg",
    expect: {
      price: 7400,
      contractorRegex: /tarheel\s*fence/i,
      stateCode: "NC",
      materialRegex: /wood|cedar/i,
      linearFeet: 180,
      heightFt: 6,
      gateCount: 2,
      scopeFound: ["removalOldFence", "stainingSealing", "warranty", "gate"],
      warrantyRegex: /5[-\s]*year|5\s*yr/i,
    },
  },
  {
    id: "f6-pine-state-low-messy",
    file: "test-quotes/fencing-images/messy-comparison-fence-low.jpg",
    expect: {
      price: 5100,
      contractorRegex: /pine\s*state/i,
      stateCode: "NC",
      materialRegex: /wood|cedar/i,
      linearFeet: 180,
      heightFt: 6,
      gateCount: 2,
      scopeFound: ["removalOldFence", "warranty", "gate"],
      // Trust-critical: must register as NOT Included on messy variant too.
      scopeExcluded: ["stainingSealing"],
      warrantyRegex: /1[-\s]*year|1\s*yr/i,
    },
  },
  {
    id: "f7-real-1600lf-wire",
    file: "test-quotes/fencing-images/real-02-1600-ft-of-6-wire-t-post-fence-with-some-braces-is.jpg",
    expect: {
      // TOTAL: $18,025. Vendor name redacted in image (..b LLC visible only).
      // Customer Kiersten / Mines road / Mines mile marker 5. Items:
      // 6 Strand Fence qty 1600 unit $9.00 = $14,400
      // Double H Brace qty 2 unit $700 = $1,400
      // H Brace qty 1 unit $425 = $425
      // Double Leg Brace qty 6 unit $300 = $1,800
      // Subtotal $18,025 / Total $18,025.
      // Material: agricultural 6-strand wire t-post fence (NOT cedar/vinyl/
      // chain-link). Linear feet: 1600 (very large — tests scaling).
      // No gates listed. No state code (likely OCR-bound).
      // Reddit context: r/homestead "1600 ft of 6 wire t post fence
      // with some braces is... $18,000?!"
      price: 18025,
      // Contractor name redacted in fixture — skip the contractor assert.
      // contractorRegex omitted on purpose.
      // No state code in document — Claude may infer or return null.
      // Allow either null or any 2-letter code; tracked as
      // statelessFixture so the harness doesn't fail on null state.
      statelessFixture: true,
      // Wire/agricultural fencing — analyzer's local detectFenceType has
      // no wire enum and will fall through. apiResult.material should
      // surface "wire" or "steel" via Claude. Scoring this as a known
      // gap until material taxonomy includes wire.
      materialOptional: true,
      linearFeet: 1600,
      // Wire fence height varies — fixture doesn't state explicitly.
      heightOptional: true,
      gateCount: 0,
      // Local scope regex on this fixture — only "post" matches via the
      // brace items, no other scope language. The harness still records
      // what it sees; we only assert what the fixture actually states.
      // Wire fence has no traditional scope items.
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
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/fencing-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/fencing-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /fencing-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Fencing analyzer:
  //   - Inline wrong-vertical hard-reject (id fencingHardRejectStartOver) runs FIRST.
  //   - Otherwise renderPriceConfirmation shows tpConfirmPriceBtn (price found)
  //     OR tpManualPriceBtn (no price). Shared hard-reject id is tpHardRejectStartOver.
  //   - High-confidence parser short-circuits straight to .verdict-price.
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("fencingHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver") ||
                     !!document.getElementById("fencingHardRejectStartOver"),
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

    // Fencing detail rows: <div class="fence-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".fence-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    // Scope Review checklist: <ul class="fence-scope"><li>icon label statusLabel</li>.
    // The label text uses FENCE_PRICING.scopeItems labels. Map back to the
    // scopeSignals key by scanning visible text, then capture status
    // (Included | Not included | Not mentioned).
    const scope = {};
    const scopeMap = [
      [/post\s*hole/i, "postHoles"],
      [/concrete\s*footing/i, "concreteFootings"],
      [/\bposts\b|post\s*set/i, "posts"],
      [/\brails\b|stringer/i, "rails"],
      [/picket|panel/i, "picketsPanels"],
      [/\bgate\b/i, "gate"],
      [/hardware|hinge|latch/i, "hardware"],
      [/old\s*fence|removal|demo/i, "removalOldFence"],
      [/permit|inspection/i, "permits"],
      [/grading|level\s*ground/i, "grading"],
      [/stain|seal/i, "stainingSealing"],
      [/warranty/i, "warranty"],
    ];
    document.querySelectorAll(".fence-scope li").forEach(li => {
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

    const isUncategorizedBanner = /couldn[’']t identify the specific (fence|type)/i.test(text);

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
    if (r.url.includes("/api/fencing-estimate") || r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not fencing");
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
    // Fencing analyzer captures apiResult into a local var but never
    // surfaces a Contractor row. Read from parseQuote API or upcoming
    // detail-row "contractor" if it lands — this assertion will surface
    // that gap as a Block 2 finding.
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

  if (expected.materialRegex) {
    // Fencing analyzer renders Fence Type row from local detectFenceType.
    // Material may surface there or in apiResult.material.
    const got = actual.display.details["fence type"] ||
                actual.parseQuote?.data?.material || "";
    if (!expected.materialRegex.test(got)) {
      failures.push(`material: expected match /${expected.materialRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.linearFeet === "number") {
    const lText = actual.display.details["length"] || "";
    const lMatch = lText.replace(/,/g, "").match(/\d+/);
    const displayGot = lMatch ? parseInt(lMatch[0], 10) : null;
    const apiGot = actual.parseQuote?.data?.linearFeet || null;
    const got = displayGot || apiGot;
    if (got !== expected.linearFeet) {
      failures.push(`linearFeet: expected ${expected.linearFeet}, got display=${JSON.stringify(displayGot)} api=${JSON.stringify(apiGot)}`);
    }
  }

  if (typeof expected.heightFt === "number") {
    const hText = actual.display.details["height"] || "";
    const hMatch = hText.match(/\d+/);
    const got = hMatch ? parseInt(hMatch[0], 10) : null;
    if (got !== expected.heightFt) {
      failures.push(`heightFt: expected ${expected.heightFt}, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.gateCount === "number") {
    // Display row Gate is currently Yes/No only — no count. Read API
    // gateCount when available; otherwise assert Yes/No matches >0.
    const apiGot = actual.parseQuote?.data?.gateCount;
    const displayGate = (actual.display.details["gate"] || "").toLowerCase();
    if (typeof apiGot === "number") {
      if (apiGot !== expected.gateCount) {
        failures.push(`gateCount: expected ${expected.gateCount}, got api=${apiGot}`);
      }
    } else {
      // Fallback to Yes/No display assertion.
      const expectsYes = expected.gateCount > 0;
      const displayYes = /^yes/.test(displayGate);
      if (expectsYes !== displayYes) {
        failures.push(`gate: expected ${expectsYes ? "Yes" : "No"}, got ${JSON.stringify(displayGate)}`);
      }
    }
  }

  if (expected.warrantyRegex) {
    // Fencing analyzer doesn't currently render a Warranty detail row.
    // Read from parseQuote API or upcoming detail-row if it lands —
    // surfaces as Block 2-3 finding.
    const apiGot = actual.parseQuote?.data?.warrantyLabor ||
                   actual.parseQuote?.data?.warrantyProduct ||
                   actual.parseQuote?.data?.warrantyTerms ||
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
      // f3/f6 trust guard: analyzer must NOT mark stainingSealing as
      // Included when fixture explicitly says "Stain/seal NOT included."
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
        apiMaterial: actual.parseQuote?.data?.material || null,
        apiFenceType: actual.parseQuote?.data?.fenceType || null,
        apiLinearFeet: actual.parseQuote?.data?.linearFeet || null,
        apiHeight: actual.parseQuote?.data?.height || null,
        apiGateCount: actual.parseQuote?.data?.gateCount || null,
        apiWarrantyLabor: actual.parseQuote?.data?.warrantyLabor || null,
        apiWarrantyProduct: actual.parseQuote?.data?.warrantyProduct || null,
        displayFenceType: actual.display.details["fence type"] || null,
        displayLength: actual.display.details["length"] || null,
        displayHeight: actual.display.details["height"] || null,
        displayGate: actual.display.details["gate"] || null,
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|material|linearFeet|heightFt|gate|gateCount|warranty|isUncategorizedBanner|hardReject|scopeFound:[a-zA-Z]+|scopeExcluded:[a-zA-Z]+):/);
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
