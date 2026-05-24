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
      lighting:                  { label: "Landscape Lighting",       unit: "project",    low: 1500, high: 8000,  mid: 4000,  category: "installation" },

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

  // Per-project tier examples. An irrigation result shouldn't read "Concrete
  // pavers, basic sod" for the budget tier; a shrub-trim result shouldn't
  // mention pavers at all. Falls back to QUALITY_TIER[tier].examples.
  var TIER_EXAMPLES_BY_PROJECT = {
    paver_patio:             { budget: "Concrete pavers, gravel base, no edge restraint", mid: "Interlocking pavers, polymeric joint sand, plastic edge restraint", premium: "Flagstone or bluestone, geotextile + 6-inch base, metal edge restraint", luxury: "Custom stonework, mortared joints, integrated lighting + drainage" },
    retaining_wall:          { budget: "Concrete block, no geogrid, surface drainage", mid: "Allan Block / Versa-Lok with geogrid <4ft, drainage tile", premium: "Engineered Belgard / Techo-Bloc with deep geogrid, full drainage", luxury: "Natural stone or boulder wall, engineered, integrated lighting" },
    sod_installation:        { budget: "Standard fescue or bermuda, basic prep, no fertilizer", mid: "Premium variety, tilling + soil amendment, starter fertilizer", premium: "Bluegrass / zoysia blend, deep tilling, compost amendment, watering plan", luxury: "Custom blend, smart irrigation included, 1-year health guarantee" },
    artificial_turf:         { budget: "Builder-grade synthetic, basic infill, no pet backing", mid: "Mid-pile synthetic, silica sand infill, drainage holes", premium: "Heavy-pile commercial-grade, anti-microbial pet-grade backing", luxury: "Custom blend with shock pad, putting-green inserts, pet odor system" },
    tree_removal:            { budget: "Cut + leave wood, no stump grinding", mid: "Cut + haul-off, stump grinding included", premium: "Crane-assisted, full clean-up, replanting plan", luxury: "Certified arborist, salvage milling option, full landscape repair" },
    grading_leveling:        { budget: "Rough grade, no compaction, surface only", mid: "Compacted grade with finish slope to spec", premium: "Engineered grade with drainage tie-ins and silt control", luxury: "Survey-staked grade plan, soil import, full erosion control" },
    irrigation_system:       { budget: "Builder-grade timer, basic pop-up heads, 4-6 zones", mid: "Mid-tier controller, pressure-regulated heads, 6-10 zones", premium: "Smart Wi-Fi controller, rain sensor, drip + spray mix, 8-15 zones", luxury: "ET-based smart controller, soil-moisture sensors, fully zoned drip" },
    lighting:                { budget: "Plug-in low-voltage starter kit, basic path lights", mid: "Hardwired transformer, mid-tier path + spot fixtures", premium: "Premium brass / copper fixtures, dimmable transformer, smart controller", luxury: "Architectural fixtures, color-tunable, app-controlled scenes, 25-yr warranty" },
    outdoor_kitchen:         { budget: "Built-in grill island, basic countertop, no plumbing", mid: "Stainless cabinets, granite top, gas + cold water rough-in", premium: "Full kitchen with side burner, fridge, sink, stone veneer", luxury: "Architect-designed pavilion with full appliances, pizza oven, smoker" },
    fire_pit:                { budget: "Wood-burning steel ring, gravel pad", mid: "Stone-faced gas pit on paver pad with simple controls", premium: "Custom natural-stone surround, gas with electronic ignition", luxury: "Architectural gas fire feature with seat-wall and ambient lighting" },
    pergola_gazebo:          { budget: "Pre-fab kit pergola, surface-mounted, untreated wood", mid: "Treated lumber, anchored to concrete piers, basic stain", premium: "Cedar / aluminum, sealed, integrated electrical for fans / lights", luxury: "Architect-designed structure, retractable canopy, full lighting + speakers" },
    walkway_path:            { budget: "Stepping stones in mulch, no base", mid: "Concrete pavers on 4-inch base with edge restraint", premium: "Flagstone / bluestone on 6-inch base, polymeric joint sand", luxury: "Custom natural-stone path, lighting integrated, mortared joints" },
    planting_beds:           { budget: "Few starter plants, generic mulch, no soil amendment", mid: "Native + ornamental mix, hardwood mulch, basic edging", premium: "Curated planting plan, compost-amended soil, larger specimens", luxury: "Designer planting with mature specimens, drip irrigation, seasonal rotation" },
    landscape_design_install:{ budget: "Functional plan, basic plants + grass, minimal hardscape", mid: "Mid-tier mixed plan with hardscape, plants, mulch, lighting", premium: "Designed plan with stone, specimen plants, drip irrigation, low-volt lighting", luxury: "Architect-designed full property, mature trees, water feature, smart systems" },
    french_drain:            { budget: "Surface trench with perforated PVC, daylight outlet", mid: "Sock-wrapped pipe, 24-inch trench, gravel + filter fabric", premium: "Catch basins + perforated pipe network, pop-up emitter, full slope spec", luxury: "Engineered drainage system with multiple catch basins and dry well" },
    // Maintenance services — tiers reflect crew skill + thoroughness, not materials
    lawn_mowing:             { budget: "Mow only, no edge trimming or cleanup", mid: "Mow + edge + blower cleanup of walks", premium: "Mow + edge + bag + light flower-bed touch", luxury: "Full service: mow + edge + bag + flower-bed weed + path blow + weekly inspection" },
    shrub_trimming:          { budget: "Quick shear, no shape correction", mid: "Hand-trim with shape, debris bagged + hauled", premium: "Selective pruning by horticulture-trained crew, deep clean", luxury: "Certified arborist shaping with deadwood + crossing-branch removal" },
    flower_bed_maintenance:  { budget: "Weed pull only", mid: "Weed + deadhead + light mulch touch-up", premium: "Weed + deadhead + soil refresh + slow-release fertilizer", luxury: "Designer-grade weekly upkeep with seasonal color rotation" },
    seasonal_cleanup:        { budget: "Basic leaf rake + curb-side haul", mid: "Full-property cleanup with pruning + mulch top-up", premium: "Cleanup + soil amendment + winterization of beds", luxury: "Full estate service incl. equipment winterization + spring re-planting plan" },
    leaf_removal:            { budget: "Curb-side blow + municipal pickup", mid: "Full property rake + bag + haul-off", premium: "Multi-visit through fall + gutter clean-out", luxury: "Weekly through fall + gutter + winter-prep package" },
    fertilization_program:   { budget: "Spring + fall feeding only", mid: "4-application program (granular), pre-emergent in spring", premium: "6-application program with grub control + soil pH check", luxury: "Custom turf consultant with soil testing + organic-product options" }
  };

  // Per-project complexity labels. The generic "simple layout / curves / multi-
  // level + water features" axis only fits hardscape/design builds. Maintenance
  // services price on count + access + debris volume, not on layout shape.
  // Missing entries fall back to GENERIC_COMPLEXITY_LABELS.
  var GENERIC_COMPLEXITY_LABELS = {
    basic:    "Basic (simple layout)",
    moderate: "Moderate (curves/patterns)",
    complex:  "Complex (multi-level/water features)"
  };
  var COMPLEXITY_LABELS_BY_PROJECT = {
    shrub_trimming:         { basic: "Light trim (under 10 shrubs)",      moderate: "Typical residential (10-20 shrubs or mid hedges)", complex: "Tall/dense hedges, formal shapes, 20+ plants" },
    lawn_mowing:            { basic: "Small flat lot (under 5K sqft)",    moderate: "Typical residential (5-15K sqft)",                 complex: "Large/sloped lot, many obstacles" },
    flower_bed_maintenance: { basic: "1-2 small beds",                    moderate: "Several beds (front + back)",                      complex: "Whole-property beds, intricate plantings" },
    seasonal_cleanup:       { basic: "Small lot, light debris",           moderate: "Typical residential, moderate debris",             complex: "Large lot, heavy leaves, many bed cleanups" },
    leaf_removal:           { basic: "Few trees, light load",             moderate: "Typical residential canopy",                       complex: "Heavy tree cover, multiple visits" },
    fertilization_program:  { basic: "Small lawn, easy access",           moderate: "Typical residential lawn",                         complex: "Large lot, troubled soil, slopes" },
    tree_removal:           { basic: "Single small tree, open access",    moderate: "Mid-size tree or 2-3 small, near structures",      complex: "Large tree, tight access, near power lines" },
    irrigation_system:      { basic: "Small flat lawn, single zone",      moderate: "Typical 4-8 zones, mixed turf + beds",             complex: "Large property, multi-zone with drip + grade changes" },
    fire_pit:               { basic: "Pre-fab kit on prepped pad",        moderate: "Custom stone surround on patio",                   complex: "Built-in gas with seat-wall + lighting integration" },
    outdoor_kitchen:        { basic: "Grill island only",                 moderate: "Cabinets + counter + gas / water rough-in",        complex: "Full kitchen with pavilion, multiple appliances" },
    pergola_gazebo:         { basic: "Kit pergola, surface-mounted",      moderate: "Anchored to piers with stain + basic electrical",  complex: "Custom structure with retractable canopy + integrated lighting" }
  };

  function tierExamplesFor(projectType, qualityTier) {
    var perProject = TIER_EXAMPLES_BY_PROJECT[projectType];
    if (perProject && perProject[qualityTier]) return perProject[qualityTier];
    return (QUALITY_TIER[qualityTier] && QUALITY_TIER[qualityTier].examples) || "";
  }

  function complexityLabelFor(projectType, complexity) {
    var perProject = COMPLEXITY_LABELS_BY_PROJECT[projectType];
    if (perProject && perProject[complexity]) return perProject[complexity];
    return GENERIC_COMPLEXITY_LABELS[complexity] || complexity;
  }

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

  // ── Bundle / "Custom" multi-service catalog ─────────────────────────────
  // A user picks several services (e.g. "trim hedges + remove 2 small trees
  // with root removal + mow front+back + debris haul") and answers per-item
  // detail questions; we compute a line per service and sum to one total.
  //
  // Each service:
  //   base: { low, high, mid } default per-item price (used by `mid * mults`)
  //   questions: [{ key, label, options:[{val,label, mult? OR addUSD? OR addUSDPerCount?}] }]
  //     mult: multiplicative on base.mid
  //     addUSD: flat dollars added (after base*mult)
  //     addUSDPerCount: dollars times the parsed "count" answer (e.g. # trees)
  //
  // Pricing math per item:
  //   subtotal = (base.mid * product(mult) + sum(addUSD) + sum(addUSDPerCount * count)) * cityMult
  // Range per item:
  //   low  = subtotal * (base.low  / base.mid)
  //   high = subtotal * (base.high / base.mid)
  var BUNDLE_SERVICES = {
    shrub_trimming: {
      label: "Shrub / Hedge Trimming",
      category: "maintenance",
      description: "One-time hedge or shrub pruning",
      base: { low: 75, high: 250, mid: 150 },
      questions: [
        { key: "count", label: "How many shrubs?", options: [
          { val: "few",     label: "Under 10 shrubs",                mult: 0.6 },
          { val: "typical", label: "10-20 shrubs",                   mult: 1.0 },
          { val: "many",    label: "20+ shrubs or large hedges",     mult: 1.6 }
        ]},
        { key: "style", label: "Trim style", options: [
          { val: "light",    label: "Light touch-up / natural shape", mult: 0.85 },
          { val: "standard", label: "Standard residential trim",      mult: 1.0  },
          { val: "formal",   label: "Formal / architectural shaping", mult: 1.3  }
        ]}
      ]
    },
    tree_removal: {
      label: "Tree Removal",
      category: "install",
      description: "Per-tree removal (cut, drop, haul)",
      base: { low: 150, high: 1500, mid: 500 },
      questions: [
        { key: "count", label: "How many trees?", options: [
          { val: "1",   label: "1 tree",      mult: 1.0 },
          { val: "2",   label: "2 trees",     mult: 1.9 },
          { val: "3-4", label: "3-4 trees",   mult: 3.5 },
          { val: "5+",  label: "5+ trees",    mult: 5.5 }
        ]},
        { key: "size", label: "Tree size", options: [
          { val: "small",  label: "Small (under 20 ft)", mult: 0.45 },
          { val: "medium", label: "Medium (20-40 ft)",   mult: 1.0  },
          { val: "large",  label: "Large (40 ft+)",      mult: 2.4  }
        ]},
        { key: "stump", label: "Stump grinding?", options: [
          { val: "no",  label: "No stump grinding",   addUSDPerCount: 0   },
          { val: "yes", label: "Yes, grind stumps",   addUSDPerCount: 150 }
        ]},
        { key: "roots", label: "Root removal?", options: [
          { val: "no",  label: "Leave roots",                 addUSDPerCount: 0  },
          { val: "yes", label: "Pull out main root system",   addUSDPerCount: 50 }
        ]}
      ]
    },
    lawn_mowing: {
      label: "Lawn Mowing (per visit)",
      category: "maintenance",
      description: "Mow + edge + blower cleanup",
      base: { low: 35, high: 85, mid: 60 },
      questions: [
        { key: "size", label: "Lot size", options: [
          { val: "small",   label: "Small (under 5,000 sqft)",        mult: 0.65 },
          { val: "typical", label: "Typical residential (5K-15K sqft)", mult: 1.0 },
          { val: "large",   label: "Large (15K-30K sqft)",            mult: 1.55 },
          { val: "xl",      label: "Acre+ or steep / many obstacles", mult: 2.2  }
        ]},
        { key: "freq", label: "Frequency", options: [
          { val: "one",      label: "One-time visit",             mult: 1.15 },
          { val: "weekly",   label: "Per visit (weekly)",         mult: 1.0  },
          { val: "biweekly", label: "Per visit (biweekly)",       mult: 1.08 }
        ]}
      ]
    },
    debris_haul: {
      label: "Yard Debris Haul-off",
      category: "addon",
      description: "One-time haul-off of bagged yard debris (separate from mowing)",
      base: { low: 30, high: 200, mid: 80 },
      questions: [
        { key: "load", label: "Debris load size", options: [
          { val: "small",  label: "Small (a few bags / one trip)",  mult: 0.5 },
          { val: "medium", label: "Medium (full truck-bed load)",   mult: 1.0 },
          { val: "large",  label: "Large (multiple loads / trailer)", mult: 2.2 }
        ]}
      ]
    },
    flower_bed_maintenance: {
      label: "Flower Bed Maintenance",
      category: "maintenance",
      description: "Weed, deadhead, mulch touch-up",
      base: { low: 50, high: 175, mid: 110 },
      questions: [
        { key: "beds", label: "How many beds?", options: [
          { val: "few",     label: "1-2 small beds",                  mult: 0.6 },
          { val: "typical", label: "3-5 beds (front + back)",         mult: 1.0 },
          { val: "many",    label: "6+ beds or whole property",       mult: 1.8 }
        ]},
        { key: "scope", label: "Scope of work", options: [
          { val: "weed",      label: "Weed pull only",                          mult: 0.6 },
          { val: "weedMulch", label: "Weed + mulch top-up + deadhead",          mult: 1.0 },
          { val: "full",      label: "Weed + mulch + soil amend + slow-release fert", mult: 1.5 }
        ]}
      ]
    },
    seasonal_cleanup: {
      label: "Seasonal Cleanup (spring/fall)",
      category: "maintenance",
      description: "Full-property cleanup, one season",
      base: { low: 300, high: 800, mid: 500 },
      questions: [
        { key: "season", label: "Which season?", options: [
          { val: "spring", label: "Spring",                  mult: 1.0  },
          { val: "fall",   label: "Fall",                    mult: 1.0  },
          { val: "both",   label: "Both (spring + fall)",    mult: 1.85 }
        ]},
        { key: "size", label: "Lot size", options: [
          { val: "small",   label: "Small lot",                        mult: 0.7 },
          { val: "typical", label: "Typical residential",              mult: 1.0 },
          { val: "large",   label: "Large lot / heavy debris",         mult: 1.5 }
        ]}
      ]
    },
    leaf_removal: {
      label: "Leaf Removal (program)",
      category: "maintenance",
      description: "Multi-visit fall leaf program",
      base: { low: 200, high: 700, mid: 400 },
      questions: [
        { key: "trees", label: "Tree density", options: [
          { val: "light",   label: "Few trees, light load",            mult: 0.5 },
          { val: "typical", label: "Typical residential canopy",       mult: 1.0 },
          { val: "heavy",   label: "Heavy tree cover",                 mult: 1.7 }
        ]},
        { key: "visits", label: "How many visits?", options: [
          { val: "one",   label: "Single visit",                       mult: 0.6 },
          { val: "multi", label: "Multi-visit through fall",           mult: 1.0 }
        ]}
      ]
    },
    fertilization_program: {
      label: "Lawn Fertilization Program",
      category: "maintenance",
      description: "Annual fertilization + weed control",
      base: { low: 300, high: 700, mid: 500 },
      questions: [
        { key: "size", label: "Lawn size", options: [
          { val: "small",   label: "Small lawn",                       mult: 0.7 },
          { val: "typical", label: "Typical residential",              mult: 1.0 },
          { val: "large",   label: "Large lawn / acre+",               mult: 1.6 }
        ]},
        { key: "program", label: "Program tier", options: [
          { val: "basic",    label: "Basic — 2 feedings/yr",                mult: 0.55 },
          { val: "fourstep", label: "4-application program",                mult: 1.0  },
          { val: "sixstep",  label: "6-step + grub control + soil pH",      mult: 1.45 }
        ]}
      ]
    }
  };

  // Display order for the checklist (matches the typical "what bundles together" mental model).
  var BUNDLE_SERVICE_ORDER = [
    "lawn_mowing",
    "shrub_trimming",
    "flower_bed_maintenance",
    "debris_haul",
    "leaf_removal",
    "seasonal_cleanup",
    "tree_removal",
    "fertilization_program"
  ];

  // Map a count-style answer to a numeric multiplier for addUSDPerCount adders
  // (used by tree_removal's stump-grind / root-removal lines). Falls back to 1.
  function _countOfAnswer(ansVal) {
    if (!ansVal) return 1;
    if (ansVal === "1") return 1;
    if (ansVal === "2") return 2;
    if (ansVal === "3-4") return 3;
    if (ansVal === "5+") return 5;
    var m = String(ansVal).match(/^(\d+)/);
    if (m) return parseInt(m[1], 10);
    return 1;
  }

  function calcBundleItem(serviceKey, answers, opts) {
    opts = opts || {};
    answers = answers || {};
    var svc = BUNDLE_SERVICES[serviceKey];
    if (!svc) return null;
    var laborMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (LAND_PRICING.laborMultiplierByRegion[opts.region] || 1.0);
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult  = (typeof opts.seasonalMult  === "number") ? opts.seasonalMult  : 1.0;

    // First pass — find the count answer (drives addUSDPerCount adders).
    var countVal = 1;
    for (var qi = 0; qi < svc.questions.length; qi++) {
      if (svc.questions[qi].key === "count") {
        countVal = _countOfAnswer(answers.count);
        break;
      }
    }

    var mult = 1.0, addUSD = 0;
    for (var qj = 0; qj < svc.questions.length; qj++) {
      var q = svc.questions[qj];
      var ans = answers[q.key];
      if (!ans) continue;
      var opt = null;
      for (var oi = 0; oi < q.options.length; oi++) {
        if (q.options[oi].val === ans) { opt = q.options[oi]; break; }
      }
      if (!opt) continue;
      if (typeof opt.mult === "number")           mult   *= opt.mult;
      if (typeof opt.addUSD === "number")         addUSD += opt.addUSD;
      if (typeof opt.addUSDPerCount === "number") addUSD += opt.addUSDPerCount * countVal;
    }

    var baseDollars = svc.base.mid * mult;
    var pretax = (baseDollars + addUSD) * laborMult * inflationMult * seasonalMult;
    var subtotal = roundDynamic(pretax);
    var lowFactor  = svc.base.low  / svc.base.mid;
    var highFactor = svc.base.high / svc.base.mid;
    return {
      service: serviceKey,
      label: svc.label,
      subtotal: subtotal,
      low:  roundDynamic(pretax * lowFactor),
      high: roundDynamic(pretax * highFactor),
      baseMid: svc.base.mid,
      mult: mult,
      addUSD: addUSD,
      countVal: countVal
    };
  }

  function calcLandscapingBundle(items, opts) {
    var lines = [], total = 0, low = 0, high = 0;
    for (var i = 0; i < (items || []).length; i++) {
      var line = calcBundleItem(items[i].service, items[i].answers, opts);
      if (!line) continue;
      lines.push(line);
      total += line.subtotal;
      low   += line.low;
      high  += line.high;
    }
    return {
      lines: lines,
      total: roundDynamic(total),
      low:   roundDynamic(low),
      high:  roundDynamic(high),
      itemCount: lines.length
    };
  }

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
    TIER_EXAMPLES_BY_PROJECT: TIER_EXAMPLES_BY_PROJECT,
    COMPLEXITY_LABELS_BY_PROJECT: COMPLEXITY_LABELS_BY_PROJECT,
    GENERIC_COMPLEXITY_LABELS: GENERIC_COMPLEXITY_LABELS,
    tierExamplesFor: tierExamplesFor,
    complexityLabelFor: complexityLabelFor,
    BUNDLE_SERVICES: BUNDLE_SERVICES,
    BUNDLE_SERVICE_ORDER: BUNDLE_SERVICE_ORDER,
    calcBundleItem: calcBundleItem,
    calcLandscapingBundle: calcLandscapingBundle,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    calcLandscapingEstimate: calcLandscapingEstimate,
    roundTo50: roundTo50,
    roundDynamic: roundDynamic
  };
});
