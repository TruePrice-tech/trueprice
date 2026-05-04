// Plumbing calculator spot-check harness.
//
// Asserts that for each (specs → expected band) tuple sourced from 2026
// industry data, the /plumbing-estimate calculator output lands inside
// the band. Catches the class of drift the fixture-truth harness can't
// see — fixture-truth only walks the upload/analyze path; this walks
// the input-form/calculator path.
//
// Born during the plumbing deep test 2026-05-04 — every other vertical
// (auto/concrete/electrical/fencing/foundation/garage/gutters/HVAC/
// insulation/kitchen/landscaping/legal/medical/moving/painting/roofing/
// siding/solar/windows) has this harness; plumbing was the only gap.
// Filling it before any tank-tier or repipe drift slips silently.
//
// Run: node test/plumbing/calculator-spot-check.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/hvac/calculator-spot-check.test.js (same baseline-
// diff exit-code semantics) so CI's regression-gate.yml auto-discovers
// every test/*/calculator-spot-check.test.js the same way it auto-
// discovers the fixture-truth harnesses.
//
// Imports js/plumbing-calc.js directly — no Puppeteer, no live-site
// dependency, runs in milliseconds. The browser and the test consume
// the same module so a basePrice change in one place can't drift from
// the other.

const fs = require("fs");
const path = require("path");
const PlumbingCalc = require("../../js/plumbing-calc.js");

const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

// Pin inflation/seasonal to deterministic values so the test doesn't drift
// over time as the calendar moves. Browser uses the live values; the test
// asserts the underlying tables are correct independent of when CI runs.
const TEST_INFLATION_MULT = 1.0;
const TEST_SEASONAL_MULT = 1.0;

// Industry-anchored 2026 market bands for fully-installed plumbing work.
// Bands are wide on purpose — contractor variance is real. Tighten only
// when the flywheel has 50+ real quotes per (state, serviceType, subType).
//
// Sources per spec are inline below the spec. Refresh dates: 2026-05-04.
// Current sources: HomeGuide 2026 plumbing cost guides, Forbes Home 2026,
// Modernize 2026, This Old House 2026, HomeAdvisor/Angi 2026 surveys.
//
// Each spec runs the calc with cityMult OMITTED so the test is independent
// of the runtime city-multiplier API. The browser layers cityMult on top.
const SPECS = [
  {
    id: "wh-tank-50-gas-south",
    label: "50-gal gas tank water heater, Texas (south baseline)",
    inputs: { serviceType: "water_heater", subType: "tank_50_gas", region: "south" },
    band: { low: 1800, high: 3500 },
    sources: "HomeGuide 2026 50-gal gas tank installed $1,800-$3,200; Forbes Home 2026.",
  },
  {
    id: "wh-tankless-gas-west",
    label: "Tankless gas water heater, California (west labor)",
    inputs: { serviceType: "water_heater", subType: "tankless_gas", region: "west" },
    band: { low: 4200, high: 9500 },
    sources: "HomeGuide 2026 tankless gas $3,500-$7,500 base, +CA west 1.25x.",
  },
  {
    id: "wh-indirect-southeast",
    label: "Indirect water heater (boiler-fed), Georgia (southeast)",
    inputs: { serviceType: "water_heater", subType: "indirect", region: "southeast" },
    band: { low: 4500, high: 9500 },
    sources: "Modernize 2026 indirect WH $4k-$8k installed; This Old House 2026.",
  },
  {
    id: "repipe-pex-south-2bath",
    label: "PEX whole-house repipe, 2-bath, Texas (south baseline)",
    inputs: { serviceType: "repipe", subType: "pex", region: "south", bathrooms: 2 },
    band: { low: 4500, high: 8500 },
    sources: "HomeGuide 2026 PEX repipe $4k-$7.5k for 2,000 sqft; Modernize 2026.",
  },
  {
    id: "repipe-copper-northeast-3bath",
    label: "Copper whole-house repipe, 3-bath, New York (northeast labor)",
    inputs: { serviceType: "repipe", subType: "copper", region: "northeast", bathrooms: 3 },
    band: { low: 8500, high: 16000 },
    sources: "HomeGuide 2026 copper repipe $7.5k-$13k base, +NE 1.20x labor +3-bath 1.15x.",
  },
  {
    id: "sewer-trenchless-midwest",
    label: "Trenchless sewer line replacement, Illinois (midwest)",
    inputs: { serviceType: "sewer_line", subType: "trenchless", region: "midwest" },
    band: { low: 6500, high: 13500 },
    sources: "HomeGuide 2026 trenchless sewer $6k-$12k; HomeAdvisor 2026 IL.",
  },
  {
    id: "bath-rough-in-full-west",
    label: "Full-bath rough-in plumbing, California (west)",
    inputs: { serviceType: "bathroom_rough_in", subType: "full_bath", region: "west" },
    band: { low: 4500, high: 9500 },
    sources: "Modernize 2026 full-bath rough-in $3.5k-$7.5k; +CA west 1.25x.",
  },
  {
    id: "gas-line-medium-south",
    label: "20-50ft gas line install, Texas (south)",
    inputs: { serviceType: "gas_line", subType: "medium_20_50ft", region: "south" },
    band: { low: 1000, high: 2800 },
    sources: "HomeAdvisor 2026 gas line install $200-$1,000/per linear ft, $1k-$2.5k typical 20-50ft run.",
  },
];

function runSpec(spec) {
  const price = PlumbingCalc.calcBenchmark(Object.assign({}, spec.inputs, {
    inflationMult: TEST_INFLATION_MULT,
    seasonalMult: TEST_SEASONAL_MULT,
  }));
  const failures = [];
  if (price < spec.band.low) {
    failures.push(`band-low: $${price} below low edge $${spec.band.low}`);
  } else if (price > spec.band.high) {
    failures.push(`band-high: $${price} above high edge $${spec.band.high}`);
  }
  return { price, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TEST_INFLATION_MULT, seasonalMult: TEST_SEASONAL_MULT, results: {} };
  let totalFails = 0;

  console.log("Plumbing calculator spot-check — 2026 industry-anchored bands");
  console.log("inflationMult=1.0 seasonalMult=1.0 cityMult=none (region multiplier only)\n");

  for (const spec of SPECS) {
    process.stdout.write(`  ${spec.id} ... `);
    const { price, failures } = runSpec(spec);
    out.results[spec.id] = {
      price: price,
      band: spec.band,
      label: spec.label,
      failures: failures,
    };
    if (failures.length) {
      totalFails += failures.length;
      console.log(`FAIL ($${price}, band $${spec.band.low}-$${spec.band.high})`);
      failures.forEach(f => console.log(`     - ${f}`));
      console.log(`     sources: ${spec.sources}`);
    } else {
      console.log(`OK ($${price}, band $${spec.band.low}-$${spec.band.high})`);
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
    const m = msg.match(/^(band-low|band-high):/);
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
