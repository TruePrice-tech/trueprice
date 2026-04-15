// End-to-end test: run fixture images through Tesseract+regex (no AI)
// Score what the parser finds vs ground truth
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

global.window = global.window || {};
global.document = global.document || { createElement: () => ({}) };
eval(fs.readFileSync("js/analyzer-parser.js", "utf8"));
eval(fs.readFileSync("js/analyzer-scope.js", "utf8"));

const TESTS = [
  // Single-quote path tests
  { file: "test-quotes/real-quotes/plumbing/fixture-water-heater-handwritten.jpg", vertical: "plumbing", truth: { price: 1829, contractor: "Pete's Plumbing LLC" } },
  { file: "test-quotes/real-quotes/roofing/fixture-roof-replacement.jpg", vertical: "roofing", truth: { price: 12250, contractor: "Apex Roofing & Exteriors" } },
  { file: "test-quotes/real-quotes/hvac/fixture-ac-replacement.jpg", vertical: "hvac", truth: { price: 7270, contractor: "Comfort Zone Heating & Air" } },
  { file: "test-quotes/real-quotes/electrical/fixture-panel-upgrade.jpg", vertical: "electrical", truth: { price: 3390, contractor: "Sparks Electric Inc." } },
  { file: "test-quotes/real-quotes/auto/fixture-brake-job.jpg", vertical: "auto", truth: { price: 883.78, contractor: "Mike's Auto Repair" } },

  // Compare path tests (same images, different verticals to test breadth)
  { file: "test-quotes/real-quotes/moving/fixture-local-move.jpg", vertical: "moving", truth: { price: 1220, contractor: "Reliable Movers LLC" } },
  { file: "test-quotes/real-quotes/fencing/fixture-wood-fence.jpg", vertical: "fencing", truth: { price: 7500, contractor: "Heartland Fence Co." } },
  { file: "test-quotes/real-quotes/solar/fixture-solar-proposal.jpg", vertical: "solar", truth: { price: 22250, contractor: "Sunwise Energy" } },
  { file: "test-quotes/real-quotes/concrete/fixture-driveway.jpg", vertical: "concrete", truth: { price: 8000, contractor: "Solid Ground Concrete" } },
  { file: "test-quotes/real-quotes/painting/fixture-interior-paint.jpg", vertical: "painting", truth: { price: 4545, contractor: "Precision Painting Co." } },
];

async function runTest(test) {
  const filePath = path.resolve(test.file);
  const t0 = Date.now();
  const result = await Tesseract.recognize(filePath, "eng", { logger: () => {} });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const text = result.data.text || "";
  const confidence = result.data.confidence || 0;

  const parsed = typeof parseExtractedText === "function" ? parseExtractedText(text, {}) : {};
  const regexPrice = parsed.finalBestPrice || parsed.price || null;
  const priceNum = regexPrice ? parseFloat(String(regexPrice).replace(/[$,]/g, "")) : null;
  const contractor = parsed.contractor || null;

  let scopeItems = [];
  if (typeof detectScopeItems === "function") {
    scopeItems = detectScopeItems(text).filter(i => i.detected).map(i => i.key);
  }

  const priceCorrect = priceNum && Math.abs(priceNum - test.truth.price) / test.truth.price < 0.03;
  const contractorFound = contractor && contractor.length > 3;

  // Score 1-3
  let score = 1; // 1 = failed
  if (priceCorrect && contractorFound) score = 3; // perfect
  else if (priceCorrect || contractorFound) score = 2; // partial

  return {
    vertical: test.vertical,
    truthPrice: test.truth.price,
    truthContractor: test.truth.contractor,
    parsedPrice: priceNum,
    parsedContractor: contractor,
    priceCorrect,
    contractorFound,
    scopeCount: scopeItems.length,
    ocrChars: text.length,
    ocrConf: Math.round(confidence),
    elapsed,
    score,
  };
}

(async () => {
  console.log("=== FIXTURE E2E TEST ===\n");
  console.log("SINGLE-QUOTE PATH (5 verticals):\n");

  const results = [];
  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    process.stdout.write(`  ${test.vertical}... `);
    const r = await runTest(test);
    results.push(r);

    const scoreLabel = r.score === 3 ? "PERFECT" : r.score === 2 ? "PARTIAL" : "FAIL";
    console.log(`${scoreLabel} (${r.elapsed}s)`);
    console.log(`    Price: $${r.parsedPrice || "NONE"} ${r.priceCorrect ? "OK" : "WRONG"} (truth: $${r.truthPrice})`);
    console.log(`    Contractor: ${r.parsedContractor || "NONE"} ${r.contractorFound ? "OK" : "MISSING"}`);
    console.log(`    Scope: ${r.scopeCount} items | OCR: ${r.ocrChars}ch/${r.ocrConf}%`);

    if (i === 4) console.log("\nCOMPARE PATH (5 verticals):\n");
  }

  // Summary
  const single = results.slice(0, 5);
  const compare = results.slice(5);
  const singleAvg = (single.reduce((s, r) => s + r.score, 0) / 5).toFixed(1);
  const compareAvg = (compare.reduce((s, r) => s + r.score, 0) / 5).toFixed(1);
  const totalCorrectPrice = results.filter(r => r.priceCorrect).length;
  const totalCorrectContractor = results.filter(r => r.contractorFound).length;

  console.log("\n=== SUMMARY ===");
  console.log(`Single-quote avg score: ${singleAvg}/3`);
  console.log(`Compare avg score: ${compareAvg}/3`);
  console.log(`Price correct: ${totalCorrectPrice}/10`);
  console.log(`Contractor found: ${totalCorrectContractor}/10`);

  process.exit(0);
})();
