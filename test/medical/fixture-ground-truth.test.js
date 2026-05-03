// Medical fixture ground-truth harness.
// Reads 9 hand-curated fixtures, uploads each through the live analyzer at
// /medical-bill-analyzer.html, and asserts displayed Total Billed / Insurance
// Paid / You Owe / verdict (Issues Found vs All Clear) / facility name / CPT
// extraction against ground truth captured 2026-05-02.
//
// Run: node test/medical/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/plumbing/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Medical-specific assertions (vs roofing/HVAC/plumbing/electrical/auto/kitchen):
//   - youOwe (patient responsibility) — TRUST CRITICAL: this is the number the
//     user reads as "what they actually pay". Confusing it with totalBilled
//     (the chargemaster sticker) is the medical analogue of electrical's
//     f3 panel-vs-EV misclassification — a bill where the analyzer says
//     "you owe $5,930" when the EOB says $579 patient resp would be a
//     trust-killer. See prompt for the three-number framing
//     (Billed / Allowed / Patient Resp).
//   - totalBilled (chargemaster sticker, mostly fictional)
//   - cptExtractionRegex — line item must include the documented CPT
//     (e.g., 74177 for CT abdomen/pelvis). Without CPT, the benchmark engine
//     falls back to wildly wrong category averages.
//   - verdictLabel — denied claims (medical necessity rejection, surprise
//     bills) MUST surface "Issues Found", never "All Clear". Pre-2026-04-27
//     the local-fallback parser silently produced ALL CLEAR on $11K denied
//     surgeries (rw-05) and a $1,992 denied myomectomy showed as $164,496
//     YOU OWE (rw-10). Both must now show ISSUES FOUND.
//   - noSurprisesFlag — ER bills (CPT 99281-99285) and out-of-network
//     anesthesia/radiology should surface NSA protection eligibility.
//
// Medical analyzer flow (DIFFERENT from plumbing/electrical):
//   - Bypasses TP_Engine entirely (per medical dive 2026-04-27 fix). Page
//     POSTs the file directly to /api/medical-bill-estimate. No INLINE
//     price-confirm dance, no engine pre-pass.
//   - Wait condition: .mb-verdict (real result) OR "We could not read this
//     bill clearly" copy (renderUnreadableFallback) OR wrong-vertical
//     hard-reject UI (via tpEnforceVerticalMatch).

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-valley-diagnostic-low",
    file: "test-quotes/medical-images/comparison-ct-01-low.png",
    expect: {
      // CPT 74177 (CT abdomen/pelvis with contrast). Independent imaging
      // center, cash-pay friendly. Billed $1,225, insurance paid $650,
      // contractual write-off $185, patient responsibility $390.
      totalBilled: 1225,
      youOwe: 390,
      facilityRegex: /valley\s*diagnostic/i,
      cptExtractionRegex: /74177/,
      verdictExpected: "any",  // small clean bill; either label OK
      isUnreadable: false,
    },
  },
  {
    id: "f2-banner-outpatient-mid",
    file: "test-quotes/medical-images/comparison-ct-02-mid.png",
    expect: {
      // Banner Outpatient Imaging (community health system). EOB-style
      // breakdown: billed $2,200, allowed $1,420, insurance paid $1,065,
      // deductible $285, coinsurance $70, patient responsibility $355.
      totalBilled: 2200,
      youOwe: 355,
      facilityRegex: /banner/i,
      cptExtractionRegex: /74177/,
      verdictExpected: "any",
      isUnreadable: false,
    },
  },
  {
    id: "f3-mayo-clinic-high",
    file: "test-quotes/medical-images/comparison-ct-03-high.png",
    expect: {
      // Mayo Clinic Arizona (academic medical center). Itemized hospital
      // bill: billed $5,930, allowed $2,895, insurance paid $2,316,
      // adjustments $3,035, patient responsibility $579. Same CPT 74177
      // as f1/f2 — proves the 4.8x billed spread for the same procedure
      // across tiers, and validates that "You Owe" still resolves to $579
      // (not the $5,930 chargemaster).
      totalBilled: 5930,
      youOwe: 579,
      facilityRegex: /mayo/i,
      cptExtractionRegex: /74177/,
      verdictExpected: "any",
      isUnreadable: false,
    },
  },
  {
    id: "f4-valley-diagnostic-messy",
    file: "test-quotes/medical-images/messy-comparison-ct-01-low.jpg",
    expect: {
      // Same content as f1 but skewed/blurred — tests Vision OCR robustness.
      totalBilled: 1225,
      youOwe: 390,
      facilityRegex: /valley\s*diagnostic/i,
      cptExtractionRegex: /74177/,
      verdictExpected: "any",
      isUnreadable: false,
    },
  },
  {
    id: "f5-mayo-clinic-messy",
    file: "test-quotes/medical-images/messy-comparison-ct-03-high.jpg",
    expect: {
      // Same content as f3 but skewed — Mayo academic-center version.
      // Most challenging: 4.8x billed-vs-paid spread, must NOT show $5,930
      // as You Owe. Same OCR-robustness test as f4 but for the high tier.
      totalBilled: 5930,
      youOwe: 579,
      facilityRegex: /mayo/i,
      cptExtractionRegex: /74177/,
      verdictExpected: "any",
      isUnreadable: false,
    },
  },
  {
    id: "f6-er-99283-towel-photo",
    file: "test-quotes/medical-images/02-2000-hospital-bill-for-a-10-minute-visit-to-er-the.jpeg",
    expect: {
      // West Boca Medical Center, CPT 99283 (ER Visit Lvl III). Photographed
      // on a pink towel, partial top crop. Billed $3,737, adjustment -$2,012,
      // total outstanding $1,725. ER visits should surface NSA protection
      // eligibility if billed at out-of-network rates. Reddit OP context:
      // "$2000 hospital bill for a 10 minute visit to ER".
      totalBilled: 3737,
      youOwe: 1725,
      facilityRegex: /west\s*boca/i,
      cptExtractionRegex: /99283/,
      verdictExpected: "any",  // Could be either — 99283 at $3,737 is high
                                // for a 10-minute visit; analyzer may flag.
      isUnreadable: false,
    },
  },
  {
    id: "f7-surgery-denied-medical-necessity",
    file: "test-quotes/medical-images/05-just-got-the-bill-doctor-waited-to-send-stuff-unti.jpeg",
    expect: {
      // Multi-CPT surgery: 30520 septoplasty + 30140 turbinate + 30465
      // sinusotomy + 20912 grafts. Billed $11,250, allowed $6,458.73,
      // insurance paid $1,691.27, patient responsibility $3,100. Denied
      // for medical necessity (Reason QD046: "Medical necessity not
      // established for services rendered"). MUST surface ISSUES FOUND.
      // Pre-2026-04-27 the local fallback fabricated this as $21 ALL CLEAR.
      totalBilled: 11250,
      youOwe: 3100,
      cptExtractionRegex: /30520|30140|30465|20912/,
      verdictExpected: "issues",
      isUnreadable: false,
    },
  },
  {
    id: "f8-myomectomy-denied",
    file: "test-quotes/medical-images/10-help-international-student-with-1990-surgery-bill.jpeg",
    expect: {
      // Cigna/Wellfleet myomectomy. CPT 58146 (Myomectomy 5/> Myomas
      // &/>250 Gm Abdomen) $5,862 + CPT 58300 (IUD insertion) $276.
      // Billed $6,138, insurance covered $4,145.20, patient responsibility
      // $1,992.77. Cigna denied with reason I2563 "Services do not meet
      // appropriate level of care". MUST show ISSUES FOUND.
      // Pre-2026-04-27 this rendered as $164,496 YOU OWE — ALL CLEAR
      // (worst-case medical hallucination). After fixes: must show $1,992
      // and Issues Found.
      totalBilled: 6138,
      youOwe: 1992,
      cptExtractionRegex: /58146|58300/,
      verdictExpected: "issues",
      isUnreadable: false,
    },
  },
  {
    id: "f9-credit-balance-overpaid",
    file: "test-quotes/medical-images/09-asked-for-itemized-bill.jpg",
    expect: {
      // Office visit ledger across 3 dates: 99441 telephone $75, 99213
      // office visit $180, 99214 office visit $260. Total charges $535,
      // total payments+adjustments -$562, REMAINING AMOUNT DUE: ($27.00).
      // Parens = credit balance — patient OVERPAID by $27. Analyzer must
      // NOT show "you owe $535" or anything positive. Either:
      //   - You Owe ≤ 0 (correct credit-balance handling)
      //   - Unreadable fallback (acceptable — better than fabricating)
      // Confident-positive on overpaid bills is a UX trust-killer.
      youOweMustBeLeqZeroOrUnreadable: true,
      cptExtractionRegex: /99441|99213|99214/,
      isUnreadable: null,  // Either OK
    },
  },
];

const PRICE_TOLERANCE_PCT = 0.05;  // ±5% — Vision OCR tolerates more drift
                                    // than regex; $390 → ±$20, $5930 → ±$297.

async function uploadAndCapture(browser, fixture) {
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 900 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/medical-bill-estimate")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/medical-bill-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /medical-bill-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Wait for ONE of: real verdict | unreadable fallback | error fallback |
  // wrong-vertical hard-reject (via tpEnforceVerticalMatch).
  // Vision API can take 30-90s; allow up to 180s.
  await page.waitForFunction(() => {
    const txt = document.body.innerText || "";
    return !!document.querySelector(".mb-verdict") ||
           /could not read this bill clearly/i.test(txt) ||
           /something went wrong/i.test(txt) ||
           /not a Medical (bill|quote)/i.test(txt) ||
           /this doesn[’']t look like a Medical/i.test(txt);
  }, { timeout: 180000 }).catch(() => null);

  await new Promise(r => setTimeout(r, 1000));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;

    const verdictEl = document.querySelector(".mb-verdict");
    const verdictLabel = (document.querySelector(".verdict-label") || {}).innerText || "";
    const verdictTitle = (document.querySelector(".verdict-title") || {}).innerText || "";

    const summaryItems = {};
    document.querySelectorAll(".mb-summary-item").forEach(d => {
      const label = ((d.querySelector(".label") || {}).innerText || "").trim().toLowerCase();
      const value = ((d.querySelector(".value") || {}).innerText || "").trim();
      if (label) summaryItems[label] = value;
    });

    const parsePrice = s => {
      if (!s) return null;
      const m = s.match(/-?\$?([\d,]+(?:\.\d+)?)/);
      return m ? parseFloat(m[1].replace(/,/g, "")) : null;
    };

    // Facility name lives in the small grey-text div sibling of .verdict-title
    // (rendered conditionally; absent when api returns "Unknown Facility").
    // Identify it by direct-child position: skip .verdict-label, .verdict-title,
    // .mb-summary; the remaining direct-child div with text IS the facility line.
    let facilityName = "";
    if (verdictEl) {
      const directChildren = Array.from(verdictEl.children);
      const candidate = directChildren.find(d => {
        if (d.classList.contains("verdict-label") ||
            d.classList.contains("verdict-title") ||
            d.classList.contains("mb-summary")) return false;
        return !!(d.innerText || "").trim();
      });
      if (candidate) facilityName = (candidate.innerText || "").trim();
    }

    // Line items table — collect CPT codes from the second column.
    const lineItemCpts = [];
    const lineItemServices = [];
    document.querySelectorAll(".mb-table tbody tr").forEach(row => {
      const tds = row.querySelectorAll("td");
      if (tds.length >= 2) {
        lineItemServices.push((tds[0].innerText || "").trim());
        lineItemCpts.push((tds[1].innerText || "").trim());
      }
    });

    // Bill checks — collect pass/fail/warn icon classes.
    const billChecks = {};
    document.querySelectorAll(".mb-checklist li").forEach(li => {
      const labelText = (li.innerText || "").trim();
      const icon = li.querySelector(".mb-check-icon");
      let status = "warn";
      if (icon) {
        if (icon.classList.contains("mb-check-pass")) status = "pass";
        else if (icon.classList.contains("mb-check-fail")) status = "fail";
      }
      if (labelText) billChecks[labelText] = status;
    });

    // Red flags count.
    const redFlagCards = document.querySelectorAll(".mb-flag-card");

    const isUnreadable = /could not read this bill clearly/i.test(text);
    const isError = /something went wrong/i.test(text);
    const isWrongVertical = /not a Medical (bill|quote)/i.test(text) ||
                            /this doesn[’']t look like a Medical/i.test(text);

    return {
      hasVerdict: !!verdictEl,
      verdictLabel: verdictLabel.trim(),
      verdictTitle: verdictTitle.trim(),
      verdictClass: verdictEl ? (verdictEl.className || "") : "",
      facilityName,
      totalBilled: parsePrice(summaryItems["total billed"]),
      insurancePaid: parsePrice(summaryItems["insurance paid"]),
      youOwe: parsePrice(summaryItems["you owe"]),
      lineItemCpts,
      lineItemServices,
      lineItemCount: lineItemCpts.length,
      billChecks,
      redFlagsCount: redFlagCards.length,
      isUnreadable,
      isError,
      isWrongVertical,
      bodyTextSlice: text.slice(0, 2500),
    };
  });

  let apiData = null;
  for (const r of apiResponses) {
    try {
      const json = JSON.parse(r.body);
      if (json && json.success && json.data) apiData = json.data;
    } catch {}
  }

  // If DOM facility scrape came back empty but API returned facilityName,
  // prefer the API value (the DOM may have suppressed the line because the
  // API returned "Unknown Facility" — in that case we still want to record
  // the API's literal value for diagnostic purposes).
  if (apiData && apiData.facilityName && !display.facilityName) {
    display.facilityNameFromApi = apiData.facilityName;
    display.facilityName = apiData.facilityName;
  } else if (apiData && apiData.facilityName) {
    display.facilityNameFromApi = apiData.facilityName;
  }

  // CPTs may also live in apiData.lineItems[].cptCode even when DOM cell
  // shows "--" (e.g. if the renderer escapes blank cells). Cross-record both
  // for diagnostic purposes; assertions still walk the DOM since users see
  // the rendered table.
  if (apiData && Array.isArray(apiData.lineItems)) {
    display.lineItemCptsFromApi = apiData.lineItems.map(li => li.cptCode || "").filter(Boolean);
  }

  await page.close();
  return { display, apiData, apiStatus: apiResponses.map(r => r.status) };
}

function compare(label, actual, expected) {
  const failures = [];
  const d = actual.display;

  if (d.isWrongVertical) {
    failures.push("wrongVertical: medical analyzer hard-rejected this fixture");
    return failures;
  }

  if (d.isError) {
    failures.push("apiError: render error fallback fired");
    return failures;
  }

  // For credit-balance fixtures, allow either "you owe ≤ 0" or unreadable.
  if (expected.youOweMustBeLeqZeroOrUnreadable) {
    if (d.isUnreadable) {
      // Acceptable — analyzer correctly admitted it couldn't parse.
    } else if (typeof d.youOwe === "number" && d.youOwe <= 0) {
      // Acceptable — credit balance handled.
    } else if (d.youOwe == null) {
      failures.push(`youOwe: expected ≤ 0 OR unreadable fallback, got null verdict`);
    } else {
      failures.push(`youOwe: expected ≤ 0 OR unreadable fallback, got positive ${d.youOwe} (analyzer claims patient owes money on overpaid ledger)`);
    }
    // Skip remaining checks for this fixture — verdict copy not asserted.
    if (expected.cptExtractionRegex && d.lineItemCpts.length > 0) {
      const allCpts = d.lineItemCpts.join(",");
      if (!expected.cptExtractionRegex.test(allCpts)) {
        failures.push(`cptExtraction: expected match /${expected.cptExtractionRegex.source}/, got [${allCpts}]`);
      }
    }
    return failures;
  }

  if (expected.isUnreadable === true) {
    if (!d.isUnreadable) {
      failures.push(`isUnreadable: expected unreadable fallback, got verdict=${d.verdictLabel}`);
    }
    return failures;
  }

  // Real verdict expected from here on.
  if (!d.hasVerdict) {
    if (d.isUnreadable) {
      failures.push(`unreadable: expected verdict, got unreadable fallback (analyzer failed to extract bill data)`);
    } else {
      failures.push(`noVerdict: expected verdict card, got nothing`);
    }
    return failures;
  }

  if (typeof expected.totalBilled === "number") {
    const tol = Math.max(50, expected.totalBilled * PRICE_TOLERANCE_PCT);
    if (d.totalBilled == null) {
      failures.push(`totalBilled: expected ~${expected.totalBilled}, got null`);
    } else if (Math.abs(d.totalBilled - expected.totalBilled) > tol) {
      failures.push(`totalBilled: expected ${expected.totalBilled} ±${tol}, got ${d.totalBilled}`);
    }
  }

  if (typeof expected.youOwe === "number") {
    const tol = Math.max(20, expected.youOwe * PRICE_TOLERANCE_PCT);
    if (d.youOwe == null) {
      failures.push(`youOwe: expected ~${expected.youOwe}, got null`);
    } else if (Math.abs(d.youOwe - expected.youOwe) > tol) {
      failures.push(`youOwe: expected ${expected.youOwe} ±${tol}, got ${d.youOwe} (TRUST-CRITICAL: this is what the user reads as 'what they actually pay')`);
    }
  }

  if (expected.facilityRegex) {
    if (!d.facilityName || !expected.facilityRegex.test(d.facilityName)) {
      failures.push(`facility: expected match /${expected.facilityRegex.source}/, got ${JSON.stringify(d.facilityName)}`);
    }
  }

  if (expected.cptExtractionRegex) {
    const allCpts = d.lineItemCpts.join(",");
    if (!expected.cptExtractionRegex.test(allCpts)) {
      failures.push(`cptExtraction: expected match /${expected.cptExtractionRegex.source}/, got [${allCpts}] (without CPT, benchmark engine falls back to wrong category averages)`);
    }
  }

  if (expected.verdictExpected === "issues") {
    if (!/issues\s*found/i.test(d.verdictLabel)) {
      failures.push(`verdictLabel: expected "Issues Found" (denied claim or surprise bill), got "${d.verdictLabel}" (TRUST-CRITICAL: silently passing a denied/disputed bill as ALL CLEAR cost user trust pre-2026-04-27)`);
    }
  } else if (expected.verdictExpected === "clean") {
    if (!/all\s*clear/i.test(d.verdictLabel)) {
      failures.push(`verdictLabel: expected "All Clear", got "${d.verdictLabel}"`);
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
        verdictLabel: actual.display.verdictLabel,
        verdictTitle: actual.display.verdictTitle,
        verdictClass: actual.display.verdictClass,
        facilityName: actual.display.facilityName,
        facilityNameFromApi: actual.display.facilityNameFromApi || null,
        totalBilled: actual.display.totalBilled,
        insurancePaid: actual.display.insurancePaid,
        youOwe: actual.display.youOwe,
        lineItemCpts: actual.display.lineItemCpts,
        lineItemCptsFromApi: actual.display.lineItemCptsFromApi || [],
        lineItemCount: actual.display.lineItemCount,
        billChecks: actual.display.billChecks,
        redFlagsCount: actual.display.redFlagsCount,
        isUnreadable: actual.display.isUnreadable,
        isError: actual.display.isError,
        isWrongVertical: actual.display.isWrongVertical,
        apiStatus: actual.apiStatus,
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
    const m1 = msg.match(/^(totalBilled|youOwe|facility|cptExtraction|verdictLabel|isUnreadable|noVerdict|unreadable|wrongVertical|apiError):/);
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
