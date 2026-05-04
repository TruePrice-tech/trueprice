// Woogoro Plumbing calculator — single source of truth for /plumbing-estimate.
//
// Same module is used by:
//   1. /plumbing-estimate (browser) — drives the cost calculator UI
//   2. test/plumbing/calculator-spot-check.test.js (Node) — asserts each spec
//      tuple lands inside an industry-anchored 2026 market band
//
// Why one module: prior to extraction the PLUMBING_PRICING tables lived
// inline in plumbing-estimate.html. The fixture-truth harness only walks
// the upload/analyze path, so the calculator's basePrice tables had no
// gate. Extracting matches the pattern shipped 2026-05-03 for HVAC after
// the Fort Mill SC bug (5-ton 16 SEER showed $6,400 vs 2026 R-454B market
// $11k-$14.5k — same drift could happen on plumbing tables silently).
//
// Pure math + constants only — no DOM, no fetch. The browser passes its
// city-multiplier/inflation/seasonal numbers in; tests pass deterministic
// stubs in. Everything else is data lookup + arithmetic.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WoogoroPlumbingCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ── 2026 market-anchored installed price tables ────────────────────────────
  //
  // Sources: HomeGuide 2026 plumbing cost guides (water heaters / repipe /
  // sewer / drain), Forbes Home 2026, Modernize 2026, This Old House 2026,
  // HomeAdvisor/Angi 2026 contractor surveys.
  //
  // Mirrors data/plumbing-pricing-model.json — keep in sync if either
  // source changes. priceByType / priceByMaterial / priceByMethod /
  // priceByScope / priceByLength are sub-type maps; the wrapper resolver
  // (getBasePrice) accepts whichever key exists.
  var PLUMBING_PRICING = {
    basePriceByService: {
      water_heater: {
        label: "Water Heater Replacement",
        priceByType: {
          tank_40_gas: 1800, tank_50_gas: 2200, tank_40_electric: 1500,
          tank_50_electric: 1800, tankless_gas: 4200, tankless_electric: 3200,
          hybrid_heat_pump: 3800, indirect: 5500
        }
      },
      repipe: {
        label: "Whole House Repipe",
        priceByMaterial: { copper: 8500, pex: 5500, cpvc: 4800 }
      },
      sewer_line: {
        label: "Sewer Line Replacement",
        priceByMethod: { traditional_dig: 5500, trenchless: 7500, pipe_lining: 6500 }
      },
      drain_cleaning: {
        label: "Drain Cleaning",
        priceByType: { simple_clog: 200, main_line: 450, hydro_jet: 650, camera_inspection: 350 }
      },
      bathroom_rough_in: {
        label: "Bathroom Plumbing Rough-In",
        priceByScope: { half_bath: 2800, full_bath: 4500, master_bath: 6200 }
      },
      gas_line: {
        label: "Gas Line Installation",
        priceByLength: { short_under_20ft: 800, medium_20_50ft: 1500, long_over_50ft: 2500 }
      },
      toilet: {
        label: "Toilet Install",
        priceByType: { standard: 450, comfort_height: 550, dual_flush: 650, smart_bidet: 1400 }
      },
      sump_pump: {
        label: "Sump Pump",
        priceByType: { pedestal_replace: 650, submersible_replace: 950, new_install_with_pit: 2200, battery_backup_add: 850 }
      },
      water_softener: {
        label: "Water Softener / Filtration",
        priceByType: { whole_house_softener: 2400, softener_plus_filter: 3200, ro_under_sink: 600, iron_filter: 1800 }
      }
    },
    laborMultiplierByRegion: { south: 1.00, southeast: 1.05, northeast: 1.20, midwest: 1.08, mountain: 1.12, west: 1.25 },
    overheadMultiplier: 1.0,
    roundTo: 25,
    homeSizes: [
      { label: "1000", bathrooms: 1, fixtures: 6 },
      { label: "1500", bathrooms: 1.5, fixtures: 8 },
      { label: "2000", bathrooms: 2, fixtures: 10 },
      { label: "2500", bathrooms: 2.5, fixtures: 12 },
      { label: "3000", bathrooms: 3, fixtures: 14 },
      { label: "3500", bathrooms: 3.5, fixtures: 16 },
      { label: "4000", bathrooms: 4, fixtures: 18 }
    ],
    scopeItems: [
      { key: "permits", label: "Permits and inspections", weight: 8 },
      { key: "shutoff", label: "Shut-off valves", weight: 6 },
      { key: "cleanup", label: "Cleanup and debris removal", weight: 4 },
      { key: "drywall", label: "Drywall repair / patching", weight: 10 },
      { key: "testing", label: "Pressure testing", weight: 8 },
      { key: "warranty", label: "Warranty (parts + labor)", weight: 10 },
      { key: "disposal", label: "Old equipment disposal", weight: 4 },
      { key: "codeCompliance", label: "Code compliance upgrades", weight: 8 },
      { key: "expansion_tank", label: "Expansion tank", weight: 6 },
      { key: "supply_lines", label: "New supply lines", weight: 8 },
      { key: "drain_pan", label: "Drain pan", weight: 4 },
      { key: "venting", label: "Venting / flue work", weight: 8 }
    ],
    brands: {
      premium: ["Rinnai", "Navien", "Noritz", "Kohler"],
      mid: ["Rheem", "A.O. Smith", "Bradford White", "State"],
      value: ["Whirlpool", "GE", "Kenmore", "Reliance"]
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
  function roundTo25(n) { return Math.round(n / 25) * 25; }

  function getRegionFromState(sc) {
    return STATE_REGIONS[(sc || "").toUpperCase()] || "south";
  }

  function getBasePrice(serviceType, subType) {
    var svc = PLUMBING_PRICING.basePriceByService[serviceType];
    if (!svc) return 2000;
    var priceMap = svc.priceByType || svc.priceByMaterial || svc.priceByMethod || svc.priceByScope || svc.priceByLength || {};
    return priceMap[subType] || 2000;
  }

  function deriveBathroomsFromHomeSize(homeSize) {
    var sqft = Number(homeSize);
    if (!sqft || sqft < 400) return null;
    var rows = PLUMBING_PRICING.homeSizes;
    var closest = rows[0];
    var bestDiff = Math.abs(sqft - Number(closest.label));
    for (var i = 1; i < rows.length; i++) {
      var d = Math.abs(sqft - Number(rows[i].label));
      if (d < bestDiff) { bestDiff = d; closest = rows[i]; }
    }
    return closest.bathrooms;
  }

  // Default seasonal table — plumbing peaks in winter (frozen pipes / heater
  // failures). Same shape as HVAC's table; browser callers pass current
  // month's multiplier in directly; tests pin to 1.0 for determinism.
  var SEASONAL_MULTS = { 1:0.97, 2:0.97, 3:0.98, 4:0.99, 5:1.01, 6:1.02, 7:1.03, 8:1.03, 9:1.01, 10:1.00, 11:0.99, 12:0.97 };

  // ── Calculator ─────────────────────────────────────────────────────────────
  //
  // calcBenchmark(opts) — opts:
  //   serviceType    "water_heater" | "repipe" | "sewer_line" | "drain_cleaning"
  //                  | "bathroom_rough_in" | "gas_line" | "toilet" | "sump_pump"
  //                  | "water_softener"
  //   subType        per-service sub-key (tank_50_gas, copper, trenchless, ...)
  //   region         "south" | "southeast" | "northeast" | "midwest" | "mountain" | "west"
  //   bathrooms      optional bathroom count (drives repipe scaling)
  //   homeSize       optional sqft (used to derive bathrooms when not given)
  //   stories        optional story count (drives repipe complexity)
  //   homeAge        optional "pre_1970" | "1970_1990" | other (drives age premium)
  //   cityMult       optional per-city multiplier (overrides region multiplier when truthy)
  //   inflationMult  optional inflation multiplier (default 1.0)
  //   seasonalMult   optional seasonal multiplier (default 1.0)
  //   calData        optional flywheel calibration { avgPrice, quotes, ... } —
  //                  when present and quotes >= 3, the rate-table-derived total
  //                  is blended toward the real-world avg via FlywheelBlend.
  //                  (Browser passes this; spot-check tests omit it.)
  function calcBenchmark(opts) {
    opts = opts || {};
    var serviceType = opts.serviceType;
    var subType = opts.subType;
    var region = opts.region;
    var cityMult = (typeof opts.cityMult === "number" && opts.cityMult > 0) ? opts.cityMult : null;
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var seasonalMult = (typeof opts.seasonalMult === "number") ? opts.seasonalMult : 1.0;
    var calData = opts.calData || null;

    var basePrice = getBasePrice(serviceType, subType);
    var regionMult = cityMult || (PLUMBING_PRICING.laborMultiplierByRegion[region] || 1.0);
    var overheadMult = PLUMBING_PRICING.overheadMultiplier;

    var total = basePrice * regionMult * overheadMult * inflationMult * seasonalMult;

    // Bathroom count adjustment for repipe (more baths = more pipe runs + fixtures)
    if (serviceType === "repipe") {
      var baths = Number(opts.bathrooms);
      if (!baths && opts.homeSize) baths = deriveBathroomsFromHomeSize(opts.homeSize);
      if (baths) {
        if (baths >= 3) total *= 1.15;
        else if (baths >= 2) total *= 1.05;
      }
    }

    // Multi-story plumbing complexity (vertical stack runs, harder access)
    if (serviceType === "repipe" && opts.stories) {
      var stories = Number(opts.stories);
      if (stories >= 3) total *= 1.10;
      else if (stories >= 2) total *= 1.05;
    }

    // Home age adjustment: older homes often cost more (pipe degradation, code upgrades)
    if (opts.homeAge === "pre_1970") total *= 1.18;
    else if (opts.homeAge === "1970_1990") total *= 1.08;

    // Flywheel blend (when caller supplies cal:* aggregates).
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));
    if (calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendedBenchmark(total, calData, roundTo25);
      if (blended.applied) return blended.total;
    }
    return roundTo25(total);
  }

  return {
    PLUMBING_PRICING: PLUMBING_PRICING,
    STATE_REGIONS: STATE_REGIONS,
    SEASONAL_MULTS: SEASONAL_MULTS,
    getRegionFromState: getRegionFromState,
    getBasePrice: getBasePrice,
    deriveBathroomsFromHomeSize: deriveBathroomsFromHomeSize,
    roundTo25: roundTo25,
    calcBenchmark: calcBenchmark
  };
});
