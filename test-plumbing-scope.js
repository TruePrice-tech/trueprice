// Test plumbing scope extraction on same 3 images from compare test
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

global.window = global.window || {};
global.document = global.document || { createElement: () => ({}) };
eval(fs.readFileSync("js/analyzer-parser.js", "utf8"));
eval(fs.readFileSync("js/analyzer-scope.js", "utf8"));
eval(fs.readFileSync("js/vertical-scope-plumbing.js", "utf8"));
var TP_PlumbingScope = window.TP_PlumbingScope;

const TESTS = [
  {
    file: "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg",
    label: "Roto-Rooter invoice (real phone photo, handwritten)",
    truth: { price: 482.80, contractor: "Roto-Rooter", jobType: "drain_cleaning", brand: "Roto-Rooter", warranty: 1, city: "Indianapolis", state: "IN" }
  },
  {
    file: "test-quotes/real-quotes/plumbing/messy-sewer-repair.jpg",
    label: "Drain Masters sewer repair (messy fixture)",
    truth: { price: 7400, contractor: "Drain Masters", jobType: "sewer_trenchless", brand: null, warranty: 25, city: "San Antonio", state: "TX" }
  },
  {
    file: "test-quotes/real-quotes/plumbing/fixture-water-heater-handwritten.jpg",
    label: "Pete's Plumbing water heater (clean fixture)",
    truth: { price: 1829, contractor: "Pete's Plumbing", jobType: "water_heater_tank", brand: "Rheem", warranty: 6, city: "Louisville", state: "KY" }
  },
];

async function runTest(test) {
  const filePath = path.resolve(test.file);
  const t0 = Date.now();
  const result = await Tesseract.recognize(filePath, "eng", { logger: () => {} });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const text = result.data.text || "";
  const conf = result.data.confidence || 0;

  // Standard parser for price + contractor
  const parsed = parseExtractedText(text, {});
  const price = parsed.finalBestPrice ? parseFloat(String(parsed.finalBestPrice).replace(/[$,]/g, "")) : null;
  const contractor = parsed.contractor || null;

  // New plumbing scope extraction
  const fields = TP_PlumbingScope.extractFields(text);

  return { text, conf: Math.round(conf), elapsed, price, contractor, fields };
}

(async () => {
  console.log("=".repeat(80));
  console.log("PLUMBING STRUCTURED FIELD EXTRACTION - Regex Only (no AI)");
  console.log("=".repeat(80));

  for (const test of TESTS) {
    console.log(`\n--- ${test.label} ---`);
    const r = await runTest(test);

    const priceOk = r.price && Math.abs(r.price - test.truth.price) / test.truth.price < 0.05;

    console.log(`  OCR: ${r.text.length} chars, ${r.conf}% confidence (${r.elapsed}s)`);
    console.log(`  Price:      $${r.price || "NONE"} ${priceOk ? "OK" : "WRONG"} (truth: $${test.truth.price})`);
    console.log(`  Contractor: ${r.contractor || "NONE"} (truth: ${test.truth.contractor})`);
    console.log(`  Job type:   ${r.fields.jobType.label} [${r.fields.jobType.value}] (truth: ${test.truth.jobType})`);
    console.log(`  Brand:      ${r.fields.brand ? r.fields.brand.brand + " (" + r.fields.brand.tier + ")" : "NONE"} (truth: ${test.truth.brand || "none"})`);
    console.log(`  Pipe type:  ${r.fields.pipeType ? r.fields.pipeType.label : "NONE"}`);
    console.log(`  Warranty:   parts=${r.fields.warranty.parts || "?"} labor=${r.fields.warranty.labor || "?"} (truth: ${test.truth.warranty}yr)`);
    console.log(`  Labor rate: ${r.fields.laborRate ? "$" + r.fields.laborRate + "/hr" : "NONE"}`);
    console.log(`  Labor hrs:  ${r.fields.laborHours || "NONE"}`);
    console.log(`  Location:   ${r.fields.location ? r.fields.location.city + ", " + r.fields.location.stateCode : "NONE"} (truth: ${test.truth.city}, ${test.truth.state})`);
    console.log(`  Line items: ${r.fields.lineItemCount}`);
    console.log(`  Scope:      ${r.fields.scopeDetected}/${r.fields.scopeTotal} items detected`);

    // List detected scope
    const detected = r.fields.scope.filter(s => s.detected).map(s => s.key);
    if (detected.length) console.log(`              [${detected.join(", ")}]`);
  }

  // Compare table simulation
  console.log("\n" + "=".repeat(80));
  console.log("SIMULATED COMPARE TABLE (what user would see)");
  console.log("=".repeat(80));

  const results = [];
  for (const test of TESTS) {
    const r = await runTest(test);
    const price = r.price ? parseFloat(String(r.price).replace(/[$,]/g, "")) : null;
    results.push({ label: test.label.split(" (")[0], price, contractor: r.contractor, fields: r.fields });
  }

  // Header
  const labels = results.map(r => r.label.substring(0, 18).padEnd(18));
  console.log(`\n${"Field".padEnd(20)} ${labels.join(" | ")}`);
  console.log("-".repeat(80));

  // Rows
  const rows = [
    ["Price", r => r.price ? "$" + r.price.toLocaleString() : "?"],
    ["Contractor", r => (r.contractor || "?").substring(0, 16)],
    ["Job Type", r => r.fields.jobType.label.substring(0, 16)],
    ["Brand", r => r.fields.brand ? r.fields.brand.brand : "?"],
    ["Warranty (parts)", r => r.fields.warranty.parts ? r.fields.warranty.parts + " yr" : "?"],
    ["Warranty (labor)", r => r.fields.warranty.labor ? r.fields.warranty.labor + " yr" : "?"],
    ["Labor Rate", r => r.fields.laborRate ? "$" + r.fields.laborRate + "/hr" : "?"],
    ["Pipe/Method", r => r.fields.pipeType ? r.fields.pipeType.label : "?"],
    ["Location", r => r.fields.location ? r.fields.location.city + ", " + r.fields.location.stateCode : "?"],
    ["Line Items", r => String(r.fields.lineItemCount)],
    ["Scope Items", r => r.fields.scopeDetected + "/" + r.fields.scopeTotal],
  ];

  for (const [label, fn] of rows) {
    const vals = results.map(r => fn(r).substring(0, 18).padEnd(18));
    console.log(`${label.padEnd(20)} ${vals.join(" | ")}`);
  }

  // Count filled vs empty fields
  let filled = 0, empty = 0;
  for (const r of results) {
    for (const [, fn] of rows) {
      if (fn(r) !== "?" && fn(r) !== "0") filled++;
      else empty++;
    }
  }
  console.log(`\nField coverage: ${filled}/${filled + empty} (${Math.round(100 * filled / (filled + empty))}%) - no AI used`);

  process.exit(0);
})();
