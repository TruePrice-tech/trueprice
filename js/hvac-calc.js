// Woogoro HVAC calculator — single source of truth for /hvac-estimate.
//
// Same module is used by:
//   1. /hvac-estimate (browser) — drives the cost calculator UI
//   2. test/hvac/calculator-spot-check.test.js (Node) — asserts each spec
//      tuple lands inside an industry-anchored 2026 market band
//
// Why one module: prior to 2026-05-03 HVAC_PRICING lived inline in
// hvac-estimate.html. The fixture-truth harness only walks the upload/analyze
// path, so the calculator's basePrice tables silently drifted to 2019 levels
// (5-ton 16 SEER central AC in Fort Mill SC was outputting $6,400 when the
// 2026 R-454B installed market is $11k-$14.5k). With one shared module the
// spot-check harness can fail CI when a value drift puts any spec outside
// the industry band.
//
// Pure math + constants only — no DOM, no fetch. The browser passes its
// city-multiplier/inflation/seasonal numbers in; tests pass deterministic
// stubs in. Everything else is data lookup + arithmetic.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WoogoroHvacCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ── 2026 market-anchored installed price tables ────────────────────────────
  //
  // Sources: HomeGuide 2026 HVAC cost guide, Forbes Home 2026, Modernize 2026,
  // This Old House 2026, HomeAdvisor/Angi 2026 contractor surveys.
  //
  // Refrigerant context: as of 2026-01-01 the EPA AIM Act bans manufacture of
  // new R-410A residential equipment; new installs use A2L refrigerants
  // (R-454B / R-32). All numbers below are R-454B-era retail.
  //
  // Federal minimum efficiency since 2023: 14.3 SEER2 (~15 SEER) in the
  // South/Southeast/Southwest, 13.4 SEER2 (~14 SEER) in the North. The
  // "14 SEER" tier here represents the new-minimum tier, not the pre-2023
  // entry-level tier.
  //
  // basePrice keys are the 3-ton baseline; tonScale grows with size.
  var HVAC_PRICING = {
    basePriceBySystem: {
      central_ac: {
        label: "Central Air Conditioning",
        basePrice: { "14_seer": 6500, "16_seer": 7800, "18_seer": 10500, "20_seer": 13000 },
        tonScale: 0.18
      },
      heat_pump: {
        label: "Heat Pump",
        basePrice: { "14_seer": 8500, "16_seer": 10500, "18_seer": 13000, "20_seer": 15500 },
        tonScale: 0.18
      },
      furnace: {
        label: "Gas Furnace",
        basePrice: { "80_afue": 4200, "90_afue": 5200, "95_afue": 6200, "98_afue": 7400 },
        tonScale: 0
      },
      mini_split: {
        label: "Ductless Mini-Split",
        pricePerZone: { single_zone: 4800, two_zone: 8000, three_zone: 11000, four_zone: 14500 }
      },
      full_system: {
        label: "Full HVAC System (AC + Furnace)",
        basePrice: { "14_seer_80_afue": 10500, "16_seer_90_afue": 13500, "18_seer_95_afue": 16800, "20_seer_98_afue": 20500 },
        tonScale: 0.18
      }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.03, northeast: 1.18, midwest: 1.06, mountain: 1.10, west: 1.22 },
    overheadMultiplier: 1.0,
    roundTo: 50,
    homeSizes: [
      { label: "1000", tons: 2.0 }, { label: "1500", tons: 2.5 },
      { label: "2000", tons: 3.5 }, { label: "2500", tons: 4.0 },
      { label: "3000", tons: 5.0 }, { label: "3500", tons: 5.0 },
      { label: "4000", tons: 5.0 }
    ],
    scopeItems: [
      { key: "equipment", label: "Equipment (condenser + air handler)", weight: 20 },
      { key: "lineSet", label: "Refrigerant line set", weight: 12 },
      { key: "thermostat", label: "Thermostat", weight: 8 },
      { key: "ductwork", label: "Ductwork modification", weight: 10 },
      { key: "electrical", label: "Electrical disconnect/wiring", weight: 10 },
      { key: "pad", label: "Concrete/composite pad", weight: 4 },
      { key: "drainLine", label: "Drain line / condensate pump", weight: 6 },
      { key: "filterRack", label: "Filter rack / return", weight: 4 },
      { key: "permit", label: "Permits and inspections", weight: 6 },
      { key: "disposal", label: "Old equipment removal", weight: 4 },
      { key: "warranty", label: "Warranty (equipment + labor)", weight: 10 },
      { key: "loadCalc", label: "Manual J load calculation", weight: 8 }
    ],
    brands: {
      premium: ["Carrier", "Trane", "Lennox", "Daikin"],
      mid: ["Rheem", "Ruud", "York", "American Standard", "Amana"],
      value: ["Goodman", "Payne", "Heil", "Comfortmaker"]
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  function roundTo50(n) { return Math.round(n / 50) * 50; }

  function getRegionFromState(sc) {
    return STATE_REGIONS[(sc || "").toUpperCase()] || "south";
  }

  function tonsFromSqFt(sqft) {
    var sizes = HVAC_PRICING.homeSizes;
    var n = Number(sqft) || 2000;
    for (var i = sizes.length - 1; i >= 0; i--) {
      if (n >= Number(sizes[i].label)) return sizes[i].tons;
    }
    return sizes[0].tons;
  }

  function seerToKey(seer) {
    var s = Number(seer) || 14;
    if (s >= 20) return "20_seer";
    if (s >= 18) return "18_seer";
    if (s >= 16) return "16_seer";
    return "14_seer";
  }

  function fullSystemEffKey(seer) {
    var s = Number(seer) || 14;
    if (s >= 20) return "20_seer_98_afue";
    if (s >= 18) return "18_seer_95_afue";
    if (s >= 16) return "16_seer_90_afue";
    return "14_seer_80_afue";
  }

  function afueToKey(afue) {
    var a = Number(afue) || 80;
    if (a >= 98) return "98_afue";
    if (a >= 95) return "95_afue";
    if (a >= 90) return "90_afue";
    return "80_afue";
  }

  // Default seasonal table — HVAC peaks in summer. Browser callers pass the
  // current month's multiplier in directly; tests pin to 1.0 for determinism.
  var SEASONAL_MULTS = { 1:0.94, 2:0.94, 3:0.96, 4:0.98, 5:1.04, 6:1.10, 7:1.12, 8:1.10, 9:1.04, 10:0.97, 11:0.93, 12:0.92 };

  // ── Calculator ─────────────────────────────────────────────────────────────
  //
  // calcBenchmark(opts) — opts:
  //   systemType       "central_ac" | "heat_pump" | "furnace" | "mini_split" | "full_system"
  //   seer             SEER number (used for AC/HP/full_system) or AFUE for furnace
  //   tons             system size in tons (for AC/HP/full_system) or zone count (mini_split)
  //   region           "south" | "southeast" | "northeast" | "midwest" | "mountain" | "west"
  //   ductworkCond     "good" | "repair" | "none"
  //   cityMult         optional per-city multiplier (overrides region multiplier when truthy)
  //   inflationMult    optional inflation multiplier (default 1.0)
  //   seasonalMult     optional seasonal multiplier (default 1.0)
  //   calData          optional flywheel calibration { avgPrice, quotes, ... } —
  //                    when present and quotes >= 3, the rate-table-derived total
  //                    is blended toward the real-world avg via FlywheelBlend.
  //                    (Browser passes this; spot-check tests omit it.)
  function calcBenchmark(opts) {
    opts = opts || {};
    var systemType = opts.systemType;
    var seer = opts.seer;
    var tons = opts.tons;
    var region = opts.region;
    var ductworkCond = opts.ductworkCond;
    var cityMult = (typeof opts.cityMult === "number" && opts.cityMult > 0) ? opts.cityMult : null;
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult = (typeof opts.seasonalMult === "number") ? opts.seasonalMult : 1.0;
    var calData = opts.calData || null;

    var sys = HVAC_PRICING.basePriceBySystem[systemType];
    if (!sys) sys = HVAC_PRICING.basePriceBySystem.central_ac;

    var basePrice = 0;
    if (systemType === "mini_split") {
      var zones = Math.max(1, Math.round(tons));
      var zoneKey = zones >= 4 ? "four_zone" : zones === 3 ? "three_zone" : zones === 2 ? "two_zone" : "single_zone";
      basePrice = (sys.pricePerZone && sys.pricePerZone[zoneKey]) || 4800;
    } else if (systemType === "furnace") {
      var afueKey = afueToKey(seer);
      var fBase = (sys.basePrice && sys.basePrice[afueKey]) || 5200;
      basePrice = fBase;
    } else if (systemType === "full_system") {
      var fKey = fullSystemEffKey(seer);
      var fsBase = (sys.basePrice && sys.basePrice[fKey]) || 13500;
      var fsTonAdj = 1 + ((tons - 3) * (sys.tonScale || 0.18));
      basePrice = fsBase * fsTonAdj;
    } else {
      // central_ac or heat_pump
      var sk = seerToKey(seer);
      var acBase = (sys.basePrice && sys.basePrice[sk]) || 7800;
      var acTonAdj = 1 + ((tons - 3) * (sys.tonScale || 0.18));
      basePrice = acBase * acTonAdj;
    }

    var regionMult = cityMult || (HVAC_PRICING.laborMultiplierByRegion[region] || 1.0);
    var overheadMult = HVAC_PRICING.overheadMultiplier;

    var total = basePrice * regionMult * overheadMult * inflationMult * seasonalMult;

    if (ductworkCond === "repair") total *= 1.12;
    else if (ductworkCond === "none") total *= 1.25;

    // Flywheel blend (when caller supplies cal:* aggregates).
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendedBenchmark(total, calData, roundTo50);
      if (blended.applied) return blended.total;
    }
    return roundTo50(total);
  }

  return {
    HVAC_PRICING: HVAC_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    tonsFromSqFt: tonsFromSqFt,
    seerToKey: seerToKey,
    fullSystemEffKey: fullSystemEffKey,
    afueToKey: afueToKey,
    roundTo50: roundTo50,
    calcBenchmark: calcBenchmark
  };
});
