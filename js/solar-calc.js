// Woogoro Solar calculator — single source of truth for /solar-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroSolarCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SOLAR_PRICING = {
    pricePerWatt: {
      budget:  { label: "Budget Panels (Jinko, Trina, Canadian Solar)", low: 2.30, high: 3.20, base: 2.75 },
      mid:     { label: "Mid-Tier Panels (Q Cells, LONGi, REC, Silfab)", low: 2.60, high: 3.70, base: 3.15 },
      premium: { label: "Premium Panels (SunPower, LG, Panasonic)",      low: 3.00, high: 4.50, base: 3.75 }
    },
    inverterAdder: {
      string:        { label: "String Inverter",          perWatt: 0.00 },
      microinverter: { label: "Microinverters (Enphase)", perWatt: 0.30 },
      optimizer:     { label: "Optimizers (SolarEdge)",   perWatt: 0.20 }
    },
    batteryAdder: {
      none:       { label: "No Battery",         cost: 0 },
      powerwall:  { label: "Tesla Powerwall",    cost: 12000 },
      enphase_iq: { label: "Enphase IQ Battery", cost: 10000 },
      other:      { label: "Other Battery",      cost: 10000 }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    overheadMultiplier: 1.0,
    federalTaxCredit: 0.30,
    roundTo: 100,
    scopeItems: [
      { key: "panels", label: "Solar panels (brand, count, wattage)", weight: 25 },
      { key: "inverter", label: "Inverter / microinverters", weight: 12 },
      { key: "racking", label: "Racking / mounting system", weight: 8 },
      { key: "wiring", label: "Electrical wiring and conduit", weight: 8 },
      { key: "panelUpgrade", label: "Electrical panel upgrade (if needed)", weight: 6 },
      { key: "permits", label: "Permit and plan review", weight: 6 },
      { key: "interconnection", label: "Utility interconnection", weight: 5 },
      { key: "netMetering", label: "Net metering application", weight: 4 },
      { key: "monitoring", label: "Monitoring system", weight: 4 },
      { key: "roofWork", label: "Roof penetration / waterproofing", weight: 6 },
      { key: "battery", label: "Battery storage (if applicable)", weight: 0 },
      { key: "warranty", label: "Workmanship warranty", weight: 6 }
    ],
    brands: {
      premium: ["SunPower", "LG", "Panasonic"],
      mid: ["Q Cells", "LONGi", "REC", "Silfab"],
      budget: ["Jinko", "Trina", "Canadian Solar", "JA Solar"]
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

  function roundTo100(n) { return Math.round(n / 100) * 100; }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }
  function kwFromSize(sizeKey, customKw) {
    if (customKw && Number(customKw) > 0) return Number(customKw);
    var map = { small: 5, medium: 8, large: 11, very_large: 14 };
    return map[sizeKey] || 8;
  }

  // calcSolarEstimate(opts):
  //   systemKw       system size in kW
  //   panelTier      "budget" | "mid" | "premium"
  //   inverterType   "string" | "microinverter" | "optimizer"
  //   batteryType    "none" | "powerwall" | "enphase_iq" | "other"
  //   region         laborMultiplierByRegion key
  //   roofCondition  "good" | "minor_repair" | "significant_work"
  //   cityMult       optional per-city mult
  //   inflationMult  default 1.0 (solar pricing tracks DOE NREL solar cost data; mostly stable)
  //   calData        optional flywheel calibration { avgPrice, quotes }
  function calcSolarEstimate(opts) {
    opts = opts || {};
    var tier = SOLAR_PRICING.pricePerWatt[opts.panelTier] || SOLAR_PRICING.pricePerWatt.mid;
    var invAdder = SOLAR_PRICING.inverterAdder[opts.inverterType] || SOLAR_PRICING.inverterAdder.string;
    var bat = SOLAR_PRICING.batteryAdder[opts.batteryType] || SOLAR_PRICING.batteryAdder.none;
    var totalPerWatt = tier.base + invAdder.perWatt;
    var systemWatts = (Number(opts.systemKw) || 8) * 1000;
    var baseCost = totalPerWatt * systemWatts + bat.cost;

    var regionMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (SOLAR_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;

    var total = baseCost * regionMult * SOLAR_PRICING.overheadMultiplier * inflationMult;
    if (opts.roofCondition === "minor_repair") total *= 1.05;
    else if (opts.roofCondition === "significant_work") total *= 1.15;

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }
    return { total: roundTo100(total), label: tier.label, totalPerWatt: totalPerWatt, flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence };
  }

  return {
    SOLAR_PRICING: SOLAR_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    getRegionFromState: getRegionFromState,
    kwFromSize: kwFromSize,
    calcSolarEstimate: calcSolarEstimate,
    roundTo100: roundTo100
  };
});
