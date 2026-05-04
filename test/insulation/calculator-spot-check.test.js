// Insulation calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const InsCalc = require("../../js/insulation-calc.js");

const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TEST_INFLATION_MULT = 1.0;
const TEST_SEASONAL_MULT = 1.0;

// Sources: HomeGuide 2026, Forbes Home 2026, Energy.gov 2026, Modernize 2026.
const SPECS = [
  {
    id: "blown-in-1500-attic-se-no-removal",
    label: "Blown-in attic, 1,500 sqft, SE, no old removal",
    inputs: { insType: "blown_in", sqft: 1500, region: "southeast", locationKey: "attic", removalIncluded: false },
    band: { low: 1500, high: 3500 },
    sources: "HomeGuide 2026 blown-in attic $0.90-2.30/sqft; mid 1.60 x 1500 ~ \$2.4k SE.",
  },
  {
    id: "spray-foam-closed-1000-walls-ne",
    label: "Closed-cell spray foam in walls, 1,000 sqft, NE",
    inputs: { insType: "spray_foam_closed", sqft: 1000, region: "northeast", locationKey: "walls", removalIncluded: false },
    band: { low: 3000, high: 7000 },
    sources: "HomeGuide 2026 closed-cell foam $2.50-5.50/sqft; NE labor 1.18x; walls 1.15x.",
  },
  {
    id: "batts-2000-attic-mw-with-removal",
    label: "Fiberglass batts attic, 2,000 sqft, MW, with old removal",
    inputs: { insType: "batts", sqft: 2000, region: "midwest", locationKey: "attic", removalIncluded: true },
    band: { low: 2500, high: 5500 },
    sources: "HomeGuide 2026 batts $0.80-2.00/sqft; MW 1.06x; removal 1.25x uplift.",
  },
  {
    id: "spray-foam-open-800-crawl-s",
    label: "Open-cell spray foam in crawl space, 800 sqft, S",
    inputs: { insType: "spray_foam_open", sqft: 800, region: "south", locationKey: "crawl_space", removalIncluded: false },
    band: { low: 1500, high: 4000 },
    sources: "HomeGuide 2026 open-cell foam $1.50-3.50/sqft; crawl 1.20x.",
  },
  {
    id: "rigid-foam-1500-walls-w",
    label: "Rigid foam board in walls, 1,500 sqft, W",
    inputs: { insType: "rigid_foam", sqft: 1500, region: "west", locationKey: "walls", removalIncluded: false },
    band: { low: 3000, high: 6500 },
    sources: "HomeGuide 2026 rigid foam $1.20-3.20/sqft; W labor 1.22x; walls 1.15x.",
  },
];

function runSpec(spec) {
  const out = InsCalc.calcInsulationEstimate(Object.assign({}, spec.inputs, { inflationMult: TEST_INFLATION_MULT, seasonalMult: TEST_SEASONAL_MULT }));
  const failures = [];
  if (!out) { failures.push("calc-error: returned null"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TEST_INFLATION_MULT, seasonalMult: TEST_SEASONAL_MULT, results: {} };
  let totalFails = 0;
  console.log("Insulation calculator spot-check\n");
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
