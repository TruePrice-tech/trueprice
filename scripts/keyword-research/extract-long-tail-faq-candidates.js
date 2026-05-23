#!/usr/bin/env node
/**
 * extract-long-tail-faq-candidates.js
 *
 * Phase 1 of the long-tail-rank initiative: turn Bing-attested user queries
 * into FAQ-block expansion candidates for existing per-city pages.
 *
 * Approach: GSC is the ideal signal (queries our pages already show for) but
 * Bing autocomplete is a strong proxy for actual user phrasing — and we
 * already harvested 269 unique HVAC suggestions across 184 clusters via
 * harvest-bing.js. We re-use that corpus, NOT to spin up new pages (the
 * generate-pages.js path), but to surface verbatim long-tail questions that
 * the per-city HVAC FAQ block doesn't yet answer.
 *
 * Inputs:
 *   scripts/keyword-research/output/clusters.json
 *   scripts/keyword-research/output/bing-raw.json
 *   output/audits/tier-b-faq-gaps-<vertical>.json  (optional — dedupe vs planned FAQs)
 *
 * Output:
 *   output/audits/long-tail-faq-candidates-<vertical>.json
 *
 * Usage:
 *   node scripts/keyword-research/extract-long-tail-faq-candidates.js [vertical]
 *   node scripts/keyword-research/extract-long-tail-faq-candidates.js hvac
 *
 * Default vertical: hvac
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const VERTICAL = (process.argv[2] || 'hvac').toLowerCase();

const CLUSTERS_FILE = path.join(__dirname, 'output', 'clusters.json');
const BING_FILE = path.join(__dirname, 'output', 'bing-raw.json');
const AUDIT_FILE = path.join(ROOT, 'output', 'audits', `tier-b-faq-gaps-${VERTICAL}.json`);
const OUT_FILE = path.join(ROOT, 'output', 'audits', `long-tail-faq-candidates-${VERTICAL}.json`);

// ---------- Vertical scope -----------------------------------------------
// Token sets that identify clusters as belonging to this vertical.
// We don't use clusters[].vertical because the harvester tagged by seed
// keyword; cross-pollination in autocomplete means many genuinely-HVAC
// queries got tagged 'meta' or other verticals.

const VERTICAL_TOKENS = {
  hvac: /\b(hvac|a\/c|air conditioner|air conditioning|furnace|heat pump|mini.?split|ductless|condenser|coil|seer|afue|heating and cooling|hvac unit|ac unit|ac install|ac replac|ac system)\b/,
};

// Cross-vertical contamination — Bing autocomplete pulls auto-ac, pool-heat-
// pump, RV-furnace, etc. into HVAC seeds. Reject if any of these tokens
// present (no false positives observed for home HVAC).
const VERTICAL_EXCLUDE_TOKENS = {
  hvac: /\b(car|auto|vehicle|truck|jeep|bmw|honda|toyota|ford|chevy|tesla|carson|pool|hot tub|rv|boat|motorhome|camper|trailer|caravan|industrial|commercial hvac|commercial ac|warehouse|portable ac|window ac|window unit|swamp cooler|evaporative|crypto|costume|certification|license cost|electrical for|electrical cost)\b/i,
};

// Maintenance/service intent — different from replacement/installation FAQ
const MAINTENANCE_REJECT = /\b(service call|tune.?up|tuneup|cleaning|clean (hvac|furnace|ac|coil|duct)|cost to clean|check (cost|service|charge|fee)|inspection (cost|fee)|maintenance (cost|fee|plan|contract)|filter (cost|change|replace)|freon (cost|charge|recharge)|refrigerant (cost|recharge|leak)|duct (cleaning|sanitiz)|repair cost|furnace service cost)\b/i;

// B2B / contractor-software / jobs / random noise. Our audience is
// consumer homeowners; reject everything else.
const B2B_AND_JOB_REJECT = /\b(quote (form|template|sheet|generation|generator)|quoting software|quotation (format|software|estimation)|estimation software|cpq|crm|case studies|software demo|customer service jobs|customer support jobs|jobs near me|service representative|construction (division|safety|skills|services|software)|sayings|coastal coating|constanta|customer experience|tracking program|spreadsheet|excel|cost codes|certification cost|license cost|near me online|online quote|template|format|sample|example|specs)\b/i;

// Foreign units (metric, weird trailing words)
const FOREIGN_UNIT_REJECT = /\b(per square meter|per sqm|per m2|per litre|per liter|kilowatt|kw\b|in euros|in pounds|in inr|in cad|in aud|in nzd)\b/i;

// Foreign / non-US geo. Bing autocomplete pulls heavily from CA/UK/AU/IN.
const FOREIGN_GEO_REJECT = /\b(nanaimo|calgary|toronto|alberta|ontario|quebec|vancouver|montreal|edmonton|winnipeg|saskatoon|halifax|ottawa|brampton|mississauga|surrey bc|north america(?!n market)|sydney|melbourne|brisbane|perth australia|adelaide|auckland|wellington|uk(?!raine)|britain|england|scotland|wales|ireland|dublin|london(?!\s+ontario)?|manchester|birmingham|liverpool|leeds|glasgow|india|delhi|mumbai|bangalore|kolkata|chennai|hyderabad|pune|costa rica|mexico|philippines|south africa|germany|berlin|munich|paris|france|spain|italy|netherlands|amsterdam|verivox|albuq(?!uerque))\b/i;

// Head-page synonyms — queries that, after stripping noise modifiers, reduce
// to "<vertical> cost" or one of its trivial reorderings. These belong to
// the head cost page (e.g. hvac-cost.html, atlanta-ga-hvac-cost.html title +
// FAQ #1), NOT to the long-tail FAQ block. Filter not-flag.
const HEAD_SYNONYM_STEMS = {
  hvac: new Set([
    'hvac', 'hvac cost', 'hvac costs', 'hvac price', 'hvac prices', 'hvac estimate', 'hvac quote',
    'hvac replacement', 'hvac replacement cost', 'hvac replacement price',
    'hvac installation', 'hvac installation cost',
    'new hvac', 'new hvac cost', 'new hvac price',
    'ac', 'ac cost', 'ac replacement', 'ac replacement cost', 'ac unit replacement',
    'ac install', 'ac installation', 'ac installation cost',
    'new ac', 'new ac cost',
    'furnace', 'furnace cost', 'furnace price', 'furnace replacement', 'furnace replacement cost',
    'new furnace', 'new furnace cost', 'house furnace', 'home furnace',
    'heat pump', 'heat pump cost', 'heat pump price', 'heat pump replacement',
  ]),
};

const NOISE_MODIFIERS = /\b(average|typical|estimated|approximate|home|house|residential|whole house|complete|full|total|new|replace|replacement|install|installation|cost of|price of|cost for|price for|with installation|installed|2024|2025|2026|estimate)\b/g;
const TOOL_REJECT = /\b(calculator|estimator|tracking program|spreadsheet|excel|app(?:\s|$)|tool(?:\s|$))\b/i;
const RETAILER_REJECT = /\b(home depot|costco|lowes|lowe's|amazon|walmart|sam'?s club|menards|ikea)\b/i;

// ---------- Category routing ---------------------------------------------
// Map each cluster to a thematic FAQ category so the output is browsable.
// Order matters — first match wins.

const CATEGORIES = [
  { id: 'size-tonnage',     re: /\b(\d(\.\d)?)\s?ton\b|\bton\s?(unit|ac|hvac|heat pump|furnace|condenser)\b/ },
  { id: 'cost-unit',        re: /\b(per (square foot|sq ft|sqft|sf|ton)|by sq ft|by square foot|per home size|by home size|for\s+(\d[,.\d]*)\s?(sq ft|sqft|square feet|square foot|sf\b|sf house|sf home))\b/ },
  { id: 'negotiation',      re: /\b(negotiate|negotiating|haggle|push back|too high|too expensive|red flag|scam|overpriced|fair price|reasonable price|second opinion|how to check|verify quote|compare (this|my|the) (hvac|ac|furnace) quote|compare quote)\b/ },
  { id: 'new-construction', re: /\b(new construction|new build|new home construction|new house construction|for new home)\b/ },
  { id: 'budget-tier',      re: /\b(cheap(est)? (hvac|ac|furnace|heat pump)|budget (hvac|ac|furnace|heat pump)|low budget|affordable|inexpensive|under \$|less than \$)\b/ },
  { id: 'system-type',      re: /\b((gas|electric|oil|propane|hybrid|geothermal|water source|water furnace|mini.?split|ductless|dual fuel|hi efficiency)\s+(furnace|heat pump|hvac|ac|system|unit|heating)|ductless|mini.?split|geothermal|heat pump|gas furnace|oil furnace|electric furnace|propane furnace|water furnace)\b/ },
  { id: 'decision',         re: /\b(vs\.?|versus|or|better|should i|is .* worth|when to|when should|or replace|or repair)\b/ },
  { id: 'timing',           re: /\b(how long|days|hours|installation time|takes to|best time|when to|time of year|fall|spring|winter|summer)\b/ },
  { id: 'financing',        re: /\b(financ|payment|loan|no money down|bad credit|installment|monthly payment|0% apr|down payment)\b/ },
  { id: 'rebate-credit',    re: /\b(rebate|tax credit|25c|inflation reduction|ira |energy efficient credit|federal credit|incentive|heat pump rebate|energy star)\b/ },
  { id: 'permit-code',      re: /\b(permit|code|license|inspection|building code|imc|ibc|mechanical permit)\b/ },
  { id: 'replacement-life', re: /\b(replace|life expectancy|how often|years old|how long does .* last|warranty|lifespan|when to replace|old furnace|old ac)\b/ },
  { id: 'sizing',           re: /\b(what size|size for|sizing|right size|manual j|btu|tonnage for|btu calculator|btu per)\b/ },
  { id: 'efficiency',       re: /\b(seer|afue|hspf|energy efficient|high efficiency|efficiency rating|18 seer|20 seer|16 seer|14 seer|95% afue|97% afue|80% afue)\b/ },
  { id: 'brand-neutral',    re: /\b(best (brand|hvac|heat pump|furnace|ac)|top rated|most reliable|consumer reports|reviews|highest rated)\b/ },
  { id: 'cost-driver',      re: /\b(why so expensive|cost breakdown|whats included|what's included|labor cost|materials cost|markup|installation cost vs equipment)\b/ },
  { id: 'general-cost',     re: /\b(cost|price|how much|average|estimate|quote)\b/ },  // catch-all — lowest priority
];

// ---------- Question-form derivation -------------------------------------
// If the verbatim Bing phrase is already a question, keep it. Otherwise
// derive a question form using the cluster's intent + category.

function isAlreadyQuestion(q) {
  return /^(how much|how long|how often|how many|what|which|why|when|where|should|is|are|do|does|did|can|will|would|could)\b/i.test(q.trim());
}

function toQuestionForm(q, category) {
  const trimmed = q.trim().replace(/[.?!]+$/, '');
  if (isAlreadyQuestion(trimmed)) {
    // Append city/state slot if no location modifier already present
    if (!/\b(in |near |for )/i.test(trimmed)) {
      return capitalize(trimmed) + ' in {{CITY}}, {{STATE}}?';
    }
    return capitalize(trimmed) + '?';
  }

  // Derive question form by category
  switch (category) {
    case 'size-tonnage':
    case 'system-type':
    case 'cost-unit':
    case 'general-cost':
      return `How much does ${trimmed.replace(/\bcost\b/i, '').trim()} cost in {{CITY}}, {{STATE}}?`.replace(/\s+/g, ' ');
    case 'decision':
      return `${capitalize(trimmed)}: which is right for {{CITY}}, {{STATE}}?`;
    case 'timing':
      return `${capitalize(trimmed)} in {{CITY}}, {{STATE}}?`;
    case 'financing':
      return `How does HVAC financing work in {{CITY}}, {{STATE}} (${trimmed})?`;
    case 'rebate-credit':
      return `What HVAC rebates and tax credits are available in {{CITY}}, {{STATE}}?`;
    case 'permit-code':
      return `Do I need a permit for ${trimmed} in {{CITY}}, {{STATE}}?`;
    case 'replacement-life':
      return `${capitalize(trimmed)} — what should I know in {{CITY}}, {{STATE}}?`;
    case 'sizing':
      return `${capitalize(trimmed)} in {{CITY}}, {{STATE}}?`;
    case 'efficiency':
      return `${capitalize(trimmed)} — is it worth it in {{CITY}}, {{STATE}}?`;
    case 'brand-neutral':
      return `${capitalize(trimmed)} in {{CITY}}, {{STATE}}?`;
    case 'cost-driver':
      return `${capitalize(trimmed)} in {{CITY}}, {{STATE}}?`;
    case 'negotiation':
      return `${capitalize(trimmed)} — what should I do in {{CITY}}, {{STATE}}?`;
    case 'new-construction':
      return `How much does HVAC cost for new construction in {{CITY}}, {{STATE}}?`;
    case 'budget-tier':
      return `What's the cheapest HVAC option in {{CITY}}, {{STATE}}?`;
    default:
      return `${capitalize(trimmed)} in {{CITY}}, {{STATE}}?`;
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function categorize(text) {
  for (const c of CATEGORIES) {
    if (c.re.test(text)) return c.id;
  }
  return 'general-cost';
}

// ---------- Suggested data slot per category -----------------------------
// Maps category to which existing data file(s) would feed the answer. This
// is informational — Phase 2 (builder) decides actual wiring.

const DATA_SLOTS = {
  hvac: {
    'size-tonnage':     { primary: 'NEW: tonPricingByCity (derivable from city-cost-multipliers.hvac × ton base table)', confidence: 'medium' },
    'system-type':      { primary: 'NEW: systemTypePricingByCity (derivable similarly)', confidence: 'medium' },
    'cost-unit':        { primary: 'data/hvac-pricing-model.json + city-cost-multipliers.hvac (already wired for AVG_LOW/AVG_HIGH)', confidence: 'high' },
    'decision':         { primary: 'data/hvac-city-context.json#climateNote, #systemTip (climate-aware steering)', confidence: 'high' },
    'timing':           { primary: 'data/hvac-city-context.json#seasonNote (98% city-distinct, currently in local-context cards)', confidence: 'high' },
    'financing':        { primary: 'NEW: financingNote (or omit FAQ for now — no data behind it)', confidence: 'low' },
    'rebate-credit':    { primary: 'data/hvac-state-data.json (PROPOSED in tier-b audit) + federal 25C ($2K cap)', confidence: 'medium-pending-state-fill' },
    'permit-code':      { primary: 'data/hvac-state-data.json (PROPOSED — same blocker as audit FAQ #6)', confidence: 'medium-pending-state-fill' },
    'replacement-life': { primary: 'data/hvac-city-context.json#housingAgeNote (derive from city-context.json#medianHouseYear)', confidence: 'medium' },
    'sizing':           { primary: 'data/hvac-city-context.json#climateNote + sq-ft → BTU rule-of-thumb', confidence: 'high' },
    'efficiency':       { primary: 'data/hvac-city-context.json#climateNote + SEER-by-climate-zone map', confidence: 'high' },
    'brand-neutral':    { primary: 'NONE — vendor-agnostic policy; skip or answer with "we don\'t rank brands" position', confidence: 'skip' },
    'cost-driver':      { primary: 'data/hvac-city-context.json#costDriverNote (738/739 unique, currently dormant)', confidence: 'high' },
    'negotiation':      { primary: 'Wire to our analyzer flow (transactional FAQ — links to /hvac-quote-analyzer.html, uses costDriverNote for "fair price" anchor)', confidence: 'high' },
    'new-construction': { primary: 'NEW: newConstructionNote (or skip — most city HVAC traffic is replacement, not new build)', confidence: 'low' },
    'budget-tier':      { primary: 'data/hvac-pricing-model.json — surface budget-tier bracket from city-cost-multipliers.hvac with low-end deflator', confidence: 'medium' },
    'general-cost':     { primary: 'data/hvac-pricing-model.json (already in main cost FAQ — skip if pure synonym)', confidence: 'redundant' },
  },
};

// ---------- Existing-FAQ overlap detector --------------------------------
// Rough — checks if any current/proposed FAQ question shares >2 content tokens
// with the candidate. Used to flag (not exclude) overlaps.

function loadExistingFaqTokens() {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  const audit = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  const allFaqs = [...(audit.currentFAQs || []), ...(audit.proposedFAQs || [])];
  return allFaqs.map(f => {
    const q = f.q || f.qTemplate || '';
    return {
      q,
      tokens: tokenizeContent(q),
    };
  });
}

const STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','to','of','in','on','at','by','for','with','from',
  'how','much','what','why','when','where','which','who','does','do','did','and','or','but','not','no',
  'i','my','me','you','your','it','its','this','that','these','those','has','have','had',
  'should','would','could','can','will','may','might','new','your','their','they',
  'city','state',
]);

function tokenizeContent(q) {
  return q.toLowerCase()
    .replace(/\{\{[^}]+\}\}/g, '')   // strip {{CITY}}/{{STATE}} placeholders
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function overlapsExisting(candidateQ, existingFaqs) {
  const ct = new Set(tokenizeContent(candidateQ));
  for (const ef of existingFaqs) {
    const shared = ef.tokens.filter(t => ct.has(t));
    if (shared.length >= 3) {
      return { overlaps: true, with: ef.q, sharedTokens: shared };
    }
  }
  return { overlaps: false };
}

// ---------- Variant picker -----------------------------------------------
// Pick the highest-value verbatim variant from a cluster:
//   1. prefer phrases that already start as questions
//   2. then prefer phrases without lone letter expansions (avoid "hvac cost a" / "hvac quote b")
//   3. then prefer longer phrases (more long-tail signal)

function pickBestVariant(cluster, rawByCanonical) {
  const variants = cluster.variants || [cluster.canonicalQuery];
  // Augment with raw phrases that contributed to this canonical (sometimes
  // raw has long-tail variants the cluster collapsed).
  const augmented = new Set(variants);
  if (rawByCanonical[cluster.canonicalQuery]) {
    for (const r of rawByCanonical[cluster.canonicalQuery]) augmented.add(r);
  }
  const arr = [...augmented];

  const verticalRe = VERTICAL_TOKENS[VERTICAL];
  const excludeRe = VERTICAL_EXCLUDE_TOKENS[VERTICAL];

  const scored = arr.map(v => {
    const lower = v.toLowerCase();
    const verticalMatch = verticalRe.test(lower);
    const isExcluded = (excludeRe && excludeRe.test(lower)) ||
                       TOOL_REJECT.test(lower) ||
                       RETAILER_REJECT.test(lower) ||
                       MAINTENANCE_REJECT.test(lower) ||
                       FOREIGN_GEO_REJECT.test(lower) ||
                       B2B_AND_JOB_REJECT.test(lower) ||
                       FOREIGN_UNIT_REJECT.test(lower);
    return {
      v,
      score:
        (verticalMatch ? 50 : 0) +                  // must match vertical
        (isExcluded ? -1000 : 0) +                  // hard-reject cross-vertical/noise
        (isAlreadyQuestion(v) ? 100 : 0) +
        (/\b[a-z]\b\s*$/.test(v) ? -20 : 0) +       // single-letter expansion suffix
        v.length * 0.1,
    };
  });
  scored.sort((a,b) => b.score - a.score);
  // If best score is still negative, the cluster has nothing usable
  return scored[0].score < 0 ? null : scored[0].v;
}

function buildRawByCanonical(bingRaw, clusterCanonical) {
  // Group raw suggestions by which cluster canonical they would have been
  // assigned to. Approximate by exact substring match — close enough for
  // augmenting variant lists.
  const out = {};
  const canonSet = new Set(clusterCanonical);
  for (const r of bingRaw) {
    const s = (r.suggestion || '').toLowerCase().trim();
    for (const c of canonSet) {
      if (s.includes(c)) {
        if (!out[c]) out[c] = [];
        out[c].push(r.suggestion);
        break;
      }
    }
  }
  return out;
}

// ---------- Main ----------------------------------------------------------

if (!fs.existsSync(CLUSTERS_FILE)) {
  console.error('Missing', CLUSTERS_FILE);
  process.exit(1);
}
if (!fs.existsSync(BING_FILE)) {
  console.error('Missing', BING_FILE);
  process.exit(1);
}

const clusters = JSON.parse(fs.readFileSync(CLUSTERS_FILE, 'utf8'));
const bingRaw = JSON.parse(fs.readFileSync(BING_FILE, 'utf8'));

const verticalRe = VERTICAL_TOKENS[VERTICAL];
if (!verticalRe) {
  console.error(`No VERTICAL_TOKENS pattern defined for vertical=${VERTICAL}. Add one above.`);
  process.exit(1);
}

// Filter clusters belonging to this vertical (token-based, not seed-tag based)
const excludeRe = VERTICAL_EXCLUDE_TOKENS[VERTICAL];
const headStems = HEAD_SYNONYM_STEMS[VERTICAL] || new Set();

function isHeadSynonym(text) {
  // Strip noise modifiers, location-y words, and punctuation. Compare residue
  // (sorted tokens) against headStems.
  const stripped = text
    .toLowerCase()
    .replace(NOISE_MODIFIERS, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (headStems.has(stripped)) return true;
  // Also try as a sorted token set — handles "cost ac replacement" vs "ac replacement cost"
  const sortedTokens = stripped.split(/\s+/).filter(Boolean).sort().join(' ');
  for (const stem of headStems) {
    const stemSorted = stem.split(/\s+/).filter(Boolean).sort().join(' ');
    if (sortedTokens === stemSorted) return true;
  }
  return false;
}

function rejectsCanonical(canonical) {
  if (!verticalRe.test(canonical)) return 'not-vertical';
  if (excludeRe && excludeRe.test(canonical)) return 'cross-vertical';
  if (TOOL_REJECT.test(canonical)) return 'tool';
  if (RETAILER_REJECT.test(canonical)) return 'retailer';
  if (MAINTENANCE_REJECT.test(canonical)) return 'maintenance';
  if (FOREIGN_GEO_REJECT.test(canonical)) return 'foreign-geo';
  if (B2B_AND_JOB_REJECT.test(canonical)) return 'b2b-or-job';
  if (FOREIGN_UNIT_REJECT.test(canonical)) return 'foreign-unit';
  if (isHeadSynonym(canonical)) return 'head-synonym';
  return null;
}

const rejectReasons = {};
const verticalClusters = clusters.filter(c => {
  const canonical = (c.canonicalQuery || '').toLowerCase();
  const reason = rejectsCanonical(canonical);
  if (reason) {
    rejectReasons[reason] = (rejectReasons[reason] || 0) + 1;
    return false;
  }
  return true;
});

console.log(`[${VERTICAL}] matched ${verticalClusters.length} clusters after vertical+exclude+tool+retailer+head-synonym filters`);

// Existing FAQs from tier-b audit (if available)
const existingFaqs = loadExistingFaqTokens();
console.log(`[${VERTICAL}] existing/proposed FAQs known: ${existingFaqs.length}`);

// Raw augmentation map
const rawByCanonical = buildRawByCanonical(bingRaw, verticalClusters.map(c => c.canonicalQuery));

// Build candidates
const slotsForVertical = DATA_SLOTS[VERTICAL] || {};
const candidates = verticalClusters.map(c => {
  const haystack = (c.canonicalQuery + ' ' + (c.variants || []).join(' ')).toLowerCase();
  const category = categorize(haystack);
  const verbatim = pickBestVariant(c, rawByCanonical);
  if (!verbatim) return null;   // every variant was filtered (cross-vertical/maintenance/foreign)
  const faqQ = toQuestionForm(verbatim, category);
  const overlap = overlapsExisting(faqQ, existingFaqs);
  const slot = slotsForVertical[category] || { primary: 'unmapped', confidence: 'unknown' };

  return {
    id: slugify(c.canonicalQuery),
    bingPriority: c.priority || 0,
    bingMemberCount: c.memberCount || (c.variants || []).length || 1,
    intent: c.intent || 'unknown',
    category,
    verbatimQuery: verbatim,
    canonicalQuery: c.canonicalQuery,
    variants: (c.variants || []).slice(0, 5),
    faqQuestion: faqQ,
    overlapsExistingFAQ: overlap.overlaps,
    overlapsWith: overlap.with || null,
    dataSlotPrimary: slot.primary,
    dataSlotConfidence: slot.confidence,
    existingPage: c.existingPage || null,
    newPageNeeded: !!c.newPageNeeded,
  };
});

// Drop nulls (no usable variant) and low-signal candidates.
// general-cost is the catch-all category — anything that lands there is either
// a head-synonym our main cost FAQ already serves, a tail-noise variant, or
// would be a duplicate of another category if its regex were tighter. Drop.
const kept = candidates.filter(c => {
  if (!c) return false;
  if (c.dataSlotConfidence === 'skip') return false;
  if (c.category === 'general-cost') return false;
  return true;
});

// Group by category, then sort within each by bingPriority desc
const byCategory = {};
for (const k of kept) {
  if (!byCategory[k.category]) byCategory[k.category] = [];
  byCategory[k.category].push(k);
}
for (const cat in byCategory) {
  byCategory[cat].sort((a,b) => b.bingPriority - a.bingPriority);
}

// Overall ranked list
const ranked = [...kept].sort((a,b) => b.bingPriority - a.bingPriority);

const out = {
  vertical: VERTICAL,
  generatedAt: new Date().toISOString().slice(0, 10),
  inputs: {
    clustersFile: path.relative(ROOT, CLUSTERS_FILE),
    bingFile: path.relative(ROOT, BING_FILE),
    auditFile: fs.existsSync(AUDIT_FILE) ? path.relative(ROOT, AUDIT_FILE) : '(not found)',
  },
  summary: {
    clustersMatched: verticalClusters.length,
    rejectReasonsCounted: rejectReasons,
    candidatesKept: kept.length,
    candidatesDropped: candidates.length - kept.length,
    existingFaqCount: existingFaqs.length,
    candidatesOverlappingExisting: kept.filter(c => c.overlapsExistingFAQ).length,
    candidatesByCategory: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, v.length])
    ),
  },
  topCandidates: ranked.slice(0, 30),
  byCategory,
  notes: [
    'verbatimQuery preserves the exact Bing-attested phrasing (or the best variant chosen by pickBestVariant).',
    'faqQuestion is the derived question form with {{CITY}}/{{STATE}} slots, ready for builder injection.',
    'overlapsExistingFAQ flags candidates whose question shares ≥3 content tokens with a current or proposed FAQ from the tier-b audit. Flag, not exclude — copy-deduplication is a Phase 2 decision.',
    'dataSlotPrimary points at the existing data file (or marks NEW: required) so we can sequence work: ship "high-confidence + existing data" first, defer "NEW data file" categories.',
    'Sort key inside each category is bingPriority (cluster.priority from cluster-and-intent.js).',
  ],
};

fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');

console.log('');
console.log(`[${VERTICAL}] wrote ${OUT_FILE}`);
console.log(`[${VERTICAL}] reject reasons (cluster-level):`);
for (const r of Object.keys(rejectReasons).sort((a,b)=>rejectReasons[b]-rejectReasons[a])) {
  console.log(`  ${r.padEnd(16)} ${String(rejectReasons[r]).padStart(4)}`);
}
console.log(`[${VERTICAL}] kept:`);
console.log('  candidates kept     :', kept.length);
console.log('  candidates dropped  :', candidates.length - kept.length);
console.log('  overlapping existing:', kept.filter(c => c.overlapsExistingFAQ).length);
console.log('  by category:');
for (const cat of Object.keys(byCategory).sort()) {
  console.log(`    ${cat.padEnd(22)} ${String(byCategory[cat].length).padStart(3)}  (top: "${byCategory[cat][0].faqQuestion}")`);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
