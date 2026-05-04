// Windows calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const WinCalc = require("../../js/window-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TEST_INFLATION_MULT = 1.0;

const SPECS = [
  {
    id: "10vinyl-mid-doublehung-lowe-pocket-nc",
    label: "10 vinyl mid double-hung double-Lowe pocket NC (count 9-15)",
    inputs: { material: "vinyl", brandTier: "mid", style: "double-hung", glass: "double-lowe", install: "pocket", count: "9-15", stateCode: "NC" },
    band: { low: 5500, high: 12000 },
    sources: "HomeGuide 2026 vinyl mid 10 windows $5.5-12k typical.",
  },
  {
    id: "6fiberglass-prem-casement-triple-fullframe-ny",
    label: "6 fiberglass premium casement triple fullframe NY (count 4-8)",
    inputs: { material: "fiberglass", brandTier: "premium", style: "casement", glass: "triple", install: "fullframe", count: "4-8", stateCode: "NY" },
    band: { low: 12000, high: 25000 },
    sources: "Forbes Home 2026 NY premium fiberglass casement + triple + fullframe $14-22k.",
  },
  {
    id: "20vinyl-value-doublehung-std-pocket-tx",
    label: "20 vinyl value double-hung double-standard pocket TX (count 16+)",
    inputs: { material: "vinyl", brandTier: "value", style: "double-hung", glass: "double-standard", install: "pocket", count: "16+", stateCode: "TX" },
    band: { low: 4500, high: 10000 },
    sources: "HomeGuide 2026 budget vinyl 16+ windows $4.5-10k.",
  },
  {
    id: "2woodclad-luxury-baybow-triple-fullframe-ma",
    label: "2 wood-clad luxury bay-bow triple fullframe MA (count 1-3)",
    inputs: { material: "wood-clad", brandTier: "luxury", style: "bay-bow", glass: "triple", install: "fullframe", count: "1-3", stateCode: "MA" },
    band: { low: 14000, high: 32000 },
    sources: "Forbes Home 2026 MA luxury wood-clad bay/bow $15-30k for 2 windows.",
  },
  {
    id: "12composite-mid-sliding-lowe-pocket-ca",
    label: "12 composite mid sliding double-Lowe pocket CA (count 9-15)",
    inputs: { material: "composite", brandTier: "mid", style: "sliding", glass: "double-lowe", install: "pocket", count: "9-15", stateCode: "CA" },
    band: { low: 7000, high: 14000 },
    sources: "HomeGuide 2026 CA composite mid sliding 12 windows $7-14k.",
  },
];

function runSpec(spec) {
  const out = WinCalc.calcWindowEstimate(Object.assign({}, spec.inputs, { inflationMult: TEST_INFLATION_MULT }));
  const failures = [];
  if (!out) { failures.push("calc-error: returned null"); return { totalMid: null, failures }; }
  if (out.totalMid < spec.band.low) failures.push(`band-low: $${out.totalMid} below $${spec.band.low}`);
  else if (out.totalMid > spec.band.high) failures.push(`band-high: $${out.totalMid} above $${spec.band.high}`);
  return { totalMid: out.totalMid, totalLow: out.totalLow, totalHigh: out.totalHigh, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TEST_INFLATION_MULT, results: {} };
  let totalFails = 0;
  console.log("Windows calculator spot-check\n");
  for (const spec of SPECS) {
    process.stdout.write(`  ${spec.id} ... `);
    const { totalMid, totalLow, totalHigh, failures } = runSpec(spec);
    out.results[spec.id] = { totalMid, totalLow, totalHigh, band: spec.band, label: spec.label, failures };
    if (failures.length) { totalFails += failures.length; console.log(`FAIL ($${totalMid})`); failures.forEach(f => console.log("     - " + f)); }
    else console.log(`OK ($${totalMid}, band $${spec.band.low}-$${spec.band.high})`);
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
