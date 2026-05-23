// Woogoro Landscaping calculator — single source of truth for /landscaping-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroLandscapingCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LAND_PRICING = {
    basePricing: {
      // Installation / build projects (one-time)
      paver_patio:               { label: "Paver Patio",              unit: "sqft",       low: 18,   high: 38,    mid: 26,    category: "installation" },
      retaining_wall:            { label: "Retaining Wall",           unit: "sqft face",  low: 25,   high: 55,    mid: 38,    category: "installation" },
      sod_installation:          { label: "Sod Installation",         unit: "sqft",       low: 1.10, high: 2.60,  mid: 1.75,  category: "installation" },
      landscape_design_install:  { label: "Landscape Design + Install", unit: "project",  low: 5000, high: 15000, mid: 10000, category: "installation" },
      french_drain:              { label: "French Drain",             unit: "LF",         low: 25,   high: 50,    mid: 37.50, category: "installation" },
      grading_leveling:          { label: "Grading/Leveling",         unit: "project",    low: 1000, high: 3000,  mid: 2000,  category: "installation" },
      artificial_turf:           { label: "Artificial Turf",          unit: "sqft",       low: 8,    high: 16,    mid: 12,    category: "installation" },
      walkway_path:              { label: "Walkway / Path",           unit: "sqft",       low: 15,   high: 35,    mid: 25,    category: "installation" },
      outdoor_kitchen:           { label: "Outdoor Kitchen",          unit: "project",    low: 8000, high: 25000, mid: 16000, category: "installation" },
      fire_pit:                  { label: "Fire Pit / Fireplace",     unit: "project",    low: 1500, high: 5000,  mid: 3000,  category: "installation" },
      tree_removal:              { label: "Tree / Stump Removal",     unit: "project",    low: 500,  high: 2000,  mid: 1200,  category: "installation" },
      irrigation_system:         { label: "Irrigation System",        unit: "project",    low: 2500, high: 5000,  mid: 3750,  category: "installation" },
      pergola_gazebo:            { label: "Pergola / Gazebo",         unit: "project",    low: 3500, high: 12000, mid: 7500,  category: "installation" },
      planting_beds:             { label: "Planting Beds / Garden",   unit: "sqft",       low: 10,   high: 25,    mid: 17,    category: "installation" },

      // Recurring / one-time maintenance services
      lawn_mowing:               { label: "Lawn Mowing (per visit)",  unit: "project",    low: 35,   high: 85,    mid: 60,    category: "maintenance" },
      shrub_trimming:            { label: "Shrub / Hedge Trimming",   unit: "project",    low: 75,   high: 250,   mid: 150,   category: "maintenance" },
      flower_bed_maintenance:    { label: "Flower Bed Maintenance",   unit: "project",    low: 50,   high: 175,   mid: 110,   category: "maintenance" },
      seasonal_cleanup:          { label: "Seasonal Cleanup (spring/fall)", unit: "project", low: 300, high: 800,  mid: 500,  category: "maintenance" },
      leaf_removal:              { label: "Leaf Removal",             unit: "project",    low: 200,  high: 700,   mid: 400,   category: "maintenance" },
      fertilization_program:     { label: "Lawn Fertilization (annual program)", unit: "project", low: 300, high: 700, mid: 500, category: "maintenance" }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    overheadMultiplier: 1.0,
    roundTo: 50,
    scopeItems: [
      { key: "designPlan", label: "Design plan / layout", weight: 10 },
      { key: "excavation", label: "Excavation / grading", weight: 12 },
      { key: "drainage", label: "Drainage solution", weight: 10 },
      { key: "baseMaterial", label: "Base material (gravel/sand)", weight: 10 },
      { key: "edging", label: "Edging / borders", weight: 6 },
      { key: "mulchRock", label: "Mulch / decorative rock", weight: 6 },
      { key: "plants", label: "Plants / trees / shrubs", weight: 10 },
      { key: "irrigation", label: "Irrigation / sprinkler", weight: 8 },
      { key: "lighting", label: "Landscape lighting", weight: 6 },
      { key: "sealing", label: "Sealing / finishing", weight: 6 },
      { key: "permits", label: "Permits and inspections", weight: 6 },
      { key: "cleanup", label: "Site cleanup / haul-off", weight: 4 },
      { key: "warranty", label: "Warranty (materials + labor)", weight: 6 }
    ],
    complexityMultipliers: { basic: 1.0, moderate: 1.20, complex: 1.50 }
  };

  var QUALITY_TIER = {
    budget:  { label: "Budget",       tag: "Basic materials, minimal design.",          mult: 0.70, examples: "Concrete pavers, basic sod, gravel borders, no lighting" },
    mid:     { label: "Mid-Range",    tag: "Most popular. Quality materials.",          mult: 1.00, examples: "Interlocking pavers, native plants, basic edging, mulch beds" },
    premium: { label: "Premium",      tag: "Natural stone, specimen plants, lighting.", mult: 1.55, examples: "Flagstone/bluestone, curated plantings, low-voltage lighting" },
    luxury:  { label: "Luxury / Custom", tag: "Architect-designed.",                    mult: 2.30, examples: "Custom stonework, mature trees, smart irrigation" }
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

  var SEASONAL_MULTS = { 1:0.90, 2:0.92, 3:0.98, 4:1.06, 5:1.10, 6:1.12, 7:1.10, 8:1.06, 9:1.00, 10:0.95, 11:0.90, 12:0.88 };

  function roundTo50(n) { return Math.round(n / 50) * 50; }

  // Maintenance services often land in the $35-$800 band where rounding to
  // the nearest $50 throws away meaningful precision (e.g. a $66 weekly mow
  // benchmark would round to $50, then a real $65 quote reads as +30%
  // above-average instead of fair). Round to $5 below $200, $25 below $1,000,
  // otherwise keep the original $50 granularity used by install projects.
  function roundDynamic(n) {
    if (n < 200) return Math.round(n / 5) * 5;
    if (n < 1000) return Math.round(n / 25) * 25;
    return Math.round(n / 50) * 50;
  }
  function getRegionFromState(sc) { return STATE_REGIONS[(sc || "").toUpperCase()] || "south"; }

  function calcLandscapingEstimate(opts) {
    opts = opts || {};
    var proj = LAND_PRICING.basePricing[opts.projectType] || LAND_PRICING.basePricing.paver_patio;
    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (LAND_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var complexityMult = LAND_PRICING.complexityMultipliers[opts.complexity] || 1.0;
    var tierMult = (QUALITY_TIER[opts.qualityTier] && QUALITY_TIER[opts.qualityTier].mult) || 1.0;
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;
    var size = Number(opts.size) || 0;

    var total = 0;
    if (proj.unit === "project") total = proj.mid * laborMult * complexityMult * tierMult;
    else                         total = proj.mid * size * laborMult * complexityMult * tierMult;
    total = total * LAND_PRICING.overheadMultiplier * inflationMult * seasonalMult;

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }
    // Use finer-grained rounding for maintenance category to preserve
    // sub-$200 precision; install projects keep the legacy $50 granularity.
    var rounder = (proj.category === "maintenance") ? roundDynamic : roundTo50;
    return { total: rounder(total), label: proj.label, unit: proj.unit, mid: proj.mid, flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence };
  }

  return {
    LAND_PRICING: LAND_PRICING,
    QUALITY_TIER: QUALITY_TIER,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    calcLandscapingEstimate: calcLandscapingEstimate,
    roundTo50: roundTo50
  };
});
