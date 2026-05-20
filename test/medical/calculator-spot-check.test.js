// Medical calculator spot-check harness — Layer 1 of pricing-realism gate.
// Note: medical asserts patient-responsibility band, not facility billed amount.
const fs = require("fs");
const path = require("path");
const Calc = require("../../js/medical-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TI = 1.0;

const SPECS = [
  { id: "er-moderate-insured-in-ne", label: "ER moderate visit, in-network insured, NE", inputs: { serviceType: "er", subType: "moderate", insuranceKey: "insured_in", region: "northeast" }, band: { low: 300, high: 1300 }, sources: "KFF / Peterson-KFF / HealthSystemTracker 2026 commercial-insured ER moderate TOTAL OOP $300-$1,200 national; NE 1.0x (no labor uplift on patient cost-sharing) lands $300-$1,300." },
  { id: "knee-replacement-medicare-mw", label: "Knee replacement, Medicare, MW", inputs: { serviceType: "surgery", subType: "knee_replacement", insuranceKey: "medicare", region: "midwest" }, band: { low: 2500, high: 10000 }, sources: "Medicare.gov / KFF / AHIP 2026 traditional-Medicare-no-Medigap knee replacement TOTAL OOP $2.5-$8k national; MW PT/SNF variance lands $2.5-$10k." },
  { id: "mri-brain-self-pay-w", label: "MRI brain self-pay, W", inputs: { serviceType: "imaging", subType: "mri_brain", insuranceKey: "self_pay", region: "west" }, band: { low: 600, high: 2400 }, sources: "Hospital chargemaster 2026 self-pay MRI $600-2.4k." },
  { id: "crown-insured-in-se", label: "Dental crown insured-in, SE", inputs: { serviceType: "dental", subType: "crown", insuranceKey: "insured_in", region: "southeast" }, band: { low: 150, high: 600 }, sources: "Delta Dental 2026 crown 50% coinsurance $200-500." },
  { id: "vaginal-epidural-out-of-net-s", label: "Vaginal birth + epidural out-of-network insured, S", inputs: { serviceType: "childbirth", subType: "vaginal_epidural", insuranceKey: "insured_out", region: "south" }, band: { low: 4000, high: 13000 }, sources: "Kaiser Family Foundation 2026 OON birth $5-12k OOP." },
];

function runSpec(spec) {
  const out = Calc.calcMedicalEstimate(Object.assign({}, spec.inputs, { inflationMult: TI }));
  const failures = [];
  if (!out) { failures.push("calc-error"); return { patientLow: null, patientHigh: null, failures }; }
  if (out.patientHigh < spec.band.low) failures.push(`band-low: patient $${out.patientLow}-$${out.patientHigh} below $${spec.band.low}`);
  else if (out.patientLow > spec.band.high) failures.push(`band-high: patient $${out.patientLow}-$${out.patientHigh} above $${spec.band.high}`);
  return { patientLow: out.patientLow, patientHigh: out.patientHigh, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TI, results: {} };
  let totalFails = 0;
  console.log("Medical calculator spot-check (patient responsibility)\n");
  for (const spec of SPECS) {
    process.stdout.write(`  ${spec.id} ... `);
    const { patientLow, patientHigh, failures } = runSpec(spec);
    out.results[spec.id] = { patientLow, patientHigh, band: spec.band, label: spec.label, failures };
    if (failures.length) { totalFails += failures.length; console.log(`FAIL ($${patientLow}-$${patientHigh})`); failures.forEach(f => console.log("     - " + f)); }
    else console.log(`OK ($${patientLow}-$${patientHigh}, band $${spec.band.low}-$${spec.band.high})`);
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
