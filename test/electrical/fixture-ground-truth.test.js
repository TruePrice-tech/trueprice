// Electrical fixture ground-truth harness.
// Reads 9 hand-curated fixtures, uploads each through the live analyzer at
// /electrical-quote-analyzer.html, and asserts displayed total / service-type
// / amperage / contractor / banner state against ground truth captured
// 2026-05-02.
//
// Run: node test/electrical/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/plumbing/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Electrical-specific assertions (vs roofing/HVAC/auto-repair/plumbing):
//   - serviceTypeRegex: panel_upgrade / ev_charger / generator / whole_house_rewire
//     / recessed_lights / circuit_addition / outlet_switch. Defaulting a
//     25-can recessed lighting job to "panel upgrade" would mislead the verdict
//     by 5x. Equivalent of plumbing's water_heater vs drain_cleaning.
//   - amperageRegex: 100A vs 200A vs 400A — service-panel size has 3-5x cost
//     spread. Equivalent of HVAC tonnage / plumbing tank-vs-tankless.
//   - contractorRegex: Spartan Electric / Redding Electric / Meridian Power.
//   - isUncategorizedBanner / isNeedsReview: shown when serviceType detection
//     fails OR low-confidence gate fires. Catches the f5-class auto-repair bug
//     where a service-call invoice silently got a confident verdict.
//
// Electrical analyzer uses the SHARED price-confirm UI (tpConfirmPriceBtn /
// tpManualPriceBtn) plus an INLINE wrong-vertical hard-reject with button id
// elecHardRejectStartOver. Detail rows have class .elec-detail.

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-redding-panel-low",
    file: "test-quotes/electrical-images/comparison-panel-01-low.png",
    expect: {
      // TOTAL: $1,660 (Square D Homeline 200A 40-circuit, Redding Electric, Spartanburg SC).
      price: 1660,
      contractorRegex: /redding\s*electric/i,
      stateCode: "SC",
      serviceTypeRegex: /panel/i,
      amperageRegex: /200/,
      brandRegex: /square\s*d/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f2-spartan-panel-mid",
    file: "test-quotes/electrical-images/comparison-panel-02-mid.png",
    expect: {
      // TOTAL ESTIMATE: $3,425 (Eaton BR 200A 40-space, Spartan Electric, Spartanburg SC).
      price: 3425,
      contractorRegex: /spartan\s*electric/i,
      stateCode: "SC",
      serviceTypeRegex: /panel/i,
      amperageRegex: /200/,
      brandRegex: /eaton/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f3-meridian-panel-ev",
    file: "test-quotes/electrical-images/comparison-panel-03-high.png",
    expect: {
      // TOTAL: $8,798 (Square D QO 200A copper bus + 60A EV-ready, Meridian Power, Boiling Springs SC).
      // Note: even though there's a 60A EV charger sub-circuit, the headline
      // job is still a panel upgrade — the EV circuit is rough-in only.
      price: 8798,
      contractorRegex: /meridian\s*power/i,
      stateCode: "SC",
      serviceTypeRegex: /panel|ev/i,
      amperageRegex: /200/,
      brandRegex: /square\s*d/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f4-redding-panel-messy",
    file: "test-quotes/electrical-images/messy-comparison-panel-01-low.jpg",
    expect: {
      // Same content as f1 but skewed — tests OCR robustness.
      price: 1660,
      contractorRegex: /redding\s*electric/i,
      stateCode: "SC",
      serviceTypeRegex: /panel/i,
      amperageRegex: /200/,
      brandRegex: /square\s*d/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f5-spartan-panel-messy",
    file: "test-quotes/electrical-images/messy-comparison-panel-02-mid.jpg",
    expect: {
      price: 3425,
      contractorRegex: /spartan\s*electric/i,
      stateCode: "SC",
      serviceTypeRegex: /panel/i,
      amperageRegex: /200/,
      brandRegex: /eaton/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f6-meridian-panel-messy",
    file: "test-quotes/electrical-images/messy-comparison-panel-03-high.jpg",
    expect: {
      price: 8798,
      contractorRegex: /meridian\s*power/i,
      stateCode: "SC",
      serviceTypeRegex: /panel|ev/i,
      amperageRegex: /200/,
      brandRegex: /square\s*d/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f7-service-form-9432",
    file: "test-quotes/real-world/electrical-extra-11.png",
    expect: {
      // "Description of Work" form. Sub-Total / Tax / Total Due: $9,432.00.
      // Line items: Main Electrical Panel $4500, Service Entrance Cable $549,
      // Ground Rod System x2, Gas Bond, Emergency Service Charge, etc.
      // No contractor name on the visible crop. No city/state.
      // Service type: panel-replacement adjacent (panel + service entrance).
      price: 9432,
      contractorRegex: null,
      stateCode: null,
      serviceTypeRegex: /panel|electrical/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f8-recessed-lights-3487",
    file: "test-quotes/real-world/electrical-extra-12.jpg",
    expect: {
      // Mobile screenshot of an Estimate app: 25 x 6" halo recessed lights @
      // $19.87, labor $2,700 for can lights, plus TV outlet + GFI/bell box.
      // Subtotal $3,436.75 + tax $50.78 = $3,487.53. No contractor visible
      // ("Larry" looks like a customer field). No city/state.
      // This is the bug-2 regression check from electrical_dive_followups —
      // 25-can recessed install used to misclassify as outlet/switch.
      price: 3487.53,
      contractorRegex: null,
      stateCode: null,
      serviceTypeRegex: /recessed|can\s*light|lighting/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f9-handwritten-side-job",
    file: "test-quotes/electrical-images/07-did-i-lowball-myself-on-this-side-job.jpeg",
    expect: {
      // Hand-drawn weather-head-to-panel diagram + handwritten material list +
      // boxed "TOTAL JOB COST = $4,588.74". 125A panel + 1/0 service entrance
      // + ground rods + breakers. NY labor rates ($80/$40 per 8hr × 3 days).
      // Hand-printing is OCR-hostile — this is the electrical analogue of
      // f5-audi-recommendations in auto-repair. We do NOT pin a price; we do
      // not pin a contractor; we accept either an uncategorized banner OR a
      // panel-adjacent service type without crashing the verdict.
      price: null,
      contractorRegex: null,
      stateCode: null,
      isUncategorizedOrPanel: true,
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
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/electrical-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/electrical-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /electrical-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Electrical analyzer:
  //   - Inline wrong-vertical hard-reject (id elecHardRejectStartOver) runs FIRST.
  //   - Otherwise renderPriceConfirmation shows tpConfirmPriceBtn (price found)
  //     OR tpManualPriceBtn (no price). Shared hard-reject id is tpHardRejectStartOver.
  //   - High-confidence parser short-circuits straight to .verdict-price.
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("elecHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver") ||
                     !!document.getElementById("elecHardRejectStartOver"),
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
    // No ground-truth price (e.g. f9 handwritten). Type a placeholder so the
    // result page renders — we still want to see service-type and banner state.
    await page.type("#tpManualPrice", "500");
    await page.click("#tpManualPriceBtn");
  }

  await page.waitForFunction(() => !!document.querySelector(".verdict-price"), { timeout: 30000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 1500));

  const display = await page.evaluate(() => {
    const text = document.body.innerText;
    const verdictEl = document.querySelector(".verdict-price");
    const verdictText = verdictEl ? verdictEl.innerText : "";
    const verdictMatch = verdictText.match(/\$([\d,]+(?:\.\d+)?)/);

    // Electrical detail rows: <div class="elec-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".elec-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    const rangeText = (document.querySelector(".verdict-range") || {}).innerText || "";

    // "Needs Review" verdict label fires from the low-confidence gate.
    const verdictLabel = (document.querySelector(".verdict-label") || {}).innerText || "";
    const isNeedsReview = /needs\s*review/i.test(verdictLabel);

    // Generic uncategorized-banner detection (not currently surfaced on
    // electrical analyzer, but parity copy may land later).
    const isUncategorizedBanner = /couldn[’']t identify the specific (electrical|service)/i.test(text);

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
    if (r.url.includes("/api/electrical-estimate") || r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not electrical");
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
    // Electrical analyzer doesn't currently render Contractor in elec-detail
    // (cf. roofing/HVAC/auto-repair/plumbing-with-PL4-shipped). Read from
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
  }

  if (expected.serviceTypeRegex) {
    const svc = actual.display.details["service type"] || "";
    if (!expected.serviceTypeRegex.test(svc)) {
      failures.push(`serviceType: expected match /${expected.serviceTypeRegex.source}/, got ${JSON.stringify(svc)}`);
    }
  }

  if (expected.amperageRegex) {
    const amp = actual.display.details["amperage"] || "";
    if (!expected.amperageRegex.test(amp)) {
      failures.push(`amperage: expected match /${expected.amperageRegex.source}/, got ${JSON.stringify(amp)}`);
    }
  }

  if (expected.brandRegex) {
    const brand = actual.display.details["brand"] || "";
    if (!expected.brandRegex.test(brand)) {
      failures.push(`brand: expected match /${expected.brandRegex.source}/, got ${JSON.stringify(brand)}`);
    }
  }

  if (typeof expected.isUncategorizedBanner === "boolean") {
    const got = actual.display.isUncategorizedBanner || actual.display.isNeedsReview;
    if (got !== expected.isUncategorizedBanner) {
      failures.push(`isUncategorizedBanner: expected ${expected.isUncategorizedBanner}, got ${got}`);
    }
  }

  if (expected.isUncategorizedOrPanel) {
    // Either uncategorized banner / "Needs Review" verdict OR panel-adjacent
    // service type is acceptable for f9 hand-drawn side-job. Anything else
    // (recessed_lights / outlet_switch / EV_charger) would be a confident-wrong
    // verdict — that's a fail.
    const svc = actual.display.details["service type"] || "";
    const ok = actual.display.isUncategorizedBanner ||
               actual.display.isNeedsReview ||
               /panel|service\s*upgrade|electrical/i.test(svc);
    if (!ok) {
      failures.push(`uncategorizedOrPanel: expected uncategorized banner OR panel service type, got service="${svc}" verdict="${actual.display.verdictLabel}"`);
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|serviceType|amperage|brand|isUncategorizedBanner|uncategorizedOrPanel|hardReject):/);
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
