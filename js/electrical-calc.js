// Woogoro Electrical calculator — single source of truth for /electrical-estimate.
// Mirrors hvac-calc.js / kitchen-calc.js / auto-calc.js / roofing-calc.js.

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroElectricalCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ELEC_PRICING = {
    basePriceByService: {
      panel_upgrade:      { label: "Panel Upgrade (100A to 200A)",     low: 1300, high: 3500 },
      whole_house_rewire: { label: "Whole House Rewire",                low: 8000, high: 30000 },
      ev_charger:         { label: "EV Charger Installation",           low: 900,  high: 3000 },
      generator:          { label: "Generator Installation (Whole Home)", low: 6500, high: 18000 },
      circuit_addition:   { label: "Circuit Addition",                  low: 180,  high: 450 },
      outlet_switch:      { label: "Outlet/Switch Replacement",         low: 180,  high: 350 }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    overheadMultiplier: 1.0,
    roundTo: 50,
    homeSizes: [
      { label: "1000", sqft: 1000 }, { label: "1500", sqft: 1500 },
      { label: "2000", sqft: 2000 }, { label: "2500", sqft: 2500 },
      { label: "3000", sqft: 3000 }, { label: "3500", sqft: 3500 },
      { label: "4000", sqft: 4000 }
    ],
    scopeItems: [
      { key: "permits", label: "Permits and inspections", weight: 8 },
      { key: "panel", label: "Electrical panel", weight: 18 },
      { key: "breakers", label: "Circuit breakers", weight: 10 },
      { key: "wiring", label: "Wiring / cabling", weight: 16 },
      { key: "grounding", label: "Grounding system", weight: 8 },
      { key: "conduit", label: "Conduit / raceway", weight: 6 },
      { key: "trenching", label: "Trenching (if applicable)", weight: 6 },
      { key: "testing", label: "Testing and commissioning", weight: 6 },
      { key: "cleanup", label: "Cleanup and patching", weight: 4 },
      { key: "warranty", label: "Warranty (parts + labor)", weight: 8 },
      { key: "codeCompliance", label: "Code compliance / upgrades", weight: 6 },
      { key: "meterUpgrade", label: "Meter base upgrade", weight: 4 }
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

  // Electrical work peaks in spring/summer (when AC + EV chargers + outdoor circuits cluster).
  var SEASONAL_MULTS = { 1:0.95, 2:0.95, 3:0.98, 4:1.02, 5:1.06, 6:1.08, 7:1.08, 8:1.06, 9:1.02, 10:0.97, 11:0.94, 12:0.93 };

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }
  function circuitsFromSqFt(sqft) {
    var n = Number(sqft) || 2000;
    return Math.max(1, Math.round(n / 450));
  }

  // calcElectricalEstimate(opts):
  //   serviceType    "panel_upgrade" | "whole_house_rewire" | "ev_charger" |
  //                  "generator" | "circuit_addition" | "outlet_switch"
  //   homeSqFt       (used for whole_house_rewire scaling + circuit_addition)
  //   homeAge        "pre1970" | "1970_1999" | "2000_plus" — age uplift for
  //                  knob-and-tube / mid-century wiring complexity
  //   region         laborMultiplierByRegion key
  //   cityMult       optional per-city mult (overrides region mult)
  //   inflationMult  default 1.0
  //   seasonalMult   default 1.0
  //   calData        optional flywheel calibration { avgPrice, quotes }
  function calcElectricalEstimate(opts) {
    opts = opts || {};
    var svc = ELEC_PRICING.basePriceByService[opts.serviceType];
    if (!svc) svc = ELEC_PRICING.basePriceByService.panel_upgrade;
    var basePrice = 0;
    var midpoint = (svc.low + svc.high) / 2;
    if (opts.serviceType === "whole_house_rewire") {
      var sqft = Number(opts.homeSqFt) || 2000;
      basePrice = midpoint * (sqft / 2000);
    } else if (opts.serviceType === "circuit_addition") {
      basePrice = midpoint * circuitsFromSqFt(opts.homeSqFt);
    } else {
      basePrice = midpoint;
    }

    var regionMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (ELEC_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;

    var total = basePrice * regionMult * ELEC_PRICING.overheadMultiplier * inflationMult * seasonalMult;
    if (opts.homeAge === "pre1970") total *= 1.25;
    else if (opts.homeAge === "1970_1999") total *= 1.10;

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }

    return {
      total: roundTo50(total),
      basePrice: basePrice,
      label: svc.label,
      regionMult: regionMult,
      flywheelApplied: flywheelApplied,
      flywheelConfidence: flywheelConfidence
    };
  }

  return {
    ELEC_PRICING: ELEC_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    circuitsFromSqFt: circuitsFromSqFt,
    calcElectricalEstimate: calcElectricalEstimate,
    roundTo50: roundTo50
  };
});
