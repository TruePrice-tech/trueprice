// Moving calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const Calc = require("../../js/moving-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TI = 1.0, TS = 1.0;

const SPECS = [
  { id: "local-2br-under50-none-nc", label: "Local 2BR <50mi NC", inputs: { moveType: "local", homeSize: "2br", distance: "under_50", packing: "none", specialItems: "none", region: "southeast" }, band: { low: 1200, high: 2000 }, sources: "HomeGuide / Forbes / Modernize 2026 local 2BR $0.8-1.5k national post-pandemic; SE 1.03x lands NC at $1.2-2k. Calc upper-mid of range." },
  { id: "ld-3br-1000plus-partial-ca-piano", label: "Long-distance 3BR 1000+mi partial CA +piano", inputs: { moveType: "long_distance", homeSize: "3br", distance: "1000_plus", packing: "partial", specialItems: "piano", region: "west" }, band: { low: 11000, high: 22000 }, sources: "HomeGuide / Forbes / Modernize 2026 cross-country 3BR $8-14k national; CA 1.22x + piano + partial-pack add-ons land $11-22k." },
  { id: "local-4brplus-50to250-full-ny-hottub", label: "Local 4BR+ 50-250mi full NY +hot tub", inputs: { moveType: "local", homeSize: "4br_plus", distance: "50_250", packing: "full", specialItems: "hot_tub", region: "northeast" }, band: { low: 5000, high: 10000 }, sources: "Modernize 2026 local 4BR+ NY full pack + hot tub." },
  { id: "samebld-2br-under50-mw", label: "Same-building 2BR MW", inputs: { moveType: "same_building", homeSize: "2br", distance: "under_50", packing: "none", specialItems: "none", region: "midwest" }, band: { low: 400, high: 1200 }, sources: "Angi 2026 same-building $400-1k." },
  { id: "office-under50-tx", label: "Office move under_50 TX", inputs: { moveType: "office", homeSize: "office", distance: "under_50", packing: "none", specialItems: "none", region: "south" }, band: { low: 3000, high: 6500 }, sources: "Office moving 2BR-equiv $3-6k." },
];

function runSpec(spec) {
  const out = Calc.calcMovingEstimate(Object.assign({}, spec.inputs, { inflationMult: TI, seasonalMult: TS }));
  const failures = [];
  if (!out) { failures.push("calc-error"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TI, seasonalMult: TS, results: {} };
  let totalFails = 0;
  console.log("Moving calculator spot-check\n");
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
