// Fencing calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const Calc = require("../../js/fencing-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TI = 1.0, TS = 1.0;

const SPECS = [
  { id: "wood-150-6ft-gate-nc", label: "Wood privacy 150 lf 6ft +gate, NC", inputs: { fenceType: "wood_privacy", linearFeet: 150, height: "6", includesGate: true, region: "southeast" }, band: { low: 4000, high: 8000 }, sources: "HomeGuide 2026 wood privacy $22-45/lf." },
  { id: "chain-200-4ft-tx", label: "Chain link 200 lf 4ft no gate, TX", inputs: { fenceType: "chain_link", linearFeet: 200, height: "4", includesGate: false, region: "south" }, band: { low: 1500, high: 5000 }, sources: "HomeGuide 2026 chain link $8-25/lf." },
  { id: "vinyl-100-6ft-gate-ny", label: "Vinyl privacy 100 lf 6ft +gate, NY", inputs: { fenceType: "vinyl_privacy", linearFeet: 100, height: "6", includesGate: true, region: "northeast" }, band: { low: 4500, high: 9500 }, sources: "Forbes Home 2026 vinyl privacy $35-80/lf + NY 1.18x." },
  { id: "iron-80-6ft-gate-ca", label: "Wrought iron 80 lf 6ft +gate, CA", inputs: { fenceType: "wrought_iron", linearFeet: 80, height: "6", includesGate: true, region: "west" }, band: { low: 5000, high: 11000 }, sources: "Modernize 2026 wrought iron $42-100/lf + W 1.22x." },
  { id: "cedar-120-8ft-gate-mw", label: "Cedar privacy 120 lf 8ft +gate, MW", inputs: { fenceType: "cedar", linearFeet: 120, height: "8", includesGate: true, region: "midwest" }, band: { low: 5000, high: 11000 }, sources: "Angi 2026 cedar 8ft $30-60/lf x 1.25 height." },
];

function runSpec(spec) {
  const out = Calc.calcFencingEstimate(Object.assign({}, spec.inputs, { inflationMult: TI, seasonalMult: TS }));
  const failures = [];
  if (!out) { failures.push("calc-error"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TI, seasonalMult: TS, results: {} };
  let totalFails = 0;
  console.log("Fencing calculator spot-check\n");
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
