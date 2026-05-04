// Woogoro Painting calculator — single source of truth for /painting-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroPaintingCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PAINT_BRAND_TIER = {
    builder: { label: "Builder Grade", tag: "Basic coverage. Best for rentals, flips, or pre-sale touch-ups.", mult: 0.80, examples: "Behr Pro, SW ProMar 200, Valspar Pro, Glidden Premium", perGallon: "$22 - $38" },
    mid:     { label: "Mid-Range", tag: "Most popular. Good coverage and durability for lived-in homes.", mult: 1.00, examples: "Behr Premium Plus, SW SuperPaint, Benjamin Moore Ben, PPG Diamond", perGallon: "$38 - $60" },
    premium: { label: "Premium", tag: "Excellent coverage, 1-coat hide, 10-15 year exterior durability.", mult: 1.25, examples: "SW Duration, BM Regal Select, Behr Marquee, PPG Manor Hall", perGallon: "$60 - $90" },
    ultra:   { label: "Ultra-Premium", tag: "Top-of-line. Maximum durability, stain resistance, and color depth.", mult: 1.55, examples: "SW Emerald, BM Aura, Farrow & Ball, Fine Paints of Europe", perGallon: "$80 - $130" }
  };

  var PAINT_PRICING = {
    basePricePerSqft: {
      exterior_standard: { label: "Exterior - Standard (1 Coat)", low: 2.00, high: 4.00, mid: 3.00 },
      exterior_premium:  { label: "Exterior - Premium (2 Coats)", low: 3.00, high: 6.00, mid: 4.50 },
      interior_standard: { label: "Interior - Standard",          low: 1.50, high: 3.00, mid: 2.25 },
      interior_premium:  { label: "Interior - Premium",           low: 2.50, high: 5.00, mid: 3.75 },
      cabinet_painting:  { label: "Cabinet Painting", flatLow: 3000, flatHigh: 7000, flatMid: 5000 }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    roundTo: 50,
    homeSizes: [
      { label: "1000", sqft: 1000 }, { label: "1500", sqft: 1500 }, { label: "2000", sqft: 2000 },
      { label: "2500", sqft: 2500 }, { label: "3000", sqft: 3000 }, { label: "3500", sqft: 3500 }
    ],
    scopeItems: [
      { key: "powerWash", label: "Power washing / surface cleaning", weight: 8 },
      { key: "scraping", label: "Scraping old paint", weight: 10 },
      { key: "priming", label: "Priming surfaces", weight: 10 },
      { key: "caulking", label: "Caulking gaps and seams", weight: 8 },
      { key: "masking", label: "Masking / taping (windows, trim, floors)", weight: 6 },
      { key: "trimPainting", label: "Trim and detail painting", weight: 10 },
      { key: "cleanup", label: "Job site cleanup", weight: 6 },
      { key: "warranty", label: "Warranty on workmanship", weight: 10 },
      { key: "paintQuality", label: "Paint quality / brand specified", weight: 12 },
      { key: "coats", label: "Number of coats specified", weight: 12 },
      { key: "colorSamples", label: "Color samples / consultation", weight: 4 }
    ],
    brands: { premium: ["Sherwin-Williams", "Benjamin Moore"], mid: ["PPG", "Dunn-Edwards"], value: ["Behr"] }
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

  var SEASONAL_MULTS = { 1:0.92, 2:0.93, 3:0.96, 4:1.00, 5:1.06, 6:1.10, 7:1.12, 8:1.10, 9:1.04, 10:0.98, 11:0.94, 12:0.91 };
  var CONDITION_MULTS = { good: 1.0, fair: 1.15, poor: 1.35 };

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }
  function getPricingKey(projectType, paintQuality) {
    if (projectType === "cabinets") return "cabinet_painting";
    var base = (projectType === "exterior" || projectType === "both") ? "exterior" : "interior";
    return base + "_" + (paintQuality === "premium" ? "premium" : "standard");
  }

  function calcPaintingEstimate(opts) {
    opts = opts || {};
    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (PAINT_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var conditionMult = CONDITION_MULTS[opts.condition] || 1.0;
    var tierMult = (PAINT_BRAND_TIER[opts.brandTier] && PAINT_BRAND_TIER[opts.brandTier].mult) || 1.0;
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;
    var sqft = Number(opts.sqft) || 1500;
    var total = 0;

    if (opts.projectType === "cabinets") {
      var cabData = PAINT_PRICING.basePricePerSqft.cabinet_painting;
      total = cabData.flatMid * laborMult * tierMult * inflationMult;
    } else if (opts.projectType === "both") {
      var extKey = "exterior_" + (opts.paintQuality === "premium" ? "premium" : "standard");
      var intKey = "interior_" + (opts.paintQuality === "premium" ? "premium" : "standard");
      var combinedPerSqft = PAINT_PRICING.basePricePerSqft[extKey].mid + PAINT_PRICING.basePricePerSqft[intKey].mid;
      total = combinedPerSqft * sqft * laborMult * conditionMult * tierMult * inflationMult * seasonalMult;
    } else {
      var key = getPricingKey(opts.projectType, opts.paintQuality);
      var pricing = PAINT_PRICING.basePricePerSqft[key] || PAINT_PRICING.basePricePerSqft.exterior_standard;
      total = pricing.mid * sqft * laborMult * conditionMult * tierMult * inflationMult * seasonalMult;
    }

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }
    return { total: roundTo50(total), flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence };
  }

  return {
    PAINT_PRICING: PAINT_PRICING,
    PAINT_BRAND_TIER: PAINT_BRAND_TIER,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    CONDITION_MULTS: CONDITION_MULTS,
    getRegionFromState: getRegionFromState,
    getPricingKey: getPricingKey,
    calcPaintingEstimate: calcPaintingEstimate,
    roundTo50: roundTo50
  };
});
