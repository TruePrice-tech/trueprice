// Woogoro Concrete calculator — single source of truth for /concrete-estimate.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WoogoroConcreteCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CONC_PRICING = {
    basePricePerSqft: {
      // [PRICE-DRIFT-2026-1] 2026 industry is $8-$20/sqft for a standard
      // driveway (was 8-15/11.50). Midpoint 14.00 puts a 600sqft job at
      // $8,400 national, matching the industry mid for that scope.
      standard_driveway: { label: "Standard Driveway", low: 8,  high: 20, mid: 14.00 },
      // [PRICE-DRIFT-2026-1] 2026 industry is $9-$30/sqft (was 12-20/16.00).
      // Our national mid was 18% low; it only looked right in the spot-check
      // because that spec is West (1.22x), which masked the gap. Using 18.00
      // rather than the 19.50 range midpoint because 9-30 is right-skewed by
      // elaborate multi-color work and the median job sits nearer $16-18.
      stamped_concrete:  { label: "Stamped Concrete",  low: 9,  high: 30, mid: 18.00 },
      concrete_patio:    { label: "Concrete Patio",    low: 8,  high: 16, mid: 12.00 },
      sidewalk:          { label: "Sidewalk",          low: 8,  high: 14, mid: 11.00 },
      asphalt_driveway:  { label: "Asphalt Driveway",  low: 5,  high: 10, mid: 7.50 }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    scopeItems: [
      { key: "demolition", label: "Demolition of existing surface", weight: 12 },
      { key: "grading", label: "Grading and leveling", weight: 10 },
      { key: "basePrep", label: "Base preparation (gravel/compaction)", weight: 10 },
      { key: "forms", label: "Formwork", weight: 8 },
      { key: "rebarMesh", label: "Rebar or wire mesh reinforcement", weight: 10 },
      { key: "concretePour", label: "Concrete pour and placement", weight: 15 },
      { key: "finishing", label: "Finishing (broom, smooth, or stamped)", weight: 10 },
      { key: "sealing", label: "Sealing / curing compound", weight: 6 },
      { key: "expansionJoints", label: "Expansion joints", weight: 5 },
      { key: "permits", label: "Permits and inspections", weight: 4 },
      { key: "cleanup", label: "Site cleanup", weight: 3 },
      { key: "warranty", label: "Warranty", weight: 5 },
      { key: "cureTime", label: "Cure time / restrictions noted", weight: 2 }
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

  var SEASONAL_MULTS = { 1:0.92, 2:0.93, 3:0.96, 4:1.00, 5:1.06, 6:1.10, 7:1.12, 8:1.10, 9:1.04, 10:0.98, 11:0.94, 12:0.90 };

  function roundTo50(n) { return Math.round(n / 50) * 50; }
  // CONC-REGION-1 (2026-05-05, mirror KIT-REGION-1 bbd7775aabe): drop
  // dishonest 'south' fallback when stateCode unknown. Math impact zero
  // (calcConcreteEstimate falls back to 1.0 labor mult when region is
  // null), but the analyzer + estimator use the returned value to label
  // pricing source — dishonest "South regional pricing" was the user-
  // facing bug. Returning null lets callers fall through to "National
  // typical pricing" / "Not detected" copy.
  function getRegionFromState(sc) {
    var key = (sc || "").toUpperCase();
    if (!key) return null;
    return STATE_REGIONS[key] || null;
  }
  function sqftFromSize(sizeLabel) {
    var map = { "200": 200, "400": 400, "600": 600, "800": 800, "1000": 1000 };
    return map[sizeLabel] || 400;
  }

  function calcConcreteEstimate(opts) {
    opts = opts || {};
    var proj = CONC_PRICING.basePricePerSqft[opts.projectType] || CONC_PRICING.basePricePerSqft.standard_driveway;
    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (CONC_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;
    var thicknessMult = (typeof opts.thicknessMult === "number") ? opts.thicknessMult : 1.0;
    var demoMult      = (typeof opts.demoMult      === "number") ? opts.demoMult      : 1.0;
    var sqft = Number(opts.sqft) || 400;
    var total = proj.mid * sqft * laborMult * thicknessMult * demoMult * inflationMult * seasonalMult;

    var flywheelApplied = false, flywheelConfidence = "model_only";
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (opts.calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(total, opts.calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied) { total = blended.mid; flywheelApplied = true; }
    }
    return { total: roundTo50(total), label: proj.label, midPerSqft: proj.mid, flywheelApplied: flywheelApplied, flywheelConfidence: flywheelConfidence };
  }

  return {
    CONC_PRICING: CONC_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    sqftFromSize: sqftFromSize,
    calcConcreteEstimate: calcConcreteEstimate,
    roundTo50: roundTo50
  };
});
