// Woogoro Fencing calculator — single source of truth for /fencing-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroFencingCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FENCE_PRICING = {
    basePricePerLinearFoot: {
      chain_link:    { label: "Chain Link",                low: 8,  high: 25,  mid: 15.00 },
      wood_privacy:  { label: "Wood Privacy (PT Pine)",    low: 22, high: 45,  mid: 33.50 },
      cedar:         { label: "Cedar Privacy",             low: 30, high: 60,  mid: 45.00 },
      vinyl_privacy: { label: "Vinyl / PVC Privacy",       low: 35, high: 80,  mid: 50.00 },
      aluminum:      { label: "Aluminum Ornamental",       low: 32, high: 75,  mid: 48.00 },
      composite:     { label: "Composite",                 low: 45, high: 95,  mid: 65.00 },
      wrought_iron:  { label: "Wrought / Ornamental Iron", low: 42, high: 100, mid: 65.00 }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    heightMultiplier: { "4": 0.85, "6": 1.00, "8": 1.25 },
    gateCost: {
      chain_link:    { low: 200, high: 500 },
      wood_privacy:  { low: 300, high: 600 },
      cedar:         { low: 400, high: 700 },
      vinyl_privacy: { low: 400, high: 700 },
      aluminum:      { low: 450, high: 800 },
      composite:     { low: 500, high: 900 },
      wrought_iron:  { low: 500, high: 1000 }
    },
    scopeItems: [
      { key: "postHoles", label: "Post holes", weight: 12 },
      { key: "concreteFootings", label: "Concrete footings", weight: 14 },
      { key: "posts", label: "Posts", weight: 14 },
      { key: "rails", label: "Rails", weight: 10 },
      { key: "picketsPanels", label: "Pickets / panels", weight: 14 },
      { key: "gate", label: "Gate", weight: 10 },
      { key: "hardware", label: "Hardware (hinges, latches, screws)", weight: 6 },
      { key: "removalOldFence", label: "Old fence removal", weight: 6 },
      { key: "permits", label: "Permits", weight: 4 },
      { key: "grading", label: "Grading / ground prep", weight: 4 },
      { key: "stainingSealing", label: "Staining / sealing", weight: 4 },
      { key: "warranty", label: "Warranty", weight: 6 }
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

  var SEASONAL_MULTS = { 1:0.92, 2:0.93, 3:0.97, 4:1.04, 5:1.08, 6:1.10, 7:1.10, 8:1.06, 9:1.00, 10:0.96, 11:0.93, 12:0.91 };

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  // FENCE-REGION-1 (mirror CONC-REGION-1 / KIT-REGION-1): return null on
  // unknown stateCode instead of dishonestly claiming "south". Math impact
  // zero (laborMultiplierByRegion[null] -> undefined -> falls back to 1.0
  // via `|| 1.0` in calcFencingEstimate); the analyzer + estimator use the
  // returned value to label pricing source — silent "South regional pricing"
  // was the user-facing trust bug. Returning null lets callers fall through
  // to "National typical pricing" copy.
  function getRegionFromState(sc) {
    var key = (sc || "").toUpperCase();
    return STATE_REGIONS[key] || null;
  }
  function getGateCost(fenceType) {
    var gc = FENCE_PRICING.gateCost[fenceType];
    if (!gc) return 500;
    return Math.round((gc.low + gc.high) / 2);
  }

  function calcFencingEstimate(opts) {
    opts = opts || {};
    var typeData = FENCE_PRICING.basePricePerLinearFoot[opts.fenceType] || FENCE_PRICING.basePricePerLinearFoot.wood_privacy;
    var heightMult = FENCE_PRICING.heightMultiplier[String(opts.height)] || 1.0;
    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (FENCE_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;
    var gateCost = opts.includesGate ? getGateCost(opts.fenceType) : 0;
    var lf = Number(opts.linearFeet) || 100;
    var total = typeData.mid * lf * laborMult * heightMult * inflationMult * seasonalMult + gateCost;

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }
    return { total: roundTo50(total), label: typeData.label, midPerLF: typeData.mid, gateCost: gateCost, flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence };
  }

  return {
    FENCE_PRICING: FENCE_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    getGateCost: getGateCost,
    calcFencingEstimate: calcFencingEstimate,
    roundTo50: roundTo50
  };
});
