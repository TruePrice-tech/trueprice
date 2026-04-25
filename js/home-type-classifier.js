// Home-type classifier + footprint→living-area multiplier table.
// Pure functions, free signals only (no paid APIs). Loaded by every vertical
// estimator that needs living-area sqft (HVAC, insulation, painting, etc.).
//
// Calibration source: American Housing Survey + Census Characteristics of
// New Housing. The "suburban / 2-story with attached garage" row is the
// modal US new-build pattern (~50% of new construction × ~85% with attached
// garage) so its multiplier is the most-used default.
(function (root) {
  "use strict";

  // Each cell is the multiplier applied to OSM footprint to estimate
  // living/conditioned area. Suburban is the default region when we have
  // no neighbor density signal.
  var MULTIPLIERS = {
    suburban: {
      single_ranch:           0.85,
      one_and_half_bonus:     1.05,
      two_story_with_garage:  1.20,
      two_story_no_garage:    1.50,
      three_story:            2.30
    },
    urban: {
      single_ranch:           0.95,
      one_and_half_bonus:     1.20,
      two_story_with_garage:  1.50,
      two_story_no_garage:    1.85,
      three_story:            2.30
    },
    rural: {
      single_ranch:           0.95,
      one_and_half_bonus:     1.10,
      two_story_with_garage:  1.30,
      two_story_no_garage:    1.70,
      three_story:            2.50
    }
  };

  var HOME_TYPES = [
    { id: "single_ranch",          label: "Single story (ranch)",           sub: "All on one floor" },
    { id: "one_and_half_bonus",    label: "1.5 story (bonus room)",         sub: "One floor + room above garage" },
    { id: "two_story_with_garage", label: "Two story with attached garage", sub: "Most common modern build" },
    { id: "two_story_no_garage",   label: "Two story (no garage / townhome)", sub: "Townhome or full 2-story house" },
    { id: "three_story",           label: "Three story",                    sub: "Tall house, often urban" }
  ];

  function normalizeRegion(regionType) {
    if (regionType === "urban" || regionType === "rural" || regionType === "suburban") return regionType;
    return "suburban";
  }

  // States where Census housing data shows clear 1-story dominance (>65%).
  // Conservative list: only states where the prior is *clearly* helpful.
  // Excludes TX/CA/GA/SC where the 1-story vs 2-story split is closer to
  // 50/50 — biasing in those states could be net-negative.
  var SUN_BELT_RANCH_STATES = {
    AZ: 1, FL: 1, NV: 1, NM: 1, OK: 1, AR: 1, LA: 1, MS: 1, AL: 1
  };

  // Building tags that indicate this is NOT a single-family home. The
  // multiplier table doesn't apply to these — caller should fall back to
  // manual entry instead of pretending we know the unit's living area.
  var NON_SFH_TAGS = {
    apartments: 1, residential_block: 1, dormitory: 1, retirement_home: 1,
    commercial: 1, industrial: 1, warehouse: 1, retail: 1, hotel: 1,
    office: 1, school: 1, church: 1, hospital: 1, civic: 1, government: 1,
    construction: 1, "yes": 0 // yes is ambiguous — handled by size heuristic below
  };

  // True when free signals suggest this is a multi-family / commercial /
  // oversized building that doesn't fit the single-family multiplier model.
  // When this returns true, the picker should show manual entry as primary
  // and not pre-select any card.
  function isNonSingleFamily(signals) {
    signals = signals || {};
    var footprint = Number(signals.footprintSqFt) || 0;
    var stories = Number(signals.osmStories) || 0;
    var heightM = Number(signals.osmHeightMeters) || 0;
    var tag = String(signals.buildingTag || "").toLowerCase();

    if (NON_SFH_TAGS[tag] === 1) return true;
    // 4+ floors = apartment / condo high-rise
    if (stories >= 4) return true;
    // ~12m+ = 4+ stories worth of building
    if (heightM > 12) return true;
    // Footprints over 5000 sqft on residential roads are almost always
    // multi-unit (typical SFH tops out at ~4000). The 5000 cap is also
    // where our multiplier table starts giving nonsense numbers.
    if (footprint > 5000) return true;
    return false;
  }

  // Pick the most likely home type from free signals. Returns null when the
  // building looks like multi-family / commercial / oversized — in those
  // cases the multiplier table doesn't apply and the picker should show
  // manual entry as primary.
  //
  // Tiered by confidence:
  //   0. Bail out if non-SFH (apartments, oversized footprint, 4+ stories)
  //   1. Explicit OSM building:levels tag (definitive when present)
  //   2. OSM building:height tag (~3m per story)
  //   3. building:type tag (terrace / townhouse forces no-garage)
  //   4. Footprint extremes (huge → ranch, tiny → townhome)
  //   5. Region + state-level prior (Sun Belt → ranch bias)
  //   6. Fallback to suburban modal case
  function classifyHomeType(signals) {
    signals = signals || {};
    if (isNonSingleFamily(signals)) return null;

    var region = normalizeRegion(signals.regionType);
    var footprint = Number(signals.footprintSqFt) || 0;
    var stories = Number(signals.osmStories) || 0;
    var heightM = Number(signals.osmHeightMeters) || 0;
    var hasGarage = !!signals.likelyAttachedGarage;
    var tag = String(signals.buildingTag || "").toLowerCase();
    var stateCode = String(signals.stateCode || "").toUpperCase();

    // Tier 1: explicit OSM building:levels — most reliable signal.
    if (stories === 3) return "three_story";
    if (stories === 2) return hasGarage ? "two_story_with_garage" : "two_story_no_garage";
    if (stories === 1) return "single_ranch";

    // Tier 2: explicit OSM building:height. Residential floor-to-floor is
    // ~3m, so <5m = 1-story, 5-9m = 2-story, 9-12m = 3-story.
    if (heightM > 0) {
      if (heightM > 9) return "three_story";
      if (heightM >= 5) return hasGarage ? "two_story_with_garage" : "two_story_no_garage";
      return "single_ranch";
    }

    // Tier 3: tag-based — terrace / row_house always means stacked.
    if (tag === "terrace" || tag === "townhouse" || tag === "row_house") {
      return "two_story_no_garage";
    }

    // Tier 4: footprint extremes (within SFH range — non-SFH already bailed).
    if (footprint >= 3500) return "single_ranch";          // wide ground = likely ranch
    if (footprint < 800)   return "two_story_no_garage";   // tiny footprint = stacked townhome

    // Tier 5: region + state prior.
    if (region === "urban") return "two_story_no_garage";
    if (region === "rural" && !hasGarage) return "single_ranch";

    // Sun Belt ranch prior: in AZ/FL/NV/NM and similar, 1-story is the
    // dominant residential pattern. Apply only when footprint is wide
    // enough to plausibly be a 1-story (>2000).
    if (SUN_BELT_RANCH_STATES[stateCode] && footprint >= 2000) {
      return "single_ranch";
    }

    // Default: suburban modal case (2-story with attached garage).
    return "two_story_with_garage";
  }

  // Phoenix tract-home haircut. OSM polygons from Esri/Microsoft/USDOT bulk
  // imports are roof outlines traced from satellite imagery — in Sun Belt
  // tract construction the same roofline covers the house, attached garage,
  // covered patio, and carport, so the polygon is ~30-45% larger than the
  // conditioned living area. Calibrated to 4115 W Sierra St, Phoenix
  // (2,585 sqft polygon, 1,502 sqft actual = 0.58 ratio). 0.76 leaves
  // headroom for homes without the carport / patio extras (0.85 * 0.76 ≈
  // 0.65 effective). Only fires when all three conditions agree, so we
  // don't undercount custom Sun Belt homes whose polygon is just the house.
  var BULK_IMPORT_HAIRCUT = 0.76;
  var BULK_IMPORT_FOOTPRINT_MIN = 1800; // typical floor where attached garage + patio dominate

  function shouldApplyBulkImportHaircut(homeTypeId, signals) {
    if (homeTypeId !== "single_ranch") return false;
    var stateCode = String(signals.stateCode || "").toUpperCase();
    if (!SUN_BELT_RANCH_STATES[stateCode]) return false;
    if (!signals.isBulkImportPolygon) return false;
    var footprint = Number(signals.footprintSqFt) || 0;
    if (footprint < BULK_IMPORT_FOOTPRINT_MIN) return false;
    return true;
  }

  function getMultiplier(homeTypeId, regionType, signals) {
    var region = normalizeRegion(regionType);
    var table = MULTIPLIERS[region];
    var base = (table && table[homeTypeId]) || MULTIPLIERS.suburban.two_story_with_garage;
    if (signals && shouldApplyBulkImportHaircut(homeTypeId, signals)) {
      return base * BULK_IMPORT_HAIRCUT;
    }
    return base;
  }

  // Return the 5 picker options with their implied living sqft so users can
  // visually scan and pick the row whose number matches their home.
  function getHomeTypeOptions(footprintSqFt, regionType, signals) {
    var fp = Number(footprintSqFt) || 0;
    var ctx = signals || { footprintSqFt: fp, stateCode: "", isBulkImportPolygon: false };
    return HOME_TYPES.map(function (t) {
      var mult = getMultiplier(t.id, regionType, ctx);
      return {
        id: t.id,
        label: t.label,
        sub: t.sub,
        multiplier: mult,
        livingSqFt: fp > 0 ? Math.round(fp * mult) : null
      };
    });
  }

  function estimateLivingArea(signals) {
    signals = signals || {};
    var fp = Number(signals.footprintSqFt) || 0;
    if (fp <= 0) return null;
    var pick = classifyHomeType(signals);
    if (!pick) return null;  // non-SFH / oversized
    var mult = getMultiplier(pick, signals.regionType, signals);
    return {
      homeType: pick,
      multiplier: mult,
      livingSqFt: Math.round(fp * mult),
      regionType: normalizeRegion(signals.regionType)
    };
  }

  var api = {
    HOME_TYPES: HOME_TYPES,
    classifyHomeType: classifyHomeType,
    isNonSingleFamily: isNonSingleFamily,
    getMultiplier: getMultiplier,
    getHomeTypeOptions: getHomeTypeOptions,
    estimateLivingArea: estimateLivingArea
  };

  root.WoogoroHomeType = api;
})(typeof window !== "undefined" ? window : globalThis);
