// HVAC calculator spot-check harness.
//
// Asserts that for each (specs → expected band) tuple sourced from 2026
// industry data, the /hvac-estimate calculator output lands inside the
// band. Catches the class of drift the fixture-truth harness can't see —
// the fixture-truth harness only walks the upload/analyze path; this
// walks the input-form/calculator path.
//
// Born 2026-05-03 after Lane's Fort Mill SC test case showed $6,400 for
// a 5-ton 16 SEER central AC when the 2026 R-454B installed market is
// $11k-$14.5k. Root cause: basePriceBySystem tables in hvac-estimate.html
// had drifted to 2019 levels with no test asserting market alignment.
//
// Run: node test/hvac/calculator-spot-check.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Pattern mirrors test/hvac/fixture-ground-truth.test.js (same baseline-
// diff exit-code semantics) so CI's regression-gate.yml can auto-discover
// every test/*/calculator-spot-check.test.js the same way it auto-discovers
// the fixture-truth harnesses.
//
// Imports js/hvac-calc.js directly — no Puppeteer, no live-site dependency,
// runs in milliseconds. The browser and the test consume the same module,
// so a basePrice change in one place can't drift from the other.

const fs = require("fs");
const path = require("path");
const HvacCalc = require("../../js/hvac-calc.js");

const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

// Pin inflation/seasonal to deterministic values so the test doesn't drift
// over time as the calendar moves. Browser uses the live values; the test
// asserts the underlying tables are correct independent of when CI runs.
const TEST_INFLATION_MULT = 1.0;
const TEST_SEASONAL_MULT = 1.0;

// Industry-anchored 2026 market bands for fully-installed HVAC. Bands are
// wide on purpose — contractor variance is real. Tighten only when the
// flywheel has 50+ real quotes per (state, systemType, tier).
//
// Sources per spec are inline below the spec. Refresh dates: 2026-05-03.
// Current sources: HomeGuide 2026 HVAC cost guide, Forbes Home 2026 AC/HP,
// Modernize 2026, This Old House 2026, HomeAdvisor/Angi 2026 surveys.
//
// Each spec runs the calc with cityMult OMITTED so the test is independent
// of the runtime city-multiplier API. The browser layers cityMult on top.
const SPECS = [
  {
    id: "ac-3ton-14seer-ga",
    label: "3-ton 14 SEER central AC, Georgia (Southeast new-minimum tier)",
    inputs: { systemType: "central_ac", seer: 14, tons: 3, region: "southeast", ductworkCond: "good" },
    band: { low: 5500, high: 9000 },
    sources: "HomeGuide 2026 14-15 SEER 3-ton $5.5k-9k SE; Modernize 2026.",
  },
  {
    id: "ac-5ton-16seer-sc",
    label: "5-ton 16 SEER central AC, South Carolina (Lane's regression case)",
    inputs: { systemType: "central_ac", seer: 16, tons: 5, region: "southeast", ductworkCond: "good" },
    band: { low: 10000, high: 15000 },
    sources: "HomeGuide 2026 5-ton $7.5k-15k; This Old House 2026 SE R-454B $11-14.5k; Forbes Home 2026.",
  },
  {
    id: "ac-4ton-18seer-nc",
    label: "4-ton 18 SEER central AC, North Carolina (high-eff Southeast)",
    inputs: { systemType: "central_ac", seer: 18, tons: 4, region: "southeast", ductworkCond: "good" },
    band: { low: 11000, high: 16500 },
    sources: "HomeGuide 2026 4-ton 18 SEER $11k-16k; Modernize 2026.",
  },
  {
    id: "hp-3ton-16seer-ny",
    label: "3-ton 16 SEER heat pump, New York (cold climate, Northeast labor)",
    inputs: { systemType: "heat_pump", seer: 16, tons: 3, region: "northeast", ductworkCond: "good" },
    band: { low: 11500, high: 17500 },
    sources: "Forbes Home 2026 HP NE; HomeGuide 2026 16 SEER HP $11k-17k installed.",
  },
  {
    id: "furnace-95afue-il",
    label: "95 AFUE gas furnace, Illinois (Midwest)",
    inputs: { systemType: "furnace", seer: 95, tons: 0, region: "midwest", ductworkCond: "good" },
    band: { low: 5500, high: 9500 },
    sources: "HomeAdvisor 2026 95% AFUE installed $5.5k-9.5k Midwest.",
  },
  {
    id: "mini-3zone-ca",
    label: "Mini-split 3-zone, California (West labor)",
    inputs: { systemType: "mini_split", seer: 18, tons: 3, region: "west", ductworkCond: "good" },
    band: { low: 11500, high: 18500 },
    sources: "HomeGuide 2026 3-zone $9.5k-15.5k base, +CA labor 1.22x.",
  },
  {
    id: "full-4ton-16-90-tx",
    label: "Full system 4-ton 16 SEER + 90 AFUE, Texas",
    inputs: { systemType: "full_system", seer: 16, tons: 4, region: "south", ductworkCond: "good" },
    band: { low: 14000, high: 21000 },
    sources: "HomeGuide 2026 full-system 4-ton mid-eff $14k-20k installed.",
  },
];

function runSpec(spec) {
  const price = HvacCalc.calcBenchmark(Object.assign({}, spec.inputs, {
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

  console.log("HVAC calculator spot-check — 2026 industry-anchored bands");
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
