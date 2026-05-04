// Woogoro Foundation calculator — single source of truth for /foundation-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroFoundationCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FOUND_PRICING = {
    basePriceByType: {
      pier_installation:   { label: "Pier Installation",       basePrice: 1500, unit: "per pier" },
      slabjacking:         { label: "Slabjacking/Mudjacking",  basePrice: 1000 },
      wall_stabilization:  { label: "Wall Stabilization",      basePrice: 8000 },
      drainage_correction: { label: "Drainage Correction",     basePrice: 4000 },
      crack_repair:        { label: "Crack Repair",            basePrice: 525,  unit: "per crack" }
    },
    projectSizes: [
      { label: "Minor (1-3 cracks)",          multiplier: 0.6 },
      { label: "Moderate (4-8 piers)",        multiplier: 1.0 },
      { label: "Major (8-12 piers + drainage)", multiplier: 1.8 },
      { label: "Extensive (full perimeter)",  multiplier: 2.8 }
    ],
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    overheadMultiplier: 1.0,
    roundTo: 50,
    homeAgeMultipliers: { pre_1960: 1.25, "1960_1989": 1.10, "1990_plus": 1.00 },
    scopeItems: [
      { key: "inspection",   label: "Structural inspection / engineering report" },
      { key: "piers",        label: "Piers (steel push piers or helical piers)" },
      { key: "brackets",     label: "Pier brackets and hardware" },
      { key: "excavation",   label: "Excavation and soil work" },
      { key: "waterproofing",label: "Waterproofing / sealant" },
      { key: "drainage",     label: "Drainage system installation" },
      { key: "backfill",     label: "Backfill and compaction" },
      { key: "monitoring",   label: "Post-repair monitoring / follow-up" },
      { key: "warranty",     label: "Warranty (transferable / lifetime)" },
      { key: "permits",      label: "Permits and inspections" },
      { key: "landscaping",  label: "Landscaping restoration" }
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

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }
  function getAgeMultiplier(homeAge) {
    if (homeAge === "pre_1960") return FOUND_PRICING.homeAgeMultipliers.pre_1960;
    if (homeAge === "1960_1989") return FOUND_PRICING.homeAgeMultipliers["1960_1989"];
    return FOUND_PRICING.homeAgeMultipliers["1990_plus"];
  }
  function getSeverityMultiplier(severity) {
    if (severity === "minor") return FOUND_PRICING.projectSizes[0].multiplier;
    if (severity === "moderate") return FOUND_PRICING.projectSizes[1].multiplier;
    if (severity === "major") return FOUND_PRICING.projectSizes[2].multiplier;
    if (severity === "extensive") return FOUND_PRICING.projectSizes[3].multiplier;
    return 1.0;
  }
  function getDefaultPierCount(severity) {
    if (severity === "minor") return 2;
    if (severity === "moderate") return 6;
    if (severity === "major") return 10;
    if (severity === "extensive") return 16;
    return 6;
  }
  function getDefaultCrackCount(severity) {
    if (severity === "minor") return 2;
    if (severity === "moderate") return 4;
    if (severity === "major") return 6;
    if (severity === "extensive") return 10;
    return 3;
  }

  function calcFoundationEstimate(opts) {
    opts = opts || {};
    var typeData = FOUND_PRICING.basePriceByType[opts.repairType] || FOUND_PRICING.basePriceByType.pier_installation;
    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (FOUND_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var severityMult = getSeverityMultiplier(opts.severity);
    var ageMult = getAgeMultiplier(opts.homeAge);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;

    var total = 0;
    if (opts.repairType === "pier_installation") {
      total = typeData.basePrice * getDefaultPierCount(opts.severity) * laborMult * inflationMult;
    } else if (opts.repairType === "crack_repair") {
      total = typeData.basePrice * getDefaultCrackCount(opts.severity) * laborMult * inflationMult;
    } else {
      total = typeData.basePrice * severityMult * laborMult * ageMult * inflationMult;
    }
    total *= FOUND_PRICING.overheadMultiplier;

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
    FOUND_PRICING: FOUND_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    getRegionFromState: getRegionFromState,
    getAgeMultiplier: getAgeMultiplier,
    getSeverityMultiplier: getSeverityMultiplier,
    getDefaultPierCount: getDefaultPierCount,
    getDefaultCrackCount: getDefaultCrackCount,
    calcFoundationEstimate: calcFoundationEstimate,
    roundTo50: roundTo50
  };
});
