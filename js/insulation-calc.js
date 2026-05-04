// Woogoro Insulation calculator — single source of truth for /insulation-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroInsulationCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var INS_PRICING = {
    basePriceByType: {
      blown_in:          { label: "Blown-In (Attic)",         lowPerSqft: 0.90, highPerSqft: 2.30 },
      spray_foam_open:   { label: "Spray Foam (Open Cell)",   lowPerSqft: 1.50, highPerSqft: 3.50 },
      spray_foam_closed: { label: "Spray Foam (Closed Cell)", lowPerSqft: 2.50, highPerSqft: 5.50 },
      batts:             { label: "Batts (Fiberglass)",       lowPerSqft: 0.80, highPerSqft: 2.00 },
      rigid_foam:        { label: "Rigid Foam Board",         lowPerSqft: 1.20, highPerSqft: 3.20 }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    locationMultiplier: { attic: 1.0, walls: 1.15, crawl_space: 1.20, basement: 1.05 },
    removalMultiplier: 1.25,
    roundTo: 50,
    areaSizes: [
      { label: "800", sqft: 800 }, { label: "1000", sqft: 1000 }, { label: "1500", sqft: 1500 },
      { label: "2000", sqft: 2000 }, { label: "2500", sqft: 2500 }
    ],
    scopeItems: [
      { key: "airSealing", label: "Air sealing", weight: 12 },
      { key: "vaporBarrier", label: "Vapor barrier", weight: 10 },
      { key: "ventBaffles", label: "Vent baffles / rafter vents", weight: 8 },
      { key: "oldRemoval", label: "Old insulation removal", weight: 10 },
      { key: "accessCreation", label: "Access creation (hatches, panels)", weight: 6 },
      { key: "energyAudit", label: "Energy audit / thermal imaging", weight: 8 },
      { key: "permits", label: "Permits and inspections", weight: 6 },
      { key: "cleanup", label: "Cleanup and debris removal", weight: 6 },
      { key: "warranty", label: "Warranty (materials + labor)", weight: 10 },
      { key: "rValueCert", label: "R-value certification", weight: 8 }
    ]
  };

  // NOTE: insulation has different STATE_REGIONS map than other verticals
  // (AL=south not southeast; NV=mountain not west). Mirrors api/insulation-estimate.js.
  var STATE_REGIONS = {
    AL:"south",AK:"west",AZ:"mountain",AR:"south",CA:"west",CO:"mountain",CT:"northeast",
    DE:"northeast",FL:"southeast",GA:"southeast",HI:"west",ID:"mountain",IL:"midwest",
    IN:"midwest",IA:"midwest",KS:"midwest",KY:"southeast",LA:"south",ME:"northeast",
    MD:"northeast",MA:"northeast",MI:"midwest",MN:"midwest",MS:"south",MO:"midwest",
    MT:"mountain",NE:"midwest",NV:"mountain",NH:"northeast",NJ:"northeast",NM:"mountain",
    NY:"northeast",NC:"southeast",ND:"midwest",OH:"midwest",OK:"south",OR:"west",
    PA:"northeast",RI:"northeast",SC:"southeast",SD:"midwest",TN:"southeast",TX:"south",
    UT:"mountain",VT:"northeast",VA:"southeast",WA:"west",WV:"southeast",WI:"midwest",
    WY:"mountain",DC:"northeast"
  };

  // Insulation peaks in fall/winter prep (HVAC bills hit users in winter, drives demand).
  var SEASONAL_MULTS = { 1:0.95, 2:0.94, 3:0.96, 4:0.98, 5:1.00, 6:1.02, 7:1.04, 8:1.06, 9:1.08, 10:1.10, 11:1.06, 12:0.97 };

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }

  function calcInsulationEstimate(opts) {
    opts = opts || {};
    var typeData = INS_PRICING.basePriceByType[opts.insType] || INS_PRICING.basePriceByType.blown_in;
    var midPerSqft = (typeData.lowPerSqft + typeData.highPerSqft) / 2;
    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (INS_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var removalMult = opts.removalIncluded ? INS_PRICING.removalMultiplier : 1.0;
    var locationMult = INS_PRICING.locationMultiplier[opts.locationKey] || 1.0;
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;
    var sqft = Number(opts.sqft) || 1000;

    var total = midPerSqft * sqft * laborMult * removalMult * locationMult * inflationMult * seasonalMult;

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }
    return { total: roundTo50(total), label: typeData.label, midPerSqft: midPerSqft, flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence };
  }

  function calcInsulationRange(opts) {
    var b = calcInsulationEstimate(opts).total;
    return { low: roundTo50(b * 0.88), high: roundTo50(b * 1.15) };
  }

  return {
    INS_PRICING: INS_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    calcInsulationEstimate: calcInsulationEstimate,
    calcInsulationRange: calcInsulationRange,
    roundTo50: roundTo50
  };
});
