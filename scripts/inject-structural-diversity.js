#!/usr/bin/env node
/**
 * inject-structural-diversity.js
 *
 * Post-processes city pages to vary structural elements that Google
 * detects as template indicators:
 *
 * 1. Section headings (H2s) -- varied per city via deterministic hash
 * 2. FAQ questions -- selected from a pool of 8-12 per vertical, 3-5 shown per city
 * 3. CTA copy -- varied per city
 * 4. V2/V3/V4/V5 section headings -- varied per city
 *
 * Idempotent: tracks applied state via TP-STRUCT-DIV marker.
 * Safe: never modifies flagship content (inside FLAGSHIP markers).
 *
 * Usage: node scripts/inject-structural-diversity.js [vertical]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}
function pick(arr, seed) { return arr[seed % arr.length]; }

// ─── HEADING VARIATIONS ─────────────────────────────────────────────────
// Each key is the normalized heading pattern (with CITY placeholder).
// Values are arrays of alternative phrasings.

const H2_VARIATIONS = {
  // "What affects X cost in CITY"
  "what_affects": [
    (trade, city) => `What affects ${trade} cost in ${city}`,
    (trade, city) => `Why ${trade} prices vary in ${city}`,
    (trade, city) => `${city} ${trade} pricing factors`,
    (trade, city) => `What drives ${trade} quotes in ${city}`,
    (trade, city) => `Key cost drivers for ${trade} in ${city}`,
    (trade, city) => `Understanding ${trade} pricing in ${city}`,
    (trade, city) => `${trade} cost breakdown for ${city}`,
    (trade, city) => `What goes into a ${city} ${trade} quote`,
  ],
  // "X Cost by Y in CITY"
  "cost_by_size": [
    (trade, size, city) => `${trade} Cost by ${size} in ${city}`,
    (trade, size, city) => `${city} ${trade} pricing by ${size.toLowerCase()}`,
    (trade, size, city) => `How ${size.toLowerCase()} affects ${trade.toLowerCase()} cost in ${city}`,
    (trade, size, city) => `${trade} estimates by ${size.toLowerCase()} in ${city}`,
    (trade, size, city) => `${city} ${trade.toLowerCase()} price ranges by ${size.toLowerCase()}`,
  ],
  // "Frequently Asked Questions"
  "faq_heading": [
    (city, trade) => `Common ${trade.toLowerCase()} questions in ${city}`,
    (city, trade) => `${city} ${trade.toLowerCase()} FAQ`,
    (city, trade) => `Questions ${city} homeowners ask about ${trade.toLowerCase()}`,
    (city, trade) => `${trade} questions for ${city} homeowners`,
    (city, trade) => `What ${city} residents ask about ${trade.toLowerCase()}`,
    (city, trade) => `Frequently asked ${trade.toLowerCase()} questions`,
    (city, trade) => `${city} ${trade.toLowerCase()}: answers to common questions`,
  ],
  // "Other Services in CITY"
  "other_services": [
    (city) => `Other services in ${city}`,
    (city) => `More home services in ${city}`,
    (city) => `${city} contractor services`,
    (city) => `Related services in ${city}`,
    (city) => `Browse ${city} home services`,
    (city) => `Other projects in ${city}`,
  ],
  // "Get a free cost estimate for CITY"
  "cta_heading": [
    (city) => `Get a free cost estimate for ${city}`,
    (city) => `Compare ${city} contractor costs`,
    (city) => `Check pricing in ${city}`,
    (city) => `Get your ${city} estimate`,
    (city) => `See ${city} pricing`,
    (city) => `${city} cost comparison`,
  ],
  // V2: "About X in CITY, ST"
  "about_section": [
    (trade, cityState) => `About ${trade} in ${cityState}`,
    (trade, cityState) => `Understanding ${trade} costs in ${cityState}`,
    (trade, cityState) => `${cityState} ${trade} market overview`,
    (trade, cityState) => `${trade} pricing explained: ${cityState}`,
    (trade, cityState) => `What shapes ${trade} pricing in ${cityState}`,
    (trade, cityState) => `${cityState}: ${trade} cost factors`,
  ],
  // V3: "Local factors: X in CITY, ST"
  "local_factors": [
    (trade, cityState) => `Local factors: ${trade} in ${cityState}`,
    (trade, cityState) => `${cityState} ${trade}: local considerations`,
    (trade, cityState) => `What ${cityState} homeowners should know about ${trade}`,
    (trade, cityState) => `${trade} in ${cityState}: the local picture`,
    (trade, cityState) => `${cityState}-specific ${trade} considerations`,
    (trade, cityState) => `${trade} insights for ${cityState}`,
  ],
  // V4: "Pricing snapshot & nearby comparisons: CITY, ST"
  "pricing_snapshot": [
    (cityState) => `Pricing snapshot &amp; nearby comparisons: ${cityState}`,
    (cityState) => `${cityState} pricing vs. nearby cities`,
    (cityState) => `How ${cityState} compares to nearby markets`,
    (cityState) => `${cityState} cost comparison with neighbors`,
    (cityState) => `Regional pricing context: ${cityState}`,
  ],
  // V5: "What tradespeople earn in CITY, ST"
  "tradespeople_earn": [
    (cityState) => `What tradespeople earn in ${cityState}`,
    (cityState) => `${cityState} trade wages and labor costs`,
    (cityState) => `Labor rates in ${cityState}`,
    (cityState) => `${cityState} contractor wages: BLS data`,
    (cityState) => `Trade labor costs in ${cityState}`,
  ],
};

// ─── FAQ POOLS ──────────────────────────────────────────────────────────
// Each vertical has 10-15 FAQ Q&A pairs. Each city gets 3-5 selected by hash.

const FAQ_POOLS = {
  "hvac": [
    { q: (c) => `How much does a new HVAC system cost in ${c}?`, a: (c) => `Most homeowners in ${c} pay between $4,000 and $14,000 for a new HVAC system, depending on equipment type, efficiency rating, and home size.` },
    { q: () => `Should I replace my AC and furnace at the same time?`, a: () => `Replacing both at once is usually more cost-effective. Matched systems run more efficiently, and you save on labor since the contractor is already on-site.` },
    { q: () => `What SEER rating should I choose?`, a: () => `16 SEER is the sweet spot for most homeowners. Higher ratings save more on energy but have longer payback periods. In hot climates, 18+ SEER pays back faster.` },
    { q: (c) => `How long does HVAC installation take in ${c}?`, a: () => `A standard residential HVAC replacement takes 1-2 days. Complex jobs involving ductwork modification or system-type changes can take 3-5 days.` },
    { q: () => `What is the difference between a heat pump and a furnace?`, a: () => `A heat pump moves heat using refrigerant and handles both heating and cooling. A furnace burns fuel to create heat and requires a separate AC unit for cooling.` },
    { q: (c) => `When is the best time to replace HVAC in ${c}?`, a: (c) => `Off-peak seasons offer the best pricing and availability in ${c}. Spring and fall are typically 10-20% cheaper than emergency summer or winter replacements.` },
    { q: () => `How long does a new HVAC system last?`, a: () => `A properly maintained system lasts 15-20 years. Air conditioners and heat pumps last 12-17 years, while gas furnaces can reach 20-25 years with annual maintenance.` },
    { q: () => `Is a two-stage system worth the extra cost?`, a: () => `Two-stage and variable-speed systems run quieter, dehumidify better, and maintain more consistent temperatures. The $1,000-$2,500 premium pays back in 5-8 years through energy savings and comfort.` },
    { q: (c) => `Do I need a permit for HVAC replacement in ${c}?`, a: (c) => `Yes. Most ${c} jurisdictions require a mechanical permit for HVAC replacement. Your contractor should pull the permit and schedule the inspection.` },
    { q: () => `What size HVAC system do I need?`, a: () => `System size depends on home square footage, insulation quality, window area, and climate zone. A Manual J load calculation determines the correct size. Never accept rule-of-thumb sizing.` },
  ],
  "roof": [
    { q: (c) => `How much does a new roof cost in ${c}?`, a: (c) => `Most homeowners in ${c} pay between $8,000 and $16,000 for a new roof, depending on size, material, and complexity.` },
    { q: () => `How long does a roof replacement take?`, a: () => `Most residential roofs take 1-3 days to replace. Complex roofs with multiple layers, steep pitch, or extensive damage can take 4-7 days.` },
    { q: () => `Should I repair or replace my roof?`, a: () => `If damage covers less than 30% of the roof and the roof is under 15 years old, repair is usually sufficient. Beyond that, replacement provides better long-term value.` },
    { q: (c) => `What roofing material is best for ${c}?`, a: (c) => `Material choice depends on ${c}'s climate, your budget, and desired lifespan. Architectural shingles offer the best balance of cost and durability for most homeowners.` },
    { q: () => `Why do roofing quotes vary so much?`, a: () => `Quotes differ based on material quality, labor assumptions, flashing work, ventilation, and warranty coverage. Lower bids often exclude items that appear as change orders later.` },
    { q: () => `Does homeowners insurance cover roof replacement?`, a: () => `Insurance covers sudden damage (storms, falling trees) but not wear-and-tear or maintenance neglect. Verify your policy covers replacement cost, not depreciated value.` },
    { q: (c) => `Do I need a permit for roof replacement in ${c}?`, a: (c) => `Yes. Most ${c} jurisdictions require a building permit for roof replacement. Your contractor should handle the permit and schedule inspection.` },
    { q: () => `How many layers of shingles can I have?`, a: () => `Most building codes allow a maximum of two layers. If you already have two layers, the old roof must be torn off before the new one is installed, adding $1,000-$3,000 to the cost.` },
    { q: () => `What is the most affordable roofing option?`, a: () => `Three-tab asphalt shingles are the most affordable at $3-5 per square foot installed. Architectural shingles cost $4-7/sqft but last 10-15 years longer, making them a better value over time.` },
    { q: () => `Should I choose the lowest roofing quote?`, a: () => `Not always. Lower bids sometimes exclude flashing, ventilation upgrades, or disposal costs that appear later as change orders. Compare scope, not just price.` },
  ],
};

// Generate default FAQ pool for verticals without a custom pool
function defaultFAQPool(tradeName, tradeNoun) {
  return [
    { q: (c) => `How much does ${tradeNoun} cost in ${c}?`, a: (c) => `Costs in ${c} vary based on scope, materials, and labor rates. Get 3 quotes from licensed local contractors to compare pricing for your specific project.` },
    { q: (c) => `How do I find a good ${tradeName.toLowerCase()} contractor in ${c}?`, a: (c) => `Check licensing through your state's contractor board, verify insurance, read reviews from ${c} homeowners, and get at least 3 written quotes with line-item detail.` },
    { q: (c) => `Do I need a permit for ${tradeNoun} in ${c}?`, a: (c) => `Most ${tradeNoun} projects in ${c} require a permit. Your contractor should pull the permit and schedule the inspection. Never pull permits in your own name.` },
    { q: () => `How long does the project typically take?`, a: () => `Timeline depends on scope and complexity. Simple projects take 1-3 days; larger jobs can run 1-4 weeks. Weather, permits, and material delivery affect scheduling.` },
    { q: () => `Should I get multiple quotes?`, a: () => `Always get at least 3 written quotes. Compare line-item details, not just total price. The lowest quote often omits scope items that appear as change orders later.` },
    { q: () => `What should I look for in a contractor quote?`, a: () => `A professional quote breaks out labor, materials, permits, and cleanup separately. It includes a timeline, payment schedule, warranty terms, and the contractor's license number.` },
    { q: (c) => `When is the best time to schedule this work in ${c}?`, a: (c) => `Off-peak seasons offer better pricing and availability. In ${c}, scheduling during the shoulder season saves 10-20% versus peak-demand months.` },
    { q: () => `What warranty should I expect?`, a: () => `Expect a minimum 1-year workmanship warranty from the contractor plus manufacturer warranties on materials. Get warranty terms in writing before signing.` },
    { q: () => `How much should I pay upfront?`, a: () => `Never pay more than 10-15% as a deposit before work begins. Standard payment structure: deposit, progress payment when materials arrive, final payment on completion.` },
    { q: () => `What are common red flags in contractor quotes?`, a: () => `Red flags include: no line-item detail, same-day signing pressure, request for more than 30% upfront, no license or insurance verification, and verbal-only warranties.` },
  ];
}

const VERTICAL_INFO = {
  "hvac": { trade: "HVAC", noun: "HVAC replacement", sizeLabel: "Home Size" },
  "roof": { trade: "Roofing", noun: "roof replacement", sizeLabel: "House Size" },
  "plumbing": { trade: "Plumbing", noun: "plumbing work", sizeLabel: "Service" },
  "electrical": { trade: "Electrical", noun: "electrical work", sizeLabel: "Service" },
  "solar": { trade: "Solar", noun: "solar installation", sizeLabel: "System Size" },
  "kitchen-remodel": { trade: "Kitchen Remodel", noun: "kitchen remodel", sizeLabel: "Size" },
  "window": { trade: "Window Replacement", noun: "window replacement", sizeLabel: "Home Size" },
  "siding": { trade: "Siding", noun: "siding replacement", sizeLabel: "Home Size" },
  "painting": { trade: "Painting", noun: "exterior painting", sizeLabel: "Home Size" },
  "garage-door": { trade: "Garage Door", noun: "garage door replacement", sizeLabel: "Material" },
  "fence": { trade: "Fencing", noun: "fence installation", sizeLabel: "Yard Size" },
  "concrete": { trade: "Concrete", noun: "concrete work", sizeLabel: "Project Size" },
  "landscaping": { trade: "Landscaping", noun: "landscaping", sizeLabel: "Size" },
  "foundation": { trade: "Foundation Repair", noun: "foundation repair", sizeLabel: "Project Size" },
  "insulation": { trade: "Insulation", noun: "insulation", sizeLabel: "Attic Size" },
  "gutters": { trade: "Gutter", noun: "gutter installation", sizeLabel: "Yard Size" },
};

function parseCityState(filename) {
  // Extract vertical pattern from filename
  for (const [vslug, info] of Object.entries(VERTICAL_INFO)) {
    const suffix = `-${vslug}-cost.html`;
    if (filename.endsWith(suffix)) {
      const prefix = filename.replace(suffix, "");
      const parts = prefix.split("-");
      const stateCode = parts.pop().toUpperCase();
      const cityName = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      return { cityName, stateCode, cityState: `${cityName}, ${stateCode}`, vslug, info };
    }
  }
  return null;
}

function processFile(filepath) {
  const filename = path.basename(filepath);
  const parsed = parseCityState(filename);
  if (!parsed) return "skip_parse";

  const { cityName, stateCode, cityState, vslug, info } = parsed;
  let html = fs.readFileSync(filepath, "utf8");

  // Skip if already processed
  if (html.includes("TP-STRUCT-DIV-V1")) return "skip_existing";

  const seed = hash(filename);
  const { trade, noun, sizeLabel } = info;

  // === 1. Vary H2: "What affects X cost in CITY" ===
  const whatAffectsRe = new RegExp(
    `(<h2[^>]*>)\\s*What affects (?:${trade.toLowerCase()}|${noun.toLowerCase()})\\s+cost in ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(</h2>)`,
    "i"
  );
  if (whatAffectsRe.test(html)) {
    const variant = pick(H2_VARIATIONS.what_affects, seed);
    html = html.replace(whatAffectsRe, `$1${variant(noun, cityName)}$2`);
  }

  // === 2. Vary H2: "X Cost by Y in CITY" ===
  const costBySizeRe = new RegExp(
    `(<h2[^>]*>)\\s*(?:${trade}|${noun})\\s+Cost(?:s)?\\s+by\\s+${sizeLabel}\\s+in\\s+${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(</h2>)`,
    "i"
  );
  if (costBySizeRe.test(html)) {
    const variant = pick(H2_VARIATIONS.cost_by_size, seed + 1);
    html = html.replace(costBySizeRe, `$1${variant(trade, sizeLabel, cityName)}$2`);
  }

  // === 3. Vary H2: "Frequently Asked Questions" ===
  const faqHeadingRe = /(<h2[^>]*>)\s*Frequently Asked Questions\s*(<\/h2>)/i;
  if (faqHeadingRe.test(html)) {
    const variant = pick(H2_VARIATIONS.faq_heading, seed + 2);
    html = html.replace(faqHeadingRe, `$1${variant(cityName, trade)}$2`);
  }

  // === 4. Vary H2: "Other Services in CITY" ===
  const otherServicesRe = new RegExp(
    `(<h2[^>]*>)\\s*Other Services in ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(</h2>)`,
    "i"
  );
  if (otherServicesRe.test(html)) {
    const variant = pick(H2_VARIATIONS.other_services, seed + 3);
    html = html.replace(otherServicesRe, `$1${variant(cityName)}$2`);
  }

  // === 5. Vary CTA H2: "Get a free cost estimate for CITY" ===
  const ctaRe = new RegExp(
    `(<h2[^>]*>)\\s*Get a free (?:cost |solar )?estimate for ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(</h2>)`,
    "i"
  );
  if (ctaRe.test(html)) {
    const variant = pick(H2_VARIATIONS.cta_heading, seed + 4);
    html = html.replace(ctaRe, `$1${variant(cityName)}$2`);
  }

  // === 6. Vary V2 "About X in CITY, ST" ===
  const aboutRe = new RegExp(
    `(<h2[^>]*>)\\s*About [^<]+ in ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*${stateCode}\\s*(</h2>)`,
    "i"
  );
  if (aboutRe.test(html)) {
    const variant = pick(H2_VARIATIONS.about_section, seed + 5);
    html = html.replace(aboutRe, `$1${variant(noun, cityState)}$2`);
  }

  // === 7. Vary V3 "Local factors: X in CITY, ST" ===
  const localRe = new RegExp(
    `(<h2[^>]*>)\\s*Local factors: [^<]+ in ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*${stateCode}\\s*(</h2>)`,
    "i"
  );
  if (localRe.test(html)) {
    const variant = pick(H2_VARIATIONS.local_factors, seed + 6);
    html = html.replace(localRe, `$1${variant(noun, cityState)}$2`);
  }

  // === 8. Vary V4 "Pricing snapshot & nearby comparisons" ===
  const pricingRe = new RegExp(
    `(<h2[^>]*>)\\s*Pricing snapshot[^<]+${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*(</h2>)`,
    "i"
  );
  if (pricingRe.test(html)) {
    const variant = pick(H2_VARIATIONS.pricing_snapshot, seed + 7);
    html = html.replace(pricingRe, `$1${variant(cityState)}$2`);
  }

  // === 9. Vary V5 "What tradespeople earn in CITY, ST" ===
  const wageRe = new RegExp(
    `(<h2[^>]*>)\\s*What tradespeople earn in ${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*${stateCode}\\s*(</h2>)`,
    "i"
  );
  if (wageRe.test(html)) {
    const variant = pick(H2_VARIATIONS.tradespeople_earn, seed + 8);
    html = html.replace(wageRe, `$1${variant(cityState)}$2`);
  }

  // === 10. Vary FAQ questions (swap in different Q&A from pool) ===
  const pool = FAQ_POOLS[vslug] || defaultFAQPool(trade, noun);
  if (pool.length >= 5) {
    // Select 3-5 questions for this city
    const count = 3 + (seed % 3); // 3, 4, or 5 questions
    const selected = [];
    const used = new Set();
    for (let i = 0; i < count && i < pool.length; i++) {
      let idx = (seed + i * 7) % pool.length;
      while (used.has(idx)) idx = (idx + 1) % pool.length;
      used.add(idx);
      selected.push(pool[idx]);
    }

    // Replace the FAQ section content
    const faqListRe = /(<div class="faq-list">)([\s\S]*?)(<\/div>\s*<\/section>)/;
    const faqMatch = html.match(faqListRe);
    if (faqMatch) {
      let newFaqHtml = "\n";
      for (const faq of selected) {
        const question = typeof faq.q === "function" ? faq.q(cityName) : faq.q;
        const answer = typeof faq.a === "function" ? faq.a(cityName) : faq.a;
        newFaqHtml += `\n<details class="faq-item">\n<summary>${question}</summary>\n<div class="faq-answer">\n<p>${answer}</p>\n</div>\n</details>\n`;
      }
      newFaqHtml += "\n";
      html = html.replace(faqListRe, `$1${newFaqHtml}$3`);
    }

    // Also update FAQ JSON-LD in head
    const faqJsonRe = /("@type":"FAQPage","mainEntity":\[)([\s\S]*?)(\]\})/;
    const jsonMatch = html.match(faqJsonRe);
    if (jsonMatch) {
      const jsonEntries = selected.map(faq => {
        const q = (typeof faq.q === "function" ? faq.q(cityName) : faq.q).replace(/"/g, '\\"');
        const a = (typeof faq.a === "function" ? faq.a(cityName) : faq.a).replace(/"/g, '\\"');
        return `{"@type":"Question","name":"${q}","acceptedAnswer":{"@type":"Answer","text":"${a}"}}`;
      });
      html = html.replace(faqJsonRe, `$1${jsonEntries.join(",")}$3`);
    }
  }

  // Add processing marker (invisible comment at end of body)
  html = html.replace("</body>", "<!-- TP-STRUCT-DIV-V1 -->\n</body>");

  fs.writeFileSync(filepath, html, "utf8");
  return "updated";
}

function main() {
  const filterVertical = process.argv[2];
  const allFiles = fs.readdirSync(ROOT).filter(f => f.endsWith("-cost.html"));

  const stats = { updated: 0, skip_existing: 0, skip_parse: 0 };
  let lastVertical = "";

  for (let i = 0; i < allFiles.length; i++) {
    const f = allFiles[i];
    const parsed = parseCityState(f);
    if (!parsed) { stats.skip_parse++; continue; }
    if (filterVertical && parsed.vslug !== filterVertical) continue;

    if (parsed.vslug !== lastVertical) {
      if (lastVertical) console.log(`  -> ${stats.updated} updated`);
      console.log(`${parsed.vslug}...`);
      lastVertical = parsed.vslug;
    }

    const result = processFile(path.join(ROOT, f));
    stats[result] = (stats[result] || 0) + 1;

    if ((i + 1) % 500 === 0) {
      process.stdout.write(`  progress ${i + 1}/${allFiles.length}\r`);
    }
  }
  if (lastVertical) console.log(`  -> ${stats.updated} updated`);

  console.log(`\n=== DONE ===`);
  console.log(`  updated: ${stats.updated}`);
  console.log(`  skip_existing: ${stats.skip_existing}`);
  console.log(`  skip_parse: ${stats.skip_parse}`);
}

main();
