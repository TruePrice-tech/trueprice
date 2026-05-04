// Painting calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const PntCalc = require("../../js/painting-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TEST_INFLATION_MULT = 1.0;
const TEST_SEASONAL_MULT = 1.0;

const SPECS = [
  {
    id: "ext-std-2000-mid-good-nc",
    label: "Exterior standard 2,000 sqft, mid-range paint, good condition, NC",
    inputs: { projectType: "exterior", sqft: 2000, paintQuality: "standard", condition: "good", brandTier: "mid", region: "southeast" },
    band: { low: 4000, high: 9000 },
    sources: "HomeGuide 2026 exterior 2k sqft $4-9k.",
  },
  {
    id: "int-prem-2500-ultra-fair-ny",
    label: "Interior premium 2,500 sqft, ultra-premium paint, fair condition, NY",
    inputs: { projectType: "interior", sqft: 2500, paintQuality: "premium", condition: "fair", brandTier: "ultra", region: "northeast" },
    band: { low: 12000, high: 25000 },
    sources: "Forbes Home 2026 interior NY ultra-premium $12-25k.",
  },
  {
    id: "cabinets-builder-mw",
    label: "Cabinet painting, builder grade, MW",
    inputs: { projectType: "cabinets", brandTier: "builder", region: "midwest", condition: "good" },
    band: { low: 3000, high: 7000 },
    sources: "HomeGuide 2026 cabinet repaint $3-7k.",
  },
  {
    id: "both-2000-mid-good-tx",
    label: "Both exterior + interior 2,000 sqft, mid paint, good, TX",
    inputs: { projectType: "both", sqft: 2000, paintQuality: "standard", condition: "good", brandTier: "mid", region: "south" },
    band: { low: 7000, high: 15000 },
    sources: "Angi 2026 ext+int combo $7-15k national.",
  },
  {
    id: "ext-prem-1500-prem-poor-ca",
    label: "Exterior premium 1,500 sqft, premium paint, poor condition, CA",
    inputs: { projectType: "exterior", sqft: 1500, paintQuality: "premium", condition: "poor", brandTier: "premium", region: "west" },
    band: { low: 9000, high: 20000 },
    sources: "Forbes Home 2026 CA exterior premium + poor + 2-coat $10-20k.",
  },
];

function runSpec(spec) {
  const out = PntCalc.calcPaintingEstimate(Object.assign({}, spec.inputs, { inflationMult: TEST_INFLATION_MULT, seasonalMult: TEST_SEASONAL_MULT }));
  const failures = [];
  if (!out) { failures.push("calc-error: returned null"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TEST_INFLATION_MULT, seasonalMult: TEST_SEASONAL_MULT, results: {} };
  let totalFails = 0;
  console.log("Painting calculator spot-check\n");
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
