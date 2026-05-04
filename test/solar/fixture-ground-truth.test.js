// Solar fixture ground-truth harness.
// Reads 13 hand-curated fixtures, uploads each through the live analyzer at
// /solar-quote-analyzer.html, and asserts displayed total / system size /
// panel brand / inverter type / battery label / state / verdict-special-case
// (lease vs wholesale vs install) against ground truth captured 2026-05-03.
//
// Run: node test/solar/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/plumbing/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Solar-specific assertions (vs roofing/HVAC/auto-repair/plumbing):
//   - systemSizeRegex: kW system size drives the canonical $/W metric.
//     A 10 kW system at $30K = $3.00/W (fair); same $30K on a 6 kW = $5.00/W
//     (overpriced). Wrong system size silently corrupts the verdict.
//   - panelBrandRegex: SunPower/LG/Panasonic (premium tier) vs REC/Q-Cells/
//     Hanwha (mid) vs Jinko/Trina/ZNSHINE (budget). Drives benchmark band.
//     Watch: SOLAR_PRICING.brands hard-codes "Q Cells: mid" and OMITS Hanwha
//     entirely — UI copy says "Mid: Hanwha" so this is a UX bug. Tracked as
//     S-3 below.
//   - inverterRegex: micro (Enphase) vs optimizer (SolarEdge) vs string.
//     Affects warranty + monitoring + fault-tolerance.
//   - batteryRegex: Powerwall / Enphase IQ / etc — battery adder in benchmark.
//   - isLeaseVerdict / isWholesaleVerdict: special verdicts that bypass $/W
//     comparison. Lease = "Lease / PPA"; wholesale (Alibaba parts-only) =
//     "Parts Only". Confidence-of-classification is the safety net here —
//     the analyzer must NOT confidently label a lease/parts-only as overpriced.
//
// Solar analyzer uses the SHARED price-confirm UI from js/price-confirm.js
// (tpConfirmPriceBtn / tpManualPriceBtn / tpManualPrice / tpHardRejectStartOver)
// — NOT plumbing's inline confirmPriceBtn flow. Solar ALSO has its own inline
// wrong-vertical hard-reject with id solarHardRejectStartOver (fires before
// the shared engine sees the file). Wait on either reject id.
// Federal ITC is hard-coded to 30% (Section 25D current through 2032).

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-sunset-low",
    file: "test-quotes/solar-images/comparison-solar-01-low.png",
    expect: {
      // SUNSET SOLAR DIRECT, Las Vegas NV. 8.04 kW (24 x 335W Hanwha Q.PEAK
      // DUO ML-G10+), Enphase IQ8+ microinverters. GROSS $14,940.
      // $1.86/W gross — well below typical $2.50/W floor (suspicious / budget).
      price: 14940,
      systemSizeRegex: /8(\.0\d)?\s*kw/i,
      panelBrandRegex: /hanwha|q[\s.]*peak|q\s*cells/i,
      inverterRegex: /microinverter|enphase/i,
      batteryRegex: null,
      stateCode: "NV",
      isLease: false,
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f2-desert-mid",
    file: "test-quotes/solar-images/comparison-solar-02-mid.png",
    expect: {
      // DESERT SUN ENERGY, Las Vegas NV. 8.16 kW (24 x 340W REC Alpha Pure),
      // Enphase IQ8M microinverters. GROSS $19,250. $2.36/W — borderline
      // low/fair for direct-to-consumer NV market.
      price: 19250,
      systemSizeRegex: /8\.\d+\s*kw/i,
      panelBrandRegex: /rec/i,                     // REC Alpha Pure (mid tier)
      inverterRegex: /microinverter|enphase/i,
      batteryRegex: null,
      stateCode: "NV",
      isLease: false,
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f3-apex-premium-battery",
    file: "test-quotes/solar-images/comparison-solar-03-high.png",
    expect: {
      // APEX SOLAR & ENERGY STORAGE, Las Vegas NV. 8.0 kW (20 x 400W SunPower
      // Maxeon 6 AC) + Tesla Powerwall 3 (13.5 kWh). GROSS $32,770.
      // $4.10/W including battery — premium tier, fair for SunPower+battery.
      price: 32770,
      systemSizeRegex: /8(\.0)?\s*kw/i,
      panelBrandRegex: /sunpower/i,                // premium tier
      inverterRegex: /microinverter|enphase|maxeon/i,
      batteryRegex: /powerwall|tesla/i,
      stateCode: "NV",
      isLease: false,
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f4-sunset-low-messy",
    file: "test-quotes/solar-images/messy-comparison-solar-01-low.jpg",
    expect: {
      // Same content as f1 but skewed/blurred — tests OCR robustness.
      price: 14940,
      systemSizeRegex: /8(\.0\d)?\s*kw/i,
      panelBrandRegex: /hanwha|q[\s.]*peak|q\s*cells/i,
      inverterRegex: /microinverter|enphase/i,
      batteryRegex: null,
      stateCode: "NV",
      isLease: false,
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f5-desert-mid-messy",
    file: "test-quotes/solar-images/messy-comparison-solar-02-mid.jpg",
    expect: {
      price: 19250,
      systemSizeRegex: /8\.\d+\s*kw/i,
      panelBrandRegex: /rec/i,
      inverterRegex: /microinverter|enphase/i,
      batteryRegex: null,
      stateCode: "NV",
      isLease: false,
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f6-apex-premium-messy",
    file: "test-quotes/solar-images/messy-comparison-solar-03-high.jpg",
    expect: {
      price: 32770,
      systemSizeRegex: /8(\.0)?\s*kw/i,
      panelBrandRegex: /sunpower/i,
      inverterRegex: /microinverter|enphase|maxeon/i,
      batteryRegex: /powerwall|tesla/i,
      stateCode: "NV",
      isLease: false,
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f7-lightreach-lease",
    file: "test-quotes/solar-images/03-power-bill-is-ridiculous-talk-me-out-of-a-solar-le.jpeg",
    expect: {
      // LightReach Solar Lease — 25 Year @ 1.99% escalator. 8 kW (20 x Hanwha
      // Q.PEAK DUO BLK ML-G10+/t 400W), Enphase IQ8PLUS-72-2-US. NO purchase
      // price (only $148.48/mo lease payment). Should hit Lease / PPA verdict
      // and bypass $/W comparison entirely.
      price: null,                                  // no purchase price
      systemSizeRegex: /8\s*kw/i,
      panelBrandRegex: /hanwha|q[\s.]*peak|q\s*cells/i,
      inverterRegex: /microinverter|enphase/i,
      batteryRegex: null,
      stateCode: null,                              // not visible in cropped image
      isLease: true,                                // canonical lease detection
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f8-8MSolar-NC-rec",
    file: "test-quotes/solar-images/04-how-does-my-solar-quote-look-thx-in-advance-nc-duk.jpg",
    expect: {
      // 8MSolar (workmanship warranty signature), NC Duke utility. 13.14 kW DC,
      // 36 REC Alpha Series 365 panels, SolarEdge 11400H-US inverter +
      // SolarEdge p370 optimizers, IronRidge racking. Turnkey $31,993.
      // 26% Federal Tax Credit (older quote — analyzer should still benchmark
      // against current 30% but quote document predates the change).
      // $/W = $31,993 / 13.14 = $2.43/W — solid fair.
      price: 31993,
      systemSizeRegex: /13(\.1\d)?\s*kw/i,
      panelBrandRegex: /rec/i,
      inverterRegex: /optimizer|solaredge/i,        // SolarEdge optimizer setup
      batteryRegex: null,
      stateCode: "NC",
      isLease: false,
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f9-sunrun-CA-2pw",
    file: "test-quotes/solar-images/05-has-any-seen-huge-differences-in-solar-panel-quote.png",
    expect: {
      // SUNRUN, San Diego CA. Side-by-side comparison (left: Sunrun lease-ish
      // 15.98 kW + 2 Powerwalls; right: 15.6 kW + 2 Powerwalls competitor).
      // The analyzer surfaces GROSS not net (verdict ratio compares against
      // pre-ITC benchmarks), so we pin the gross $51,938 figure that the
      // parser extracts as the "Total Amount Due" / pre-credit total.
      // Net-of-ITC ($38,619) is shown separately in the ITC banner.
      price: 51938,
      systemSizeRegex: /15(\.\d)?\s*kw/i,
      panelBrandRegex: null,                        // panel brand cropped/not visible
      inverterRegex: null,                          // not surfaced in side-by-side
      batteryRegex: /powerwall|battery/i,
      stateCode: "CA",
      isLease: false,
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f10-sunnova-FL-2pw",
    file: "test-quotes/solar-images/06-17600kw-system-with-2-powerwalls-98k-central-flori.png",
    expect: {
      // Sunnova Easy Own Plan (25 yr financed purchase, NOT lease — the loan
      // structure means installer benchmarks DO apply). 17.6 kW, Hanwha
      // Q.PEAK DUO BLK ML-G10 400W, Enphase IQ7A-72-2-US, 2 Tesla Powerwall 2
      // (27 kWh total). System price $98,324.50. Florida.
      // $/W = $5.59 including 2 Powerwalls — overpriced even for premium
      // installer. Dealer-fee finance markup typical for Sunnova.
      price: 98324,
      systemSizeRegex: /17(\.\d)?\s*kw/i,
      panelBrandRegex: /hanwha|q[\s.]*peak|q\s*cells/i,
      inverterRegex: /microinverter|enphase/i,
      batteryRegex: /powerwall|tesla/i,
      stateCode: "FL",
      isLease: false,                               // Easy Own Plan is purchase-via-loan
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f11-alibaba-wholesale",
    file: "test-quotes/solar-images/08-a-quote-from-alibabacom-for-solar-panels.jpeg",
    expect: {
      // Alibaba.com chat screenshot. 10 ZNSHINE 610W N-Type modules,
      // unit price $57.56/piece, +unpacking $169.01, +DDP to Florida $1,035.21,
      // total $1,779.82. NOT a residential install — bare panels DDP shipped.
      // Should hit Wholesale / Parts Only verdict (canonical wholesaleRe match
      // on "DDP" + "alibaba" + "unit price ... per piece").
      price: 1779,
      systemSizeRegex: null,                        // no kW total quoted
      panelBrandRegex: /znshine|trina|jinko/i,
      inverterRegex: null,
      batteryRegex: null,
      stateCode: "FL",                              // "DDP to Florida"
      isLease: false,
      isWholesale: true,                            // canonical parts-only
      isHardReject: false,
    },
  },
  {
    id: "f12-cal-sun-WA",
    file: "test-quotes/solar-images/09-just-getting-started-heres-my-first-quote-after-pe.jpg",
    expect: {
      // Cal Sun Construction proposal — 13.6 kW, 15,128 kWh/yr year-1 prod.
      // Total Loan Amount $67,028.58 @ 4.99% APR 25yr. Avista WA utility.
      // $/W = $4.93 — high; loan-financed dealer markup typical.
      // No panel/inverter brand surfaced in this proposal-summary view.
      price: 67028,
      systemSizeRegex: /13(\.\d)?\s*kw/i,
      panelBrandRegex: null,                        // not surfaced in summary
      inverterRegex: null,
      batteryRegex: null,
      stateCode: "WA",
      isLease: false,                               // loan = purchase
      isWholesale: false,
      isHardReject: false,
    },
  },
  {
    id: "f13-sunnova-lease-ipad",
    file: "test-quotes/solar-images/10-am-i-getting-ripped-off.jpeg",
    expect: {
      // Tablet-photo of Sunnova lease screen. $445.45/mo Sunnova payment
      // (includes estimated tax), $0.288/kWh solar rate, 12,604.98 kWh/yr
      // estimated production. NO purchase price (lease). Photo has keystone
      // distortion + glare — OCR robustness check.
      // Should hit Lease / PPA verdict.
      price: null,
      systemSizeRegex: null,                        // not surfaced on this screen
      panelBrandRegex: null,
      inverterRegex: null,
      batteryRegex: null,
      stateCode: null,
      isLease: true,                                // Sunnova in leaseRe whitelist
      isWholesale: false,
      isHardReject: false,
    },
  },
];

const PRICE_TOLERANCE_PCT = 0.005;

async function uploadAndCapture(browser, fixture) {
  const page = await browser.newPage();
  await preparePage(page, BASE);
  page.setDefaultTimeout(180000);
  await page.setViewport({ width: 1440, height: 900 });

  const apiResponses = [];
  page.on("response", async res => {
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/solar-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/solar-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /solar-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Solar uses the shared price-confirm UI (tpConfirmPriceBtn / tpManualPriceBtn /
  // tpHardRejectStartOver from js/price-confirm.js) PLUS solar's own inline
  // wrong-vertical reject (solarHardRejectStartOver). Lease/wholesale early-detect
  // jumps straight to .verdict-price without confirm.
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("solarHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 180000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("solarHardRejectStartOver") ||
                     !!document.getElementById("tpHardRejectStartOver"),
      hardRejectText: (document.querySelector("h1") || {}).innerText || "",
      bodyText: document.body.innerText.slice(0, 1500),
    };
  });

  if (preConfirm.hasHardReject) {
    await page.close();
    return {
      display: { verdictPrice: null, details: {}, rangeText: "", verdictLabel: "", isLeaseVerdict: false, isWholesaleVerdict: false, bodyTextSlice: "" },
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
    // No ground-truth price (e.g. lease fixtures). Type a placeholder so the
    // result page renders — we still want to see verdict label + lease detect.
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

    // Solar detail rows: <div class="solar-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".solar-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    const rangeText = (document.querySelector(".verdict-range") || {}).innerText || "";
    const verdictLabel = (document.querySelector(".verdict-label") || {}).innerText || "";

    // Lease / wholesale special verdicts
    const isLeaseVerdict = /lease\s*\/\s*ppa|lease.*ppa|\bppa\b/i.test(verdictLabel);
    const isWholesaleVerdict = /parts\s*only|wholesale/i.test(verdictLabel);

    return {
      verdictPrice: verdictMatch ? parseFloat(verdictMatch[1].replace(/,/g, "")) : null,
      verdictText,
      details,
      rangeText,
      verdictLabel,
      isLeaseVerdict,
      isWholesaleVerdict,
      bodyTextSlice: text.slice(0, 2500),
    };
  });

  let parseQuote = null;
  for (const r of apiResponses) {
    if (r.url.includes("/api/solar-estimate") || r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (expected.isHardReject) {
    if (!actual.preConfirm || !actual.preConfirm.hasHardReject) {
      failures.push("isHardReject: expected wrong-vertical hard-reject, got result page");
    }
    return failures;
  }

  if (actual.preConfirm && actual.preConfirm.hasHardReject && !expected.isHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not solar");
    return failures;
  }

  // Lease / wholesale verdict assertions take precedence — they bypass $/W.
  if (expected.isLease) {
    if (!actual.display.isLeaseVerdict) {
      failures.push(`isLease: expected Lease/PPA verdict, got verdictLabel="${actual.display.verdictLabel}"`);
    }
  }

  if (expected.isWholesale) {
    if (!actual.display.isWholesaleVerdict) {
      failures.push(`isWholesale: expected Parts Only / Wholesale verdict, got verdictLabel="${actual.display.verdictLabel}"`);
    }
  }

  if (typeof expected.price === "number") {
    const tol = Math.max(50, expected.price * PRICE_TOLERANCE_PCT);
    if (actual.display.verdictPrice == null) {
      failures.push(`displayPrice: expected ~${expected.price}, got null`);
    } else if (Math.abs(actual.display.verdictPrice - expected.price) > tol) {
      failures.push(`displayPrice: expected ${expected.price} ±${tol}, got ${actual.display.verdictPrice}`);
    }
  }

  if (expected.systemSizeRegex) {
    const sys = actual.display.details["system size"] || "";
    if (!expected.systemSizeRegex.test(sys)) {
      failures.push(`systemSize: expected match /${expected.systemSizeRegex.source}/, got ${JSON.stringify(sys)}`);
    }
  }

  if (expected.panelBrandRegex) {
    const brand = actual.display.details["panel brand"] || actual.display.details["panel tier"] || "";
    if (!expected.panelBrandRegex.test(brand)) {
      failures.push(`panelBrand: expected match /${expected.panelBrandRegex.source}/, got ${JSON.stringify(brand)}`);
    }
  }

  if (expected.inverterRegex) {
    const inv = actual.display.details["inverter"] || "";
    if (!expected.inverterRegex.test(inv)) {
      failures.push(`inverter: expected match /${expected.inverterRegex.source}/, got ${JSON.stringify(inv)}`);
    }
  }

  if (expected.batteryRegex) {
    const bat = actual.display.details["battery"] || "";
    if (!expected.batteryRegex.test(bat)) {
      failures.push(`battery: expected match /${expected.batteryRegex.source}/, got ${JSON.stringify(bat)}`);
    }
  }

  if ("stateCode" in expected && actual.parseQuote?.data) {
    // Solar API returns stateCode either at top-level data.stateCode or nested
    // under data.location.stateCode (engine surfaces both shapes).
    const got = actual.parseQuote.data.stateCode ||
                (actual.parseQuote.data.location && actual.parseQuote.data.location.stateCode) ||
                null;
    if ((got || null) !== (expected.stateCode || null)) {
      failures.push(`stateCode: expected ${JSON.stringify(expected.stateCode)}, got ${JSON.stringify(got)}`);
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
        isLeaseVerdict: actual.display.isLeaseVerdict,
        isWholesaleVerdict: actual.display.isWholesaleVerdict,
        preConfirm: {
          hasConfirmBtn: actual.preConfirm?.hasConfirmBtn,
          hasManualBtn: actual.preConfirm?.hasManualBtn,
          hasHardReject: actual.preConfirm?.hasHardReject,
        },
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
    const m1 = msg.match(/^(displayPrice|systemSize|panelBrand|inverter|battery|stateCode|isLease|isWholesale|isHardReject|hardReject):/);
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
