#!/usr/bin/env node
// FAQ corruption sweeper — strips the corrupted aftermath of the FAQ section
// and injects a calc-sourced replacement with city-name interpolation.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const VERTICAL = process.argv[2];
const DRY_RUN = process.argv.includes("--dry");
const CITY_PAGES_GLOB = `*-${VERTICAL}-cost.html`;

const VERTICAL_RULES = {
  insulation: {
    junkStartFragment: "</section>.50/sqft for batt insulation in walls, and ",
    legitCloseLen: "</section>".length,
    cityH1: /<h1>Insulation Cost in ([^,<]+), [A-Z]{2}<\/h1>/,
    replacement: (city) => `<section class="section">
<h2>More questions about insulation in ${city}</h2>
<div class="faq-list">

<details class="faq-item">
<summary>What does spray foam cost per square foot?</summary>
<div class="faq-answer">
<p>Open-cell spray foam runs $1.50-$3.50 per square foot installed nationally. Closed-cell, with a higher R-value and built-in vapor barrier, runs $2.50-$5.50 per square foot. Walls and crawl spaces add 15-20% over attic-floor pricing.</p>
</div>
</details>

<details class="faq-item">
<summary>How much does a 1,500 sq ft attic cost to insulate?</summary>
<div class="faq-answer">
<p>Typical 2026 ranges for a 1,500 sq ft attic: blown-in cellulose $1,500-$3,500, fiberglass batts $1,500-$3,000, open-cell spray foam $2,500-$5,000, closed-cell spray foam $4,000-$8,000. Removing old insulation adds about 25%; air sealing top plates and penetrations adds $300-$700 and pays back within a few heating seasons.</p>
</div>
</details>

<details class="faq-item">
<summary>Do I need a permit for insulation in ${city}?</summary>
<div class="faq-answer">
<p>Most blown-in attic jobs in ${city} do not require a permit. Spray foam projects often do, especially in walls or crawl spaces where ignition-barrier code applies. Confirm with your contractor — pulling the permit is the contractor's job, not yours.</p>
</div>
</details>

</div>
</section>`,
  },
  electrical: {
    junkStartFragment: "</section>00 if wiring can be run through accessible spaces",
    legitCloseLen: "</section>".length,
    cityH1: /<h1>Electrical (?:Cost|Work Cost) in ([^,<]+), [A-Z]{2}<\/h1>/,
    replacement: (city) => `<section class="section">
<h2>More questions about electrical work in ${city}</h2>
<div class="faq-list">

<details class="faq-item">
<summary>How much does a 200-amp panel upgrade cost?</summary>
<div class="faq-answer">
<p>A 100-to-200-amp service panel upgrade runs $1,850-$3,600 nationally in 2026. Older homes with damaged service entrance cable, undersized meter sockets, or grounding rod upgrades push the higher end. Permit and inspection are mandatory and are usually pulled by the licensed electrician, not the homeowner.</p>
</div>
</details>

<details class="faq-item">
<summary>How much does it cost to add an outlet?</summary>
<div class="faq-answer">
<p>Adding a standard 120V outlet on an existing circuit costs $150-$300 if the wiring runs through accessible attic, basement, or crawl space. Opening finished walls, fishing wire, or running a dedicated circuit pushes the price to $300-$600 per outlet. Dedicated 240V outlets for ranges, dryers, or EV chargers run $400-$1,500.</p>
</div>
</details>

<details class="faq-item">
<summary>What does a whole-house generator cost in ${city}?</summary>
<div class="faq-answer">
<p>A whole-house standby generator runs $5,000-$15,000 installed in ${city}, depending on wattage (14kW-24kW), fuel type (natural gas or propane), and the transfer switch configuration. Concrete pad, gas-line trenching, and load calculation are billed separately on most quotes.</p>
</div>
</details>

<details class="faq-item">
<summary>Do I need a permit for electrical work in ${city}?</summary>
<div class="faq-answer">
<p>Panel changes, new circuits, service upgrades, and sub-panel additions in ${city} require a permit and inspection. Like-for-like fixture or outlet swaps usually do not. Your contractor pulls the permit and schedules the inspector — never let a contractor ask you to pull permits in your own name.</p>
</div>
</details>

</div>
</section>`,
  },
  concrete: {
    junkStartFragment: "</section>0,000. A slab foundation for a house costs",
    legitCloseLen: "</section>".length,
    cityH1: /<h1>Concrete (?:Cost|Work Cost) in ([^,<]+), [A-Z]{2}<\/h1>/,
    replacement: (city) => `<section class="section">
<h2>More questions about concrete in ${city}</h2>
<div class="faq-list">

<details class="faq-item">
<summary>What does a concrete driveway cost per square foot?</summary>
<div class="faq-answer">
<p>Plain 4-inch concrete runs $6-$12 per square foot installed in 2026. Stamped concrete adds $4-$8/sqft for pattern and color. Heavy-duty 6-inch driveways for RVs or trucks cost $9-$15/sqft. A 600 sq ft two-car driveway typically lands between $5,800 and $8,100.</p>
</div>
</details>

<details class="faq-item">
<summary>How much does a 1,000 sq ft concrete patio cost?</summary>
<div class="faq-answer">
<p>Typical 2026 ranges for a 1,000 sq ft project: plain broom-finish $8,000-$12,000, exposed-aggregate $9,500-$14,500, stamped $11,000-$16,500. Tearing out an existing slab adds $1,500-$3,000. Reinforcing wire mesh and rebar are usually $0.50-$1.00/sqft and worth it on driveways, optional on patios.</p>
</div>
</details>

<details class="faq-item">
<summary>What does a slab foundation cost in ${city}?</summary>
<div class="faq-answer">
<p>A monolithic slab foundation for a typical single-family house in ${city} runs $5,000-$15,000 depending on square footage and soil conditions. A garage slab is $2,500-$6,000. Full basement foundations are a different scope entirely and run $15,000-$30,000.</p>
</div>
</details>

<details class="faq-item">
<summary>Do I need a permit for concrete work in ${city}?</summary>
<div class="faq-answer">
<p>Driveways, patios over a certain size, and any structural slab in ${city} require a permit and an inspection of the base prep and rebar before the pour. Sidewalks, repairs, and resurfacing usually do not. Your contractor pulls the permit — never pull it in your own name.</p>
</div>
</details>

</div>
</section>`,
  },
  landscaping: {
    junkStartFragment: "</section>0-$50/yard.</p>",
    legitCloseLen: "</section>".length,
    cityH1: /<h1>Landscaping (?:Cost|Work Cost) in ([^,<]+), [A-Z]{2}<\/h1>/,
    replacement: (city) => `<section class="section">
<h2>More questions about landscaping in ${city}</h2>
<div class="faq-list">

<details class="faq-item">
<summary>How much does mulch cost per yard?</summary>
<div class="faq-answer">
<p>Bulk mulch costs $25-$50 per cubic yard delivered. Plan 3 inches deep — one cubic yard covers about 108 sq ft. A 1,000 sq ft bed needs roughly 10 yards ($250-$500 in materials) plus $30-$50/yard for professional spreading and edging.</p>
</div>
</details>

<details class="faq-item">
<summary>What does a sprinkler system cost in ${city}?</summary>
<div class="faq-answer">
<p>A residential irrigation system in ${city} costs $2,500-$5,000 for a quarter-acre lot with 4-6 zones. Smart wifi controllers add $100-$300 and cut water usage 20-40%. Drip-irrigation zones for planting beds cost $500-$1,000 extra and are worth it on shrubs and perennials.</p>
</div>
</details>

<details class="faq-item">
<summary>How much does sod installation cost?</summary>
<div class="faq-answer">
<p>Sod costs $1-$2 per square foot installed including soil prep and rolling. Hydroseeding runs $0.05-$0.10/sqft and establishes in 4-6 weeks. Traditional broadcast seeding is the cheapest at $0.10-$0.25/sqft but needs 6-8 weeks and frequent watering. A 5,000 sq ft lawn lands between $5,000 and $10,000 in sod.</p>
</div>
</details>

<details class="faq-item">
<summary>Do I need a permit for landscaping in ${city}?</summary>
<div class="faq-answer">
<p>Most landscaping in ${city} — planting, mulching, sod, basic irrigation — does not need a permit. Retaining walls over 4 feet, drainage tied to the storm system, tree removal in some neighborhoods, and any grading that changes lot drainage usually do. Confirm with your landscaper before they start digging.</p>
</div>
</details>

</div>
</section>`,
  },
};

function listGitFiles(pattern) {
  const out = execSync(`git ls-files -- ${JSON.stringify(pattern)}`, { encoding: "utf8" });
  return out.split("\n").filter(Boolean).filter(p => !p.includes("/"));
}

// Find the END of the corruption block: the position of the next legitimate
// section / style block / TP-comment marker after the junk-start fragment.
function findCorruptionEndIndex(html, junkStartIdx) {
  const slice = html.slice(junkStartIdx);
  // Candidate end markers (any of these begin clean post-corruption content):
  const markers = [
    /<style>\r?\n\.fp-section/,
    /<section class="section">\r?\n<h2>/,
    /<section class="section fp-section">/,
    /<!-- TP-LOCAL-INJECTED-/,
    /<!-- TP-NEARBY-CITIES -->/,
    /<!-- TP-INTERNAL-TOOLS-BLOCK -->/,
    /<\/main>/,
  ];
  let bestIdx = -1;
  for (const re of markers) {
    const m = slice.match(re);
    if (m && (bestIdx < 0 || m.index < bestIdx)) bestIdx = m.index;
  }
  return bestIdx < 0 ? -1 : junkStartIdx + bestIdx;
}

function fixFile(filePath, rule) {
  const html = fs.readFileSync(filePath, "utf8");
  const fpIdx = html.indexOf(rule.junkStartFragment);
  if (fpIdx < 0) return { changed: false, reason: "no-fingerprint" };
  const cityMatch = html.match(rule.cityH1);
  if (!cityMatch) return { changed: false, reason: "no-city-h1" };
  const city = cityMatch[1].trim();
  // junk starts AFTER the legit </section> close
  const junkStartIdx = fpIdx + rule.legitCloseLen;
  const corruptionEndIdx = findCorruptionEndIndex(html, junkStartIdx);
  if (corruptionEndIdx < 0) return { changed: false, reason: "no-end-marker" };
  const usesCRLF = html.includes("\r\n");
  const nl = usesCRLF ? "\r\n" : "\n";
  let replacement = rule.replacement(city);
  if (usesCRLF) replacement = replacement.replace(/\n/g, "\r\n");
  const before = html.slice(0, junkStartIdx);
  const after = html.slice(corruptionEndIdx);
  const next = before + nl + nl + replacement + nl + nl + after;
  if (next === html) return { changed: false, reason: "no-change" };
  if (!DRY_RUN) fs.writeFileSync(filePath, next);
  return { changed: true, city, junkLen: corruptionEndIdx - junkStartIdx };
}

(function main() {
  if (!VERTICAL || !VERTICAL_RULES[VERTICAL]) {
    console.error("Usage: node _faq-corruption-fix.js <vertical> [--dry]");
    console.error("Verticals:", Object.keys(VERTICAL_RULES).join(", "));
    process.exit(1);
  }
  const rule = VERTICAL_RULES[VERTICAL];
  const files = listGitFiles(CITY_PAGES_GLOB);
  let fixed = 0, mismatches = [], junkLens = [];
  for (const f of files) {
    const r = fixFile(f, rule);
    if (r.changed) { fixed++; junkLens.push(r.junkLen); }
    else if (r.reason !== "no-fingerprint") mismatches.push(`${f}: ${r.reason}`);
  }
  const avgJunk = junkLens.length ? Math.round(junkLens.reduce((a,b)=>a+b, 0) / junkLens.length) : 0;
  const minJunk = junkLens.length ? Math.min(...junkLens) : 0;
  const maxJunk = junkLens.length ? Math.max(...junkLens) : 0;
  console.log(`vertical=${VERTICAL}  total=${files.length}  fixed=${fixed}  mismatches=${mismatches.length}${DRY_RUN ? "  (DRY RUN)" : ""}`);
  console.log(`junk-stripped: avg=${avgJunk} chars, min=${minJunk}, max=${maxJunk}`);
  if (mismatches.length) { console.log("\nMismatches:"); mismatches.forEach(m => console.log("  - " + m)); }
})();
