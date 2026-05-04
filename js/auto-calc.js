// Woogoro Auto-repair calculator — single source of truth for /auto-repair.
//
// Mirrors js/hvac-calc.js (HVAC-CALC-1) and js/roofing-calc.js (ROOF-CALC-1).
// Same module is used by:
//   1. /auto-estimate.html (browser) — drives the auto-repair cost estimator
//   2. test/auto-repair/calculator-spot-check.test.js (Node) — asserts each
//      (repair × vehicle × shop × state) tuple lands inside its 2026
//      industry-anchored band
//
// Why one module: prior to 2026-05-03 the calc lived inline in auto-estimate.html
// with no test asserting market alignment. The fixture-truth harness only
// walks the upload/analyze path, so the calculator's pricing tables could
// drift unchecked. With one shared module + the spot-check harness, CI's
// regression-gate.yml fails the build when any (repair × shop × state) tuple
// drifts outside the band.
//
// Pure math + constants only — no DOM, no fetch. Browser passes its
// city-multiplier and inflation values in; tests pass deterministic stubs.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WoogoroAutoCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ── 2026 market-anchored repair pricing ────────────────────────────────────
  //
  // Sources: AAA 2026, RepairPal 2026, BLS SOC 49-3023, Mitchell labor guides,
  // PartsTech 2025, contractor surveys.
  //
  // Refreshed 2026-05-03 (AUTO-CALC-1, commit 4981fbdd330) — bumped stale
  // 2018-era low-end values (battery 80→130, alternator 120→180, engine 1500→
  // 2500, catalytic 200→400) and labor rate floors (independent 75→90, dealer
  // 125→150). See git blame for per-value rationale.
  var REPAIR_TYPES = {
    brakes: {
      label: "Brakes",
      subtypes: {
        pads_only:    { label: "Brake pads only (per axle)", laborHrs: [0.8, 1.5], partsLow: 80, partsHigh: 200, totalLow: 150, totalHigh: 350 },
        pads_rotors:  { label: "Pads + rotors (per axle)", laborHrs: [1.0, 2.0], partsLow: 150, partsHigh: 400, totalLow: 300, totalHigh: 700 },
        full_job:     { label: "Full brake job (all 4 wheels)", laborHrs: [2.0, 4.0], partsLow: 280, partsHigh: 650, totalLow: 450, totalHigh: 1200 },
        brake_line:   { label: "Brake line repair", laborHrs: [1.0, 2.5], partsLow: 40, partsHigh: 120, totalLow: 200, totalHigh: 500 }
      },
      included: ["New pads/rotors as selected", "Brake hardware/clips", "Rotor resurfacing or replacement", "Brake fluid top-off", "Road test and inspection"]
    },
    oil_change: {
      label: "Oil Change",
      subtypes: {
        conventional: { label: "Conventional oil change", laborHrs: [0.3, 0.5], partsLow: 20, partsHigh: 40, totalLow: 30, totalHigh: 75 },
        synthetic:    { label: "Full synthetic oil change", laborHrs: [0.3, 0.5], partsLow: 35, partsHigh: 70, totalLow: 65, totalHigh: 125 },
        high_mileage: { label: "High-mileage synthetic blend", laborHrs: [0.3, 0.5], partsLow: 30, partsHigh: 55, totalLow: 50, totalHigh: 100 },
        diesel:       { label: "Diesel oil change", laborHrs: [0.4, 0.7], partsLow: 50, partsHigh: 90, totalLow: 80, totalHigh: 150 }
      },
      included: ["Oil (type as selected)", "Oil filter", "Drain plug washer", "Multi-point inspection", "Fluid level check"]
    },
    tires: {
      label: "Tires",
      subtypes: {
        tire_set:     { label: "New tires (set of 4)", laborHrs: [1.0, 1.5], partsLow: 400, partsHigh: 1200, totalLow: 500, totalHigh: 1400 },
        single_tire:  { label: "Single tire replacement", laborHrs: [0.3, 0.5], partsLow: 100, partsHigh: 300, totalLow: 130, totalHigh: 380 },
        rotation:     { label: "Tire rotation + balance", laborHrs: [0.5, 0.8], partsLow: 0, partsHigh: 0, totalLow: 30, totalHigh: 80 },
        alignment:    { label: "Wheel alignment", laborHrs: [0.5, 1.0], partsLow: 0, partsHigh: 20, totalLow: 75, totalHigh: 150 }
      },
      included: ["Mounting and balancing", "Valve stems", "Tire disposal fee", "TPMS reset", "Alignment check"]
    },
    transmission: {
      label: "Transmission",
      subtypes: {
        fluid_change:  { label: "Transmission fluid change", laborHrs: [0.5, 1.5], partsLow: 40, partsHigh: 100, totalLow: 100, totalHigh: 300 },
        rebuild:       { label: "Transmission rebuild", laborHrs: [8.0, 15.0], partsLow: 800, partsHigh: 2000, totalLow: 2500, totalHigh: 5000 },
        replacement:   { label: "Transmission replacement", laborHrs: [6.0, 10.0], partsLow: 1500, partsHigh: 4000, totalLow: 2800, totalHigh: 6000 },
        clutch:        { label: "Clutch replacement (manual)", laborHrs: [4.0, 8.0], partsLow: 150, partsHigh: 800, totalLow: 800, totalHigh: 2000 }
      },
      included: ["Transmission fluid", "Gaskets and seals", "Torque converter (if replacing)", "Road test", "Warranty on parts and labor"]
    },
    engine: {
      label: "Engine",
      subtypes: {
        spark_plugs:    { label: "Spark plug replacement", laborHrs: [0.5, 3.0], partsLow: 20, partsHigh: 120, totalLow: 100, totalHigh: 350 },
        timing_belt:    { label: "Timing belt/chain", laborHrs: [3.0, 10.0], partsLow: 80, partsHigh: 400, totalLow: 400, totalHigh: 2500 },
        head_gasket:    { label: "Head gasket replacement", laborHrs: [10.0, 20.0], partsLow: 100, partsHigh: 600, totalLow: 1500, totalHigh: 3500 },
        engine_replace: { label: "Engine replacement", laborHrs: [10.0, 20.0], partsLow: 2500, partsHigh: 7000, totalLow: 3000, totalHigh: 8000 }
      },
      included: ["Parts as specified", "Gaskets and seals", "Fluids and coolant", "Computer reset/calibration", "Road test and inspection"]
    },
    ac_heating: {
      label: "AC / Heating",
      subtypes: {
        ac_recharge:   { label: "AC recharge", laborHrs: [0.5, 1.0], partsLow: 60, partsHigh: 180, totalLow: 150, totalHigh: 400 },
        ac_compressor: { label: "AC compressor replacement", laborHrs: [3.0, 5.0], partsLow: 200, partsHigh: 700, totalLow: 600, totalHigh: 1400 },
        heater_core:   { label: "Heater core replacement", laborHrs: [4.0, 10.0], partsLow: 80, partsHigh: 250, totalLow: 500, totalHigh: 1500 },
        thermostat:    { label: "Thermostat replacement", laborHrs: [1.0, 2.5], partsLow: 15, partsHigh: 80, totalLow: 150, totalHigh: 400 }
      },
      included: ["Refrigerant (if AC)", "Compressor oil", "O-rings and seals", "System pressure test", "Temperature verification"]
    },
    suspension: {
      label: "Suspension",
      subtypes: {
        struts_front:  { label: "Front struts (pair)", laborHrs: [2.0, 4.0], partsLow: 100, partsHigh: 500, totalLow: 400, totalHigh: 900 },
        struts_rear:   { label: "Rear shocks/struts (pair)", laborHrs: [1.5, 3.0], partsLow: 80, partsHigh: 400, totalLow: 300, totalHigh: 700 },
        ball_joints:   { label: "Ball joints (pair)", laborHrs: [1.5, 3.0], partsLow: 60, partsHigh: 300, totalLow: 250, totalHigh: 600 },
        control_arms:  { label: "Control arms (pair)", laborHrs: [1.5, 3.5], partsLow: 100, partsHigh: 500, totalLow: 400, totalHigh: 1200 }
      },
      included: ["Parts as specified", "Alignment after installation", "Hardware and bushings", "Road test", "Inspection of related components"]
    },
    electrical: {
      label: "Electrical",
      subtypes: {
        battery:        { label: "Battery replacement", laborHrs: [0.3, 0.5], partsLow: 130, partsHigh: 320, totalLow: 180, totalHigh: 380 },
        alternator:     { label: "Alternator replacement", laborHrs: [1.0, 3.0], partsLow: 180, partsHigh: 500, totalLow: 350, totalHigh: 800 },
        starter:        { label: "Starter motor replacement", laborHrs: [1.0, 3.0], partsLow: 150, partsHigh: 450, totalLow: 300, totalHigh: 700 },
        ignition_coils: { label: "Ignition coil(s) replacement", laborHrs: [0.5, 2.0], partsLow: 25, partsHigh: 200, totalLow: 150, totalHigh: 500 }
      },
      included: ["Parts as specified", "Electrical system test", "Battery terminal cleaning", "Computer reset if needed", "Charging system verification"]
    },
    exhaust: {
      label: "Exhaust",
      subtypes: {
        muffler:      { label: "Muffler replacement", laborHrs: [0.5, 1.5], partsLow: 50, partsHigh: 250, totalLow: 150, totalHigh: 400 },
        catalytic:    { label: "Catalytic converter", laborHrs: [1.0, 3.0], partsLow: 400, partsHigh: 2800, totalLow: 600, totalHigh: 3500 },
        o2_sensor:    { label: "Oxygen sensor replacement", laborHrs: [0.5, 1.5], partsLow: 40, partsHigh: 200, totalLow: 150, totalHigh: 400 },
        exhaust_pipe: { label: "Exhaust pipe repair/replace", laborHrs: [0.5, 2.0], partsLow: 50, partsHigh: 200, totalLow: 100, totalHigh: 400 }
      },
      included: ["Parts as specified", "Gaskets and hangers", "Emissions check", "Exhaust leak test", "Heat shield inspection"]
    },
    general_maintenance: {
      label: "General Maintenance",
      subtypes: {
        serpentine:   { label: "Serpentine belt replacement", laborHrs: [0.3, 1.0], partsLow: 15, partsHigh: 80, totalLow: 75, totalHigh: 200 },
        coolant_flush:{ label: "Coolant flush", laborHrs: [0.5, 1.0], partsLow: 20, partsHigh: 50, totalLow: 75, totalHigh: 175 },
        fuel_filter:  { label: "Fuel filter replacement", laborHrs: [0.3, 1.0], partsLow: 15, partsHigh: 60, totalLow: 50, totalHigh: 150 },
        tune_up:      { label: "Full tune-up", laborHrs: [1.5, 4.0], partsLow: 50, partsHigh: 250, totalLow: 200, totalHigh: 600 }
      },
      included: ["Parts as specified", "Multi-point inspection", "Fluid top-offs", "Filter replacement", "System test"]
    }
  };

  var VEHICLE_CATS = {
    economy:     { label: "Economy Sedan", mult: 0.85, examples: "Civic, Corolla, Sentra, Elantra" },
    standard:    { label: "Standard Sedan", mult: 1.0,  examples: "Camry, Accord, Altima, Malibu" },
    truck_suv:   { label: "Truck / SUV", mult: 1.15, examples: "F-150, Silverado, 4Runner, Wrangler" },
    luxury:      { label: "Luxury", mult: 1.40, examples: "BMW, Mercedes, Audi, Lexus" },
    performance: { label: "Performance", mult: 1.50, examples: "Porsche, Corvette, AMG, M-series" },
    ev_hybrid:   { label: "EV / Hybrid", mult: 1.30, examples: "Tesla, Prius, Bolt, Leaf, Mach-E" }
  };

  var SHOP_TYPES = {
    dealer:      { label: "Dealership", mult: 1.30, rateRange: [150, 250] },
    independent: { label: "Independent Shop", mult: 1.0,  rateRange: [90, 160] },
    chain:       { label: "Chain Shop", mult: 0.90, rateRange: [95, 150] },
    diy:         { label: "DIY (Parts Only)", mult: 0.0,  rateRange: [0, 0] }
  };

  var URGENCY_MULTS = {
    asap: 1.08,
    this_week: 1.03,
    schedule_ahead: 1.0
  };

  var STATE_MULTS = {
    AL:0.82,AK:1.10,AZ:0.95,AR:0.78,CA:1.25,CO:1.08,CT:1.18,DE:1.05,FL:0.92,GA:0.88,
    HI:1.12,ID:0.85,IL:1.02,IN:0.88,IA:0.85,KS:0.85,KY:0.82,LA:0.85,ME:0.95,MD:1.05,
    MA:1.15,MI:0.88,MN:0.95,MS:0.78,MO:0.85,MT:0.90,NE:0.85,NV:1.00,NH:1.05,NJ:1.12,
    NM:0.88,NY:1.18,NC:0.88,ND:0.85,OH:0.88,OK:0.80,OR:1.02,PA:1.00,RI:1.05,SC:0.85,
    SD:0.82,TN:0.85,TX:0.90,UT:0.92,VT:0.95,VA:0.95,WA:1.12,WV:0.78,WI:0.90,WY:0.88,DC:1.20
  };

  var STATE_TAX = {
    AL:0.04,AK:0.0,AZ:0.056,AR:0.065,CA:0.0725,CO:0.029,CT:0.0635,DE:0.0,FL:0.06,GA:0.04,
    HI:0.04,ID:0.06,IL:0.0625,IN:0.07,IA:0.06,KS:0.065,KY:0.06,LA:0.0445,ME:0.055,MD:0.06,
    MA:0.0625,MI:0.06,MN:0.0688,MS:0.07,MO:0.0423,MT:0.0,NE:0.055,NV:0.0685,NH:0.0,NJ:0.0663,
    NM:0.0513,NY:0.04,NC:0.0475,ND:0.05,OH:0.0575,OK:0.045,OR:0.0,PA:0.06,RI:0.07,SC:0.06,
    SD:0.045,TN:0.07,TX:0.0625,UT:0.061,VT:0.06,VA:0.053,WA:0.065,WV:0.06,WI:0.05,WY:0.04,DC:0.06
  };

  function roundTo10(n) { return Math.round(n / 10) * 10; }

  // ── Calculator ─────────────────────────────────────────────────────────────
  //
  // calcAutoEstimate(opts) — opts:
  //   repairType     key in REPAIR_TYPES (e.g. "brakes", "engine", "electrical")
  //   subType        key in REPAIR_TYPES[repairType].subtypes (e.g. "pads_rotors")
  //   vehicleCat     key in VEHICLE_CATS (e.g. "standard", "luxury")
  //   shopType       key in SHOP_TYPES (e.g. "independent", "dealer", "chain", "diy")
  //   urgency        key in URGENCY_MULTS (e.g. "this_week")
  //   stateCode      2-letter US state code (e.g. "SC")
  //   cityMult       optional per-city multiplier (overrides state mult when truthy)
  //   inflationMult  optional inflation multiplier (default 1.0)
  //   calData        optional flywheel calibration { avgPrice, quotes, ... } —
  //                  when present and quotes >= 3, the rate-table-derived totalMid
  //                  is blended toward the real-world avg via FlywheelBlend; the
  //                  totalLow/totalHigh band scales with the new mid so verdict
  //                  ratios stay coherent. Mirrors hvac-calc.js + roofing-calc.js.
  //
  // Returns an object with totalLow / totalMid / totalHigh + the components
  // the UI needs to render the breakdown.
  function calcAutoEstimate(opts) {
    opts = opts || {};
    var repairCat = REPAIR_TYPES[opts.repairType];
    if (!repairCat) return null;
    var subtype = repairCat.subtypes[opts.subType];
    if (!subtype) return null;
    var vehicle = VEHICLE_CATS[opts.vehicleCat] || VEHICLE_CATS.standard;
    var shop = SHOP_TYPES[opts.shopType] || SHOP_TYPES.independent;
    var urgMult = URGENCY_MULTS[opts.urgency] || 1.0;
    var stateMult = (typeof opts.cityMult === "number" && opts.cityMult > 0)
      ? opts.cityMult
      : (STATE_MULTS[opts.stateCode] || 1.0);
    var taxRate = STATE_TAX[opts.stateCode] || 0.06;
    var vMult = vehicle.mult;
    var inflationMult = (typeof opts.inflationMult === "number") ? opts.inflationMult : 1.0;
    var calData = opts.calData || null;
    var FB = (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : null));

    // DIY: parts only (no labor, no shop supplies, no urgency, no shop mult)
    if (opts.shopType === "diy") {
      var diyPartsLow = roundTo10(subtype.partsLow * vMult * stateMult * inflationMult);
      var diyPartsHigh = roundTo10(subtype.partsHigh * vMult * stateMult * inflationMult);
      var diyPartsMid = roundTo10((diyPartsLow + diyPartsHigh) / 2);
      var diyTaxMid = Math.round(diyPartsMid * taxRate);
      // DIY doesn't blend with flywheel — calData reflects shop quotes, not parts-only
      return {
        repairLabel: subtype.label,
        categoryLabel: repairCat.label,
        vehicleLabel: vehicle.label,
        shopLabel: "DIY (Parts Only)",
        totalLow: roundTo10(diyPartsLow + Math.round(diyPartsLow * taxRate)),
        totalMid: roundTo10(diyPartsMid + diyTaxMid),
        totalHigh: roundTo10(diyPartsHigh + Math.round(diyPartsHigh * taxRate)),
        laborMid: 0,
        laborRateMid: 0,
        laborHrsMid: 0,
        partsMid: diyPartsMid,
        partsLow: diyPartsLow,
        partsHigh: diyPartsHigh,
        shopSupplies: 0,
        taxMid: diyTaxMid,
        taxRate: taxRate,
        isDIY: true,
        flywheelApplied: false,
        included: repairCat.included || []
      };
    }

    // Labor calculation
    var laborRateLow = shop.rateRange[0] * stateMult * vMult;
    var laborRateHigh = shop.rateRange[1] * stateMult * vMult;
    var laborRateMid = (laborRateLow + laborRateHigh) / 2;
    var laborHrsLow = subtype.laborHrs[0];
    var laborHrsHigh = subtype.laborHrs[1];
    var laborHrsMid = (laborHrsLow + laborHrsHigh) / 2;

    var laborLow = roundTo10(laborRateLow * laborHrsLow * inflationMult);
    var laborMid = roundTo10(laborRateMid * laborHrsMid * inflationMult);
    var laborHigh = roundTo10(laborRateHigh * laborHrsHigh * inflationMult);

    // Parts
    var partsLow = roundTo10(subtype.partsLow * vMult * stateMult * inflationMult);
    var partsMid = roundTo10(((subtype.partsLow + subtype.partsHigh) / 2) * vMult * stateMult * inflationMult);
    var partsHigh = roundTo10(subtype.partsHigh * vMult * stateMult * inflationMult);

    // Shop supplies (~6% of labor)
    var shopSupplies = Math.round(laborMid * 0.06);

    // Tax on parts + shop supplies
    var taxLow = Math.round((partsLow + shopSupplies) * taxRate);
    var taxMid = Math.round((partsMid + shopSupplies) * taxRate);
    var taxHigh = Math.round((partsHigh + shopSupplies) * taxRate);

    // Urgency
    var totalLow = roundTo10((laborLow + partsLow + shopSupplies + taxLow) * urgMult);
    var totalMid = roundTo10((laborMid + partsMid + shopSupplies + taxMid) * urgMult);
    var totalHigh = roundTo10((laborHigh + partsHigh + shopSupplies + taxHigh) * urgMult);

    // Apply shop multiplier
    totalLow = totalLow * shop.mult;
    totalMid = totalMid * shop.mult;
    totalHigh = totalHigh * shop.mult;

    // Flywheel blend: when calData has enough quotes, blend totalMid toward
    // real-world avg, then scale totalLow/totalHigh proportionally so the
    // verdict band stays coherent. Mirrors hvac-calc.js / roofing-calc.js.
    var flywheelApplied = false;
    var flywheelConfidence = "model_only";
    if (calData && FB && FB.FlywheelBlend) {
      var blended = FB.FlywheelBlend.blendMid(totalMid, calData);
      flywheelConfidence = blended.confidence;
      if (blended.applied && totalMid > 0) {
        var ratio = blended.mid / totalMid;
        totalMid = blended.mid;
        totalLow = totalLow * ratio;
        totalHigh = totalHigh * ratio;
        flywheelApplied = true;
      }
    }

    return {
      repairLabel: subtype.label,
      categoryLabel: repairCat.label,
      vehicleLabel: vehicle.label,
      shopLabel: shop.label,
      totalLow: roundTo10(totalLow),
      totalMid: roundTo10(totalMid),
      totalHigh: roundTo10(totalHigh),
      laborMid: roundTo10(laborMid * shop.mult),
      laborRateMid: Math.round(laborRateMid),
      laborHrsMid: laborHrsMid,
      partsMid: partsMid,
      partsLow: partsLow,
      partsHigh: partsHigh,
      shopSupplies: shopSupplies,
      taxMid: taxMid,
      taxRate: taxRate,
      isDIY: false,
      flywheelApplied: flywheelApplied,
      flywheelConfidence: flywheelConfidence,
      included: repairCat.included || []
    };
  }

  return {
    REPAIR_TYPES: REPAIR_TYPES,
    VEHICLE_CATS: VEHICLE_CATS,
    SHOP_TYPES: SHOP_TYPES,
    URGENCY_MULTS: URGENCY_MULTS,
    STATE_MULTS: STATE_MULTS,
    STATE_TAX: STATE_TAX,
    calcAutoEstimate: calcAutoEstimate,
    roundTo10: roundTo10
  };
});
