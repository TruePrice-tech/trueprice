// Siding calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const SidCalc = require("../../js/siding-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TEST_INFLATION_MULT = 1.0;
const TEST_SEASONAL_MULT = 1.0;

// Sources: HomeGuide 2026, Forbes Home 2026, Modernize 2026, Angi 2026.
const SPECS = [
  {
    id: "vinyl-1500-1story-good-nc",
    label: "Vinyl 1,500 sqft 1-story good, NC",
    inputs: { sidingType: "vinyl", wallSqft: 1500, stories: "1", condition: "good", region: "southeast" },
    band: { low: 5000, high: 12000 },
    sources: "HomeGuide / Forbes / Modernize / Angi 2026 vinyl $3-8/sqft = $5-12k for 1500sqft 1-story; SE 1.03x ~= national.",
  },
  {
    id: "hardie-2000-2story-fair-mw",
    label: "Fiber cement (Hardie) 2,000 sqft 2-story fair, MW",
    inputs: { sidingType: "fiber_cement", wallSqft: 2000, stories: "2", condition: "fair", region: "midwest" },
    band: { low: 20000, high: 36000 },
    sources: "HomeGuide / Forbes / Modernize / Angi 2026 Hardie $7-13/sqft = $15-26k national 2k sqft; MW 1.06x x 2-story 1.15x x fair 1.15x lands $21-36k. Calc $30,850 inside.",
  },
  {
    id: "wood-1500-2story-good-ne",
    label: "Wood siding 1,500 sqft 2-story good, NE",
    inputs: { sidingType: "wood", wallSqft: 1500, stories: "2", condition: "good", region: "northeast" },
    band: { low: 14000, high: 25000 },
    sources: "HomeGuide 2026 wood $7-12/sqft; 2-story 1.15x; NE 1.18x.",
  },
  {
    id: "stone-800-1story-good-ca",
    label: "Stone veneer 800 sqft 1-story good, CA",
    inputs: { sidingType: "stone_veneer", wallSqft: 800, stories: "1", condition: "good", region: "west" },
    band: { low: 14000, high: 30000 },
    sources: "Modernize 2026 stone veneer $15-30/sqft; W 1.22x.",
  },
  {
    id: "engwood-2500-3story-poor-tx",
    label: "Engineered wood 2,500 sqft 3-story poor condition, TX",
    inputs: { sidingType: "engineered_wood", wallSqft: 2500, stories: "3", condition: "poor", region: "south" },
    band: { low: 25000, high: 50000 },
    sources: "HomeGuide 2026 LP SmartSide $6-10/sqft; 3-story 1.30x; poor 1.35x.",
  },
];

function runSpec(spec) {
  const out = SidCalc.calcSidingEstimate(Object.assign({}, spec.inputs, { inflationMult: TEST_INFLATION_MULT, seasonalMult: TEST_SEASONAL_MULT }));
  const failures = [];
  if (!out) { failures.push("calc-error: returned null"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TEST_INFLATION_MULT, seasonalMult: TEST_SEASONAL_MULT, results: {} };
  let totalFails = 0;
  console.log("Siding calculator spot-check\n");
  for (const spec of SPECS) {
    process.stdout.write(`  ${spec.id} ... `);
    const { total, failures } = runSpec(spec);
    out.results[spec.id] = { total, band: spec.band, label: spec.label, failures };
    if (failures.length) { totalFails += failures.length; console.log(`FAIL ($${total})`); failures.forEach(f => console.log("     - " + f)); }
    else console.log(`OK ($${total}, band $${spec.band.low}-$${spec.band.high})`);
  }
  if (IS_BASELINE) { fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2)); console.log("\nBaseline:", BASELINE_PATH); console.log(`Total failures: ${totalFails}`); process.exit(0); return; }
  function fs2(msg) { const m = msg.match(/^(band-low|band-high|calc-error):/); return m ? m[1] : msg.split(":")[0].trim(); }
  let newFails = 0;
  if (fs.existsSync(BASELINE_PATH)) {
    const base = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    const nf = [], np = [];
    for (const id of Object.keys(out.results)) {
      const before = (base.results[id]?.failures || []).map(fs2);
      const after = (out.results[id]?.failures || []).map(fs2);
      const bs = new Set(before), as = new Set(after);
      after.forEach(s => { if (!bs.has(s)) nf.push(`${id}: ${s}`); });
      before.forEach(s => { if (!as.has(s)) np.push(`${id}: ${s}`); });
    }
    newFails = nf.length;
    if (np.length) { console.log("\nNEW PASSES:"); np.forEach(p => console.log("  + " + p)); }
    if (nf.length) { console.log("\nNEW FAILURES:"); nf.forEach(f => console.log("  - " + f)); }
    if (!np.length && !nf.length) console.log("\nNo deltas vs baseline.");
  }
  console.log(`\nTotal failures: ${totalFails}`);
  process.exit(fs.existsSync(BASELINE_PATH) ? (newFails > 0 ? 1 : 0) : (totalFails > 0 ? 1 : 0));
})();
