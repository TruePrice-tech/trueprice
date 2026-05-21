#!/usr/bin/env node
/**
 * Read chattanooga-painting-pilot.json, cluster suggestions by intent + geo,
 * write a structured report to chattanooga-painting-pilot-clusters.json,
 * and print a tight summary to stdout.
 */

const fs = require('fs');
const path = require('path');

const IN = path.join(__dirname, 'output', 'chattanooga-painting-pilot.json');
const OUT = path.join(__dirname, 'output', 'chattanooga-painting-pilot-clusters.json');

const data = JSON.parse(fs.readFileSync(IN, 'utf8'));

// Normalize + dedupe
const counts = new Map(); // normalized phrase -> { phrase, count, engines: Set }
for (const row of data.suggestions) {
  const phrase = String(row.suggestion || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!phrase) continue;
  const existing = counts.get(phrase) || { phrase, count: 0, engines: new Set(), seeds: new Set() };
  existing.count += 1;
  existing.engines.add(row.engine);
  existing.seeds.add(row.seed);
  counts.set(phrase, existing);
}

const unique = [...counts.values()].map(x => ({
  phrase: x.phrase,
  count: x.count,
  engines: [...x.engines],
  seedCount: x.seeds.size,
}));

// Intent classifier — a phrase can be in multiple buckets
const INTENT = {
  cost: /\b(cost|price|prices|how much|expensive|cheap|cheapest|affordable|estimate|estimates|quote|quotes|fee|fees|hourly|per sq ?ft|per gallon|per hour)\b/,
  contractor: /\b(painter|painters|contractor|contractors|company|companies|service|services|crew|business|professional|pro|near me|best|top|local|licensed|insured|bonded|reviews?)\b/,
  project_exterior: /\b(exterior|outside|outdoor|siding|stucco|brick|fascia|soffit|gutter|trim|deck staining|fence painting)\b/,
  project_interior: /\b(interior|inside|indoor|room|wall|ceiling|drywall|trim work)\b/,
  project_cabinet: /\b(cabinet|cabinets|kitchen cabinet|vanity)\b/,
  project_deck: /\b(deck|stain|staining|fence)\b/,
  project_commercial: /\b(commercial|office|business|industrial|warehouse)\b/,
  paint_brand: /\b(sherwin[- ]?williams|sherwin|benjamin moore|behr|valspar|kilz|cabot|dunn[- ]?edwards|ppg|color|colors|primer|primers)\b/,
  prep_repair: /\b(prep|scrape|scraping|sand|sanding|wash|power[- ]?wash|pressure[- ]?wash|caulk|caulking|drywall repair|stucco repair|wood repair|patch|patching|peeling|crack)\b/,
  how_to: /\b(how to|how do|how can|diy|do it yourself|yourself|tips|guide|tutorial|step by step)\b/,
  timing: /\b(how long|last|lasts|lifespan|years|season|seasonal|spring|summer|fall|winter|weather|rain|humidity|temperature|when to|when should)\b/,
  comparison: /\b(vs|or|versus|compare|comparison|better than|differences|difference)\b/,
  question: /\b(faq|faqs|questions|what is|what are|why|should i|do i need|when should)\b/,
  paid_rebate: /\b(rebate|tax credit|discount|coupon|deal|finance|financing|payment plan)\b/,
};

// Geo classifier — Chattanooga + neighborhoods + suburbs
const CHATT_GEO = /\b(chattanooga|chatt|lookout mountain|east brainerd|brainerd|north shore|hixson|east ridge|red bank|ooltewah|signal mountain|soddy[- ]?daisy|harrison)\b/i;
const TN_GEO = /\btn\b|tennessee/i;
const STATE_NEAR = /\b(ga|georgia|al|alabama|nc|north carolina)\b/i;
const OTHER_CITY_HINT = /\b(detroit|joplin|carson|kettering|linden|southfield|nashville|knoxville|memphis)\b/i;

function classify(phrase) {
  const intents = [];
  for (const [name, re] of Object.entries(INTENT)) if (re.test(phrase)) intents.push(name);
  const geo = CHATT_GEO.test(phrase) ? 'chattanooga'
    : TN_GEO.test(phrase) ? 'tn_other'
    : STATE_NEAR.test(phrase) ? 'state_near'
    : OTHER_CITY_HINT.test(phrase) ? 'other_city'
    : 'no_geo';
  return { intents, geo };
}

const enriched = unique.map(u => ({ ...u, ...classify(u.phrase) }));

// Build cluster outputs
const byIntent = {};
for (const intentName of Object.keys(INTENT)) byIntent[intentName] = [];
const noIntent = [];
for (const e of enriched) {
  if (e.intents.length === 0) noIntent.push(e);
  for (const i of e.intents) byIntent[i].push(e);
}
for (const k of Object.keys(byIntent)) {
  byIntent[k].sort((a, b) => b.count - a.count);
}

const byGeo = { chattanooga: [], tn_other: [], state_near: [], other_city: [], no_geo: [] };
for (const e of enriched) byGeo[e.geo].push(e);
for (const k of Object.keys(byGeo)) byGeo[k].sort((a, b) => b.count - a.count);

// Cross-tab: Chattanooga × intent (the most actionable view)
const chattByIntent = {};
for (const intentName of Object.keys(INTENT)) chattByIntent[intentName] = [];
for (const e of enriched) {
  if (e.geo !== 'chattanooga') continue;
  for (const i of e.intents) chattByIntent[i].push(e);
}
for (const k of Object.keys(chattByIntent)) chattByIntent[k].sort((a, b) => b.count - a.count);

// Top phrases overall (sanity)
const topOverall = [...enriched].sort((a, b) => b.count - a.count).slice(0, 50);

// Phrases that came up in BOTH engines (signal of strong intent across both)
const bothEngines = enriched.filter(e => e.engines.length === 2).sort((a, b) => b.count - a.count);

const out = {
  meta: {
    sourceFile: 'chattanooga-painting-pilot.json',
    harvestedAt: data.meta?.harvestedAt,
    analyzedAt: new Date().toISOString(),
    totalRawSuggestions: data.suggestions.length,
    totalUnique: enriched.length,
    geoBreakdown: Object.fromEntries(Object.entries(byGeo).map(([k, v]) => [k, v.length])),
    intentBreakdown: Object.fromEntries(Object.entries(byIntent).map(([k, v]) => [k, v.length])),
  },
  topOverall: topOverall.map(e => ({ phrase: e.phrase, count: e.count, geo: e.geo, intents: e.intents })),
  bothEngines: bothEngines.slice(0, 30).map(e => ({ phrase: e.phrase, count: e.count, geo: e.geo, intents: e.intents })),
  chattByIntent: Object.fromEntries(Object.entries(chattByIntent).map(([k, v]) => [
    k, v.slice(0, 20).map(e => ({ phrase: e.phrase, count: e.count, engines: e.engines }))
  ])),
  byIntent: Object.fromEntries(Object.entries(byIntent).map(([k, v]) => [
    k, v.slice(0, 30).map(e => ({ phrase: e.phrase, count: e.count, geo: e.geo }))
  ])),
  byGeo: Object.fromEntries(Object.entries(byGeo).map(([k, v]) => [
    k, v.slice(0, 30).map(e => ({ phrase: e.phrase, count: e.count, intents: e.intents }))
  ])),
  noIntentClassified: noIntent.slice(0, 30).map(e => ({ phrase: e.phrase, count: e.count, geo: e.geo })),
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

// Summary print — keep it tight
console.log(`\n=== Chattanooga Painting Pilot — Cluster Analysis ===`);
console.log(`Total unique phrases: ${enriched.length}`);
console.log(`Geo: chattanooga=${byGeo.chattanooga.length}, tn_other=${byGeo.tn_other.length}, state_near=${byGeo.state_near.length}, other_city=${byGeo.other_city.length}, no_geo=${byGeo.no_geo.length}`);
console.log(`\nChattanooga phrases by intent (counts):`);
for (const [k, v] of Object.entries(chattByIntent)) {
  if (v.length === 0) continue;
  console.log(`  ${k.padEnd(20)} ${v.length} phrases`);
}
console.log(`\nFull report: ${OUT}`);
