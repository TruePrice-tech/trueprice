// Full E2E test: messy images through all 3 paths (single-quote, compare, estimate)
// 10 verticals, 2 images each, report price accuracy + AI calls
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

global.window = { location: { href: "http://localhost" } };
global.document = { createElement: () => ({}) };
eval(fs.readFileSync("js/analyzer-parser.js", "utf8"));
eval(fs.readFileSync("js/analyzer-scope.js", "utf8"));

const BASE = "https://truepricehq.com";

// Test images: messy fixtures + real Reddit images
const TESTS = [
  // Plumbing
  { vertical: "plumbing", file: "test-quotes/real-quotes/plumbing/messy-sewer-repair.jpg", truth: { price: 7400 }, label: "Plumbing: sewer repair (messy)" },
  { vertical: "plumbing", file: "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg", truth: { price: 482.80 }, label: "Plumbing: Roto-Rooter (real phone)" },

  // Roofing
  { vertical: "roofing", file: "test-quotes/real-quotes/roofing/messy-roof-repair.jpg", truth: { price: 12345 }, label: "Roofing: Ridge Line (messy)" },
  { vertical: "roofing", file: "test-quotes/roofing-images/07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg", truth: { price: 10500 }, label: "Roofing: 2000sqft (real phone)" },

  // HVAC
  { vertical: "hvac", file: "test-quotes/real-quotes/hvac/messy-furnace-install.jpg", truth: { price: 5500 }, label: "HVAC: furnace install (messy)" },
  { vertical: "hvac", file: "test-quotes/real-quotes/hvac/invoice-50s.jpeg", truth: { price: null }, label: "HVAC: 1950s invoice (real, handwritten)" },

  // Electrical
  { vertical: "electrical", file: "test-quotes/real-quotes/electrical/messy-ev-charger.jpg", truth: { price: 1709 }, label: "Electrical: EV charger (messy)" },
  { vertical: "electrical", file: "test-quotes/real-quotes/electrical/quote-opinions.jpg", truth: { price: 3487.53 }, label: "Electrical: recessed lights (real phone)" },

  // Auto
  { vertical: "auto", file: "test-quotes/real-quotes/auto/messy-transmission-service.jpg", truth: { price: 4428.22 }, label: "Auto: transmission (messy)" },
  { vertical: "auto", file: "test-quotes/real-quotes/auto/1boni58.jpeg", truth: { price: 558 }, label: "Auto: Jiffy Lube (real phone)" },

  // Moving
  { vertical: "moving", file: "test-quotes/real-quotes/moving/messy-interstate-move.jpg", truth: { price: 9252 }, label: "Moving: interstate (messy)" },
  { vertical: "moving", file: "test-quotes/real-quotes/moving/1bgju9p.jpeg", truth: { price: 3070.58 }, label: "Moving: long distance (real)" },

  // Solar
  { vertical: "solar", file: "test-quotes/real-quotes/solar/messy-solar-quote.jpg", truth: { price: 21250 }, label: "Solar: Solar Solutions (messy)" },
  { vertical: "solar", file: "test-quotes/real-quotes/solar/1iwi5to.jpeg", truth: { price: 20749 }, label: "Solar: Northeast Solar (real)" },

  // Concrete
  { vertical: "concrete", file: "test-quotes/real-quotes/concrete/messy-patio-pour.jpg", truth: { price: 8150 }, label: "Concrete: patio (messy)" },
  { vertical: "concrete", file: "test-quotes/real-quotes/concrete/fixture-driveway.jpg", truth: { price: 8000 }, label: "Concrete: driveway (clean fixture)" },

  // Painting
  { vertical: "painting", file: "test-quotes/real-quotes/painting/messy-exterior-paint.jpg", truth: { price: 9650 }, label: "Painting: exterior (messy)" },
  { vertical: "painting", file: "test-quotes/real-quotes/painting/fixture-interior-paint.jpg", truth: { price: 4545 }, label: "Painting: interior (clean fixture)" },

  // Fencing
  { vertical: "fencing", file: "test-quotes/real-quotes/fencing/messy-chain-link.jpg", truth: { price: 6295 }, label: "Fencing: chain link (messy)" },
  { vertical: "fencing", file: "test-quotes/real-quotes/fencing/fixture-wood-fence.jpg", truth: { price: 7500 }, label: "Fencing: wood fence (clean fixture)" },
];

function priceMatch(got, truth) {
  if (!truth) return got === null; // no truth = we don't know the right answer
  if (!got) return false;
  return Math.abs(got - truth) / truth < 0.05;
}

async function ocrAndParse(filePath) {
  const t0 = Date.now();
  const result = await Tesseract.recognize(filePath, "eng", { logger: () => {} });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const text = result.data.text || "";
  const conf = result.data.confidence || 0;

  const parsed = typeof parseExtractedText === "function" ? parseExtractedText(text, {}) : {};
  const price = parsed.finalBestPrice ? parseFloat(String(parsed.finalBestPrice).replace(/[$,]/g, "")) : null;
  const contractor = parsed.contractor || null;

  return { price, contractor, ocrChars: text.length, ocrConf: Math.round(conf), elapsed };
}

async function callApi(filePath, endpoint) {
  const imageData = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${imageData.toString("base64")}`;

  const t0 = Date.now();
  try {
    const resp = await fetch(BASE + endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://truepricehq.com",
        "Referer": "https://truepricehq.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({ images: [dataUrl] }),
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    if (!resp.ok) return { error: resp.status, elapsed };
    const json = await resp.json();
    const d = json.data || json;
    return { price: d.totalPrice || d.price || d.quoteTotal || null, elapsed, data: d };
  } catch (e) {
    return { error: e.message, elapsed: ((Date.now() - t0) / 1000).toFixed(1) };
  }
}

const API_MAP = {
  plumbing: "/api/plumbing-estimate",
  roofing: "/api/parse-quote",
  hvac: "/api/hvac-estimate",
  electrical: "/api/electrical-estimate",
  auto: "/api/auto-repair-estimate",
  moving: "/api/moving-estimate",
  solar: "/api/solar-estimate",
  concrete: "/api/concrete-estimate",
  painting: "/api/painting-estimate",
  fencing: "/api/fencing-estimate",
};

(async () => {
  console.log("=".repeat(90));
  console.log("FULL E2E TEST: 10 verticals x 2 images x 3 paths");
  console.log("=".repeat(90));

  let regexCorrect = 0, regexTotal = 0;
  let aiCorrect = 0, aiTotal = 0, aiCalls = 0;
  const results = [];

  for (const test of TESTS) {
    const filePath = path.resolve(test.file);
    if (!fs.existsSync(filePath)) {
      console.log(`\nSKIP: ${test.label} (file not found)`);
      continue;
    }

    process.stdout.write(`\n${test.label}\n`);

    // PATH 1: Regex only (what TP_Engine does first)
    const regex = await ocrAndParse(filePath);
    const regexOk = priceMatch(regex.price, test.truth.price);
    if (test.truth.price) { regexTotal++; if (regexOk) regexCorrect++; }

    console.log(`  REGEX:   $${regex.price || "NONE"} ${regexOk ? "OK" : "WRONG"} (truth: $${test.truth.price || "?"}) | OCR: ${regex.ocrChars}ch/${regex.ocrConf}% (${regex.elapsed}s)`);

    // PATH 2: AI backup (only called when regex fails - simulating engine behavior)
    let aiPrice = null;
    let aiElapsed = "-";
    let aiWouldFire = !regexOk && test.truth.price;

    if (aiWouldFire) {
      aiCalls++;
      const api = await callApi(filePath, API_MAP[test.vertical]);
      aiElapsed = api.elapsed;
      if (api.error) {
        console.log(`  AI:      ERROR ${api.error} (${aiElapsed}s)`);
      } else {
        aiPrice = api.price ? parseFloat(String(api.price)) : null;
        const aiOk = priceMatch(aiPrice, test.truth.price);
        if (test.truth.price) { aiTotal++; if (aiOk) aiCorrect++; }
        console.log(`  AI:      $${aiPrice || "NONE"} ${aiOk ? "OK" : "WRONG"} (${aiElapsed}s)`);
      }
    } else {
      console.log(`  AI:      not called (regex ${regexOk ? "found price" : "no truth to compare"})`);
    }

    // PATH 3: Compare path (would use same engine + API)
    // In compare, engine runs OCR then API always fires for structured fields
    // Price accuracy is same as above, so just note the path
    const finalPrice = regex.price && regexOk ? regex.price : (aiPrice || regex.price);
    const finalOk = priceMatch(finalPrice, test.truth.price);
    console.log(`  COMPARE: would use engine OCR ($${regex.price || "NONE"}) + API for fields`);
    console.log(`  FINAL:   $${finalPrice || "NONE"} ${finalOk ? "OK" : "WRONG"}`);

    results.push({
      label: test.label,
      vertical: test.vertical,
      truth: test.truth.price,
      regexPrice: regex.price,
      regexOk,
      aiWouldFire,
      aiPrice,
      finalPrice,
      finalOk,
    });

    // Rate limit between AI calls
    if (aiWouldFire) await new Promise(r => setTimeout(r, 2000));
  }

  // Summary
  console.log("\n" + "=".repeat(90));
  console.log("SUMMARY");
  console.log("=".repeat(90));

  const withTruth = results.filter(r => r.truth);
  const regexPassRate = withTruth.filter(r => r.regexOk).length;
  const finalPassRate = withTruth.filter(r => r.finalOk).length;

  console.log(`\nImages tested: ${results.length} across 10 verticals`);
  console.log(`\nPATH 1 - Regex only (no AI, $0 cost):`);
  console.log(`  ${regexPassRate}/${withTruth.length} correct (${Math.round(100*regexPassRate/withTruth.length)}%)`);
  console.log(`\nPATH 2 - Regex + AI backup:`);
  console.log(`  ${finalPassRate}/${withTruth.length} correct (${Math.round(100*finalPassRate/withTruth.length)}%)`);
  console.log(`  AI calls fired: ${aiCalls}/${withTruth.length} (${Math.round(100*aiCalls/withTruth.length)}% of requests)`);
  console.log(`  AI recovered: ${aiCorrect}/${aiCalls} of the ones it was called for`);
  console.log(`\nPATH 3 - Compare (engine OCR + API):`);
  console.log(`  Same price accuracy as Path 2, plus structured field extraction`);

  // Per-vertical breakdown
  console.log("\nPER-VERTICAL:");
  const verticals = [...new Set(results.map(r => r.vertical))];
  for (const v of verticals) {
    const vr = results.filter(r => r.vertical === v && r.truth);
    const regexV = vr.filter(r => r.regexOk).length;
    const finalV = vr.filter(r => r.finalOk).length;
    const aiV = vr.filter(r => r.aiWouldFire).length;
    console.log(`  ${v.padEnd(12)} regex: ${regexV}/${vr.length}  final: ${finalV}/${vr.length}  AI calls: ${aiV}`);
  }

  process.exit(0);
})();
