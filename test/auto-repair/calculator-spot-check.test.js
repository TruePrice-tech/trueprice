// Auto-repair calculator spot-check harness.
//
// Asserts that for each (repair x vehicle x shop x state x urgency) tuple
// sourced from 2026 industry data, the /auto-repair calculator's totalMid
// lands inside its band. Catches the same drift class as HVAC + roofing
// spot-checks: the fixture-truth harness only walks the upload/analyze path;
// this walks the input-form/calculator path.
//
// Born 2026-05-03 as the missing Step 3 from the canonical 9-step deep-test
// procedure (feedback_deep_test_command.md). The 2026-05-02 auto-repair deep
// test predated the calculator-spot-check pattern, so this finalizes it.
//
// Run: node test/auto-repair/calculator-spot-check.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Imports js/auto-calc.js directly -- no Puppeteer, no live-site dependency,
// runs in milliseconds. Browser and test consume the same module so a
// repair-rate change in one place can't drift from the other.

const fs = require("fs");
const path = require("path");
const AutoCalc = require("../../js/auto-calc.js");

const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

// Pin inflation to 1.0 for deterministic test bands. Browser uses the live
// 1.04ish multiplier; the test asserts the underlying tables are correct
// independent of when CI runs.
const TEST_INFLATION_MULT = 1.0;

// Industry-anchored 2026 mid-price bands sourced from RepairPal 2026, AAA
// 2026, BLS SOC 49-3023, Mitchell labor guides, Forbes Home 2026.
//
// Bands target the calc's totalMid output. Bands are wide on purpose --
// shop-to-shop variance within a city is real (20-40%). Tighten only when
// the flywheel has 50+ real quotes per (state, repair, shop type).
//
// Refresh date: 2026-05-03.
const SPECS = [
  {
    id: "brakes-pads-rotors-std-indep-sc",
    label: "Pads + rotors per axle, standard sedan, independent shop, SC",
    inputs: { repairType: "brakes", subType: "pads_rotors", vehicleCat: "standard", shopType: "independent", urgency: "this_week", stateCode: "SC" },
    band: { low: 250, high: 600 },
    sources: "RepairPal 2026 indep $250-500/axle; AAA 2026 $300-600. SC ~= national. Calc mid $430 inside.",
  },
  {
    id: "brakes-pads-rotors-truck-indep-tx",
    label: "Pads + rotors per axle, F-150/SUV, independent shop, TX",
    inputs: { repairType: "brakes", subType: "pads_rotors", vehicleCat: "truck_suv", shopType: "independent", urgency: "this_week", stateCode: "TX" },
    band: { low: 320, high: 850 },
    sources: "RepairPal 2026 truck/SUV $400-700/axle; HomeGuide-equivalent.",
  },
  {
    id: "oil-synthetic-std-chain-ga",
    label: "Full synthetic oil change, standard sedan, chain shop, GA",
    inputs: { repairType: "oil_change", subType: "synthetic", vehicleCat: "standard", shopType: "chain", urgency: "this_week", stateCode: "GA" },
    band: { low: 55, high: 135 },
    sources: "AAA 2026 chain synthetic $70-130; consumer surveys 2026.",
  },
  {
    id: "trans-rebuild-std-indep-tx",
    label: "Transmission rebuild, standard sedan, independent shop, TX",
    inputs: { repairType: "transmission", subType: "rebuild", vehicleCat: "standard", shopType: "independent", urgency: "this_week", stateCode: "TX" },
    band: { low: 1700, high: 4800 },
    sources: "RepairPal 2026 rebuild $2.5k-4.5k; Mitchell labor guide.",
  },
  {
    id: "engine-replace-std-indep-sc",
    label: "Engine replacement, standard sedan, independent shop, SC",
    inputs: { repairType: "engine", subType: "engine_replace", vehicleCat: "standard", shopType: "independent", urgency: "this_week", stateCode: "SC" },
    band: { low: 3200, high: 10000 },
    sources: "RepairPal 2026 reman engine + install $4.5k-9k; PartsTech 2025.",
  },
  {
    id: "engine-replace-truck-dealer-tx",
    label: "Engine replacement, F-150/SUV, dealer, TX",
    inputs: { repairType: "engine", subType: "engine_replace", vehicleCat: "truck_suv", shopType: "dealer", urgency: "this_week", stateCode: "TX" },
    band: { low: 6000, high: 17000 },
    sources: "Forbes Home 2026 truck engine replacement at dealer $7k-15k.",
  },
  {
    id: "ac-recharge-std-indep-ga",
    label: "AC recharge, standard sedan, independent shop, GA",
    inputs: { repairType: "ac_heating", subType: "ac_recharge", vehicleCat: "standard", shopType: "independent", urgency: "this_week", stateCode: "GA" },
    band: { low: 100, high: 350 },
    sources: "RepairPal 2026 AC recharge $150-400 (R-1234yf-era).",
  },
  {
    id: "struts-front-std-dealer-ny",
    label: "Front struts (pair), standard sedan, dealer, NY",
    inputs: { repairType: "suspension", subType: "struts_front", vehicleCat: "standard", shopType: "dealer", urgency: "this_week", stateCode: "NY" },
    band: { low: 700, high: 2400 },
    sources: "AAA 2026 dealer struts NYC $800-2k pair.",
  },
  {
    id: "battery-std-chain-sc",
    label: "Battery replacement (AGM era), standard sedan, chain shop, SC",
    inputs: { repairType: "electrical", subType: "battery", vehicleCat: "standard", shopType: "chain", urgency: "this_week", stateCode: "SC" },
    band: { low: 200, high: 360 },
    sources: "AAA / RepairPal / Walmart / Costco 2026 AGM battery installed $200-$350 national; conventional $130-$200 (excluded). Calc mid $230 inside — calc-side may be averaging conventional+AGM rather than AGM-specific.",
  },
  {
    id: "alternator-luxury-dealer-asap-ny",
    label: "Alternator, luxury (BMW/Audi), dealer, ASAP, NY",
    inputs: { repairType: "electrical", subType: "alternator", vehicleCat: "luxury", shopType: "dealer", urgency: "asap", stateCode: "NY" },
    band: { low: 800, high: 3200 },
    sources: "Mitchell labor guide 2026 luxury alternator dealer NYC $800-2.5k.",
  },
  {
    id: "catalytic-evhybrid-dealer-ca",
    label: "Catalytic converter, EV/hybrid, dealer, CA (CARB-compliant)",
    inputs: { repairType: "exhaust", subType: "catalytic", vehicleCat: "ev_hybrid", shopType: "dealer", urgency: "this_week", stateCode: "CA" },
    band: { low: 2000, high: 9000 },
    sources: "CARB-compliant cat dealer CA 2026 $2.5k-6k typical, premium up to $8k.",
  },
  {
    id: "tire-set-std-chain-tx",
    label: "New tires (set of 4), standard sedan, chain shop, TX",
    inputs: { repairType: "tires", subType: "tire_set", vehicleCat: "standard", shopType: "chain", urgency: "schedule_ahead", stateCode: "TX" },
    band: { low: 400, high: 1500 },
    sources: "Discount Tire / Costco 2026 set of 4 std sedan $500-1.4k.",
  },
];

function runSpec(spec) {
  const out = AutoCalc.calcAutoEstimate(Object.assign({}, spec.inputs, {
    inflationMult: TEST_INFLATION_MULT,
  }));
  const failures = [];
  if (!out) {
    failures.push(`calc-error: calcAutoEstimate returned null (bad repair/subtype key?)`);
    return { mid: null, low: null, high: null, failures };
  }
  if (out.totalMid < spec.band.low) {
    failures.push(`band-low: mid $${out.totalMid} below low edge $${spec.band.low}`);
  } else if (out.totalMid > spec.band.high) {
    failures.push(`band-high: mid $${out.totalMid} above high edge $${spec.band.high}`);
  }
  return { mid: out.totalMid, low: out.totalLow, high: out.totalHigh, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TEST_INFLATION_MULT, results: {} };
  let totalFails = 0;

  console.log("Auto-repair calculator spot-check — 2026 industry-anchored bands");
  console.log("inflationMult=1.0 cityMult=none (state mult only) calData=none (no flywheel)\n");

  for (const spec of SPECS) {
    process.stdout.write(`  ${spec.id} ... `);
    const { mid, low, high, failures } = runSpec(spec);
    out.results[spec.id] = {
      calcMid: mid,
      calcLow: low,
      calcHigh: high,
      band: spec.band,
      label: spec.label,
      failures: failures,
    };
    if (failures.length) {
      totalFails += failures.length;
      console.log(`FAIL (mid $${mid}, band $${spec.band.low}-$${spec.band.high})`);
      failures.forEach(f => console.log(`     - ${f}`));
      console.log(`     sources: ${spec.sources}`);
    } else {
      console.log(`OK (mid $${mid}, calc range $${low}-$${high}, band $${spec.band.low}-$${spec.band.high})`);
    }
  }

  if (IS_BASELINE) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2));
    console.log("\nBaseline written:", BASELINE_PATH);
    console.log(`\nTotal failures: ${totalFails}`);
    process.exit(0);
    return;
  }

  function failureSubject(msg) {
    const m = msg.match(/^(band-low|band-high|calc-error):/);
    return m ? m[1] : msg.split(":")[0].trim();
  }

  let newFailsCount = 0;
  let newPassesCount = 0;
  if (fs.existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    const newFails = [];
    const newPasses = [];
    for (const id of Object.keys(out.results)) {
      const before = (baseline.results[id]?.failures || []).map(failureSubject);
      const after = (out.results[id]?.failures || []).map(failureSubject);
      const beforeSet = new Set(before);
      const afterSet = new Set(after);
      after.forEach(s => { if (!beforeSet.has(s)) newFails.push(`${id}: ${s}`); });
      before.forEach(s => { if (!afterSet.has(s)) newPasses.push(`${id}: ${s}`); });
    }
    newFailsCount = newFails.length;
    newPassesCount = newPasses.length;
    console.log("\n=== vs baseline ===");
    if (newPasses.length) {
      console.log("NEW PASSES (band drift fixes landed):");
      newPasses.forEach(p => console.log("  + " + p));
    }
    if (newFails.length) {
      console.log("NEW FAILURES (band regressions):");
      newFails.forEach(f => console.log("  - " + f));
    }
    if (!newPasses.length && !newFails.length) console.log("No deltas vs baseline.");
  }

  console.log(`\nTotal failures: ${totalFails}`);

  if (fs.existsSync(BASELINE_PATH)) {
    process.exit(newFailsCount > 0 ? 1 : 0);
  } else {
    process.exit(totalFails > 0 ? 1 : 0);
  }
})();
