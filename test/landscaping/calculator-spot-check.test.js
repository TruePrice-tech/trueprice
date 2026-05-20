// Landscaping calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const Calc = require("../../js/landscaping-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TI = 1.0, TS = 1.0;

const SPECS = [
  { id: "paver-400-mod-mid-nc", label: "Paver patio 400 sqft mod mid NC", inputs: { projectType: "paver_patio", size: 400, region: "southeast", complexity: "moderate", qualityTier: "mid" }, band: { low: 6000, high: 14000 }, sources: "HomeGuide / Forbes / Modernize 2026 400-sqft paver patio $6-14k national; NC 1.03x = national equivalent. Industry has come down from 2026-05-04 calibration." },
  { id: "sod-5000-basic-mid-tx", label: "Sod 5000 sqft basic mid TX", inputs: { projectType: "sod_installation", size: 5000, region: "south", complexity: "basic", qualityTier: "mid" }, band: { low: 5000, high: 13000 }, sources: "Forbes 2026 sod $1.10-2.60/sqft." },
  { id: "outdoor-kitchen-complex-prem-ca", label: "Outdoor kitchen complex prem CA", inputs: { projectType: "outdoor_kitchen", region: "west", complexity: "complex", qualityTier: "premium" }, band: { low: 30000, high: 80000 }, sources: "HomeGuide / Forbes / Modernize 2026 premium outdoor kitchen $25-80k national; CA 1.22x + complex lands $30-80k. Calc $45k in middle." },
  { id: "retaining-wall-200-mod-prem-ne", label: "Retaining wall 200 sqft face mod prem NE", inputs: { projectType: "retaining_wall", size: 200, region: "northeast", complexity: "moderate", qualityTier: "premium" }, band: { low: 10000, high: 22000 }, sources: "HomeGuide 2026 retaining wall $25-55/sqft + NE 1.18x + prem 1.55x." },
  { id: "tree-removal-basic-budget-mw", label: "Tree removal basic budget MW", inputs: { projectType: "tree_removal", region: "midwest", complexity: "basic", qualityTier: "budget" }, band: { low: 500, high: 2000 }, sources: "Angi 2026 tree removal $500-2k." },
];

function runSpec(spec) {
  const out = Calc.calcLandscapingEstimate(Object.assign({}, spec.inputs, { inflationMult: TI, seasonalMult: TS }));
  const failures = [];
  if (!out) { failures.push("calc-error"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TI, seasonalMult: TS, results: {} };
  let totalFails = 0;
  console.log("Landscaping calculator spot-check\n");
  for (const spec of SPECS) {
    process.stdout.write(`  ${spec.id} ... `);
    const { total, failures } = runSpec(spec);
    out.results[spec.id] = { total, band: spec.band, label: spec.label, failures };
    if (failures.length) { totalFails += failures.length; console.log(`FAIL ($${total})`); failures.forEach(f => console.log("     - " + f)); }
    else console.log(`OK ($${total}, band $${spec.band.low}-$${spec.band.high})`);
  }
  if (IS_BASELINE) { fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2)); console.log("\nBaseline:", BASELINE_PATH); console.log(`Total failures: ${totalFails}`); process.exit(0); return; }
  function fs2(msg) { const m = msg.match(/^(band-low|band-high|calc-error)/); return m ? m[1] : msg.split(":")[0].trim(); }
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
