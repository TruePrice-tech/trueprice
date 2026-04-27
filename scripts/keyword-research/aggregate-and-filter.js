#!/usr/bin/env node
/**
 * Aggregate Trends harvest output, dedupe, filter out off-scope queries, and
 * flag which queries already have a matching Woogoro page vs which are gaps.
 *
 * Goal: produce keywords-ranked.csv with clear "new page needed" targets
 * sorted by priority so we know what to write first.
 *
 * Filtering rules are encoded in EXCLUDE_PATTERNS below. Edit as needed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const IN_FILE = path.join(__dirname, 'output', 'trends-raw.json');
const BING_FILE = path.join(__dirname, 'output', 'bing-raw.json');
const OUT_JSON = path.join(__dirname, 'output', 'keywords-filtered.json');
const OUT_CSV = path.join(__dirname, 'output', 'keywords-ranked.csv');

// --- Filters: queries matching these patterns are discarded ---

// Brand/vendor names — Woogoro is vendor-agnostic, doesn't publish brand-
// comparison pages. (Could revisit later: "lennox vs trane cost" type pages
// might be worth a cluster, but skip for the main pass.)
const BRANDS = [
  'lennox', 'trane', 'carrier', 'goodman', 'rheem', 'bryant', 'american standard',
  'mitsubishi', 'daikin', 'fujitsu', 'ruud', 'amana', 'york', 'coleman', 'payne',
  'heil', 'tempstar', 'maytag', 'westinghouse',
  'gaf', 'owens corning', 'certainteed', 'iko', 'malarkey', 'atlas', 'tamko',
  'pella', 'andersen', 'milgard', 'marvin', 'jeld wen',
  'toyota', 'honda', 'ford', 'chevy', 'bmw', 'audi', 'mercedes', 'tesla', 'subaru', 'nissan',
  'midas', 'jiffy lube', 'valvoline', 'pepboys', 'meineke', 'firestone', 'goodyear',
  'u-haul', 'pods', 'two men and a truck', 'north american', 'allied', 'mayflower', 'united van lines',
];

// Symptom/fault queries — Woogoro's purpose is pricing analysis, not repair diagnosis.
const SYMPTOM_WORDS = [
  'not working', 'not cooling', 'not heating', 'leaking', 'noise', 'noisy',
  'smell', 'smoke', 'error code', 'flashing', 'blinking',
  'won\'t start', 'won\'t turn', 'keeps running', 'keeps cycling',
  'how to fix', 'how to repair yourself', 'diy ', 'do it yourself',
];

// Off-scope products — things that sound like our verticals but aren't.
const OFF_SCOPE = [
  'pool heat pump', 'hot tub heat pump', 'pool furnace',
  'boat ', 'rv ', 'motorhome',
  'commercial ', 'industrial ',
  'dog fence', 'invisible fence', 'pet fence',
];

// Legal specialty that isn't a pricing page
const LEGAL_SPECIALTY_OK = [
  'divorce', 'estate', 'will', 'personal injury', 'dui', 'criminal', 'bankruptcy',
  'immigration', 'tax lawyer', 'trust',
];

function normalize(q) {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

function shouldExclude(q) {
  const qn = normalize(q);
  for (const b of BRANDS) if (qn.includes(b)) return 'brand:' + b;
  for (const s of SYMPTOM_WORDS) if (qn.includes(s)) return 'symptom:' + s;
  for (const o of OFF_SCOPE) if (qn.includes(o)) return 'off-scope:' + o.trim();
  return null;
}

// --- Page-match check: does Woogoro already have a page matching this query? ---

function existingPages() {
  const pages = new Set();
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  for (const f of files) pages.add(f.toLowerCase());
  return pages;
}

function queryToSlug(q) {
  return normalize(q).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Try several candidate URL patterns for a query.
function candidateFilenames(q) {
  const slug = queryToSlug(q);
  return [
    slug + '.html',
    slug + '-cost.html',
    slug + '-guide.html',
    slug + '-cost-guide.html',
  ];
}

function hasExistingPage(q, pages) {
  for (const c of candidateFilenames(q)) {
    if (pages.has(c)) return c;
  }
  return null;
}

// --- Commercial intent scoring ---

function commercialScore(q) {
  const qn = normalize(q);
  let s = 0;
  if (qn.includes('cost') || qn.includes('price')) s += 3;
  if (qn.includes('quote') || qn.includes('estimate')) s += 3;
  if (qn.includes('average') || qn.includes('typical')) s += 2;
  if (qn.includes('how much')) s += 2;
  if (qn.includes('per square foot') || qn.includes('per sq ft') || qn.includes('per linear foot')) s += 2;
  if (qn.match(/\b\d+ (ton|sq ft|square foot|square feet|gallon)\b/)) s += 2;
  if (qn.includes('calculator')) s += 1;
  if (qn.includes('near me')) s -= 1;  // local-intent, covered by city pages
  return s;
}

// --- Main ---

if (!fs.existsSync(IN_FILE)) {
  console.error('Missing', IN_FILE, '— run harvest-trends.js first.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
const pages = existingPages();

// Dedupe: keep the highest-value occurrence of each normalized query.
const byQuery = new Map();
let totalInput = 0, excluded = 0, deduped = 0;

for (const row of raw) {
  for (const rq of row.relatedQueries || []) {
    totalInput++;
    const nq = normalize(rq.query);
    const reason = shouldExclude(nq);
    if (reason) { excluded++; continue; }

    const existing = byQuery.get(nq);
    const entry = {
      query: rq.query,
      normalized: nq,
      vertical: row.vertical,
      seed: row.seed,
      value: rq.value,
      kind: rq.kind,
      commercialScore: commercialScore(nq),
    };
    if (!existing || rq.kind === 'top' && existing.kind !== 'top' || (rq.kind === existing.kind && rq.value > existing.value)) {
      byQuery.set(nq, entry);
      if (existing) deduped++;
    } else {
      deduped++;
    }
  }
}

// --- Merge Bing autocomplete harvest if present.
// Bing entries are { seed, vertical, expansion, suggestion }. We treat each
// suggestion as a "rising" kind with synthetic value (Bing has no relative
// volume signal, so commercial score does the ranking work).
let bingMerged = 0, bingExcluded = 0;
if (fs.existsSync(BING_FILE)) {
  const bingRaw = JSON.parse(fs.readFileSync(BING_FILE, 'utf8'));
  for (const item of bingRaw) {
    const q = String(item.suggestion || '').trim();
    if (!q || q.length < 4) continue;
    totalInput++;
    const nq = normalize(q);
    const reason = shouldExclude(nq);
    if (reason) { bingExcluded++; excluded++; continue; }

    const existing = byQuery.get(nq);
    const entry = {
      query: q,
      normalized: nq,
      vertical: item.vertical,
      seed: item.seed || 'bing',
      value: 1,           // Bing has no volume — let commercialScore drive ranking
      kind: 'bing',
      commercialScore: commercialScore(nq),
    };
    if (!existing) {
      byQuery.set(nq, entry);
      bingMerged++;
    } else if (existing.kind === 'bing') {
      // both bing — keep first
      deduped++;
    } else {
      // existing is from Trends — Trends is more trustworthy, skip
      deduped++;
    }
  }
  console.log(`Bing merge: ${bingMerged} new entries added, ${bingExcluded} bing-only excluded`);
} else {
  console.log('No bing-raw.json present — Trends-only run.');
}

// Flag existing-page matches
for (const entry of byQuery.values()) {
  const hit = hasExistingPage(entry.normalized, pages);
  entry.existingPage = hit;
  entry.newPageNeeded = !hit;
}

// Rank: priority = commercialScore × 10 + normalized value (top kind only)
const ranked = [...byQuery.values()].map(e => ({
  ...e,
  priority: e.commercialScore * 10 + (e.kind === 'top' ? e.value : Math.min(e.value / 1000, 20)),
})).sort((a, b) => b.priority - a.priority);

// Write filtered JSON
fs.writeFileSync(OUT_JSON, JSON.stringify(ranked, null, 2), 'utf8');

// Write CSV
const csvHeader = 'priority,query,vertical,seed,value,kind,commercialScore,existingPage,newPageNeeded\n';
const csvRows = ranked.map(e => {
  const q = e.query.replace(/"/g, '""');
  return `${e.priority.toFixed(1)},"${q}",${e.vertical},"${e.seed}",${e.value},${e.kind},${e.commercialScore},${e.existingPage || ''},${e.newPageNeeded}`;
});
fs.writeFileSync(OUT_CSV, csvHeader + csvRows.join('\n'), 'utf8');

// Summary report
const gaps = ranked.filter(e => e.newPageNeeded);
const covered = ranked.filter(e => !e.newPageNeeded);

console.log('--- Aggregation summary ---');
console.log('Total raw related-queries:', totalInput);
console.log('Excluded (brand/symptom/off-scope):', excluded);
console.log('Dedup collisions:', deduped);
console.log('Unique filtered queries:', ranked.length);
console.log('  Already have a page:', covered.length);
console.log('  NEW PAGE NEEDED (gaps):', gaps.length);
console.log('');
console.log('Top 20 gaps by priority:');
gaps.slice(0, 20).forEach((e, i) => {
  console.log(`${(i+1).toString().padStart(3, ' ')}. [${e.vertical.padEnd(15)}] ${e.query.padEnd(40)} p=${e.priority.toFixed(1)} v=${e.value} k=${e.kind}`);
});

console.log('');
console.log('Output:');
console.log('  ', OUT_JSON);
console.log('  ', OUT_CSV);
