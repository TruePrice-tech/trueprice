// Legal calculator spot-check harness — Layer 1 of pricing-realism gate.
// Note: contingency cases assert percentage band (33-40%), not dollar.
const fs = require("fs");
const path = require("path");
const Calc = require("../../js/legal-calc.js");
const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");
const TI = 1.0;

const SPECS = [
  { id: "uncontested-divorce-simple-se", label: "Uncontested divorce simple SE", inputs: { serviceType: "divorce", subType: "uncontested", complexity: "simple", region: "southeast" }, band: { low: 1000, high: 4000 }, sources: "Martindale / LegalZoom / ABA / Avvo / Justia 2026 uncontested divorce $1-4k national typical; SE 1.0x ~= national." },
  { id: "auto-accident-contingency", label: "Auto accident contingency (% band)", inputs: { serviceType: "personal_injury", subType: "auto_accident", complexity: "simple", region: "south" }, isPct: true, band: { low: 30, high: 45 }, sources: "ABA 2026 personal injury 33-40% contingency." },
  { id: "basic-will-simple-se", label: "Basic will simple SE", inputs: { serviceType: "estate_planning", subType: "basic_will", complexity: "simple", region: "southeast" }, band: { low: 350, high: 2500 }, sources: "LegalZoom/Avvo 2026 basic will $500-1.5k." },
  { id: "chapter-7-simple-s", label: "Chapter 7 bankruptcy simple S", inputs: { serviceType: "bankruptcy", subType: "chapter_7", complexity: "simple", region: "south" }, band: { low: 1000, high: 2000 }, sources: "Justia / Nolo / LegalZoom / ABA / Avvo 2026 Chapter 7 typical $1-2k national central tendency; S 1.0x = national." },
  { id: "dui-moderate-mw", label: "DUI defense moderate MW", inputs: { serviceType: "criminal_defense", subType: "dui", complexity: "moderate", region: "midwest" }, band: { low: 2500, high: 20000 }, sources: "Avvo 2026 DUI moderate defense $3-15k." },
  { id: "llc-formation-simple-w", label: "LLC formation simple W", inputs: { serviceType: "business_formation", subType: "llc", complexity: "simple", region: "west" }, band: { low: 500, high: 3000 }, sources: "LegalZoom 2026 LLC formation CA $500-2.5k." },
];

function runSpec(spec) {
  const out = Calc.calcLegalEstimate(Object.assign({}, spec.inputs, { inflationMult: TI }));
  const failures = [];
  if (!out) { failures.push("calc-error"); return { low: null, high: null, failures }; }
  if (spec.isPct && !out.isContingency) failures.push(`expected-contingency: spec marked pct but calc returned dollar`);
  if (out.high < spec.band.low) failures.push(`band-low: $${out.low}-$${out.high} below $${spec.band.low}`);
  else if (out.low > spec.band.high) failures.push(`band-high: $${out.low}-$${out.high} above $${spec.band.high}`);
  return { low: out.low, high: out.high, isContingency: out.isContingency, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TI, results: {} };
  let totalFails = 0;
  console.log("Legal calculator spot-check\n");
  for (const spec of SPECS) {
    process.stdout.write(`  ${spec.id} ... `);
    const { low, high, isContingency, failures } = runSpec(spec);
    out.results[spec.id] = { low, high, isContingency, band: spec.band, label: spec.label, failures };
    var unit = isContingency ? "%" : "$";
    if (failures.length) { totalFails += failures.length; console.log(`FAIL (${unit}${low}-${unit}${high})`); failures.forEach(f => console.log("     - " + f)); }
    else console.log(`OK (${unit}${low}-${unit}${high}, band ${unit}${spec.band.low}-${unit}${spec.band.high})`);
  }
  if (IS_BASELINE) { fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2)); console.log("\nBaseline:", BASELINE_PATH); console.log(`Total failures: ${totalFails}`); process.exit(0); return; }
  function fs2(msg) { const m = msg.match(/^(band-low|band-high|calc-error|expected-contingency)/); return m ? m[1] : msg.split(":")[0].trim(); }
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
