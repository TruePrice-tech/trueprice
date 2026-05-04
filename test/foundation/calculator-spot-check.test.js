// Foundation calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const FoundCalc = require("../../js/foundation-calc.js");

const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TEST_INFLATION_MULT = 1.0;

// Sources: HomeGuide 2026, Forbes Home 2026, Angi 2026, This Old House 2026.
const SPECS = [
  {
    id: "pier-moderate-1990plus-tx",
    label: "Pier installation, moderate (6 piers), 1990+ home, TX",
    inputs: { repairType: "pier_installation", severity: "moderate", homeAge: "1990_plus", region: "south" },
    band: { low: 6000, high: 14000 },
    sources: "HomeGuide 2026 6 piers $6-14k typical (TX expansive clay).",
  },
  {
    id: "crack-minor-1990plus-nc",
    label: "Crack repair, minor (2 cracks), 1990+ home, NC",
    inputs: { repairType: "crack_repair", severity: "minor", homeAge: "1990_plus", region: "southeast" },
    band: { low: 600, high: 2000 },
    sources: "HomeGuide 2026 minor crack repair $500-2k.",
  },
  {
    id: "slabjacking-moderate-pre1960-il",
    label: "Slabjacking moderate, pre-1960 home, IL",
    inputs: { repairType: "slabjacking", severity: "moderate", homeAge: "pre_1960", region: "midwest" },
    band: { low: 1000, high: 4000 },
    sources: "Angi 2026 slabjacking/mudjacking $500-2.5k typical; pre-1960 +25%.",
  },
  {
    id: "wall-stab-major-1960to89-ny",
    label: "Wall stabilization, major (carbon strap + brace), 1960-89 home, NY",
    inputs: { repairType: "wall_stabilization", severity: "major", homeAge: "1960_1989", region: "northeast" },
    band: { low: 12000, high: 25000 },
    sources: "Forbes Home 2026 wall stabilization NE $5-25k; major scope + age uplift.",
  },
  {
    id: "drainage-moderate-1990plus-ca",
    label: "Drainage correction, moderate, 1990+ home, CA",
    inputs: { repairType: "drainage_correction", severity: "moderate", homeAge: "1990_plus", region: "west" },
    band: { low: 3000, high: 8000 },
    sources: "HomeGuide 2026 french-drain / regrading $2-10k (CA labor 1.22x).",
  },
  {
    id: "pier-extensive-pre1960-co",
    label: "Pier installation extensive (16 piers), pre-1960 home, CO",
    inputs: { repairType: "pier_installation", severity: "extensive", homeAge: "pre_1960", region: "mountain" },
    band: { low: 18000, high: 40000 },
    sources: "Forbes Home 2026 extensive perimeter pier work $18-35k+; mountain region clay.",
  },
];

function runSpec(spec) {
  const out = FoundCalc.calcFoundationEstimate(Object.assign({}, spec.inputs, { inflationMult: TEST_INFLATION_MULT }));
  const failures = [];
  if (!out) { failures.push("calc-error: returned null"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TEST_INFLATION_MULT, results: {} };
  let totalFails = 0;
  console.log("Foundation calculator spot-check — 2026 industry-anchored bands\n");
  for (const spec of SPECS) {
    process.stdout.write(`  ${spec.id} ... `);
    const { total, failures } = runSpec(spec);
    out.results[spec.id] = { total, band: spec.band, label: spec.label, failures };
    if (failures.length) { totalFails += failures.length; console.log(`FAIL ($${total}, band $${spec.band.low}-$${spec.band.high})`); failures.forEach(f => console.log("     - " + f)); console.log("     " + spec.sources); }
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
    console.log("\n=== vs baseline ===");
    if (np.length) { console.log("NEW PASSES:"); np.forEach(p => console.log("  + " + p)); }
    if (nf.length) { console.log("NEW FAILURES:"); nf.forEach(f => console.log("  - " + f)); }
    if (!np.length && !nf.length) console.log("No deltas.");
  }
  console.log(`\nTotal failures: ${totalFails}`);
  process.exit(fs.existsSync(BASELINE_PATH) ? (newFails > 0 ? 1 : 0) : (totalFails > 0 ? 1 : 0));
})();
