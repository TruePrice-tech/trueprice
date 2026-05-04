// Woogoro Moving calculator — single source of truth for /moving-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroMovingCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MOVING_PRICING = {
    basePriceByType: {
      local:         { label: "Local Move",         base2BR: 1600 },
      long_distance: { label: "Long Distance Move", base2BR: 5000 },
      same_building: { label: "Same Building Move", base2BR: 600 },
      office:        { label: "Office/Commercial",  base2BR: 2800 }
    },
    sizeMultiplier: { studio_1br: 0.60, "2br": 1.00, "3br": 1.40, "4br_plus": 1.90, office: 1.60 },
    distanceMultiplier: { under_50: 0.40, "50_250": 0.65, "250_1000": 1.40, "1000_plus": 1.90 },
    packingMultiplier: { none: 1.00, partial: 1.15, full: 1.30 },
    specialItemsCost: { none: 0, piano: 350, hot_tub: 500, stairs: 200 },
    scopeItems: [
      { key: "truck", label: "Truck / transportation" },
      { key: "loading", label: "Loading labor" },
      { key: "unloading", label: "Unloading labor" },
      { key: "protection", label: "Basic furniture protection (blankets/wrap)" },
      { key: "fuel", label: "Fuel / travel charges" }
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

  var LABOR_MULT_BY_REGION = { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 };
  var SEASONAL_MULTS = { 1:0.88, 2:0.88, 3:0.92, 4:0.96, 5:1.06, 6:1.14, 7:1.16, 8:1.14, 9:1.02, 10:0.94, 11:0.90, 12:0.88 };

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }

  // distanceMultiplier table is tuned for long_distance pricing. Local /
  // office / same_building need different distance handling — without
  // this override, a local under_50 move was getting 0.40 multiplier and
  // producing $650 for a 2BR move (real ~$1,650).
  function effectiveDistanceMult(moveType, distance) {
    var dm = MOVING_PRICING.distanceMultiplier[distance] || 1.0;
    if (moveType === "local") {
      if (distance === "under_50") return 1.0;
      if (distance === "50_250") return 1.30;
      return dm;
    }
    if (moveType === "office") {
      if (distance === "under_50") return 1.0;
      if (distance === "50_250") return 1.20;
      return dm;
    }
    if (moveType === "same_building") return 1.0;
    return dm;
  }

  function calcMovingEstimate(opts) {
    opts = opts || {};
    var typeData = MOVING_PRICING.basePriceByType[opts.moveType] || MOVING_PRICING.basePriceByType.local;
    var sizeMult = MOVING_PRICING.sizeMultiplier[opts.homeSize] || 1.0;
    var distMult = effectiveDistanceMult(opts.moveType, opts.distance);
    var packMult = MOVING_PRICING.packingMultiplier[opts.packing] || 1.0;
    var specialCost = MOVING_PRICING.specialItemsCost[opts.specialItems] || 0;
    var regionMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (LABOR_MULT_BY_REGION[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;

    var total = (typeData.base2BR * sizeMult * distMult * packMult * regionMult * inflationMult * seasonalMult) + (specialCost * sizeMult);

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }
    return { total: roundTo50(total), label: typeData.label, flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence };
  }

  return {
    MOVING_PRICING: MOVING_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    LABOR_MULT_BY_REGION: LABOR_MULT_BY_REGION,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    effectiveDistanceMult: effectiveDistanceMult,
    calcMovingEstimate: calcMovingEstimate,
    roundTo50: roundTo50
  };
});
