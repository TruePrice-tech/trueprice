// Test real quote images through the live API, capture full parsed response.
// Usage: node test-quote-accuracy.js

const fs = require("fs");
const path = require("path");

const BASE = "https://woogoro.com";

// Only real quote images + comparison images for plumbing and roofing
const TESTS = [
  // --- PLUMBING SINGLE QUOTES (real Reddit images) ---
  { file: "test-quotes/plumbing-images/06-help-me-understand-the-invoicenote-from-a-plumber.jpeg", api: "/api/plumbing-estimate", label: "PLUMBING-06 Roto-Rooter invoice (phone photo of paper)" },
  { file: "test-quotes/plumbing-images/10-is-this-estimate-crazy-or-am-i.jpeg", api: "/api/plumbing-estimate", label: "PLUMBING-10 Water heater swap (digital screenshot)" },

  // --- ROOFING SINGLE QUOTES (real Reddit images) ---
  { file: "test-quotes/roofing-images/03-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg", api: "/api/parse-quote", label: "ROOFING-03 Metal roof estimate (digital screenshot)" },
  { file: "test-quotes/roofing-images/07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg", api: "/api/parse-quote", label: "ROOFING-07 Roof replacement form (phone photo of paper)" },

  // --- PLUMBING COMPARISON: clean ---
  { file: "test-quotes/plumbing-images/comparison-wh-01-low.png", api: "/api/plumbing-estimate", label: "PLUMBING-CMP-01 Budget clean (synthetic)" },
  { file: "test-quotes/plumbing-images/comparison-wh-02-mid.png", api: "/api/plumbing-estimate", label: "PLUMBING-CMP-02 Westside clean (synthetic)" },
  { file: "test-quotes/plumbing-images/comparison-wh-03-high.png", api: "/api/plumbing-estimate", label: "PLUMBING-CMP-03 Premier clean (synthetic)" },

  // --- PLUMBING COMPARISON: messy ---
  { file: "test-quotes/plumbing-images/messy-comparison-wh-01-low.jpg", api: "/api/plumbing-estimate", label: "PLUMBING-MESSY-01 Budget messy (JPEG degraded)" },
  { file: "test-quotes/plumbing-images/messy-comparison-wh-02-mid.jpg", api: "/api/plumbing-estimate", label: "PLUMBING-MESSY-02 Westside messy (JPEG degraded)" },
  { file: "test-quotes/plumbing-images/messy-comparison-wh-03-high.jpg", api: "/api/plumbing-estimate", label: "PLUMBING-MESSY-03 Premier messy (JPEG degraded)" },

  // --- ROOFING COMPARISON: clean ---
  { file: "test-quotes/roofing-images/comparison-roof-01-low.png", api: "/api/parse-quote", label: "ROOFING-CMP-01 Budget clean (synthetic)" },
  { file: "test-quotes/roofing-images/comparison-roof-02-mid.png", api: "/api/parse-quote", label: "ROOFING-CMP-02 Heritage clean (synthetic)" },
  { file: "test-quotes/roofing-images/comparison-roof-03-high.png", api: "/api/parse-quote", label: "ROOFING-CMP-03 Pinnacle clean (synthetic)" },

  // --- ROOFING COMPARISON: messy ---
  { file: "test-quotes/roofing-images/messy-comparison-roof-01-low.jpg", api: "/api/parse-quote", label: "ROOFING-MESSY-01 Budget messy (JPEG degraded)" },
  { file: "test-quotes/roofing-images/messy-comparison-roof-02-mid.jpg", api: "/api/parse-quote", label: "ROOFING-MESSY-02 Heritage messy (JPEG degraded)" },
  { file: "test-quotes/roofing-images/messy-comparison-roof-03-high.jpg", api: "/api/parse-quote", label: "ROOFING-MESSY-03 Pinnacle messy (JPEG degraded)" },
];

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "image/jpeg";
}

async function testImage(test) {
  const filePath = path.resolve(test.file);
  if (!fs.existsSync(filePath)) {
    return { label: test.label, error: "FILE NOT FOUND", data: null };
  }

  const imageData = fs.readFileSync(filePath);
  const base64 = imageData.toString("base64");
  const mime = getMimeType(filePath);
  const dataUrl = `data:${mime};base64,${base64}`;
  const sizeKB = Math.round(imageData.length / 1024);

  const t0 = Date.now();
  try {
    const resp = await fetch(BASE + test.api, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://woogoro.com",
        "Referer": "https://woogoro.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ images: [dataUrl] }),
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return { label: test.label, error: `HTTP ${resp.status}: ${errText.slice(0, 100)}`, sizeKB, elapsed, data: null };
    }

    const json = await resp.json();
    return { label: test.label, sizeKB, elapsed, data: json };
  } catch (e) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    return { label: test.label, error: e.message, sizeKB, elapsed, data: null };
  }
}

(async () => {
  console.log("=== QUOTE ACCURACY TEST ===");
  console.log(`Testing ${TESTS.length} images against live API\n`);

  const allResults = [];

  for (const test of TESTS) {
    process.stdout.write(`Testing: ${test.label} ... `);
    const result = await testImage(test);
    allResults.push(result);

    if (result.error) {
      console.log(`ERROR (${result.elapsed || "?"}s, ${result.sizeKB || "?"}KB) - ${result.error}`);
    } else {
      const d = result.data?.data || result.data || {};
      const price = d.totalPrice || d.price || "NONE";
      const contractor = d.contractor || "?";
      console.log(`$${price} | ${contractor} (${result.elapsed}s, ${result.sizeKB}KB)`);
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  // Write full results to JSON
  const outPath = path.resolve("test-quote-accuracy-results.json");
  fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2));
  console.log(`\nFull results written to: ${outPath}`);

  // Summary table
  console.log("\n=== SUMMARY ===\n");
  for (const r of allResults) {
    const d = r.data?.data || r.data || {};
    const price = d.totalPrice || d.price || null;
    const contractor = d.contractor || null;
    const city = d.city || null;
    const state = d.stateCode || null;
    const confidence = d.confidence || null;
    const lineItems = d.lineItems ? d.lineItems.length : 0;
    const scopeItems = d.scopeItems ? Object.entries(d.scopeItems).filter(([,v]) => v === "included" || v === "yes").length : 0;
    const scopeTotal = d.scopeItems ? Object.keys(d.scopeItems).length : 0;

    console.log(`${r.label}`);
    if (r.error) {
      console.log(`  ERROR: ${r.error}`);
    } else {
      console.log(`  Price: ${price !== null ? "$" + price : "NONE"} | Contractor: ${contractor || "NONE"} | Location: ${city || "?"}, ${state || "?"}`);
      console.log(`  Confidence: ${confidence || "?"} | Line items: ${lineItems} | Scope: ${scopeItems}/${scopeTotal}`);
      if (d.jobType) console.log(`  Job type: ${d.jobType}`);
      if (d.material) console.log(`  Material: ${d.material}`);
      if (d.fixture) console.log(`  Fixture: ${d.fixture}`);
      if (d.brand) console.log(`  Brand: ${d.brand}`);
      if (d.pipeType) console.log(`  Pipe: ${d.pipeType}`);
      if (d.warrantyParts || d.warrantyLabor || d.warranty) console.log(`  Warranty: parts=${d.warrantyParts || d.warranty || "?"} labor=${d.warrantyLabor || "?"}`);
      if (d.redFlags && d.redFlags.length) console.log(`  Red flags: ${d.redFlags.length}`);
    }
    console.log();
  }
})();
