// Legal fixture ground-truth harness.
// Reads 9 hand-curated legal fixtures, uploads each through the live analyzer
// at /legal-fee-analyzer.html, and asserts the displayed fee type / fee value /
// practice area / state code / firm name / hard-reject state against ground
// truth captured 2026-05-03.
//
// Run: node test/legal/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/kitchen/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Legal-specific assertions (vs kitchen/electrical/HVAC):
//   - No single "headline price" — feeType drives which value to assert:
//       contingency: assert contingencyPct
//       hourly:      assert hourlyRate (and optionally retainerAmount)
//       flat:        assert flatFee
//   - The legal analyzer auto-renders the verdict (no tpConfirmPriceBtn /
//     tpManualPriceBtn flow). It calls TP_Engine.analyzeQuote, which posts to
//     /api/legal-fee-estimate and returns AI-extracted fields.
//   - DOM hooks: .lf-summary-item rows with .label/.value pairs.
//     Visible labels: "Hourly Rate", "Contingency", "Flat Fee", "Fee"
//     (when feeType not handled), "Practice Area", "Market Mid".
//   - Hard-reject button id from wrong-vertical-guard.min.js: tpWvgStartOver.
//
// Known carry-over bug (LF-1, pre-flight finding): legal-fee-analyzer.html
// reads api.feeType / api.contingencyPct / api.firm but the API
// (api/legal-fee-estimate.js) returns feeStructure / contingencyPercent /
// firmName. This baseline will likely show "Fee: Not detected" + "Unknown
// Attorney" across most fixtures and will be the first Block-1 fix.

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-pi-low-brighton",
    file: "test-quotes/legal-images/comparison-pi-01-firm-a-low.png",
    expect: {
      // Brighton & Sage Injury Lawyers, Charlotte NC 28204. Contingency
      // 33% flat. Case value $42K-$68K, attorney fee at midpoint = $18,150.
      feeStructure: "contingency",
      contingencyPct: 33,
      practiceArea: "personal_injury",
      stateCode: "NC",
      firmRegex: /brighton.*sage|brighton/i,
      isHardReject: false,
    },
  },
  {
    id: "f2-pi-mid-kestrel",
    file: "test-quotes/legal-images/comparison-pi-02-firm-b-mid.png",
    expect: {
      // Kestrel Injury Law, Charlotte NC 28209. Tiered contingency
      // 35%/40%/45% (pre-suit/post-suit/trial). Per API prompt rule,
      // contingencyPercent should be the LOWEST tier = 35.
      feeStructure: "contingency",
      contingencyPct: 35,
      practiceArea: "personal_injury",
      stateCode: "NC",
      firmRegex: /kestrel/i,
      isHardReject: false,
    },
  },
  {
    id: "f3-pi-high-stratton",
    file: "test-quotes/legal-images/comparison-pi-03-firm-c-high.png",
    expect: {
      // Stratton & Caine Trial Attorneys, Charlotte NC 28202. Contingency
      // 40% flat (+5% appellate). Should classify as "above" (>40 trigger
      // is strict-greater, so 40 is at threshold; verdict can be "fair"
      // OR "above" — accept either).
      feeStructure: "contingency",
      contingencyPct: 40,
      practiceArea: "personal_injury",
      stateCode: "NC",
      firmRegex: /stratton|caine/i,
      isHardReject: false,
    },
  },
  {
    id: "f4-pi-low-messy",
    file: "test-quotes/legal-images/messy-comparison-pi-01-firm-a-low.jpg",
    expect: {
      // Same content as f1, skewed/grayscale render.
      feeStructure: "contingency",
      contingencyPct: 33,
      practiceArea: "personal_injury",
      stateCode: "NC",
      firmRegex: /brighton.*sage|brighton/i,
      isHardReject: false,
    },
  },
  {
    id: "f5-pi-mid-messy",
    file: "test-quotes/legal-images/messy-comparison-pi-02-firm-b-mid.jpg",
    expect: {
      feeStructure: "contingency",
      contingencyPct: 35,
      practiceArea: "personal_injury",
      stateCode: "NC",
      firmRegex: /kestrel/i,
      isHardReject: false,
    },
  },
  {
    id: "f6-pi-high-messy",
    file: "test-quotes/legal-images/messy-comparison-pi-03-firm-c-high.jpg",
    expect: {
      feeStructure: "contingency",
      contingencyPct: 40,
      practiceArea: "personal_injury",
      stateCode: "NC",
      firmRegex: /stratton|caine/i,
      isHardReject: false,
    },
  },
  {
    id: "f7-hourly-retainer-blackwood",
    file: "test-quotes/legal-images/02-hourly-retainer-litigation.png",
    expect: {
      // Blackwood Steel Attorneys, Charlotte NC 28202. Civil litigation /
      // commercial disputes. Senior partner $585/hr (lead). $15,000
      // initial retainer. Fee structure is hourly+retainer; Claude reports
      // either "hourly" or "hybrid" depending on run — both correct, since
      // a retainer drawn down hourly IS technically hybrid. The renderer
      // falls back to "hourly" feeType when hourlyRate is set, so the
      // display is identical either way.
      feeStructureRegex: /^(hourly|hybrid)$/,
      hourlyRate: 585,
      retainerAmount: 15000,
      practiceArea: "general_litigation",
      stateCode: "NC",
      firmRegex: /blackwood.*steel|blackwood/i,
      isHardReject: false,
    },
  },
  {
    id: "f8-flat-criminal-falconer",
    file: "test-quotes/legal-images/06-criminal-defense-flat-fee.png",
    expect: {
      // Falconer Law Firm, Mobile AL 36604. DUI first offense. Flat fee
      // $3,500 ($1,500 due signing — must NOT be picked up as the
      // headline; per API prompt rule, flatFee=3500 not 1500).
      feeStructure: "flat_fee",
      flatFee: 3500,
      practiceArea: "criminal_defense",
      stateCode: "AL",
      firmRegex: /falconer/i,
      isHardReject: false,
    },
  },
  {
    id: "f9-real-photo-invoice",
    file: "test-quotes/real-quotes/legal/fixture-attorney-invoice.jpg",
    expect: {
      // Henderson & Cole, PLLC, San Antonio TX 78205. Estate planning /
      // trust admin invoice for March 2026. 11.5 hours @ $350/hr = $4,025
      // + $75 filing fees = $4,100 total due. Hourly rate = $350.
      // Photographic capture on dark background — OCR-hostile.
      feeStructure: "hourly",
      hourlyRate: 350,
      practiceArea: "estate_planning",
      stateCode: "TX",
      firmRegex: /henderson.*cole|henderson/i,
      isHardReject: false,
    },
  },
];

async function uploadAndCapture(browser, fixture) {
  const page = await browser.newPage();
  await preparePage(page, BASE);
  page.setDefaultTimeout(120000);
  await page.setViewport({ width: 1440, height: 900 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/legal-fee-estimate") || res.url().includes("/api/calibration") || res.url().includes("/api/parse-quote")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/legal-fee-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /legal-fee-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Legal analyzer auto-renders (no price-confirm flow). Wait for either:
  //   - .lf-verdict (rendered result)
  //   - tpWvgStartOver (wrong-vertical hard-reject)
  //   - error-fallback "Try Again" card
  await page.waitForFunction(() => {
    return !!document.querySelector(".lf-verdict") ||
           !!document.getElementById("tpWvgStartOver") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           /Try Again/i.test(document.body.innerText);
  }, { timeout: 120000 }).catch(() => null);

  // Give the result render a moment to fully settle.
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    const verdictLabel = (document.querySelector(".verdict-label") || {}).innerText || "";
    const verdictTitle = (document.querySelector(".verdict-title") || {}).innerText || "";

    // Capture .lf-summary-item rows: { "hourly rate": "$585/hr", ... }
    const details = {};
    document.querySelectorAll(".lf-summary-item").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    // Attorney/firm shown in the verdict card subtitle (sibling div with
    // color #64748b inside .lf-verdict). We just grab .lf-verdict's
    // entire innerText and parse out the practice-area-bullet line.
    const verdictCard = document.querySelector(".lf-verdict");
    const verdictText = verdictCard ? verdictCard.innerText : "";

    const isHardReject = !!document.getElementById("tpWvgStartOver") ||
                         !!document.getElementById("tpHardRejectStartOver") ||
                         /This is not (a|an) [a-z\s]+/i.test(text);

    return {
      verdictLabel,
      verdictTitle,
      verdictText,
      details,
      isHardReject,
      bodyTextSlice: text.slice(0, 2500),
    };
  });

  let parseQuote = null;
  for (const r of apiResponses) {
    if (r.url.includes("/api/legal-fee-estimate")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote };
}

function compare(label, actual, expected) {
  const failures = [];

  if (expected.isHardReject === false && actual.display.isHardReject) {
    failures.push("hardReject: vertical-detect rejected this legal fixture (expected to pass through)");
    return failures;
  }
  if (expected.isHardReject === true && !actual.display.isHardReject) {
    failures.push("hardReject: expected vertical-detect rejection, but got rendered result");
    return failures;
  }

  // feeStructure / fee value pulled preferentially from the API response
  // (canonical machine-readable). Fall back to display labels.
  const apiData = actual.parseQuote && actual.parseQuote.data ? actual.parseQuote.data : null;

  if (expected.feeStructure) {
    const got = apiData ? apiData.feeStructure : null;
    if (got !== expected.feeStructure) {
      failures.push(`feeStructure: expected ${JSON.stringify(expected.feeStructure)}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.feeStructureRegex) {
    const got = apiData ? apiData.feeStructure : null;
    if (!got || !expected.feeStructureRegex.test(got)) {
      failures.push(`feeStructure: expected match /${expected.feeStructureRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.contingencyPct === "number") {
    const got = apiData ? Number(apiData.contingencyPercent) : null;
    if (got == null || isNaN(got) || Math.abs(got - expected.contingencyPct) > 1) {
      failures.push(`contingencyPct: expected ~${expected.contingencyPct}, got ${JSON.stringify(got)}`);
    }
    // Display-side cross-check: "Contingency" row should show the same %
    const dispVal = (actual.display.details["contingency"] || "").replace(/[^\d.]/g, "");
    if (dispVal && Math.abs(parseFloat(dispVal) - expected.contingencyPct) > 1) {
      failures.push(`contingencyDisplay: expected /${expected.contingencyPct}/, got ${JSON.stringify(actual.display.details["contingency"])}`);
    } else if (!dispVal) {
      // The display row may be missing entirely (LF-1 known bug).
      failures.push(`contingencyDisplay: row missing — got ${JSON.stringify(actual.display.details["fee"] || actual.display.details["contingency"])}`);
    }
  }

  if (typeof expected.hourlyRate === "number") {
    const got = apiData ? Number(apiData.hourlyRate) : null;
    if (got == null || isNaN(got) || Math.abs(got - expected.hourlyRate) > 25) {
      failures.push(`hourlyRate: expected ~${expected.hourlyRate}, got ${JSON.stringify(got)}`);
    }
    const dispVal = (actual.display.details["hourly rate"] || "").replace(/[^\d]/g, "");
    if (!dispVal || Math.abs(parseFloat(dispVal) - expected.hourlyRate) > 25) {
      failures.push(`hourlyRateDisplay: expected /${expected.hourlyRate}/, got ${JSON.stringify(actual.display.details["hourly rate"] || actual.display.details["fee"])}`);
    }
  }

  if (typeof expected.flatFee === "number") {
    const got = apiData ? Number(apiData.flatFee) : null;
    if (got == null || isNaN(got) || Math.abs(got - expected.flatFee) > 50) {
      failures.push(`flatFee: expected ~${expected.flatFee}, got ${JSON.stringify(got)}`);
    }
    const dispVal = (actual.display.details["flat fee"] || "").replace(/[^\d]/g, "");
    if (!dispVal || Math.abs(parseFloat(dispVal) - expected.flatFee) > 50) {
      failures.push(`flatFeeDisplay: expected /${expected.flatFee}/, got ${JSON.stringify(actual.display.details["flat fee"] || actual.display.details["fee"])}`);
    }
  }

  if (typeof expected.retainerAmount === "number") {
    const got = apiData ? Number(apiData.retainerAmount) : null;
    if (got == null || isNaN(got) || Math.abs(got - expected.retainerAmount) > 100) {
      failures.push(`retainerAmount: expected ~${expected.retainerAmount}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.practiceArea) {
    const got = apiData ? apiData.practiceArea : null;
    if (got !== expected.practiceArea) {
      failures.push(`practiceArea: expected ${JSON.stringify(expected.practiceArea)}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.stateCode) {
    const got = apiData ? (apiData.stateCode || "").toUpperCase() : null;
    if (got !== expected.stateCode) {
      failures.push(`stateCode: expected ${JSON.stringify(expected.stateCode)}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.firmRegex) {
    const apiFirm = apiData ? apiData.firmName : null;
    const verdictTextHasFirm = expected.firmRegex.test(actual.display.verdictText || "");
    if (!apiFirm || !expected.firmRegex.test(apiFirm)) {
      failures.push(`firmName(API): expected match /${expected.firmRegex.source}/, got ${JSON.stringify(apiFirm)}`);
    }
    if (!verdictTextHasFirm) {
      failures.push(`firmDisplay: verdict card missing firm match /${expected.firmRegex.source}/`);
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
        verdictLabel: actual.display.verdictLabel,
        verdictTitle: actual.display.verdictTitle,
        details: actual.display.details,
        isHardReject: actual.display.isHardReject,
        firmName: actual.parseQuote?.data?.firmName || null,
        feeStructure: actual.parseQuote?.data?.feeStructure || null,
        hourlyRate: actual.parseQuote?.data?.hourlyRate ?? null,
        flatFee: actual.parseQuote?.data?.flatFee ?? null,
        contingencyPercent: actual.parseQuote?.data?.contingencyPercent ?? null,
        retainerAmount: actual.parseQuote?.data?.retainerAmount ?? null,
        practiceArea: actual.parseQuote?.data?.practiceArea || null,
        stateCode: actual.parseQuote?.data?.stateCode || null,
        firmSize: actual.parseQuote?.data?.firmSize || null,
        firmSizeMult: actual.parseQuote?.data?.pricingContext?.firmSizeMultiplier ?? null,
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
    const m1 = msg.match(/^(feeStructure|contingencyPct|contingencyDisplay|hourlyRate|hourlyRateDisplay|flatFee|flatFeeDisplay|retainerAmount|practiceArea|stateCode|firmName\(API\)|firmDisplay|hardReject):/);
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
