// Foundation fixture ground-truth harness.
// Reads 7 hand-curated fixtures, uploads each through the live analyzer at
// /foundation-quote-analyzer.html, and asserts displayed total / repair type /
// pricing-region / scope checklist + API-side contractor / stateCode / numPiers /
// warrantyType / transferable / engineerReport against ground truth captured
// 2026-05-03.
//
// Run: node test/foundation/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/kitchen/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Foundation-specific assertions (vs roofing/HVAC/auto-repair/plumbing/electrical/kitchen):
//   - repairTypeRegex: pier_push / pier_helical / slabjacking / wall_anchors /
//     polyurethane_foam etc. The biggest trust-critical bug class is benchmark
//     mismatch: analyzer benchmarks every quote against default "moderate (6 piers)"
//     because pierCount is not read from quote text. An 8-pier quote at fair
//     market rate gets verdicted "Above Average" purely because analyzer benchmark
//     uses 6 piers not 8.
//   - numPiers: parsed.numPiers from Claude. Should match the count in the
//     fixture text ("8 piers required" in all 3 Houston fixtures + the mock).
//   - warrantyType / transferable: f1 lifetime+transferable, f2 25-year+transferable,
//     f3 lifetime+transferable on piers only.
//   - engineerReport: f1=true (line item), f2=true (line item $700), f3=FALSE
//     (explicitly "Engineer report not included; recommend client obtain
//     separately ($400)"). Critical: analyzer scopeSignals for "inspection"
//     uses /inspect|engineer|structural\s*report|assessment/i which matches
//     "Engineer report not included" → falsely marks engineering as Included
//     for f3. Same false-positive class as kitchen K4 (Appliances NOT included).
//   - contractorRegex: 7 distinct names (Citadel / Gulf Coast / Anchor /
//     Foundation Pros). API schema added contractor 2026-05-03 (CMP-CONTRACTOR
//     commit 24535039c0a, cacheNamespace bumped to v4-cmp-contractor-2026-05-03).
//     Analyzer page does NOT yet surface a Contractor detail row. Expected
//     Block 2 finding.
//
// Foundation analyzer uses the SHARED price-confirm UI (tpConfirmPriceBtn /
// tpManualPriceBtn) plus an INLINE wrong-vertical hard-reject with button id
// fdnHardRejectStartOver. Detail rows have class .found-detail. Scope rows
// live in <ul class="found-scope">.

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-citadel-high",
    file: "test-quotes/foundation-images/comparison-pier-high.png",
    expect: {
      // TOTAL: $12,800 (Citadel Structural Solutions, TX FN-100422,
      // Houston TX 77007). 8 helical piers (deeper bedrock load path),
      // pre-installation engineering assessment $1,200, permit/inspection
      // $600, drainage diversion $1,100, cleanup/sod $500. Lifetime fully
      // transferable warranty (engineer-stamped). Soil test included; pier
      // depths sized to refusal. Premium-tier helical-pier job.
      price: 12800,
      contractorRegex: /citadel\s*structural/i,
      stateCode: "TX",
      // Analyzer detectFoundationRepairType uses /\bpier\b|push\s*pier|helical|underpinning/i
      // → "Pier Installation". API parsed.repairType expected pier_helical.
      repairTypeRegex: /pier\s*installation/i,
      apiRepairTypeRegex: /helical|pier_helical|pier_push/i,
      numPiers: 8,
      warrantyTypeRegex: /lifetime/i,
      transferable: true,
      engineerReport: true,
      scopeFound: ["inspection", "piers", "drainage", "warranty", "permits"],
      // f1 quote text does NOT mention waterproofing/landscaping/monitoring.
      // The analyzer regex /landscap|yard|lawn|restoration|cleanup/ matches
      // "cleanup, sod replacement, haul-off" → marks landscaping included
      // (defensible). Backfill regex /backfill|compact|fill\s*material|soil\s*replac/
      // doesn't match "Drainage diversion" so backfill stays not-mentioned.
      scopeAbsent: ["waterproofing", "monitoring"],
    },
  },
  {
    id: "f2-gulf-coast-mid",
    file: "test-quotes/foundation-images/comparison-pier-mid.png",
    expect: {
      // TOTAL: $8,750 (Gulf Coast Foundation, TX FN-99812, Houston TX 77092).
      // 8 steel push piers $7,200, permit/inspection coordination $450,
      // engineer's report included $700, cleanup/grade restoration $400.
      // 25-year transferable on workmanship+materials. Includes structural
      // engineer's letter for closing/insurance. Drainage assessment included
      // (recommends gutter/grade fixes). Mid-tier steel push-pier job.
      price: 8750,
      contractorRegex: /gulf\s*coast\s*foundation/i,
      stateCode: "TX",
      repairTypeRegex: /pier\s*installation/i,
      apiRepairTypeRegex: /pier_push|push|steel/i,
      numPiers: 8,
      // Allow "limited" since 25-year term may map to limited not lifetime.
      warrantyTypeRegex: /limited|25/i,
      transferable: true,
      engineerReport: true,
      scopeFound: ["inspection", "piers", "drainage", "warranty", "permits"],
      scopeAbsent: ["waterproofing", "monitoring"],
    },
  },
  {
    id: "f3-anchor-low",
    file: "test-quotes/foundation-images/comparison-pier-low.png",
    expect: {
      // TOTAL: $6,900 (Anchor Foundation Repair, TX FNDX-44218, Houston TX 77055).
      // Hydraulic concrete pier installation (8 piers) $5,200, excavation/
      // underpinning $1,400, site cleanup/haul-off $300. Lifetime transferable
      // on piers (lifetime of structure). Free re-leveling if pier moves >1".
      // EXPLICITLY "Engineer report not included; recommend client obtain
      // separately ($400)". Lowest-tier hydraulic-concrete pier job. The
      // engineer-not-included is the F1-class trust-critical guard target:
      // analyzer scope regex /inspect|engineer|structural\s*report|assessment/
      // matches "Engineer report not included" → falsely marks Included.
      price: 6900,
      contractorRegex: /anchor\s*foundation\s*repair/i,
      stateCode: "TX",
      repairTypeRegex: /pier\s*installation/i,
      apiRepairTypeRegex: /pier|concrete|hydraulic/i,
      numPiers: 8,
      warrantyTypeRegex: /lifetime/i,
      transferable: true,
      // Trust-critical: must register as FALSE (or unclear), not true.
      engineerReport: false,
      scopeFound: ["piers", "excavation", "warranty"],
      // Analyzer falsely reports inspection=included on f3. F3 trust guard.
      scopeExcluded: ["inspection"],
    },
  },
  {
    id: "f4-citadel-high-messy",
    file: "test-quotes/foundation-images/messy-comparison-pier-high.jpg",
    expect: {
      // Same content as f1 but skewed/grayscale photo render — tests OCR
      // robustness at edge alignment.
      price: 12800,
      contractorRegex: /citadel\s*structural/i,
      stateCode: "TX",
      repairTypeRegex: /pier\s*installation/i,
      apiRepairTypeRegex: /helical|pier_helical|pier_push/i,
      numPiers: 8,
      warrantyTypeRegex: /lifetime/i,
      transferable: true,
      engineerReport: true,
      scopeFound: ["inspection", "piers", "drainage", "warranty", "permits"],
    },
  },
  {
    id: "f5-gulf-coast-mid-messy",
    file: "test-quotes/foundation-images/messy-comparison-pier-mid.jpg",
    expect: {
      price: 8750,
      contractorRegex: /gulf\s*coast\s*foundation/i,
      stateCode: "TX",
      repairTypeRegex: /pier\s*installation/i,
      apiRepairTypeRegex: /pier_push|push|steel/i,
      numPiers: 8,
      warrantyTypeRegex: /limited|25/i,
      transferable: true,
      engineerReport: true,
      scopeFound: ["inspection", "piers", "drainage", "warranty", "permits"],
    },
  },
  {
    id: "f6-anchor-low-messy",
    file: "test-quotes/foundation-images/messy-comparison-pier-low.jpg",
    expect: {
      price: 6900,
      contractorRegex: /anchor\s*foundation\s*repair/i,
      stateCode: "TX",
      repairTypeRegex: /pier\s*installation/i,
      apiRepairTypeRegex: /pier|concrete|hydraulic/i,
      numPiers: 8,
      warrantyTypeRegex: /lifetime/i,
      transferable: true,
      engineerReport: false,
      scopeFound: ["piers", "excavation", "warranty"],
      scopeExcluded: ["inspection"],
    },
  },
  {
    id: "f7-mock-foundation-pros-nc",
    file: "test-quotes/foundation-images/mock-01.png",
    expect: {
      // TOTAL: $21,115 (Foundation Pros LLC, Charlotte NC 28202). 8 steel
      // push piers @ $1,500 ea = $12,000, independent structural engineer
      // evaluation $850, pier installation labor $4,200, drainage tile
      // install (40 LF) $1,800, grading correction $750, permit $320,
      // 25-year transferable warranty. Subtotal $19,920 + 6% sales tax
      // $1,195 = $21,115. Mocks 02-10 are identical templates with only
      // contractor name varying — same scope/total/state. We benchmark
      // only mock-01 to avoid 9 redundant fixtures.
      // Trust-critical class: analyzer benchmark uses default "moderate
      // (6 piers)" while quote has 8 piers + engineer + drainage tile.
      // A fair-priced 8-pier comprehensive job verdicts as "Overpriced"
      // because pier count + scope breadth aren't read into the benchmark.
      price: 21115,
      contractorRegex: /foundation\s*pros/i,
      stateCode: "NC",
      repairTypeRegex: /pier\s*installation/i,
      apiRepairTypeRegex: /pier_push|push|steel/i,
      numPiers: 8,
      warrantyTypeRegex: /limited|25/i,
      transferable: true,
      engineerReport: true,
      scopeFound: ["inspection", "piers", "drainage", "warranty", "permits"],
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
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/foundation-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/foundation-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /foundation-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Foundation analyzer:
  //   - Inline wrong-vertical hard-reject (id fdnHardRejectStartOver) runs FIRST.
  //   - Otherwise renderPriceConfirmation shows tpConfirmPriceBtn (price found)
  //     OR tpManualPriceBtn (no price). Shared hard-reject id is tpHardRejectStartOver.
  //   - High-confidence parser short-circuits straight to .verdict-price.
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("fdnHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver") ||
                     !!document.getElementById("fdnHardRejectStartOver"),
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
    await page.type("#tpManualPrice", "10000");
    await page.click("#tpManualPriceBtn");
  }

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    const verdictEl = document.querySelector(".verdict-price");
    const verdictText = verdictEl ? verdictEl.innerText : "";
    const verdictMatch = verdictText.match(/\$([\d,]+(?:\.\d+)?)/);

    // Foundation detail rows: <div class="found-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".found-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    // Scope Review checklist: <ul class="found-scope"><li>... <icon>... <label>...
    // <statusLabel></li>. The label text uses canonical key names matching
    // FOUND_PRICING.scopeItems: "Structural inspection / engineering report",
    // "Piers (steel push piers or helical piers)", "Pier brackets and hardware",
    // "Excavation and soil work", "Waterproofing", "Drainage", "Backfill",
    // "Monitoring", "Warranty (transferable / lifetime)", "Permit", "Landscaping
    // restoration". We map each li back to the scopeSignals key by scanning
    // visible text, then capture status (Included | Not included | Not mentioned).
    const scope = {};
    const scopeMap = [
      [/structural\s*inspection|engineer/i, "inspection"],
      [/piers/i, "piers"],
      [/brackets|hardware/i, "brackets"],
      [/excavation|soil\s*work/i, "excavation"],
      [/waterproof/i, "waterproofing"],
      [/drainage/i, "drainage"],
      [/backfill/i, "backfill"],
      [/monitor/i, "monitoring"],
      [/warranty/i, "warranty"],
      [/permit/i, "permits"],
      [/landscap/i, "landscaping"],
    ];
    document.querySelectorAll(".found-scope li").forEach(li => {
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

    // Generic uncategorized-banner detection (not currently surfaced on
    // foundation analyzer, but parity copy may land later).
    const isUncategorizedBanner = /couldn[’']t identify the specific (foundation|repair)/i.test(text);

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
    if (r.url.includes("/api/foundation-estimate") || r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not foundation");
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
    // Foundation analyzer doesn't currently render Contractor in found-detail
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

  if (expected.repairTypeRegex) {
    const tier = actual.display.details["repair type"] || "";
    if (!expected.repairTypeRegex.test(tier)) {
      failures.push(`repairType: expected match /${expected.repairTypeRegex.source}/, got ${JSON.stringify(tier)}`);
    }
  }

  if (expected.apiRepairTypeRegex) {
    const got = actual.parseQuote?.data?.repairType || "";
    if (!expected.apiRepairTypeRegex.test(got)) {
      failures.push(`apiRepairType: expected match /${expected.apiRepairTypeRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.numPiers === "number") {
    const got = actual.parseQuote?.data?.numPiers;
    if (got !== expected.numPiers) {
      failures.push(`numPiers: expected ${expected.numPiers}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.warrantyTypeRegex) {
    const got = actual.parseQuote?.data?.warrantyType || "";
    if (!expected.warrantyTypeRegex.test(got)) {
      failures.push(`warrantyType: expected match /${expected.warrantyTypeRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.transferable === "boolean") {
    const got = actual.parseQuote?.data?.transferable;
    if (got !== expected.transferable) {
      failures.push(`transferable: expected ${expected.transferable}, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.engineerReport === "boolean") {
    const got = actual.parseQuote?.data?.engineerReport;
    if (got !== expected.engineerReport) {
      failures.push(`engineerReport: expected ${expected.engineerReport}, got ${JSON.stringify(got)}`);
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
      // Accept Included only.
      if (!/^included$/i.test(got)) {
        failures.push(`scopeFound:${key}: expected "Included", got ${JSON.stringify(got)}`);
      }
    }
  }

  if (Array.isArray(expected.scopeExcluded)) {
    for (const key of expected.scopeExcluded) {
      const got = (actual.display.scope || {})[key] || "(missing row)";
      // f3 trust guard: analyzer must NOT mark inspection as Included when
      // fixture explicitly says "Engineer report not included; recommend
      // client obtain separately ($400)".
      if (/^included$/i.test(got)) {
        failures.push(`scopeExcluded:${key}: expected NOT "Included", got ${JSON.stringify(got)}`);
      }
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
        apiRepairType: actual.parseQuote?.data?.repairType || null,
        numPiers: actual.parseQuote?.data?.numPiers ?? null,
        warrantyType: actual.parseQuote?.data?.warrantyType || null,
        transferable: actual.parseQuote?.data?.transferable ?? null,
        engineerReport: actual.parseQuote?.data?.engineerReport ?? null,
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|repairType|apiRepairType|numPiers|warrantyType|transferable|engineerReport|isUncategorizedBanner|hardReject|scopeFound:[a-z]+|scopeExcluded:[a-z]+):/);
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
