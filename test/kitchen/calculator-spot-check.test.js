// Kitchen calculator spot-check harness — Layer 1 of the pricing-realism
// gate stack (see project_pricing_realism_gate_stack.md). Asserts that for
// each (tier x size x countertop x cabinet x appliance x state) tuple
// sourced from 2026 industry data, the kitchen calculator's totalMid lands
// inside its band. Pure Node, deterministic.
//
// Run: node test/kitchen/calculator-spot-check.test.js
// Run --baseline to write baseline snapshot.

const fs = require("fs");
const path = require("path");
const KitchenCalc = require("../../js/kitchen-calc.js");

const BASELINE_PATH = path.join(__dirname, "calculator-spot-check.baseline.json");
const IS_BASELINE = process.argv.includes("--baseline");

const TEST_INFLATION_MULT = 1.0;
const TEST_SEASONAL_MULT = 1.0;

// Industry-anchored 2026 mid-price bands. Sources: HomeGuide 2026, Forbes
// Home 2026, NKBA Cost vs Value 2024 (latest available), This Old House
// 2026, Modernize 2026. Pinned inflation/seasonal to 1.0 in tests so bands
// assert the underlying tables independent of when CI runs.
const SPECS = [
  {
    id: "minor-small-laminate-stock-existing-ga",
    label: "Minor cosmetic, small kitchen, laminate, stock cabinets, keep appliances, GA",
    inputs: { tier: "minor", sizeIdx: 0, countertopKey: "laminate", cabinetKey: "stock", applianceKey: "existing", region: "southeast" },
    band: { low: 8000, high: 18000 },
    sources: "HomeGuide 2026 minor cosmetic small kitchen $10-22k.",
  },
  {
    id: "midrange-average-granite-semi-mid-il",
    label: "Mid-range, average size, granite, semi-custom, mid-range appliances, IL",
    inputs: { tier: "midrange", sizeIdx: 1, countertopKey: "granite", cabinetKey: "semicustom", applianceKey: "midrange", region: "midwest" },
    band: { low: 42000, high: 70000 },
    sources: "HomeGuide 2026 midrange medium kitchen $25-60k; NKBA Cost vs Value $77k national.",
  },
  {
    id: "midrange-average-quartz-semi-mid-nc",
    label: "Mid-range, average size, quartz, semi-custom, mid-range appliances, NC",
    inputs: { tier: "midrange", sizeIdx: 1, countertopKey: "quartz", cabinetKey: "semicustom", applianceKey: "midrange", region: "southeast" },
    band: { low: 45000, high: 75000 },
    sources: "Forbes Home 2026 midrange + quartz upgrade $50-75k typical.",
  },
  {
    id: "midrange-large-quartz-custom-premium-ny",
    label: "Mid-range, large kitchen, quartz, custom cabinets, premium appliances, NY",
    inputs: { tier: "midrange", sizeIdx: 2, countertopKey: "quartz", cabinetKey: "custom", applianceKey: "premium", region: "northeast" },
    band: { low: 120000, high: 220000 },
    sources: "Corniel NYC 2026 Manhattan kitchen guide Upscale tier $120-250k; NKBA Cost vs Value 2024 NY metro upper-mid.",
  },
  {
    id: "major-large-quartzite-custom-premium-ny",
    label: "Major upscale, large, quartzite, custom, premium, NY (NYC luxury full custom)",
    inputs: { tier: "major", sizeIdx: 2, countertopKey: "quartzite", cabinetKey: "custom", applianceKey: "premium", region: "northeast" },
    band: { low: 200000, high: 400000 },
    sources: "Corniel NYC 2026 Manhattan kitchen guide Luxury/Full-Custom tier $200-400k+; Zonda 2025 CvV Major Upscale $164k national × NE region premium.",
  },
  {
    id: "major-expansive-marble-custom-premium-ca",
    label: "Major upscale, expansive (200+ sqft), marble, custom, premium, CA",
    inputs: { tier: "major", sizeIdx: 3, countertopKey: "marble", cabinetKey: "custom", applianceKey: "premium", region: "west" },
    band: { low: 250000, high: 500000 },
    sources: "CA high-cost market ~80-90% of NYC Luxury baseline (Corniel) × expansive (200+ sqft) size premium; Forbes Home 2026 CA upscale.",
  },
  {
    id: "refacing-average-granite-semi-existing-tx",
    label: "Cabinet refacing, average size, granite, semi-custom, keep appliances, TX",
    inputs: { tier: "cabinet_refacing", sizeIdx: 1, countertopKey: "granite", cabinetKey: "semicustom", applianceKey: "existing", region: "south" },
    band: { low: 5000, high: 15000 },
    sources: "HomeGuide 2026 cabinet refacing $5-15k typical.",
  },
];

function runSpec(spec) {
  const out = KitchenCalc.calcKitchenEstimate(Object.assign({}, spec.inputs, {
    inflationMult: TEST_INFLATION_MULT,
    seasonalMult: TEST_SEASONAL_MULT,
  }));
  const failures = [];
  if (!out) {
    failures.push("calc-error: calcKitchenEstimate returned null");
    return { total: null, failures };
  }
  if (out.total < spec.band.low) {
    failures.push(`band-low: total $${out.total} below low edge $${spec.band.low}`);
  } else if (out.total > spec.band.high) {
    failures.push(`band-high: total $${out.total} above high edge $${spec.band.high}`);
  }
  return { total: out.total, failures };
}

(function main() {
  const out = { ts: new Date().toISOString(), inflationMult: TEST_INFLATION_MULT, seasonalMult: TEST_SEASONAL_MULT, results: {} };
  let totalFails = 0;
  console.log("Kitchen calculator spot-check — 2026 industry-anchored bands");
  console.log("inflationMult=1.0 seasonalMult=1.0 cityMult=none calData=none\n");

  for (const spec of SPECS) {
    process.stdout.write(`  ${spec.id} ... `);
    const { total, failures } = runSpec(spec);
    out.results[spec.id] = { total, band: spec.band, label: spec.label, failures };
    if (failures.length) {
      totalFails += failures.length;
      console.log(`FAIL (total $${total}, band $${spec.band.low}-$${spec.band.high})`);
      failures.forEach(f => console.log(`     - ${f}`));
      console.log(`     sources: ${spec.sources}`);
    } else {
      console.log(`OK (total $${total}, band $${spec.band.low}-$${spec.band.high})`);
    }
  }

  if (IS_BASELINE) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2));
    console.log("\nBaseline written:", BASELINE_PATH);
    console.log(`\nTotal failures: ${totalFails}`);
    process.exit(0);
    return;
  }

  function failureSubject(msg) {
    const m = msg.match(/^(band-low|band-high|calc-error):/);
    return m ? m[1] : msg.split(":")[0].trim();
  }
  let newFailsCount = 0;
  if (fs.existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    const newFails = [];
    const newPasses = [];
    for (const id of Object.keys(out.results)) {
      const before = (baseline.results[id]?.failures || []).map(failureSubject);
      const after = (out.results[id]?.failures || []).map(failureSubject);
      const beforeSet = new Set(before);
      const afterSet = new Set(after);
      after.forEach(s => { if (!beforeSet.has(s)) newFails.push(`${id}: ${s}`); });
      before.forEach(s => { if (!afterSet.has(s)) newPasses.push(`${id}: ${s}`); });
    }
    newFailsCount = newFails.length;
    console.log("\n=== vs baseline ===");
    if (newPasses.length) { console.log("NEW PASSES:"); newPasses.forEach(p => console.log("  + " + p)); }
    if (newFails.length)  { console.log("NEW FAILURES:"); newFails.forEach(f => console.log("  - " + f)); }
    if (!newPasses.length && !newFails.length) console.log("No deltas vs baseline.");
  }

  console.log(`\nTotal failures: ${totalFails}`);
  if (fs.existsSync(BASELINE_PATH)) process.exit(newFailsCount > 0 ? 1 : 0);
  else process.exit(totalFails > 0 ? 1 : 0);
})();
