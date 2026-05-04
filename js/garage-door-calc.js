// Woogoro Garage Door calculator — single source of truth for /garage-door-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroGarageDoorCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var GD_PRICING = {
    basePriceByType: {
      single_car:         { label: "Single Car (9x7)",   basePrice: 1150 },
      double_car:         { label: "Double Car (16x7)",  basePrice: 1850 },
      custom_carriage:    { label: "Custom/Carriage",    basePrice: 3500 },
      opener_only:        { label: "Opener Only",        basePrice: 450 },
      spring_replacement: { label: "Spring Replacement", basePrice: 300 }
    },
    materialUpgrades: {
      steel_basic:     { label: "Basic Steel",        multiplier: 1.0 },
      steel_insulated: { label: "Insulated Steel",    multiplier: 1.15 },
      wood:            { label: "Wood",               multiplier: 1.45 },
      aluminum:        { label: "Aluminum",           multiplier: 1.20 },
      fiberglass:      { label: "Fiberglass",         multiplier: 1.30 },
      composite:       { label: "Composite/Faux Wood",multiplier: 1.55 }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    overheadMultiplier: 1.0,
    roundTo: 50,
    scopeItems: [
      { key: "oldDoorRemoval", label: "Old door removal and disposal", weight: 8 },
      { key: "tracks", label: "Tracks and hardware", weight: 12 },
      { key: "springs", label: "Torsion/extension springs", weight: 14 },
      { key: "opener", label: "Garage door opener", weight: 15 },
      { key: "remotes", label: "Remote controls", weight: 4 },
      { key: "weatherstripping", label: "Weatherstripping and seals", weight: 8 },
      { key: "insulation", label: "Insulation", weight: 6 },
      { key: "safetySensors", label: "Safety sensors and auto-reverse", weight: 10 },
      { key: "keypad", label: "Wireless keypad", weight: 4 },
      { key: "warranty", label: "Warranty (parts + labor)", weight: 10 },
      { key: "permits", label: "Permits and inspections", weight: 6 }
    ],
    openerCost: { low: 350, high: 500 }
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

  function calcGarageDoorEstimate(opts) {
    opts = opts || {};
    var typeInfo = GD_PRICING.basePriceByType[opts.serviceType] || GD_PRICING.basePriceByType.single_car;
    var basePrice = typeInfo.basePrice;
    var materialMult = 1.0;
    if (opts.serviceType !== "opener_only" && opts.serviceType !== "spring_replacement" && opts.materialKey) {
      var mat = GD_PRICING.materialUpgrades[opts.materialKey];
      if (mat) materialMult = mat.multiplier;
    }
    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (GD_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var total = basePrice * materialMult * laborMult * inflationMult;
    if (opts.includesOpener === "yes") {
      total += ((GD_PRICING.openerCost.low + GD_PRICING.openerCost.high) / 2) * laborMult * inflationMult;
    }

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }
    return { total: roundTo50(total), label: typeInfo.label, basePrice: basePrice, flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence };
  }

  return {
    GD_PRICING: GD_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    getRegionFromState: getRegionFromState,
    calcGarageDoorEstimate: calcGarageDoorEstimate,
    roundTo50: roundTo50
  };
});
