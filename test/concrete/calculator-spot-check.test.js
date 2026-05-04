// Concrete calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const Calc = require("../../js/concrete-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TI = 1.0, TS = 1.0;

const SPECS = [
  { id: "std-driveway-600-se", label: "Standard driveway 600 sqft, SE", inputs: { projectType: "standard_driveway", sqft: 600, region: "southeast" }, band: { low: 5000, high: 9000 }, sources: "HomeGuide 2026 driveway $8-15/sqft." },
  { id: "stamped-400-w", label: "Stamped concrete 400 sqft, W", inputs: { projectType: "stamped_concrete", sqft: 400, region: "west" }, band: { low: 5000, high: 9500 }, sources: "Forbes 2026 stamped $12-20/sqft + W 1.22x." },
  { id: "patio-800-demo-ny", label: "Patio 800 sqft + demo, NY", inputs: { projectType: "concrete_patio", sqft: 800, region: "northeast", demoMult: 1.20 }, band: { low: 9000, high: 18000 }, sources: "Angi 2026 patio + demo NE $9-16k." },
  { id: "sidewalk-200-thick-mw", label: "Sidewalk 200 sqft + thicker pour, MW", inputs: { projectType: "sidewalk", sqft: 200, region: "midwest", thicknessMult: 1.15 }, band: { low: 1500, high: 3500 }, sources: "HomeGuide 2026 sidewalk $8-14/sqft." },
  { id: "asphalt-600-s", label: "Asphalt driveway 600 sqft, S", inputs: { projectType: "asphalt_driveway", sqft: 600, region: "south" }, band: { low: 3000, high: 7000 }, sources: "HomeGuide 2026 asphalt drive $5-10/sqft." },
];

function runSpec(spec) {
  const out = Calc.calcConcreteEstimate(Object.assign({}, spec.inputs, { inflationMult: TI, seasonalMult: TS }));
  const failures = [];
  if (!out) { failures.push("calc-error"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TI, seasonalMult: TS, results: {} };
  let totalFails = 0;
  console.log("Concrete calculator spot-check\n");
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
