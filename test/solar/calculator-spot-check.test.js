// Solar calculator spot-check harness — Layer 1 of pricing-realism gate.
const fs = require("fs");
const path = require("path");
const SolCalc = require("../../js/solar-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TEST_INFLATION_MULT = 1.0;

// Sources: NREL 2026 solar cost benchmark, EnergySage 2026, Modernize 2026, Forbes Home 2026.
// Note: solar pricing per watt has been relatively stable 2024-2026; ITC remains 30%.
const SPECS = [
  {
    id: "8kw-mid-string-none-ca-good",
    label: "8kW mid-tier, string inverter, no battery, CA, good roof",
    inputs: { systemKw: 8, panelTier: "mid", inverterType: "string", batteryType: "none", region: "west", roofCondition: "good" },
    band: { low: 22000, high: 38000 },
    sources: "EnergySage 2026 CA 8kW $24-32k typical mid-tier; NREL 2026.",
  },
  {
    id: "11kw-prem-micro-powerwall-ny",
    label: "11kW premium, microinverters, Tesla Powerwall, NY",
    inputs: { systemKw: 11, panelTier: "premium", inverterType: "microinverter", batteryType: "powerwall", region: "northeast", roofCondition: "good" },
    band: { low: 50000, high: 80000 },
    sources: "EnergySage 2026 11kW NY premium with battery $55-75k.",
  },
  {
    id: "5kw-budget-string-none-tx",
    label: "5kW budget, string inverter, no battery, TX",
    inputs: { systemKw: 5, panelTier: "budget", inverterType: "string", batteryType: "none", region: "south", roofCondition: "good" },
    band: { low: 10000, high: 18000 },
    sources: "Modernize 2026 5kW TX budget $11-16k.",
  },
  {
    id: "14kw-mid-optim-none-az-minor",
    label: "14kW mid, optimizers, no battery, AZ (West region), minor roof repair",
    inputs: { systemKw: 14, panelTier: "mid", inverterType: "optimizer", batteryType: "none", region: "west", roofCondition: "minor_repair" },
    band: { low: 45000, high: 68000 },
    sources: "EnergySage 2026 AZ 14kW mid $42-58k + 5% roof uplift.",
  },
  {
    id: "8kw-prem-micro-enphase-ne-major",
    label: "8kW premium, micro, Enphase IQ battery, NE, major roof work",
    inputs: { systemKw: 8, panelTier: "premium", inverterType: "microinverter", batteryType: "enphase_iq", region: "northeast", roofCondition: "significant_work" },
    band: { low: 45000, high: 75000 },
    sources: "EnergySage 2026 NE 8kW premium + battery + roof work.",
  },
];

function runSpec(spec) {
  const out = SolCalc.calcSolarEstimate(Object.assign({}, spec.inputs, { inflationMult: TEST_INFLATION_MULT }));
  const failures = [];
  if (!out) { failures.push("calc-error: returned null"); return { total: null, failures }; }
  if (out.total < spec.band.low) failures.push(`band-low: $${out.total} below $${spec.band.low}`);
  else if (out.total > spec.band.high) failures.push(`band-high: $${out.total} above $${spec.band.high}`);
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TEST_INFLATION_MULT, results: {} };
  let totalFails = 0;
  console.log("Solar calculator spot-check\n");
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
