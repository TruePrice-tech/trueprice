// Woogoro Roofing calculator — single source of truth for /roof-cost-calculator.
//
// Mirrors the js/hvac-calc.js pattern shipped 2026-05-03 in HVAC-CALC-1. Same
// module is used by:
//   1. /roof-cost-calculator.html (browser) — drives the simple cost calc UI
//   2. test/roofing/calculator-spot-check.test.js (Node) — asserts each
//      (size, material) tuple lands inside its 2026 industry-anchored band
//
// Why one module: prior to 2026-05-03 the calc lived inline in
// roof-cost-calculator.html with no test asserting market alignment. The
// fixture-truth harness only walks the upload/analyze path so the simple
// calculator's rates could drift unchecked. With one shared module + the
// spot-check harness, CI's regression-gate.yml fails the build when any
// (size × material) tuple drifts outside the band.
//
// Pure math + constants only — no DOM, no fetch.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WoogoroRoofingCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ── 2026 market-anchored installed price tables ────────────────────────────
  //
  // Sources: Forbes Home 2026 roofing cost guide, HomeGuide 2026, This Old
  // House 2026, Modernize 2026, Angi/HomeAdvisor 2026 contractor surveys.
  //
  // Rates are per LIVING-sq-ft (not roof-sq-ft). Roof area typically equals
  // living area × 1.05-1.30 for single-story, ÷ ~1.5 for two-story. These
  // rates average across single+two-story for the simple calc — the analyzer
  // (js/analyzer-ui.js) handles roof-vs-living distinction with property
  // signals.
  //
  // Bands are computed multiplicatively (low = mid × 0.70, high = mid × 1.35)
  // because real contractor variance is roughly that wide — the prior
  // additive `(rate ± constant)` formula compressed metal/tile bands far
  // below industry reality.
  var ROOFING_PRICING = {
    materialRates: {
      asphalt: {
        label: "3-Tab Asphalt Shingles",
        midPerLivingSqFt: 4.0,
        notes: "Budget option, 15-20yr lifespan. IKO Marathon, TAMKO Heritage, Atlas StormMaster."
      },
      architectural: {
        label: "Architectural / Dimensional Shingles",
        midPerLivingSqFt: 6.0,
        notes: "Most popular, 25-30yr warranty. GAF Timberline HDZ, OC Duration, CertainTeed Landmark."
      },
      metal: {
        label: "Metal Roofing",
        midPerLivingSqFt: 10.0,
        notes: "30-50yr lifespan. Average across corrugated + standing seam. Premium standing seam runs 30-50% above this."
      },
      tile: {
        label: "Tile Roofing",
        midPerLivingSqFt: 13.0,
        notes: "50+yr lifespan. Average across concrete + clay tile. Heavy — verify structural capacity."
      }
    },
    bandLow: 0.70,
    bandHigh: 1.35
  };

  function roundTo10(n) { return Math.round(n / 10) * 10; }

  // ── Calculator ─────────────────────────────────────────────────────────────
  //
  // calcRoofEstimate(opts) — opts:
  //   sqft        living-area square footage
  //   material    "asphalt" | "architectural" | "metal" | "tile"
  //   calData     optional flywheel calibration { avgPrice, quotes, ... } —
  //               when present and quotes >= 3, the rate-table-derived mid is
  //               blended toward the real-world avg via FlywheelBlend; the
  //               band scales with the new mid so verdict ratios stay coherent.
  //
  // Returns { low, mid, high, ratePerSqFt, label } — all numbers rounded to
  // the nearest $10.
  function calcRoofEstimate(opts) {
    opts = opts || {};
    var sqft = Number(opts.sqft) || 0;
    var material = String(opts.material || "asphalt").toLowerCase();
    var calData = opts.calData || null;

    var entry = ROOFING_PRICING.materialRates[material]
      || ROOFING_PRICING.materialRates.asphalt;

    var rate = entry.midPerLivingSqFt;
    var mid = sqft * rate;

    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(mid, calData);
      if (blended.applied) mid = blended.mid;
    }

    var low = mid * ROOFING_PRICING.bandLow;
    var high = mid * ROOFING_PRICING.bandHigh;

    return {
      low: roundTo10(low),
      mid: roundTo10(mid),
      high: roundTo10(high),
      ratePerSqFt: rate,
      label: entry.label,
      notes: entry.notes
    };
  }

  return {
    ROOFING_PRICING: ROOFING_PRICING,
    calcRoofEstimate: calcRoofEstimate,
    roundTo10: roundTo10
  };
});
