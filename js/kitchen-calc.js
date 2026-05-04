// Woogoro Kitchen calculator — single source of truth for /kitchen-estimate.
//
// Mirrors js/hvac-calc.js + js/auto-calc.js + js/roofing-calc.js. Same module
// is used by:
//   1. /kitchen-estimate.html (browser) — drives the kitchen remodel estimator
//   2. test/kitchen/calculator-spot-check.test.js (Node) — asserts each
//      (tier x size x countertop x cabinet x appliance x state) tuple lands
//      inside its 2026 industry-anchored band
//
// Pricing tables refreshed 2026-05-04 (KITCHEN-CALC-1, commit dcd07f54a00):
//   countertopMaterials.quartzite  1.30 -> 1.50
//   cabinetQuality.custom          1.40 -> 1.55
//   applianceTier.premium          1.25 -> 1.40
// Single-upgrade scenarios unchanged; multi-premium combinations now reflect
// 2026 metro-luxury reality.
//
// Pure math + constants — no DOM, no fetch. Browser passes its city-mult /
// inflation / seasonal / flywheel-calData in; tests pass deterministic stubs.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WoogoroKitchenCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var KIT_PRICING = {
    basePriceByTier: {
      minor:            { label: "Minor Remodel (Cosmetic)",  low: 15000, high: 30000,  base: 22500 },
      midrange:         { label: "Mid-Range Remodel",         low: 30000, high: 60000,  base: 45000 },
      major:            { label: "Major/Upscale Remodel",     low: 60000, high: 120000, base: 90000 },
      cabinet_refacing: { label: "Cabinet Refacing",          low: 5000,  high: 12000,  base: 8500  }
    },
    kitchenSizes: [
      { label: "Small (< 100 sq ft)",      multiplier: 0.75 },
      { label: "Average (100-150 sq ft)",   multiplier: 1.0  },
      { label: "Large (150-200 sq ft)",     multiplier: 1.30 },
      { label: "Expansive (200+ sq ft)",    multiplier: 1.65 }
    ],
    countertopMaterials: [
      { key: "laminate", label: "Laminate",  multiplier: 0.85 },
      { key: "butcher_block", label: "Butcher Block", multiplier: 0.90 },
      { key: "granite",  label: "Granite",   multiplier: 1.0  },
      { key: "quartz",   label: "Quartz",    multiplier: 1.10 },
      { key: "marble",   label: "Marble",    multiplier: 1.25 },
      { key: "quartzite", label: "Quartzite", multiplier: 1.50 }
    ],
    cabinetQuality: [
      { key: "stock", label: "Stock Cabinets", tag: "Pre-made, limited sizes. Hampton Bay, In-Stock.", multiplier: 0.85 },
      { key: "semicustom", label: "Semi-Custom Cabinets", tag: "More options, 2-4 week lead. KraftMaid, Thomasville, Diamond.", multiplier: 1.00 },
      { key: "custom", label: "Custom Cabinets", tag: "Built to spec, 6-12 week lead. Local shops, high-end brands.", multiplier: 1.55 }
    ],
    applianceTier: [
      { key: "existing", label: "Keep Existing Appliances", tag: "Reuse what you have. No appliance cost.", multiplier: 0.80 },
      { key: "basic", label: "Basic / Builder Grade", tag: "Whirlpool, Frigidaire, Amana. $3K-$5K for a set.", multiplier: 0.90 },
      { key: "midrange", label: "Mid-Range", tag: "KitchenAid, Bosch, Samsung. $5K-$10K for a set.", multiplier: 1.00 },
      { key: "premium", label: "Premium", tag: "Sub-Zero, Wolf, Viking, Thermador. $15K-$30K+ for a set.", multiplier: 1.40 }
    ],
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    roundTo: 50,
    scopeItems: [
      { key: "demo",         label: "Demolition and removal",       weight: 8  },
      { key: "cabinets",     label: "Cabinets (supply and install)", weight: 20 },
      { key: "countertops",  label: "Countertops",                   weight: 14 },
      { key: "flooring",     label: "Flooring",                      weight: 8  },
      { key: "backsplash",   label: "Backsplash",                    weight: 6  },
      { key: "plumbing",     label: "Plumbing (sink, faucet, lines)", weight: 8  },
      { key: "electrical",   label: "Electrical (outlets, wiring)",  weight: 8  },
      { key: "appliances",   label: "Appliances",                    weight: 12 },
      { key: "lighting",     label: "Lighting (under-cabinet, recessed)", weight: 5 },
      { key: "painting",     label: "Painting and trim",            weight: 4  },
      { key: "permits",      label: "Permits and inspections",      weight: 3  },
      { key: "design",       label: "Design and planning",          weight: 5  },
      { key: "warranty",     label: "Warranty (labor and materials)", weight: 5  }
    ]
  };

  var STATE_REGIONS = {
    AL:"southeast",AK:"west",AZ:"west",AR:"south",CA:"west",CO:"mountain",CT:"northeast",
    DE:"northeast",FL:"southeast",GA:"southeast",HI:"west",ID:"mountain",IL:"midwest",
    IN:"midwest",IA:"midwest",KS:"midwest",KY:"southeast",LA:"south",ME:"northeast",
    MD:"northeast",MA:"northeast",MI:"midwest",MN:"midwest",MS:"south",MO:"midwest",
    MT:"mountain",NE:"midwest",NV:"west",NH:"northeast",NJ:"northeast",NM:"mountain",
    NY:"northeast",NC:"southeast",ND:"midwest",OH:"midwest",OK:"south",OR:"west",
    PA:"northeast",RI:"northeast",SC:"southeast",SD:"midwest",TN:"southeast",TX:"south",
    UT:"mountain",VT:"northeast",VA:"southeast",WA:"west",WV:"southeast",WI:"midwest",
    WY:"mountain",DC:"northeast"
  };

  var SEASONAL_MULTS = { 1:0.94, 2:0.95, 3:0.98, 4:1.02, 5:1.06, 6:1.08, 7:1.08, 8:1.06, 9:1.02, 10:0.98, 11:0.94, 12:0.92 };

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }

  // calcKitchenEstimate(opts):
  //   tier            "minor" | "midrange" | "major" | "cabinet_refacing"
  //   sizeIdx         0-3 index into KIT_PRICING.kitchenSizes
  //   countertopKey   "laminate" | "butcher_block" | "granite" | "quartz" | "marble" | "quartzite"
  //   cabinetKey      "stock" | "semicustom" | "custom"
  //   applianceKey    "existing" | "basic" | "midrange" | "premium"
  //   region          one of laborMultiplierByRegion keys
  //   cityMult        optional per-city mult (overrides region mult)
  //   inflationMult   optional inflation mult (default 1.0)
  //   seasonalMult    optional seasonal mult (default 1.0)
  //   calData         optional flywheel calibration { avgPrice, quotes }
  //
  // Returns { total, base, tierLabel, applied multipliers, flywheel info }.
  function calcKitchenEstimate(opts) {
    opts = opts || {};
    var tierData = KIT_PRICING.basePriceByTier[opts.tier];
    if (!tierData) tierData = KIT_PRICING.basePriceByTier.midrange;
    var base = tierData.base;

    var sizeMult = 1.0;
    if (opts.sizeIdx !== null && opts.sizeIdx !== undefined && KIT_PRICING.kitchenSizes[opts.sizeIdx]) {
      sizeMult = KIT_PRICING.kitchenSizes[opts.sizeIdx].multiplier;
    }
    var countertopMult = 1.0;
    if (opts.countertopKey) {
      var mat = KIT_PRICING.countertopMaterials.find(function(m) { return m.key === opts.countertopKey; });
      if (mat) countertopMult = mat.multiplier;
    }
    var cabinetMult = 1.0;
    if (opts.cabinetKey) {
      var cab = KIT_PRICING.cabinetQuality.find(function(c) { return c.key === opts.cabinetKey; });
      if (cab) cabinetMult = cab.multiplier;
    }
    var applianceMult = 1.0;
    if (opts.applianceKey) {
      var app = KIT_PRICING.applianceTier.find(function(a) { return a.key === opts.applianceKey; });
      if (app) applianceMult = app.multiplier;
    }

    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (KIT_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;

    var total = base * sizeMult * countertopMult * cabinetMult * applianceMult * laborMult * inflationMult * seasonalMult;

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }

    return {
      total: roundTo50(total),
      base: base,
      tierLabel: tierData.label,
      sizeMult: sizeMult,
      countertopMult: countertopMult,
      cabinetMult: cabinetMult,
      applianceMult: applianceMult,
      laborMult: laborMult,
      inflationMult: inflationMult,
      seasonalMult: seasonalMult,
      flywheelApplied: flywheelApplied,
      flywheelConfidence: flywheelConfidence
    };
  }

  return {
    KIT_PRICING: KIT_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    calcKitchenEstimate: calcKitchenEstimate,
    roundTo50: roundTo50
  };
});
