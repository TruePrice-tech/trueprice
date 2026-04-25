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

  // Pick the most likely home type from free signals.
  function classifyHomeType(signals) {
    signals = signals || {};
    var region = normalizeRegion(signals.regionType);
    var footprint = Number(signals.footprintSqFt) || 0;
    var stories = Number(signals.osmStories) || 0;
    var hasGarage = !!signals.likelyAttachedGarage;
    var tag = String(signals.buildingTag || "").toLowerCase();

    // OSM building:levels is the single most reliable signal — use it.
    if (stories >= 3) return "three_story";
    if (stories === 2) return hasGarage ? "two_story_with_garage" : "two_story_no_garage";
    if (stories === 1) return "single_ranch";

    // Townhome / terrace tag forces the no-garage 2-story bucket.
    if (tag === "terrace" || tag === "townhouse" || tag === "row_house") {
      return "two_story_no_garage";
    }

    // Without explicit stories, infer from region + footprint + shape:
    if (footprint >= 3500) return "single_ranch";          // wide ground = likely ranch
    if (footprint < 800)   return "two_story_no_garage";   // tiny footprint = stacked townhome
    if (region === "urban") return "two_story_no_garage";  // dense urban = no SFH garage
    if (region === "rural" && !hasGarage) return "single_ranch";
    return "two_story_with_garage";                        // suburban default (modal case)
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
