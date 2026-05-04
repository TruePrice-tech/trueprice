// Roofing calculator spot-check harness.
//
// Asserts that for each (sqft × material) tuple sourced from 2026 industry
// data, the /roof-cost-calculator midpoint output lands inside its band.
// Catches the same class of drift the HVAC spot-check (test/hvac/
// calculator-spot-check.test.js, shipped 2026-05-03) was built for — the
// fixture-truth harness only walks the upload/analyze path; this walks the
// input-form/calculator path.
//
// Pattern mirrors test/hvac/calculator-spot-check.test.js. Same baseline-
// diff exit-code semantics so CI's regression-gate.yml auto-discovers
// every test/*/calculator-spot-check.test.js the same way it auto-
// discovers fixture-truth harnesses.
//
// Run: node test/roofing/calculator-spot-check.test.js
// Run --baseline to write a baseline JSON snapshot of current results.
//
// Imports js/roofing-calc.js directly — no Puppeteer, no live-site
// dependency, runs in milliseconds.

const fs = require("fs");
const path = require("path");
const RoofingCalc = require("../../js/roofing-calc.js");

const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

// Industry-anchored 2026 mid-price bands for fully-installed roof
// replacement (tear-off + underlayment + shingles + standard accessories,
// no major decking repair). Bands target the calc's "midpoint" output —
// not the low/high range — because calc derives its own range
// multiplicatively from the same mid.
//
// Sources per spec inline. Refresh date: 2026-05-03.
// Sources used: Forbes Home 2026 roofing cost guide, HomeGuide 2026, This
// Old House 2026, Modernize 2026, Angi/HomeAdvisor 2026.
//
// Bands are wide on purpose — slope, complexity, and contractor variance
// add ~±25% spread on top of size/material. Tighten only when the flywheel
// has 50+ real quotes per (state, material, size).
const SPECS = [
  {
    id: "asphalt-1200sqft",
    label: "1,200 sqft small home, 3-tab asphalt shingles",
    inputs: { sqft: 1200, material: "asphalt" },
    band: { low: 3500, high: 8500 },
    sources: "HomeGuide 2026 1200-sqft 3-tab $3-8k; Forbes Home 2026.",
  },
  {
    id: "asphalt-1500sqft",
    label: "1,500 sqft typical small home, 3-tab asphalt",
    inputs: { sqft: 1500, material: "asphalt" },
    band: { low: 4500, high: 10500 },
    sources: "HomeGuide 2026 1500-sqft asphalt $4.5-10k; Modernize 2026.",
  },
  {
    id: "architectural-2000sqft",
    label: "2,000 sqft typical home, architectural shingles (most popular case)",
    inputs: { sqft: 2000, material: "architectural" },
    band: { low: 7500, high: 16500 },
    sources: "Forbes Home 2026 2000-sqft architectural $7.5-16k; This Old House 2026.",
  },
  {
    id: "architectural-2500sqft",
    label: "2,500 sqft larger home, architectural shingles",
    inputs: { sqft: 2500, material: "architectural" },
    band: { low: 9500, high: 20000 },
    sources: "HomeGuide 2026 2500-sqft architectural $9.5-20k; Angi 2026.",
  },
  {
    id: "metal-2000sqft",
    label: "2,000 sqft home, metal roofing (mix of corrugated + standing seam)",
    inputs: { sqft: 2000, material: "metal" },
    band: { low: 14000, high: 28000 },
    sources: "HomeGuide 2026 2000-sqft metal $14-28k; Forbes Home 2026 metal avg.",
  },
  {
    id: "metal-2500sqft",
    label: "2,500 sqft home, metal roofing",
    inputs: { sqft: 2500, material: "metal" },
    band: { low: 17500, high: 32000 },
    sources: "HomeGuide 2026 2500-sqft metal $17.5-32k; Modernize 2026.",
  },
  {
    id: "tile-2000sqft",
    label: "2,000 sqft home, tile roofing (concrete + clay average)",
    inputs: { sqft: 2000, material: "tile" },
    band: { low: 17000, high: 35000 },
    sources: "HomeGuide 2026 2000-sqft tile $17-35k; Forbes Home 2026.",
  },
  {
    id: "tile-3000sqft",
    label: "3,000 sqft home, tile roofing",
    inputs: { sqft: 3000, material: "tile" },
    band: { low: 25000, high: 50000 },
    sources: "HomeGuide 2026 3000-sqft tile $25-50k; This Old House 2026.",
  },
];

function runSpec(spec) {
  const out = RoofingCalc.calcRoofEstimate(spec.inputs);
  const failures = [];
  if (out.mid < spec.band.low) {
    failures.push(`band-low: mid $${out.mid} below low edge $${spec.band.low}`);
  } else if (out.mid > spec.band.high) {
    failures.push(`band-high: mid $${out.mid} above high edge $${spec.band.high}`);
  }
  return { mid: out.mid, low: out.low, high: out.high, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), results: {} };
  let totalFails = 0;

  console.log("Roofing calculator spot-check — 2026 industry-anchored bands\n");

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
