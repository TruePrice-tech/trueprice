// Garage Door calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const Calc = require("../../js/garage-door-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TI = 1.0;

const SPECS = [
  { id: "single-steel-basic-opener-nc", label: "Single car steel basic +opener NC", inputs: { serviceType: "single_car", materialKey: "steel_basic", includesOpener: "yes", region: "southeast" }, band: { low: 1200, high: 2200 }, sources: "HomeGuide 2026 single steel + opener $1.2-2.2k." },
  { id: "double-steel-insulated-opener-ny", label: "Double car steel insulated +opener NY", inputs: { serviceType: "double_car", materialKey: "steel_insulated", includesOpener: "yes", region: "northeast" }, band: { low: 2100, high: 5000 }, sources: "HomeGuide / Forbes / Modernize 2026 double insulated + opener $1.8-4.5k national; NY 1.18x lands $2.1-5k." },
  { id: "custom-wood-opener-ca", label: "Custom carriage wood +opener CA", inputs: { serviceType: "custom_carriage", materialKey: "wood", includesOpener: "yes", region: "west" }, band: { low: 5000, high: 9000 }, sources: "Modernize 2026 custom wood + W 1.22x." },
  { id: "spring-replacement-tx", label: "Spring replacement TX", inputs: { serviceType: "spring_replacement", region: "south" }, band: { low: 200, high: 500 }, sources: "Angi 2026 torsion spring $200-500." },
  { id: "opener-only-mw", label: "Opener only MW", inputs: { serviceType: "opener_only", region: "midwest" }, band: { low: 350, high: 800 }, sources: "HomeGuide 2026 opener replacement $350-700." },
];

function runSpec(spec) {
  const out = Calc.calcGarageDoorEstimate(Object.assign({}, spec.inputs, { inflationMult: TI }));
  const failures = [];
  if (!out) { failures.push("calc-error"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TI, results: {} };
  let totalFails = 0;
  console.log("Garage Door calculator spot-check\n");
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
