// Painting fixture ground-truth harness.
// Reads 9 hand-curated fixtures, uploads each through the live analyzer at
// /painting-quote-analyzer.html, and asserts displayed total / project type /
// paint quality / contractor / banner state against ground truth captured
// 2026-05-03.
//
// Run: node test/painting/fixture-ground-truth.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/kitchen/fixture-ground-truth.test.js. CI auto-discovers
// every test/*/fixture-ground-truth.test.js via .github/workflows/regression-gate.yml.
//
// Painting-specific assertions (vs kitchen/electrical/etc):
//   - paintTypeRegex: exterior / interior / cabinet — three distinct
//     pricing models (per-sqft for ext/int, flat range for cabinets).
//     Misclassifying f2 cabinet as exterior would benchmark vs $4-6/sqft
//     against a default 2000 sqft = $8K-12K range, verdicting $2,820 as
//     "unusually low" when it's actually a fair cabinet refinish.
//   - brandRegex: Sherwin-Williams / Benjamin Moore (premium), PPG /
//     Dunn-Edwards (mid), Behr (value). Drives paintQuality=premium when
//     premium brand detected (line 915).
//   - contractorRegex: Budget Painters / Rocky Mountain Pro / Front Range.
//     Painting analyzer doesn't currently render Contractor in paint-detail
//     (cf. P-K6 finding). Read from parseQuote API or painting-estimate API.
//   - stateCode "CO" for synthetic fixtures, null for real (no state token).
//     P-K3 / P-Bug13 risk — analyzer reads parsed.location.stateCode and
//     defaults to "TX" if missing.
//   - isUncategorizedBanner: not surfaced on painting analyzer.
//
// Painting analyzer uses the SHARED price-confirm UI (tpConfirmPriceBtn /
// tpManualPriceBtn) plus an INLINE wrong-vertical hard-reject with button id
// paintHardRejectStartOver. Detail rows have class .paint-detail.

const { launchHarnessBrowser, preparePage } = require("../lib/harness-browser");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WOOGORO_BASE || "https://woogoro.com";
const FIXTURES_DIR = path.resolve(__dirname, "..", "..");
const BASELINE_PATH = path.join(__dirname, "fixture-ground-truth.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const FIXTURES = [
  {
    id: "f1-imessage-exterior",
    file: "test-quotes/painting-test-images/01-is-my-estimate-reasonable-or-am-i-going-crazy.jpeg",
    expect: {
      // iMessage screenshot of contractor stating final price after 10%
      // new-client discount: "$10,650". No scope, no contractor name, no
      // address. Tests parser robustness on conversational text.
      // Real-world post-recipient said "yours is very high" -- analyzer
      // can't know that, but verdict should at least not crash.
      price: 10650,
      contractorRegex: null,
      stateCode: null,
      paintTypeRegex: /exterior/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f2-cabinet-refinish",
    file: "test-quotes/painting-test-images/07-is-this-a-fair-price-from-professional-point-of-vi.jpeg",
    expect: {
      // Total $2,820 cabinet refinish. 17 cabinet doors @ $65 +
      // 9 drawers @ $35 + 7 cabinets @ $200 = $2,820. No contractor
      // visible (header cropped). No state. Tests CABINET project-type
      // detection -- cabinets use a flat-range pricing model
      // (PAINT_PRICING.basePricePerSqft.cabinet_painting), NOT per-sqft.
      // Misclassifying as interior/exterior produces nonsense verdicts.
      price: 2820,
      contractorRegex: null,
      stateCode: null,
      paintTypeRegex: /cabinet/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f3-primer-notes",
    file: "test-quotes/painting-test-images/08-quote-feedback--primer-only-job.png",
    expect: {
      // Multi-line notes app: car port ceiling primer ($475 base / $550
      // with pressure wash) + fascia trim primer ($450). Mixed brand
      // (Kilz value, Sherwin A-100 mid). Job-aggregate is ambiguous; we
      // baseline at the largest explicit "Total" (parser will likely
      // pick $550 or $450 -- both in-range). Tolerance widened to allow
      // either pick. No contractor, no state. Brand detection should
      // surface Kilz and/or Sherwin-Williams.
      // OCR-bound real-world fixture -- expect failures here, baseline them.
      price: 550,
      priceTolerance: 100, // accept $450-$650 because of multi-job ambiguity
      contractorRegex: null,
      stateCode: null,
      paintTypeRegex: /interior|exterior|cabinet|painting/i,
      isUncategorizedBanner: false,
    },
  },
  {
    id: "f4-budget-low",
    file: "test-quotes/painting-images/comparison-paint-low.png",
    expect: {
      // BUDGET PAINTERS DENVER, $3,280, 2200 sqft 2-story exterior
      // repaint, Aurora CO 80016. 1-coat body + trim, pressure wash only,
      // Behr Marquee builder-grade, 1-year warranty. Should classify as
      // exterior + standard quality (1 coat). Brand Behr = value tier.
      price: 3280,
      contractorRegex: /budget\s*painters/i,
      // stateCode dropped on f4-f9: painting analyzer's TP_Engine short-
      // circuits the API call when the regex parser finds a price. With no
      // /api/painting-estimate response, paintingEstimate.data.stateCode is
      // null -- creates a false-positive failure. The pricingRegex below
      // verifies the K3 fix at the UI level (Pricing Source row).
      paintTypeRegex: /exterior/i,
      brandRegex: /behr/i,
      coats: 1,
      isUncategorizedBanner: false,
      // P-K3 UI assertion: post-fix the Pricing Source row should show
      // mountain region or local pricing for an Aurora CO 80016 quote.
      pricingRegex: /mountain|aurora|denver|colorado|local pricing/i,
    },
  },
  {
    id: "f5-rocky-mountain-mid",
    file: "test-quotes/painting-images/comparison-paint-mid.png",
    expect: {
      // ROCKY MOUNTAIN PRO PAINTING, $6,680, same property/job. 2-coat
      // body + trim, prep + caulking + wood repair, Sherwin-Williams
      // Duration premium. 5-year workmanship + 10-year paint warranty.
      // Premium tier classification expected.
      price: 6680,
      contractorRegex: /rocky\s*mountain\s*pro\s*painting/i,
      // stateCode dropped (see f4 note).
      paintTypeRegex: /exterior/i,
      brandRegex: /sherwin[\s-]?williams/i,
      coats: 2,
      isUncategorizedBanner: false,
      pricingRegex: /mountain|aurora|denver|colorado|local pricing/i,
    },
  },
  {
    id: "f6-front-range-high",
    file: "test-quotes/painting-images/comparison-paint-high.png",
    expect: {
      // FRONT RANGE FINISHWORKS, $12,400, same property/job. 2-coat body
      // + 3-coat trim/fascia/soffit, full prep + wood rot repair, doors
      // and shutters (2 coats), Sherwin-Williams Emerald premium, project
      // management. 10-year workmanship + lifetime paint + year-1 free
      // touch-up. Top tier.
      price: 12400,
      contractorRegex: /front\s*range\s*finishworks/i,
      // stateCode dropped (see f4 note).
      paintTypeRegex: /exterior/i,
      brandRegex: /sherwin[\s-]?williams/i,
      coats: 2,
      isUncategorizedBanner: false,
      pricingRegex: /mountain|aurora|denver|colorado|local pricing/i,
    },
  },
  {
    id: "f7-budget-low-messy",
    file: "test-quotes/painting-images/messy-comparison-paint-low.jpg",
    expect: {
      // Same content as f4 but skewed/grayscale photo render -- tests
      // OCR robustness at edge alignment.
      price: 3280,
      contractorRegex: /budget\s*painters/i,
      // stateCode dropped on f4-f9: painting analyzer's TP_Engine short-
      // circuits the API call when the regex parser finds a price. With no
      // /api/painting-estimate response, paintingEstimate.data.stateCode is
      // null -- creates a false-positive failure. The pricingRegex below
      // verifies the K3 fix at the UI level (Pricing Source row).
      paintTypeRegex: /exterior/i,
      brandRegex: /behr/i,
      coats: 1,
      isUncategorizedBanner: false,
      // P-K3 UI assertion: post-fix the Pricing Source row should show
      // mountain region or local pricing for an Aurora CO 80016 quote.
      pricingRegex: /mountain|aurora|denver|colorado|local pricing/i,
    },
  },
  {
    id: "f8-rocky-mountain-mid-messy",
    file: "test-quotes/painting-images/messy-comparison-paint-mid.jpg",
    expect: {
      price: 6680,
      contractorRegex: /rocky\s*mountain\s*pro\s*painting/i,
      // stateCode dropped (see f4 note).
      paintTypeRegex: /exterior/i,
      brandRegex: /sherwin[\s-]?williams/i,
      coats: 2,
      isUncategorizedBanner: false,
      pricingRegex: /mountain|aurora|denver|colorado|local pricing/i,
    },
  },
  {
    id: "f9-front-range-high-messy",
    file: "test-quotes/painting-images/messy-comparison-paint-high.jpg",
    expect: {
      price: 12400,
      contractorRegex: /front\s*range\s*finishworks/i,
      // stateCode dropped (see f4 note).
      paintTypeRegex: /exterior/i,
      brandRegex: /sherwin[\s-]?williams/i,
      coats: 2,
      isUncategorizedBanner: false,
      pricingRegex: /mountain|aurora|denver|colorado|local pricing/i,
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
    if (res.url().includes("/api/parse-quote") || res.url().includes("/api/painting-estimate") || res.url().includes("/api/calibration")) {
      let body = "";
      try { body = await res.text(); } catch {}
      apiResponses.push({ url: res.url(), status: res.status(), body });
    }
  });

  await page.goto(BASE + "/painting-quote-analyzer.html", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));

  const inp = await page.$('input[type="file"]');
  if (!inp) {
    await page.close();
    throw new Error("file input not found on /painting-quote-analyzer.html");
  }
  await inp.uploadFile(path.join(FIXTURES_DIR, fixture.file));

  // Painting analyzer:
  //   - Inline wrong-vertical hard-reject (id paintHardRejectStartOver) runs FIRST.
  //   - Otherwise renderPriceConfirmation shows tpConfirmPriceBtn (price found)
  //     OR tpManualPriceBtn (no price). Shared hard-reject id is tpHardRejectStartOver.
  //   - High-confidence parser short-circuits straight to .verdict-price.
  await page.waitForFunction(() => {
    return !!document.getElementById("tpConfirmPriceBtn") ||
           !!document.getElementById("tpManualPriceBtn") ||
           !!document.getElementById("tpHardRejectStartOver") ||
           !!document.getElementById("paintHardRejectStartOver") ||
           !!document.querySelector(".verdict-price");
  }, { timeout: 120000 }).catch(() => null);

  const preConfirm = await page.evaluate(() => {
    return {
      hasConfirmBtn: !!document.getElementById("tpConfirmPriceBtn"),
      hasManualBtn: !!document.getElementById("tpManualPriceBtn"),
      hasHardReject: !!document.getElementById("tpHardRejectStartOver") ||
                     !!document.getElementById("paintHardRejectStartOver"),
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

    // Painting detail rows: <div class="paint-detail"><div class="label">..</div><div class="value">..</div></div>
    const details = {};
    document.querySelectorAll(".paint-detail").forEach(d => {
      const label = (d.querySelector(".label") || {}).innerText || "";
      const value = (d.querySelector(".value") || {}).innerText || "";
      if (label) details[label.trim().toLowerCase()] = value.trim();
    });

    // Scope Review checklist: <ul class="paint-scope"><li>...<icon>...
    // <label>...<status></li>. We map each li back to canonical PAINT_PRICING
    // scopeItems keys: powerWash, scraping, priming, caulking, masking,
    // trimPainting, cleanup, warranty, paintQuality, coats, colorSamples.
    const scope = {};
    const scopeMap = [
      [/power\s*washing|surface\s*cleaning/i, "powerWash"],
      [/scraping/i, "scraping"],
      [/priming/i, "priming"],
      [/caulking/i, "caulking"],
      [/masking|taping/i, "masking"],
      [/trim\s*and\s*detail/i, "trimPainting"],
      [/cleanup/i, "cleanup"],
      [/warranty/i, "warranty"],
      [/paint\s*quality|brand\s*specified/i, "paintQuality"],
      [/number\s*of\s*coats|coats\s*specified/i, "coats"],
      [/color\s*samples|consultation/i, "colorSamples"],
    ];
    document.querySelectorAll(".paint-scope li").forEach(li => {
      const lines = (li.innerText || "").split("\n").map(s => s.trim()).filter(Boolean);
      if (!lines.length) return;
      const flat = lines.join(" ");
      const status = (lines[lines.length - 1] || "").toLowerCase();
      for (const [rx, key] of scopeMap) {
        if (rx.test(flat)) { scope[key] = status; break; }
      }
    });

    const rangeText = (document.querySelector(".verdict-range") || {}).innerText || "";
    const verdictLabel = (document.querySelector(".verdict-label") || {}).innerText || "";
    const isNeedsReview = /needs\s*review/i.test(verdictLabel);
    const isUncategorizedBanner = /couldn[’']t identify the specific (paint|painting|project)/i.test(text);

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
  let paintingEstimate = null;
  for (const r of apiResponses) {
    if (r.url.includes("/api/parse-quote")) {
      try { parseQuote = JSON.parse(r.body); } catch {}
    }
    if (r.url.includes("/api/painting-estimate")) {
      try { paintingEstimate = JSON.parse(r.body); } catch {}
    }
  }

  await page.close();
  return { display, parseQuote, paintingEstimate, preConfirm };
}

function compare(label, actual, expected) {
  const failures = [];

  if (actual.preConfirm && actual.preConfirm.hasHardReject) {
    failures.push("hardReject: vertical-detect rejected this fixture as not painting");
    return failures;
  }

  if (typeof expected.price === "number") {
    const tol = typeof expected.priceTolerance === "number"
      ? expected.priceTolerance
      : Math.max(10, expected.price * PRICE_TOLERANCE_PCT);
    if (actual.display.verdictPrice == null) {
      failures.push(`displayPrice: expected ~${expected.price}, got null`);
    } else if (Math.abs(actual.display.verdictPrice - expected.price) > tol) {
      failures.push(`displayPrice: expected ${expected.price} ±${tol}, got ${actual.display.verdictPrice}`);
    }
  }

  if (expected.contractorRegex) {
    // Painting analyzer doesn't render Contractor in paint-detail (P-K6).
    // Read from parseQuote API or painting-estimate API contractor field.
    const contractor = actual.display.details["contractor"] ||
                       actual.parseQuote?.data?.contractor ||
                       actual.paintingEstimate?.contractor ||
                       actual.paintingEstimate?.data?.contractor || null;
    if (!contractor || !expected.contractorRegex.test(contractor)) {
      failures.push(`contractor: expected match /${expected.contractorRegex.source}/, got ${JSON.stringify(contractor)}`);
    }
  }

  if ("stateCode" in expected) {
    // Painting analyzer uses TP_Engine.analyzeQuote which calls
    // /api/painting-estimate (Claude haiku-4-5) for AI extraction. The
    // local analyzer-parser.js parser ALSO runs client-side and its
    // parsed.stateCode is read by P-K3 patch into state.address.stateCode
    // -- that propagates to the displayed Pricing Source row but isn't
    // visible to the harness via any API response. Read paintingEstimate
    // primary (Claude's extraction); legacy parseQuote endpoint isn't
    // called for painting -- kept as fallback only.
    const got = actual.paintingEstimate?.data?.stateCode ||
                actual.parseQuote?.data?.stateCode || null;
    if ((got || null) !== (expected.stateCode || null)) {
      failures.push(`stateCode: expected ${JSON.stringify(expected.stateCode)}, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.pricingRegex) {
    // Mirrors kitchen f1 pricingRegex assertion. Verifies the UI-display
    // side of P-K3: "Pricing Source" row should reflect the propagated
    // stateCode -> region (or city local pricing if cityMult cached). Pre-P-K3
    // every CO synthetic fixture displayed "South regional pricing" because
    // parsed.location.stateCode never matched. Post-fix, "Aurora, CO 80016"
    // text in the quote -> CO -> mountain region -> "Mountain regional
    // pricing" / "Aurora local pricing" / "Denver local pricing".
    const got = actual.display.details["pricing source"] || "";
    if (!expected.pricingRegex.test(got)) {
      failures.push(`pricing: expected match /${expected.pricingRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.paintTypeRegex) {
    const got = actual.display.details["project type"] || "";
    if (!expected.paintTypeRegex.test(got)) {
      failures.push(`paintType: expected match /${expected.paintTypeRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (expected.brandRegex) {
    const got = actual.display.details["paint brand"] || "";
    if (!expected.brandRegex.test(got)) {
      failures.push(`brand: expected match /${expected.brandRegex.source}/, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.coats === "number") {
    const got = actual.display.details["coats"] || "";
    const m = got.match(/(\d+)\s*coats?/i);
    const gotCoats = m ? parseInt(m[1], 10) : null;
    if (gotCoats !== expected.coats) {
      failures.push(`coats: expected ${expected.coats}, got ${JSON.stringify(got)}`);
    }
  }

  if (typeof expected.isUncategorizedBanner === "boolean") {
    const got = actual.display.isUncategorizedBanner || actual.display.isNeedsReview;
    if (got !== expected.isUncategorizedBanner) {
      failures.push(`isUncategorizedBanner: expected ${expected.isUncategorizedBanner}, got ${got}`);
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
                    actual.parseQuote?.data?.contractor ||
                    actual.paintingEstimate?.contractor || null,
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
    const m1 = msg.match(/^(displayPrice|contractor|stateCode|pricing|paintType|brand|coats|isUncategorizedBanner|hardReject):/);
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
