// Side-by-side: Tesseract+regex (no AI) vs Claude Haiku (with AI)
// Runs the same images through both paths and compares what the user would see.

const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

// Load the regex parser (it's browser JS - shim window/document for Node)
global.window = global.window || {};
global.document = global.document || { createElement: () => ({}) };
const parserCode = fs.readFileSync("js/analyzer-parser.js", "utf8");
const scopeCode = fs.readFileSync("js/analyzer-scope.js", "utf8");
eval(parserCode);
eval(scopeCode);

const TESTS = [
  // Real quotes
  { file: "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg", label: "PLUMBING-06 Roto-Rooter (phone photo, handwritten)", vertical: "plumbing" },
  { file: "test-quotes/plumbing-images/10-is-this-estimate-crazy-or-am-i.jpeg", label: "PLUMBING-10 Water heater swap (digital screenshot)", vertical: "plumbing" },
  { file: "test-quotes/roofing-images/03-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg", label: "ROOFING-03 Metal roof (digital screenshot)", vertical: "roofing" },
  { file: "test-quotes/roofing-images/07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg", label: "ROOFING-07 Roof replacement (phone photo of paper)", vertical: "roofing" },

  // Comparison: clean
  { file: "test-quotes/plumbing-images/comparison-wh-01-low.png", label: "PLUMBING-CMP-01 Budget clean", vertical: "plumbing" },
  { file: "test-quotes/plumbing-images/comparison-wh-02-mid.png", label: "PLUMBING-CMP-02 Westside clean", vertical: "plumbing" },
  { file: "test-quotes/plumbing-images/comparison-wh-03-high.png", label: "PLUMBING-CMP-03 Premier clean", vertical: "plumbing" },

  // Comparison: messy
  { file: "test-quotes/plumbing-images/messy-comparison-wh-01-low.jpg", label: "PLUMBING-MESSY-01 Budget messy", vertical: "plumbing" },
  { file: "test-quotes/plumbing-images/messy-comparison-wh-02-mid.jpg", label: "PLUMBING-MESSY-02 Westside messy", vertical: "plumbing" },
  { file: "test-quotes/plumbing-images/messy-comparison-wh-03-high.jpg", label: "PLUMBING-MESSY-03 Premier messy", vertical: "plumbing" },

  // Roofing comparison: clean
  { file: "test-quotes/roofing-images/comparison-roof-01-low.png", label: "ROOFING-CMP-01 Budget clean", vertical: "roofing" },
  { file: "test-quotes/roofing-images/comparison-roof-02-mid.png", label: "ROOFING-CMP-02 Heritage clean", vertical: "roofing" },
  { file: "test-quotes/roofing-images/comparison-roof-03-high.png", label: "ROOFING-CMP-03 Pinnacle clean", vertical: "roofing" },

  // Roofing comparison: messy
  { file: "test-quotes/roofing-images/messy-comparison-roof-01-low.jpg", label: "ROOFING-MESSY-01 Budget messy", vertical: "roofing" },
  { file: "test-quotes/roofing-images/messy-comparison-roof-02-mid.jpg", label: "ROOFING-MESSY-02 Heritage messy", vertical: "roofing" },
  { file: "test-quotes/roofing-images/messy-comparison-roof-03-high.jpg", label: "ROOFING-MESSY-03 Pinnacle messy", vertical: "roofing" },
];

// Ground truth: what I visually read from each image
const GROUND_TRUTH = {
  "PLUMBING-06 Roto-Rooter (phone photo, handwritten)": { price: 482.80, contractor: "Roto-Rooter", city: "Indianapolis", state: "IN" },
  "PLUMBING-10 Water heater swap (digital screenshot)": { price: 6950, contractor: null, city: null, state: null },
  "ROOFING-03 Metal roof (digital screenshot)": { price: 136375, contractor: null, city: null, state: null, material: "metal" },
  "ROOFING-07 Roof replacement (phone photo of paper)": { price: 10500, contractor: null, city: null, state: null, material: "architectural" },
  "PLUMBING-CMP-01 Budget clean": { price: 1380, contractor: "Budget Plumbing Services", city: "Los Angeles", state: "CA" },
  "PLUMBING-CMP-02 Westside clean": { price: 2553, contractor: "Westside Plumbing & Drain", city: "Los Angeles", state: "CA" },
  "PLUMBING-CMP-03 Premier clean": { price: 7571, contractor: "Premier Home Plumbing Solutions", city: "West Hollywood", state: "CA" },
  "PLUMBING-MESSY-01 Budget messy": { price: 1380, contractor: "Budget Plumbing Services", city: "Los Angeles", state: "CA" },
  "PLUMBING-MESSY-02 Westside messy": { price: 2553, contractor: "Westside Plumbing & Drain", city: "Los Angeles", state: "CA" },
  "PLUMBING-MESSY-03 Premier messy": { price: 7571, contractor: "Premier Home Plumbing Solutions", city: "West Hollywood", state: "CA" },
  "ROOFING-CMP-01 Budget clean": { price: 7565, contractor: "Budget Roofing Co", city: "Greensboro", state: "NC", material: "architectural" },
  "ROOFING-CMP-02 Heritage clean": { price: 11895, contractor: "Heritage Roofing & Exteriors", city: null, state: null, material: "architectural" },
  "ROOFING-CMP-03 Pinnacle clean": { price: 17500, contractor: "Pinnacle Premium Roofing", city: null, state: null, material: "architectural" },
  "ROOFING-MESSY-01 Budget messy": { price: 7565, contractor: "Budget Roofing Co", city: "Greensboro", state: "NC", material: "architectural" },
  "ROOFING-MESSY-02 Heritage messy": { price: 11895, contractor: "Heritage Roofing & Exteriors", city: null, state: null, material: "architectural" },
  "ROOFING-MESSY-03 Pinnacle messy": { price: 17500, contractor: "Pinnacle Premium Roofing", city: null, state: null, material: "architectural" },
};

// Load AI results from previous test run - map by file path
let aiResults = {};
const AI_LABEL_MAP = {
  "PLUMBING-06 Roto-Rooter (phone photo, handwritten)": "PLUMBING-06 Roto-Rooter invoice (phone photo of paper)",
  "PLUMBING-10 Water heater swap (digital screenshot)": "PLUMBING-10 Water heater swap (digital screenshot)",
  "ROOFING-03 Metal roof (digital screenshot)": "ROOFING-03 Metal roof estimate (digital screenshot)",
  "ROOFING-07 Roof replacement (phone photo of paper)": "ROOFING-07 Roof replacement form (phone photo of paper)",
  "PLUMBING-CMP-01 Budget clean": "PLUMBING-CMP-01 Budget clean (synthetic)",
  "PLUMBING-CMP-02 Westside clean": "PLUMBING-CMP-02 Westside clean (synthetic)",
  "PLUMBING-CMP-03 Premier clean": "PLUMBING-CMP-03 Premier clean (synthetic)",
  "PLUMBING-MESSY-01 Budget messy": "PLUMBING-MESSY-01 Budget messy (JPEG degraded)",
  "PLUMBING-MESSY-02 Westside messy": "PLUMBING-MESSY-02 Westside messy (JPEG degraded)",
  "PLUMBING-MESSY-03 Premier messy": "PLUMBING-MESSY-03 Premier messy (JPEG degraded)",
  "ROOFING-CMP-01 Budget clean": "ROOFING-CMP-01 Budget clean (synthetic)",
  "ROOFING-CMP-02 Heritage clean": "ROOFING-CMP-02 Heritage clean (synthetic)",
  "ROOFING-CMP-03 Pinnacle clean": "ROOFING-CMP-03 Pinnacle clean (synthetic)",
  "ROOFING-MESSY-01 Budget messy": "ROOFING-MESSY-01 Budget messy (JPEG degraded)",
  "ROOFING-MESSY-02 Heritage messy": "ROOFING-MESSY-02 Heritage messy (JPEG degraded)",
  "ROOFING-MESSY-03 Pinnacle messy": "ROOFING-MESSY-03 Pinnacle messy (JPEG degraded)",
};
try {
  const aiData = JSON.parse(fs.readFileSync("test-quote-accuracy-results.json", "utf8"));
  for (const r of aiData) {
    aiResults[r.label] = r;
  }
} catch (e) {
  console.error("Could not load AI results:", e.message);
}

async function runTesseract(filePath) {
  const t0 = Date.now();
  const result = await Tesseract.recognize(filePath, "eng", {
    logger: () => {},
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  return { text: result.data.text, confidence: result.data.confidence, elapsed };
}

(async () => {
  console.log("=== WITH vs WITHOUT AI: Side-by-Side Test ===\n");

  const rows = [];

  for (const test of TESTS) {
    const filePath = path.resolve(test.file);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${test.label} (file not found)`);
      continue;
    }

    process.stdout.write(`OCR: ${test.label} ... `);

    // --- WITHOUT AI: Tesseract + regex ---
    const ocr = await runTesseract(filePath);
    const parsed = typeof parseExtractedText === "function"
      ? parseExtractedText(ocr.text, {})
      : {};

    const regexPrice = parsed.price || parsed.finalPrice || parsed.finalBestPrice || null;
    const regexContractor = parsed.contractor || null;
    const regexMaterial = parsed.material || parsed.materialLabel || null;

    // Scope items from regex
    let regexScope = [];
    if (typeof detectScopeItems === "function") {
      const scopeDetected = detectScopeItems(ocr.text);
      regexScope = scopeDetected.filter(i => i.detected).map(i => i.key);
    }

    console.log(`${ocr.elapsed}s, ${ocr.text.length} chars, conf=${ocr.confidence.toFixed(0)}%`);

    // --- WITH AI: from previous test run ---
    const aiLabel = AI_LABEL_MAP[test.label] || test.label;
    const aiRun = aiResults[aiLabel];
    const aiData = aiRun && aiRun.data && aiRun.data.data ? aiRun.data.data : {};
    const aiPrice = aiData.totalPrice || aiData.price || null;
    const aiContractor = aiData.contractor || null;
    const aiMaterial = aiData.material || aiData.materialLabel || null;
    const aiRedFlags = aiData.redFlags ? aiData.redFlags.length : 0;
    const aiLineItems = aiData.lineItems ? aiData.lineItems.length : 0;
    const aiScopeCount = aiData.scopeItems
      ? Object.values(aiData.scopeItems).filter(v => v === "included" || v === "yes").length
      : 0;

    // --- Ground truth ---
    const truth = GROUND_TRUTH[test.label] || {};

    rows.push({
      label: test.label,
      truth,
      regex: { price: regexPrice ? parseFloat(String(regexPrice).replace(/[$,]/g, "")) : null, contractor: regexContractor, material: regexMaterial, scopeCount: regexScope.length, ocrChars: ocr.text.length, ocrConf: ocr.confidence.toFixed(0), elapsed: ocr.elapsed },
      ai: { price: aiPrice, contractor: aiContractor, material: aiMaterial, redFlags: aiRedFlags, lineItems: aiLineItems, scopeCount: aiScopeCount },
    });
  }

  // --- Print comparison table ---
  console.log("\n" + "=".repeat(120));
  console.log("SIDE-BY-SIDE COMPARISON: What the user sees");
  console.log("=".repeat(120));

  let regexCorrect = 0, aiCorrect = 0, total = 0;

  for (const r of rows) {
    total++;
    const truthPrice = r.truth.price;

    const regexMatch = r.regex.price !== null && Math.abs(r.regex.price - truthPrice) / truthPrice < 0.02;
    const aiMatch = r.ai.price !== null && Math.abs(r.ai.price - truthPrice) / truthPrice < 0.02;

    if (regexMatch) regexCorrect++;
    if (aiMatch) aiCorrect++;

    console.log(`\n--- ${r.label} ---`);
    console.log(`  TRUTH:     $${truthPrice} | ${r.truth.contractor || "(redacted)"} | ${r.truth.material || "-"}`);
    console.log(`  NO AI:     $${r.regex.price || "NONE"} ${regexMatch ? "OK" : "WRONG"} | ${r.regex.contractor || "NONE"} | ${r.regex.material || "-"} | scope:${r.regex.scopeCount} | OCR:${r.regex.ocrChars}ch/${r.regex.ocrConf}% (${r.regex.elapsed}s)`);
    console.log(`  WITH AI:   $${r.ai.price || "NONE"} ${aiMatch ? "OK" : "WRONG"} | ${r.ai.contractor || "NONE"} | ${r.ai.material || "-"} | scope:${r.ai.scopeCount} items:${r.ai.lineItems} flags:${r.ai.redFlags}`);
  }

  console.log("\n" + "=".repeat(120));
  console.log(`PRICE ACCURACY:  NO AI = ${regexCorrect}/${total} (${Math.round(100*regexCorrect/total)}%)  |  WITH AI = ${aiCorrect}/${total} (${Math.round(100*aiCorrect/total)}%)`);
  console.log("=".repeat(120));

  // Terminate Tesseract worker
  process.exit(0);
})();
