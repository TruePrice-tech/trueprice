#!/usr/bin/env node
/**
 * vary-baked-in-boilerplate.js
 *
 * Post-build sweep that targets the last-remaining shared sentences on city
 * pages — the ones baked into the initial HTML at build time that audit scripts
 * and inject-* scripts can't touch from outside. For each known boilerplate
 * string, pick a seeded variant based on (city, vertical) so same-vertical
 * pages no longer share the exact sentence after city-name normalization.
 *
 * Idempotent: marker at bottom of body prevents re-application.
 *
 * Usage: node scripts/vary-baked-in-boilerplate.js [vertical-slug]
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const MARKER = "<!-- TP-BAKED-VARIANCE-V3 -->";

function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 16777619)) >>> 0;
  return h;
}
function pick(arr, seed) { return arr[seed % arr.length]; }

const VERTICAL_SUFFIXES = {
  "hvac": "hvac-cost",
  "roof": "roof-cost",
  "plumbing": "plumbing-cost",
  "electrical": "electrical-cost",
  "solar": "solar-cost",
  "kitchen-remodel": "kitchen-remodel-cost",
  "window": "window-cost",
  "siding": "siding-cost",
  "painting": "painting-cost",
  "garage-door": "garage-door-cost",
  "fence": "fence-cost",
  "concrete": "concrete-cost",
  "landscaping": "landscaping-cost",
  "foundation": "foundation-cost",
  "insulation": "insulation-cost",
  "gutter": "gutter-cost",
  "auto-repair": "auto-repair-cost",
  "medical": "medical-cost",
  "legal": "legal-cost",
  "moving": "moving-cost",
};

// Vertical display labels (used in some pool variants)
const VERTICAL_LABEL = {
  "hvac": "HVAC",
  "roof": "roofing",
  "plumbing": "plumbing",
  "electrical": "electrical work",
  "solar": "solar",
  "kitchen-remodel": "kitchen remodel",
  "window": "window replacement",
  "siding": "siding",
  "painting": "painting",
  "garage-door": "garage door",
  "fence": "fencing",
  "concrete": "concrete",
  "landscaping": "landscaping",
  "foundation": "foundation",
  "insulation": "insulation",
  "gutter": "gutter",
  "auto-repair": "auto repair",
  "medical": "medical services",
  "legal": "legal services",
  "moving": "moving services",
};

// Product-phrase per vertical: used in "Average X cost in CITY" intros
const VERTICAL_PRODUCT = {
  "hvac": "HVAC replacement",
  "roof": "roof replacement",
  "plumbing": "plumbing",
  "electrical": "electrical work",
  "solar": "solar installation",
  "kitchen-remodel": "kitchen remodel",
  "window": "window replacement",
  "siding": "siding replacement",
  "painting": "exterior painting",
  "garage-door": "garage door replacement",
  "fence": "fence installation",
  "concrete": "concrete work",
  "landscaping": "landscaping",
  "foundation": "foundation repair",
  "insulation": "insulation",
  "gutter": "gutter installation",
  "auto-repair": "auto repair",
  "medical": "medical procedure",
  "legal": "legal service",
  "moving": "moving service",
};

// Verb used in "Do I need a permit to X in CITY?" FAQ Q
const VERTICAL_VERB = {
  "hvac": "replace HVAC",
  "roof": "replace my roof",
  "plumbing": "do plumbing work",
  "electrical": "do electrical work",
  "solar": "install solar",
  "kitchen-remodel": "remodel my kitchen",
  "window": "replace my windows",
  "siding": "replace my siding",
  "painting": "paint my home",
  "garage-door": "replace my garage door",
  "fence": "build a fence",
  "concrete": "do concrete work",
  "landscaping": "do landscaping work",
  "foundation": "repair my foundation",
  "insulation": "add insulation",
  "gutter": "install gutters",
  "auto-repair": "do auto repair",
  "medical": "get a medical service",
  "legal": "get a legal service",
  "moving": "get moving services",
};

// Short noun for "When is the best time to X in CITY?" phrasing
const VERTICAL_NOUN = {
  "hvac": "replace HVAC",
  "roof": "replace a roof",
  "plumbing": "do plumbing work",
  "electrical": "do electrical work",
  "solar": "install solar",
  "kitchen-remodel": "remodel a kitchen",
  "window": "replace windows",
  "siding": "replace siding",
  "painting": "paint a home",
  "garage-door": "replace a garage door",
  "fence": "build a fence",
  "concrete": "pour concrete",
  "landscaping": "do landscaping",
  "foundation": "repair a foundation",
  "insulation": "add insulation",
  "gutter": "install gutters",
  "auto-repair": "do auto repair",
  "medical": "schedule a procedure",
  "legal": "engage a lawyer",
  "moving": "schedule a move",
};

function parseFile(filename) {
  for (const [vslug, suffix] of Object.entries(VERTICAL_SUFFIXES)) {
    const s = `-${suffix}.html`;
    if (!filename.endsWith(s)) continue;
    const prefix = filename.slice(0, -s.length);
    const parts = prefix.split("-");
    const state = parts.pop().toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) return null;
    const city = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    if (!city) return null;
    return { vslug, city, state };
  }
  return null;
}

// Replacement rules. Each rule looks for an EXACT sentence/phrase in the HTML
// (with CITY and STATE placeholders) and swaps it for one of N variants picked
// by seed. Rules target strings that audit diagnostic showed as shared by 5+/10
// sampled pages.
function buildRules(city, state, vslug) {
  const seed = hash(`${city}|${state}|${vslug}`);
  const vlabel = VERTICAL_LABEL[vslug] || vslug;

  const rules = [];

  // 1. "No spam, unsubscribe anytime." (form pre-text)
  rules.push({
    find: "No spam, unsubscribe anytime.",
    replace: pick([
      "No spam, unsubscribe anytime.",
      "We don't share your email. Unsubscribe whenever.",
      "One-click unsubscribe. No third-party sharing.",
      "Email only used for pricing updates. Unsubscribe anytime.",
    ], seed + 1),
  });

  // 2. "Upload it and Iris will check all N items for you."
  for (const n of [10, 11, 12, 13, 14, 15]) {
    rules.push({
      find: `Upload it and Iris will check all ${n} items for you.`,
      replace: pick([
        `Upload it and Iris will check all ${n} items for you.`,
        `Send it over — Iris audits all ${n} checklist items.`,
        `Drop it in and let Iris verify all ${n} items.`,
        `Share your quote; Iris reviews all ${n} items for you.`,
      ], seed + 2),
    });
  }

  // 3. "Missing any could mean surprise costs later."
  rules.push({
    find: "Missing any could mean surprise costs later.",
    replace: pick([
      "Missing any could mean surprise costs later.",
      "Gaps here often show up as change orders on the invoice.",
      "Items left off the quote tend to reappear as charges later.",
      "Skipped items often become unexpected line items later.",
    ], seed + 3),
  });

  // 4. Section intro "Average X cost in CITY vs. nearby cities." (use per-vertical product)
  const product = VERTICAL_PRODUCT[vslug] || vlabel;
  const avgCostPhrases = [
    `Average ${product} cost in ${city} vs. nearby cities.`,
    `Average ${vlabel} cost in ${city} vs. nearby cities.`,
    `Average ${vlabel} replacement cost in ${city} vs. nearby cities.`,
  ];
  for (const find of avgCostPhrases) {
    rules.push({
      find,
      replace: pick([
        find,
        `How ${city}'s ${product} pricing compares to nearby metros.`,
        `${city} ${product} pricing against its neighbors.`,
        `${product} costs: ${city} vs. the surrounding region.`,
      ], seed + 4),
    });
  }

  // 10. "How CITY Compares" H2 heading
  rules.push({
    find: `<h2>How ${city} Compares</h2>`,
    replace: pick([
      `<h2>How ${city} Compares</h2>`,
      `<h2>${city} vs. nearby markets</h2>`,
      `<h2>Where ${city} sits regionally</h2>`,
      `<h2>${city}'s pricing in context</h2>`,
    ], seed + 10),
  });

  // 11. FAQ Q: "Do I need a permit to X in CITY?"
  const verb = VERTICAL_VERB[vslug] || `do ${vlabel} work`;
  rules.push({
    find: `Do I need a permit to ${verb} in ${city}?`,
    replace: pick([
      `Do I need a permit to ${verb} in ${city}?`,
      `Are permits required to ${verb} in ${city}?`,
      `Is a ${city} permit needed to ${verb}?`,
      `${city} permits: required to ${verb}?`,
    ], seed + 11),
  });

  // 12. FAQ Q: "When is the best time to X in CITY?"
  const noun = VERTICAL_NOUN[vslug] || `do ${vlabel} work`;
  rules.push({
    find: `When is the best time to ${noun} in ${city}?`,
    replace: pick([
      `When is the best time to ${noun} in ${city}?`,
      `What's the best season to ${noun} in ${city}?`,
      `Best time of year to ${noun} in ${city}?`,
      `When should I ${noun} in ${city}?`,
    ], seed + 12),
  });

  // 13. CTA lead-in: "Check my price in CITY or compare quotes side by side"
  rules.push({
    find: `Check my price in ${city} or compare quotes side by side`,
    replace: pick([
      `Check my price in ${city} or compare quotes side by side`,
      `See ${city} pricing or compare multiple quotes`,
      `Get a ${city} estimate or compare quotes side by side`,
      `Price check for ${city} or compare quotes at a glance`,
    ], seed + 13),
  });

  // 14. Nearby-cities section header (one-line)
  rules.push({
    find: `Nearby cities cost comparison.`,
    replace: pick([
      `Nearby cities cost comparison.`,
      `How nearby cities compare on cost.`,
      `Neighboring-city cost comparison.`,
      `Regional city cost comparison.`,
    ], seed + 14),
  });

  // 15. Pricing disclaimer: "Your own quote can fall outside this band..."
  rules.push({
    find: `Your own quote can fall outside this band depending on scope, materials tier, and contractor, but this is the middle 80% of quotes we see.`,
    replace: pick([
      `Your own quote can fall outside this band depending on scope, materials tier, and contractor, but this is the middle 80% of quotes we see.`,
      `Individual quotes can sit outside this range based on scope, materials, and contractor — but this band captures 80% of what we see.`,
      `Your specific quote may land outside this band (scope, materials tier, and contractor all matter), but it covers the middle 80% of quotes.`,
      `Scope, material grade, and contractor all shift individual quotes, so yours may fall outside — this band is the middle 80% of quotes we observe.`,
    ], seed + 15),
  });

  // 16. "Full range:" pricing intro
  rules.push({
    find: `Full range:`,
    replace: pick([
      `Full range:`,
      `Typical range:`,
      `Observed range:`,
      `Price spread:`,
    ], seed + 16),
  });

  // 5. "See detailed pricing for each X material in CITY, ST."
  rules.push({
    find: `See detailed pricing for each ${vlabel} material in ${city}, ${state}.`,
    replace: pick([
      `See detailed pricing for each ${vlabel} material in ${city}, ${state}.`,
      `Per-material ${vlabel} pricing for ${city}, ${state}.`,
      `Material-by-material ${vlabel} costs in ${city}, ${state}.`,
      `${city}, ${state} ${vlabel} pricing broken down by material.`,
    ], seed + 5),
  });

  // 6. "See how X costs in CITY compare to major cities in neighboring states."
  rules.push({
    find: `See how ${vlabel} costs in ${city} compare to major cities in neighboring states.`,
    replace: pick([
      `See how ${vlabel} costs in ${city} compare to major cities in neighboring states.`,
      `How ${city}'s ${vlabel} pricing stacks up against regional metros.`,
      `${city} ${vlabel} costs compared to major cities across nearby states.`,
      `Where ${city}'s ${vlabel} pricing sits relative to the wider regional market.`,
    ], seed + 6),
  });

  // 7. "A complete X proposal should cover all N of these items."
  for (const n of [8, 10, 11, 12, 13, 14, 15]) {
    rules.push({
      find: `A complete ${vlabel} proposal should cover all ${n} of these items.`,
      replace: pick([
        `A complete ${vlabel} proposal should cover all ${n} of these items.`,
        `Any thorough ${vlabel} proposal spells out these ${n} items.`,
        `A full ${vlabel} scope covers these ${n} checklist items.`,
        `Expect every serious ${vlabel} proposal to detail all ${n} of these.`,
      ], seed + 7),
    });
  }

  // 8. "Quotes differ based on material quality, labor assumptions, flashing work, ventilation, and warranty coverage."
  rules.push({
    find: "Quotes differ based on material quality, labor assumptions, flashing work, ventilation, and warranty coverage.",
    replace: pick([
      "Quotes differ based on material quality, labor assumptions, flashing work, ventilation, and warranty coverage.",
      "Pricing spreads come from material tiers, labor estimates, flashing scope, ventilation choices, and warranty terms.",
      "The gap between quotes usually traces to materials, labor hours, flashing details, ventilation, and warranty structure.",
      "Bid-to-bid variation comes down to material grade, labor assumptions, flashing work, ventilation upgrades, and warranty tier.",
    ], seed + 8),
  });

  // 9. "Lower bids often exclude items that appear as change orders later."
  rules.push({
    find: "Lower bids often exclude items that appear as change orders later.",
    replace: pick([
      "Lower bids often exclude items that appear as change orders later.",
      "The cheapest bid frequently skips items that become change orders mid-project.",
      "Budget bids tend to leave out scope that reappears as extras later.",
      "Low quotes typically omit items that show up on the final invoice anyway.",
    ], seed + 9),
  });

  // 17. "for national averages, material comparisons, and money-saving tips."
  rules.push({
    find: `for national averages, material comparisons, and money-saving tips.`,
    replace: pick([
      `for national averages, material comparisons, and money-saving tips.`,
      `to see national averages, material tiers, and ways to save.`,
      `for national averages, side-by-side material comparisons, and cost-cutting tips.`,
      `to compare national averages, materials, and where to save.`,
    ], seed + 17),
  });

  // 18. "or compare quotes side by side" button text
  rules.push({
    find: `or compare quotes side by side`,
    replace: pick([
      `or compare quotes side by side`,
      `or put quotes side-by-side`,
      `or compare bids at a glance`,
      `or line up quotes to compare`,
    ], seed + 18),
  });

  // 19. Read-our-guide link text
  const guideProduct = {
    "hvac": "HVAC", "roof": "Roofing", "plumbing": "Plumbing",
    "electrical": "Electrical", "solar": "Solar", "kitchen-remodel": "Kitchen Remodel",
    "window": "Window", "siding": "Siding", "painting": "Painting",
    "garage-door": "Garage Door", "fence": "Fencing", "concrete": "Concrete",
    "landscaping": "Landscaping", "foundation": "Foundation",
    "insulation": "Insulation", "gutter": "Gutter",
    "auto-repair": "Auto Repair", "medical": "Medical",
    "legal": "Legal", "moving": "Moving",
  }[vslug] || vlabel;
  rules.push({
    find: `Read our ${guideProduct} Cost Guide`,
    replace: pick([
      `Read our ${guideProduct} Cost Guide`,
      `See the ${guideProduct} Cost Guide`,
      `Open our ${guideProduct} Cost Guide`,
      `Browse the ${guideProduct} Cost Guide`,
    ], seed + 19),
  });

  // 20. "Popular Cities for X" H2 (per vertical)
  const prodFull = VERTICAL_PRODUCT[vslug] || vlabel;
  rules.push({
    find: `<h2>Popular Cities for ${prodFull}</h2>`,
    replace: pick([
      `<h2>Popular Cities for ${prodFull}</h2>`,
      `<h2>Top ${prodFull.toLowerCase()} markets nationwide</h2>`,
      `<h2>${prodFull} pricing in major cities</h2>`,
      `<h2>${prodFull} cost in major US metros</h2>`,
    ], seed + 20),
  });

  // 21. "X Cost in Nearby Cities" H2
  rules.push({
    find: `<h2>${prodFull} Cost in Nearby Cities</h2>`,
    replace: pick([
      `<h2>${prodFull} Cost in Nearby Cities</h2>`,
      `<h2>Nearby-city ${prodFull.toLowerCase()} pricing</h2>`,
      `<h2>${prodFull} cost in cities near ${city}</h2>`,
      `<h2>Compare ${prodFull.toLowerCase()} pricing regionally</h2>`,
    ], seed + 21),
  });

  return rules;
}

// Regex-based rules for patterns with variable numeric content that string
// find/replace can't handle cleanly.
function buildRegexRules(city, state, vslug) {
  const seed = hash(`${city}|${state}|${vslug}`);
  const out = [];

  // Pricing disclaimer: "...middle NN-NN% of quotes we see in the CITY area."
  const cityEsc = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  out.push({
    re: new RegExp(`Your own quote can fall outside this band depending on scope, materials tier, and contractor, but this is the middle (\\d+-\\d+)% of quotes we see in the ${cityEsc} area\\.`, "g"),
    replace: (m, pct) => pick([
      `Your own quote can fall outside this band depending on scope, materials tier, and contractor, but this is the middle ${pct}% of quotes we see in the ${city} area.`,
      `Individual ${city}-area quotes can land outside this range — scope, materials, and contractor all shift the number — but this band covers the middle ${pct}% of bids.`,
      `Scope, materials, and contractor all move individual ${city} quotes, so yours may sit outside. This range is the middle ${pct}% of quotes we see locally.`,
      `Your specific ${city} quote may fall outside this band depending on scope, materials tier, and contractor, but it covers the middle ${pct}% of quotes observed.`,
    ], seed + 30),
  });

  return out;
}

function processFile(filepath) {
  let html = fs.readFileSync(filepath, "utf8");
  if (html.includes(MARKER)) return "skip_existing";
  const filename = path.basename(filepath);
  const parsed = parseFile(filename);
  if (!parsed) return "skip_parse";
  const { city, state, vslug } = parsed;

  const rules = buildRules(city, state, vslug);
  const regexRules = buildRegexRules(city, state, vslug);
  let changed = false;
  for (const r of rules) {
    if (r.find === r.replace) continue;
    if (!html.includes(r.find)) continue;
    html = html.split(r.find).join(r.replace);
    changed = true;
  }
  for (const r of regexRules) {
    const before = html;
    html = html.replace(r.re, r.replace);
    if (html !== before) changed = true;
  }

  // Always mark processed so we don't reprocess on later runs.
  html = html.replace("</body>", `${MARKER}\n</body>`);
  fs.writeFileSync(filepath, html, "utf8");
  return changed ? "updated" : "marked_no_change";
}

function main() {
  const filterVertical = process.argv[2];
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith("-cost.html"));
  const stats = {};
  let lastVert = "";
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const parsed = parseFile(f);
    if (!parsed) { stats.skip_parse = (stats.skip_parse || 0) + 1; continue; }
    if (filterVertical && parsed.vslug !== filterVertical) continue;
    if (parsed.vslug !== lastVert) {
      if (lastVert) process.stdout.write("\n");
      process.stdout.write(`${parsed.vslug}...`);
      lastVert = parsed.vslug;
    }
    const result = processFile(path.join(ROOT, f));
    stats[result] = (stats[result] || 0) + 1;
  }
  console.log("\n\n=== DONE ===");
  for (const [k, v] of Object.entries(stats)) {
    console.log(`  ${k}: ${v}`);
  }
}

main();
