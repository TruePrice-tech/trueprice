// Electrical calculator spot-check harness — Layer 1 of pricing-realism gate.

const fs = require("fs");
const path = require("path");
const ElecCalc = require("../../js/electrical-calc.js");

const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TEST_INFLATION_MULT = 1.0;
const TEST_SEASONAL_MULT = 1.0;

// Sources: HomeGuide 2026, Forbes Home 2026, Angi 2026, RewireRight 2026.
const SPECS = [
  {
    id: "panel-upgrade-2k-2000plus-se",
    label: "Panel upgrade 100A->200A, 2,000 sqft, 2000+ home, SE",
    inputs: { serviceType: "panel_upgrade", homeSqFt: 2000, homeAge: "2000_plus", region: "southeast" },
    band: { low: 1800, high: 4500 },
    sources: "HomeGuide 2026 panel upgrade 100A-to-200A $1.5-4.5k national; modest SE labor mult.",
  },
  {
    id: "whole-rewire-2k-pre1970-ne",
    label: "Whole-house rewire, 2,000 sqft, pre-1970 (knob-and-tube), NE",
    inputs: { serviceType: "whole_house_rewire", homeSqFt: 2000, homeAge: "pre1970", region: "northeast" },
    band: { low: 18000, high: 40000 },
    sources: "Forbes Home 2026 NE rewire $18-35k; pre-1970 knob/tube +25%.",
  },
  {
    id: "ev-charger-2000plus-w",
    label: "EV charger (Level 2) install, 2000+ home, West (CA)",
    inputs: { serviceType: "ev_charger", homeSqFt: 2000, homeAge: "2000_plus", region: "west" },
    band: { low: 1500, high: 4500 },
    sources: "HomeGuide 2026 L2 EV charger CA $1.5-4k; CA labor 1.22x mult.",
  },
  {
    id: "generator-whole-2k-2000plus-s",
    label: "Whole-home generator install, 2000+ home, South",
    inputs: { serviceType: "generator", homeSqFt: 2000, homeAge: "2000_plus", region: "south" },
    band: { low: 9000, high: 20000 },
    sources: "Angi 2026 whole-home generator install $10-18k national.",
  },
  {
    id: "circuit-addition-2k-2000plus-mw",
    label: "Circuit addition, 2,000 sqft, 2000+ home, Midwest",
    inputs: { serviceType: "circuit_addition", homeSqFt: 2000, homeAge: "2000_plus", region: "midwest" },
    band: { low: 750, high: 2500 },
    sources: "HomeGuide 2026 circuit addition $180-450 per circuit; ~4 circuits for 2k sqft.",
  },
  {
    id: "outlet-switch-2k-1970_1999-mt",
    label: "Outlet/switch replacement, 2,000 sqft, 1970-1999 home, Mountain",
    inputs: { serviceType: "outlet_switch", homeSqFt: 2000, homeAge: "1970_1999", region: "mountain" },
    band: { low: 180, high: 500 },
    sources: "HomeGuide 2026 outlet replacement $180-350; 1970-1999 +10%.",
  },
];

function runSpec(spec) {
  const out = ElecCalc.calcElectricalEstimate(Object.assign({}, spec.inputs, { inflationMult: TEST_INFLATION_MULT, seasonalMult: TEST_SEASONAL_MULT }));
  const failures = [];
  if (!out) { failures.push("calc-error: returned null"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TEST_INFLATION_MULT, seasonalMult: TEST_SEASONAL_MULT, results: {} };
  let totalFails = 0;
  console.log("Electrical calculator spot-check — 2026 industry-anchored bands\n");
  for (const spec of SPECS) {
    process.stdout.write(`  ${spec.id} ... `);
    const { total, failures } = runSpec(spec);
    out.results[spec.id] = { total, band: spec.band, label: spec.label, failures };
    if (failures.length) { totalFails += failures.length; console.log(`FAIL ($${total}, band $${spec.band.low}-$${spec.band.high})`); failures.forEach(f => console.log("     - " + f)); console.log("     " + spec.sources); }
    else console.log(`OK ($${total}, band $${spec.band.low}-$${spec.band.high})`);
  }
  if (IS_BASELINE) { fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2)); console.log("\nBaseline:", BASELINE_PATH); console.log(`Total failures: ${totalFails}`); process.exit(0); return; }
  function failureSubject(msg) { const m = msg.match(/^(band-low|band-high|calc-error):/); return m ? m[1] : msg.split(":")[0].trim(); }
  let newFails = 0;
  if (fs.existsSync(BASELINE_PATH)) {
    const base = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    const nf = [], np = [];
    for (const id of Object.keys(out.results)) {
      const before = (base.results[id]?.failures || []).map(failureSubject);
      const after = (out.results[id]?.failures || []).map(failureSubject);
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
