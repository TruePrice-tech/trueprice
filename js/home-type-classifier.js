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

  // Pick the most likely home type from free signals. Tiered by confidence:
  //   1. Explicit OSM building:levels tag (definitive when present)
  //   2. OSM building:height tag (~3m per story)
  //   3. building:type tag (terrace / townhouse forces no-garage)
  //   4. Footprint extremes (huge → ranch, tiny → townhome)
  //   5. Region + state-level prior (Sun Belt → ranch bias)
  //   6. Fallback to suburban modal case
  function classifyHomeType(signals) {
    signals = signals || {};
    var region = normalizeRegion(signals.regionType);
    var footprint = Number(signals.footprintSqFt) || 0;
    var stories = Number(signals.osmStories) || 0;
    var heightM = Number(signals.osmHeightMeters) || 0;
    var hasGarage = !!signals.likelyAttachedGarage;
    var tag = String(signals.buildingTag || "").toLowerCase();
    var stateCode = String(signals.stateCode || "").toUpperCase();

    // Tier 1: explicit OSM building:levels — most reliable signal.
    if (stories >= 3) return "three_story";
    if (stories === 2) return hasGarage ? "two_story_with_garage" : "two_story_no_garage";
    if (stories === 1) return "single_ranch";

    // Tier 2: explicit OSM building:height. Residential floor-to-floor is
    // ~3m, so <5m = 1-story, 5-9m = 2-story, >9m = 3+.
    if (heightM > 0) {
      if (heightM > 9) return "three_story";
      if (heightM >= 5) return hasGarage ? "two_story_with_garage" : "two_story_no_garage";
      return "single_ranch";
    }

    // Tier 3: tag-based — terrace / row_house always means stacked.
    if (tag === "terrace" || tag === "townhouse" || tag === "row_house") {
      return "two_story_no_garage";
    }

    // Tier 4: footprint extremes.
    if (footprint >= 3500) return "single_ranch";          // wide ground = likely ranch
    if (footprint < 800)   return "two_story_no_garage";   // tiny footprint = stacked townhome

    // Tier 5: region + state prior.
    if (region === "urban") return "two_story_no_garage";
    if (region === "rural" && !hasGarage) return "single_ranch";

    // Sun Belt ranch prior: in AZ/FL/NV/NM and similar, 1-story is the
    // dominant residential pattern. Apply only when footprint is wide
    // enough to plausibly be a 1-story (>2000) and we haven't already
    // detected a contradicting signal.
    if (SUN_BELT_RANCH_STATES[stateCode] && footprint >= 2000) {
      return "single_ranch";
    }

    // Default: suburban modal case (2-story with attached garage).
    return "two_story_with_garage";
  }

  function getMultiplier(homeTypeId, regionType) {
    var region = normalizeRegion(regionType);
    var table = MULTIPLIERS[region];
    return (table && table[homeTypeId]) || MULTIPLIERS.suburban.two_story_with_garage;
  }

  // Return the 5 picker options with their implied living sqft so users can
  // visually scan and pick the row whose number matches their home.
  function getHomeTypeOptions(footprintSqFt, regionType) {
    var fp = Number(footprintSqFt) || 0;
    return HOME_TYPES.map(function (t) {
      var mult = getMultiplier(t.id, regionType);
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
    var mult = getMultiplier(pick, signals.regionType);
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
    getMultiplier: getMultiplier,
    getHomeTypeOptions: getHomeTypeOptions,
    estimateLivingArea: estimateLivingArea
  };

  root.WoogoroHomeType = api;
})(typeof window !== "undefined" ? window : globalThis);
