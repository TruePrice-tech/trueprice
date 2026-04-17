// Quick 3-quote test: regex-only vs regex+Claude backup
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

global.window = global.window || {};
global.document = global.document || { createElement: () => ({}) };
eval(fs.readFileSync("js/analyzer-parser.js", "utf8"));
eval(fs.readFileSync("js/analyzer-scope.js", "utf8"));

const BASE = "https://woogoro.com";

const TESTS = [
  {
    label: "AUTO - Jiffy Lube invoice (phone photo, orange redactions)",
    file: "test-quotes/real-quotes/auto/1boni58.jpeg",
    api: "/api/auto-repair-estimate",
    truth: { price: 558.05, contractor: "Jiffy Lube" },
  },
  {
    label: "ROOFING - Handwritten proposal (blue pen, CertainTeed Landmark)",
    file: "test-quotes/real-quotes/roofing/13r1q44.png",
    api: "/api/parse-quote",
    truth: { price: 9143.92, contractor: "Integrity Roofing" },
  },
  {
    label: "MOVING - Digital quote (Long Distance Moving Services)",
    file: "test-quotes/real-quotes/moving/1bgju9p.jpeg",
    api: "/api/moving-estimate",
    truth: { price: 3070.58, contractor: "MVM" },
  },
];

async function runTesseract(filePath) {
  const t0 = Date.now();
  const result = await Tesseract.recognize(filePath, "eng", { logger: () => {} });
  return {
    text: result.data.text,
    confidence: result.data.confidence,
    elapsed: ((Date.now() - t0) / 1000).toFixed(1),
  };
}

async function callClaudeAPI(filePath, apiPath) {
  const imageData = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${imageData.toString("base64")}`;

  const t0 = Date.now();
  const resp = await fetch(BASE + apiPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://woogoro.com",
      "Referer": "https://woogoro.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: JSON.stringify({ images: [dataUrl] }),
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (!resp.ok) return { error: `HTTP ${resp.status}`, elapsed };
  const json = await resp.json();
  return { data: json.data || json, elapsed };
}

function priceMatch(got, truth) {
  if (!got || !truth) return false;
  return Math.abs(got - truth) / truth < 0.05; // 5% tolerance
}

(async () => {

  for (const test of TESTS) {
    const filePath = path.resolve(test.file);
    console.log(`\n${"=".repeat(80)}`);
    console.log(test.label);
    console.log(`TRUTH: $${test.truth.price} | ${test.truth.contractor}`);
    console.log(`${"=".repeat(80)}`);

    // --- TEST 1: Tesseract + Regex only ---
    console.log(`\n--- TEST 1: Tesseract + Regex (no AI) ---`);
    const ocr = await runTesseract(filePath);
    const parsed = typeof parseExtractedText === "function" ? parseExtractedText(ocr.text, {}) : {};
    const regexPrice = parsed.price || parsed.finalPrice || parsed.finalBestPrice || null;
    const regexPriceNum = regexPrice ? parseFloat(String(regexPrice).replace(/[$,]/g, "")) : null;
    const regexContractor = parsed.contractor || null;

    let regexScope = [];
    if (typeof detectScopeItems === "function") {
      regexScope = detectScopeItems(ocr.text).filter(i => i.detected).map(i => i.key);
    }

    const regexOK = priceMatch(regexPriceNum, test.truth.price);
    console.log(`   OCR: ${ocr.text.length} chars, ${ocr.confidence.toFixed(0)}% confidence (${ocr.elapsed}s)`);
    console.log(`   Price:      $${regexPriceNum || "NONE"} ${regexOK ? "CORRECT" : "WRONG"}`);
    console.log(`   Contractor: ${regexContractor || "NONE"}`);
    console.log(`   Scope:      ${regexScope.length} items detected: ${regexScope.join(", ") || "none"}`);
    console.log(`   What user sees: ${regexOK ? "Price confirmation screen" : "Manual entry screen (couldn't read price)"}`);

    // --- TEST 2: Tesseract + Regex + Claude backup ---
    console.log(`\n--- TEST 2: Tesseract + Regex + Claude backup ---`);
    console.log(`   (Regex ${regexOK ? "found price, Claude not needed" : "failed, falling back to Claude..."})`);

    let aiPrice = null, aiContractor = null, aiElapsed = "0";
    let finalPrice = regexPriceNum;
    let finalContractor = regexContractor;
    let aiLineItems = 0, aiRedFlags = 0, aiScope = 0;

    if (!regexOK) {
      // Claude backup
      const ai = await callClaudeAPI(filePath, test.api);
      aiElapsed = ai.elapsed;
      if (ai.error) {
        console.log(`   Claude ERROR: ${ai.error} (${aiElapsed}s)`);
      } else {
        const d = ai.data || {};
        aiPrice = d.totalPrice || d.price || d.total || null;
        aiContractor = d.contractor || d.companyName || null;
        aiLineItems = d.lineItems ? d.lineItems.length : 0;
        aiRedFlags = d.redFlags ? d.redFlags.length : 0;
        aiScope = d.scopeItems ? Object.values(d.scopeItems).filter(v => v === "included" || v === "yes").length : 0;

        if (aiPrice) finalPrice = aiPrice;
        if (aiContractor) finalContractor = aiContractor;
      }
    }

    const finalOK = priceMatch(finalPrice, test.truth.price);
    console.log(`   Final price:      $${finalPrice || "NONE"} ${finalOK ? "CORRECT" : "WRONG"}`);
    console.log(`   Final contractor: ${finalContractor || "NONE"}`);
    if (!regexOK) {
      console.log(`   Claude added:     ${aiLineItems} line items, ${aiRedFlags} red flags, ${aiScope} scope items (${aiElapsed}s)`);
    }
    console.log(`   What user sees:   ${finalOK ? "Price confirmation -> verdict screen" : "Manual entry screen"}`);
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("DONE");
  process.exit(0);
})();
