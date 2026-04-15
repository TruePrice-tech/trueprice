// Test messy fixtures: single-quote path + 3-way compare for select verticals
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

global.window = global.window || {};
global.document = global.document || { createElement: () => ({}) };
eval(fs.readFileSync("js/analyzer-parser.js", "utf8"));
eval(fs.readFileSync("js/analyzer-scope.js", "utf8"));

const SINGLE = [
  { file: "test-quotes/real-quotes/plumbing/messy-sewer-repair.jpg", vertical: "plumbing", truth: { price: 7400, contractor: "Drain Masters Plumbing" } },
  { file: "test-quotes/real-quotes/roofing/messy-roof-repair.jpg", vertical: "roofing", truth: { price: 12345, contractor: "Ridge Line Roofing" } },
  { file: "test-quotes/real-quotes/hvac/messy-furnace-install.jpg", vertical: "hvac", truth: { price: 5500, contractor: "All Seasons HVAC" } },
  { file: "test-quotes/real-quotes/electrical/messy-ev-charger.jpg", vertical: "electrical", truth: { price: 1709, contractor: "Volt Electric Services" } },
  { file: "test-quotes/real-quotes/auto/messy-transmission-service.jpg", vertical: "auto", truth: { price: 4428.22, contractor: "Eastside Transmission" } },
  { file: "test-quotes/real-quotes/moving/messy-interstate-move.jpg", vertical: "moving", truth: { price: 9252, contractor: "Atlas Moving & Storage" } },
  { file: "test-quotes/real-quotes/fencing/messy-chain-link.jpg", vertical: "fencing", truth: { price: 6295, contractor: "American Fence & Gate" } },
  { file: "test-quotes/real-quotes/concrete/messy-patio-pour.jpg", vertical: "concrete", truth: { price: 8150, contractor: "Metro Concrete & Masonry" } },
  { file: "test-quotes/real-quotes/solar/messy-solar-quote.jpg", vertical: "solar", truth: { price: 21250, contractor: "Solar Solutions TX" } },
  { file: "test-quotes/real-quotes/painting/messy-exterior-paint.jpg", vertical: "painting", truth: { price: 9650, contractor: "ColorCraft Painting" } },
];

// 3-way compare sets: 3 quotes from same vertical at different price points
const COMPARE_SETS = [
  {
    vertical: "plumbing",
    label: "Plumbing 3-way compare",
    quotes: [
      { file: "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg", truth: { price: 482.80, contractor: "Roto-Rooter" } },
      { file: "test-quotes/real-quotes/plumbing/messy-sewer-repair.jpg", truth: { price: 7400, contractor: "Drain Masters" } },
      { file: "test-quotes/real-quotes/plumbing/fixture-water-heater-handwritten.jpg", truth: { price: 1829, contractor: "Pete's Plumbing" } },
    ]
  },
  {
    vertical: "roofing",
    label: "Roofing 3-way compare",
    quotes: [
      { file: "test-quotes/roofing-images/07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg", truth: { price: 10500, contractor: null } },
      { file: "test-quotes/real-quotes/roofing/messy-roof-repair.jpg", truth: { price: 12345, contractor: "Ridge Line" } },
      { file: "test-quotes/real-quotes/roofing/fixture-roof-replacement.jpg", truth: { price: 12250, contractor: "Apex Roofing" } },
    ]
  },
  {
    vertical: "auto",
    label: "Auto 3-way compare",
    quotes: [
      { file: "test-quotes/real-quotes/auto/messy-transmission-service.jpg", truth: { price: 4428.22, contractor: "Eastside" } },
      { file: "test-quotes/real-quotes/auto/fixture-brake-job.jpg", truth: { price: 883.78, contractor: "Mike's Auto" } },
      { file: "test-quotes/real-quotes/auto/1boni58.jpeg", truth: { price: 558, contractor: "Jiffy Lube" } },
    ]
  },
];

async function parseImage(filePath) {
  const t0 = Date.now();
  const result = await Tesseract.recognize(filePath, "eng", { logger: () => {} });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const text = result.data.text || "";
  const conf = result.data.confidence || 0;

  const parsed = typeof parseExtractedText === "function" ? parseExtractedText(text, {}) : {};
  const price = parsed.finalBestPrice || parsed.price || null;
  const priceNum = price ? parseFloat(String(price).replace(/[$,]/g, "")) : null;
  const contractor = parsed.contractor || null;

  let scopeCount = 0;
  if (typeof detectScopeItems === "function") {
    scopeCount = detectScopeItems(text).filter(i => i.detected).length;
  }

  return { priceNum, contractor, scopeCount, ocrChars: text.length, ocrConf: Math.round(conf), elapsed };
}

function score(got, truth) {
  const priceOk = got && truth && Math.abs(got - truth) / truth < 0.05;
  return priceOk;
}

(async () => {
  // ── SINGLE QUOTE PATH ──
  console.log("=" .repeat(80));
  console.log("SINGLE-QUOTE PATH - MESSY FIXTURES (10 verticals)");
  console.log("=".repeat(80) + "\n");

  let singleCorrect = 0, singleTotal = 0, aiNeeded = 0;

  for (const test of SINGLE) {
    singleTotal++;
    process.stdout.write(`  ${test.vertical}... `);
    const r = await parseImage(path.resolve(test.file));
    const priceOk = score(r.priceNum, test.truth.price);
    if (priceOk) singleCorrect++;
    if (!priceOk) aiNeeded++;

    const contractorOk = r.contractor && r.contractor.length > 3;
    const s = priceOk && contractorOk ? 3 : priceOk || contractorOk ? 2 : 1;

    console.log(`${s}/3 | $${r.priceNum || "NONE"} ${priceOk ? "OK" : "WRONG"} (truth: $${test.truth.price}) | ${r.contractor || "NONE"} | scope:${r.scopeCount} | OCR:${r.ocrChars}ch/${r.ocrConf}% (${r.elapsed}s)`);
  }

  // ── 3-WAY COMPARE PATH ──
  console.log("\n" + "=".repeat(80));
  console.log("3-WAY COMPARE PATH - MIXED IMAGES (3 verticals)");
  console.log("=".repeat(80) + "\n");

  let compareCorrect = 0, compareTotal = 0;

  for (const set of COMPARE_SETS) {
    console.log(`  --- ${set.label} ---`);
    for (let i = 0; i < set.quotes.length; i++) {
      const q = set.quotes[i];
      compareTotal++;
      process.stdout.write(`    Quote ${i+1}: `);
      const r = await parseImage(path.resolve(q.file));
      const priceOk = score(r.priceNum, q.truth.price);
      if (priceOk) compareCorrect++;

      console.log(`$${r.priceNum || "NONE"} ${priceOk ? "OK" : "WRONG"} (truth: $${q.truth.price}) | ${r.contractor || "NONE"} | scope:${r.scopeCount}`);
    }

    // Can we rank them correctly?
    const prices = [];
    for (const q of set.quotes) {
      const r = await parseImage(path.resolve(q.file));
      prices.push({ truth: q.truth.price, parsed: r.priceNum });
    }
    const truthOrder = [...prices].sort((a, b) => a.truth - b.truth).map(p => p.truth);
    const parsedOrder = prices.filter(p => p.parsed).sort((a, b) => a.parsed - b.parsed).map(p => p.truth);
    const rankCorrect = JSON.stringify(truthOrder) === JSON.stringify(parsedOrder);
    console.log(`    Ranking: ${rankCorrect ? "CORRECT" : "WRONG"} (${parsedOrder.length}/3 prices found)\n`);
  }

  // ── SUMMARY ──
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Single-quote price accuracy: ${singleCorrect}/${singleTotal} (${Math.round(100*singleCorrect/singleTotal)}%)`);
  console.log(`Compare price accuracy:      ${compareCorrect}/${compareTotal} (${Math.round(100*compareCorrect/compareTotal)}%)`);
  console.log(`AI backup would be needed:   ${aiNeeded}/${singleTotal} quotes`);
  console.log(`Total correct (all paths):   ${singleCorrect + compareCorrect}/${singleTotal + compareTotal} (${Math.round(100*(singleCorrect+compareCorrect)/(singleTotal+compareTotal))}%)`);

  process.exit(0);
})();
