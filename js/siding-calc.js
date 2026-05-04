// Woogoro Siding calculator — single source of truth for /siding-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroSidingCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SIDE_PRICING = {
    basePriceByType: {
      vinyl:           { label: "Vinyl Siding",                   lowPerSqft: 4,  highPerSqft: 8 },
      fiber_cement:    { label: "Fiber Cement (Hardie)",          lowPerSqft: 8,  highPerSqft: 14 },
      wood:            { label: "Wood Siding",                    lowPerSqft: 7,  highPerSqft: 12 },
      engineered_wood: { label: "Engineered Wood (LP SmartSide)", lowPerSqft: 6,  highPerSqft: 10 },
      stone_veneer:    { label: "Stone Veneer",                   lowPerSqft: 15, highPerSqft: 30 }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    roundTo: 50,
    scopeItems: [
      { key: "removal", label: "Old siding removal", weight: 10 },
      { key: "houseWrap", label: "House wrap / weather barrier", weight: 12 },
      { key: "flashing", label: "Flashing (windows, doors, corners)", weight: 8 },
      { key: "trimFascia", label: "Trim and fascia", weight: 10 },
      { key: "soffit", label: "Soffit", weight: 8 },
      { key: "caulking", label: "Caulking and sealant", weight: 6 },
      { key: "painting", label: "Painting / finishing", weight: 8 },
      { key: "disposal", label: "Debris removal and disposal", weight: 6 },
      { key: "permits", label: "Permits and inspections", weight: 6 },
      { key: "warranty", label: "Warranty (materials + labor)", weight: 10 },
      { key: "cornerPosts", label: "Corner posts", weight: 6 },
      { key: "jChannel", label: "J-channel", weight: 6 }
    ],
    brands: {
      premium: ["James Hardie", "Hardie", "Boral", "Nichiha"],
      mid: ["LP SmartSide", "CertainTeed", "Ply Gem", "Mastic"],
      value: ["Alside", "Norandex", "Georgia-Pacific", "Kaycan"]
    }
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

  var SEASONAL_MULTS = { 1:0.93, 2:0.93, 3:0.96, 4:1.02, 5:1.08, 6:1.10, 7:1.10, 8:1.06, 9:1.02, 10:0.97, 11:0.93, 12:0.92 };

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }
  function storyMult(stories) {
    if (stories === "3") return 1.30;
    if (stories === "2") return 1.15;
    return 1.0;
  }
  function conditionMult(cond) {
    if (cond === "poor") return 1.35;
    if (cond === "fair") return 1.15;
    return 1.0;
  }

  function calcSidingEstimate(opts) {
    opts = opts || {};
    var typeData = SIDE_PRICING.basePriceByType[opts.sidingType] || SIDE_PRICING.basePriceByType.vinyl;
    var midPerSqft = (typeData.lowPerSqft + typeData.highPerSqft) / 2;
    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (SIDE_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;
    var sqft = Number(opts.wallSqft) || 1500;
    var total = midPerSqft * sqft * laborMult * storyMult(opts.stories) * conditionMult(opts.condition) * inflationMult * seasonalMult;

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }
    return { total: roundTo50(total), label: typeData.label, midPerSqft: midPerSqft, flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence };
  }

  function calcSidingRange(opts) {
    var b = calcSidingEstimate(opts).total;
    return { low: roundTo50(b * 0.88), high: roundTo50(b * 1.15) };
  }

  return {
    SIDE_PRICING: SIDE_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    storyMult: storyMult,
    conditionMult: conditionMult,
    calcSidingEstimate: calcSidingEstimate,
    calcSidingRange: calcSidingRange,
    roundTo50: roundTo50
  };
});
