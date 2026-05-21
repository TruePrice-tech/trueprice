// Gutters calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const Calc = require("../../js/gutters-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TI = 1.0, TS = 1.0;

const SPECS = [
  { id: "alum-seamless-150-1story-se", label: "Aluminum seamless 150lf 1-story, SE", inputs: { gutterType: "aluminum_seamless", linearFeet: 150, stories: "1", addGuards: false, region: "southeast" }, band: { low: 1000, high: 1800 }, sources: "HomeGuide / Forbes / Modernize / Angi 2026 alum seamless 5\" $6-12/lf = $900-1.8k for 150lf; SE 1.03x ~= national." },
  { id: "alum-6inch-200-2story-ne-guards", label: "Aluminum 6\" 200lf 2-story, NE, +guards", inputs: { gutterType: "aluminum_6inch", linearFeet: 200, stories: "2", addGuards: true, region: "northeast" }, band: { low: 5500, high: 12000 }, sources: "Forbes 2026 6\" alum + guards 200lf 2-story NE." },
  { id: "vinyl-100-1story-tx", label: "Vinyl 100lf 1-story, TX, no guards", inputs: { gutterType: "vinyl", linearFeet: 100, stories: "1", addGuards: false, region: "south" }, band: { low: 400, high: 1000 }, sources: "HomeGuide 2026 vinyl gutters $4-8/lf." },
  { id: "copper-80-2story-ca-guards", label: "Copper 80lf 2-story, CA, +guards", inputs: { gutterType: "copper", linearFeet: 80, stories: "2", addGuards: true, region: "west" }, band: { low: 3500, high: 8000 }, sources: "HomeGuide / Forbes / Modernize 2026 copper $25-74/lf = $2-6k national 80lf; CA 1.22x + 2-story + guards add-ons land $3.5-8k." },
  { id: "steel-150-1story-mw-guards", label: "Steel 150lf 1-story, MW, +guards", inputs: { gutterType: "steel", linearFeet: 150, stories: "1", addGuards: true, region: "midwest" }, band: { low: 2500, high: 5500 }, sources: "Angi 2026 steel + guards 150lf MW." },
];

function runSpec(spec) {
  const out = Calc.calcGuttersEstimate(Object.assign({}, spec.inputs, { inflationMult: TI, seasonalMult: TS }));
  const failures = [];
  if (!out) { failures.push("calc-error"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TI, seasonalMult: TS, results: {} };
  let totalFails = 0;
  console.log("Gutters calculator spot-check\n");
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
