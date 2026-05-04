// Woogoro Gutters calculator — single source of truth for /gutters-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroGuttersCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var GUT_PRICING = {
    basePricePerLinearFoot: {
      aluminum_seamless: { label: "Aluminum Seamless (5\")", low: 6,  high: 12, mid: 9 },
      aluminum_6inch:    { label: "Aluminum Seamless (6\")", low: 8,  high: 15, mid: 11.50 },
      vinyl:             { label: "Vinyl Gutters",           low: 4,  high: 8,  mid: 6 },
      copper:            { label: "Copper Gutters",          low: 25, high: 50, mid: 37.50 },
      steel:             { label: "Steel Gutters",           low: 8,  high: 14, mid: 11 },
      gutter_guards:     { label: "Gutter Guards (add-on)",  low: 7,  high: 20, mid: 13.50 }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    storyMultiplier: { "1": 1.0, "2": 1.20, "3": 1.40 },
    scopeItems: [
      { key: "removal", label: "Old gutter removal & disposal", weight: 8 },
      { key: "gutters", label: "Gutter installation", weight: 20 },
      { key: "downspouts", label: "Downspouts", weight: 12 },
      { key: "hangers", label: "Hidden hangers / brackets", weight: 8 },
      { key: "endCaps", label: "End caps & miters", weight: 5 },
      { key: "outlets", label: "Outlets / drop connections", weight: 6 },
      { key: "splashBlocks", label: "Splash blocks / extensions", weight: 5 },
      { key: "fasciaRepair", label: "Fascia board repair", weight: 10 },
      { key: "gutterGuards", label: "Gutter guards / leaf protection", weight: 10 },
      { key: "cleanup", label: "Cleanup & debris removal", weight: 4 },
      { key: "warranty", label: "Warranty (materials + labor)", weight: 8 },
      { key: "sealant", label: "Sealant at joints & end caps", weight: 4 }
    ]
  };

  // Mirrors api/gutters-estimate.js stateToRegion. AL=southeast, AZ=mountain, NV=mountain.
  var STATE_REGIONS = {
    AL:"southeast",AK:"west",AZ:"mountain",AR:"south",CA:"west",CO:"mountain",CT:"northeast",
    DE:"northeast",FL:"southeast",GA:"southeast",HI:"west",ID:"mountain",IL:"midwest",
    IN:"midwest",IA:"midwest",KS:"midwest",KY:"southeast",LA:"south",ME:"northeast",
    MD:"northeast",MA:"northeast",MI:"midwest",MN:"midwest",MS:"south",MO:"midwest",
    MT:"mountain",NE:"midwest",NV:"mountain",NH:"northeast",NJ:"northeast",NM:"mountain",
    NY:"northeast",NC:"southeast",ND:"midwest",OH:"midwest",OK:"south",OR:"west",
    PA:"northeast",RI:"northeast",SC:"southeast",SD:"midwest",TN:"southeast",TX:"south",
    UT:"mountain",VT:"northeast",VA:"southeast",WA:"west",WV:"southeast",WI:"midwest",
    WY:"mountain",DC:"northeast"
  };

  var SEASONAL_MULTS = { 1:0.93, 2:0.93, 3:0.95, 4:0.98, 5:1.02, 6:1.04, 7:1.04, 8:1.06, 9:1.10, 10:1.12, 11:1.06, 12:0.94 };

  function roundTo10(n) { return Math.round(n / 10) * 10; }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }

  function calcGuttersEstimate(opts) {
    opts = opts || {};
    var typeData = GUT_PRICING.basePricePerLinearFoot[opts.gutterType] || GUT_PRICING.basePricePerLinearFoot.aluminum_seamless;
    var lf = Number(opts.linearFeet) || 150;
    var storyMult = GUT_PRICING.storyMultiplier[String(opts.stories)] || 1.0;
    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (GUT_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;

    var total = typeData.mid * lf * laborMult * storyMult * inflationMult * seasonalMult;
    if (opts.addGuards) {
      var guard = GUT_PRICING.basePricePerLinearFoot.gutter_guards;
      total += guard.mid * lf * laborMult * storyMult * inflationMult * seasonalMult;
    }

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }
    return { total: roundTo10(total), label: typeData.label, midPerLF: typeData.mid, flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence };
  }

  return {
    GUT_PRICING: GUT_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    calcGuttersEstimate: calcGuttersEstimate,
    roundTo10: roundTo10
  };
});
