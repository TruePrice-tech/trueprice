#!/usr/bin/env node
/**
 * Cluster Chattanooga roofing autocomplete suggestions by intent + geo.
 * Mirrors analyze-chattanooga-painting-pilot.js with ROOFING sub-vertical regexes.
 *
 * Run: node scripts/keyword-research/analyze-chattanooga-roofing-pilot.js
 */

const fs = require('fs');
const path = require('path');

const IN = path.join(__dirname, 'output', 'chattanooga-roofing-pilot.json');
const OUT = path.join(__dirname, 'output', 'chattanooga-roofing-pilot-clusters.json');

const data = JSON.parse(fs.readFileSync(IN, 'utf8'));

const counts = new Map();
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
  phrase: x.phrase, count: x.count, engines: [...x.engines], seedCount: x.seeds.size,
}));

// Intent classifier — roofing-tuned sub-verticals (paint -> roof brands; deck/cabinet -> shingle/metal/hail/gutter)
const INTENT = {
  cost: /\b(cost|price|prices|how much|expensive|cheap|cheapest|affordable|estimate|estimates|quote|quotes|fee|fees|per sq ?ft|per square|per square foot)\b/,
  contractor: /\b(roofer|roofers|contractor|contractors|company|companies|service|services|crew|business|professional|pro|near me|best|top|local|licensed|insured|bonded|reviews?)\b/,
  project_shingle: /\b(shingle|shingles|asphalt|architectural|3.?tab|laminated)\b/,
  project_metal: /\b(metal|standing seam|aluminum|copper|steel roof|tin roof)\b/,
  project_flat: /\b(flat roof|epdm|tpo|rubber roof|membrane)\b/,
  project_tile: /\b(tile|clay|concrete tile|spanish tile|slate)\b/,
  project_repair: /\b(repair|leak|leaking|patch|fix|emergency)\b/,
  project_hail: /\b(hail|storm damage|wind damage|insurance claim)\b/,
  project_gutter: /\b(gutter|gutters|downspout|drainage)\b/,
  project_inspection: /\b(inspect|inspection|assessment|evaluation)\b/,
  project_commercial: /\b(commercial|office|business|industrial|warehouse)\b/,
  roof_brand: /\b(gaf|owens corning|certainteed|tamko|iko|atlas|malarkey|timberline|landmark)\b/,
  prep_repair: /\b(decking|underlayment|flashing|ventilation|ridge vent|soffit vent|drip edge|ice and water|tear off|tear[- ]off)\b/,
  how_to: /\b(how to|how do|how can|diy|do it yourself|yourself|tips|guide|tutorial|step by step)\b/,
  timing: /\b(how long|last|lasts|lifespan|years|season|seasonal|spring|summer|fall|winter|weather|rain)\b/,
  comparison: /\b(vs|or|versus|compare|comparison|better than|difference|differences)\b/,
  question: /\b(faq|faqs|questions|what is|what are|why|should i|do i need|when should)\b/,
  insurance: /\b(insurance|claim|adjuster|deductible|covered)\b/,
};

const CHATT_GEO = /\b(chattanooga|chatt|lookout mountain|east brainerd|brainerd|north shore|northshore|hixson|east ridge|red bank|ooltewah|signal mountain|soddy[- ]?daisy|harrison)\b/i;
const TN_GEO = /\btn\b|tennessee/i;
const STATE_NEAR = /\b(ga|georgia|al|alabama|nc|north carolina)\b/i;
const OTHER_CITY_HINT = /\b(detroit|joplin|carson|kettering|linden|southfield|nashville|knoxville|memphis|atlanta|birmingham|charlotte)\b/i;

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

const byIntent = {};
for (const intentName of Object.keys(INTENT)) byIntent[intentName] = [];
const noIntent = [];
for (const e of enriched) {
  if (e.intents.length === 0) noIntent.push(e);
  for (const i of e.intents) byIntent[i].push(e);
}
for (const k of Object.keys(byIntent)) byIntent[k].sort((a, b) => b.count - a.count);

const byGeo = { chattanooga: [], tn_other: [], state_near: [], other_city: [], no_geo: [] };
for (const e of enriched) byGeo[e.geo].push(e);
for (const k of Object.keys(byGeo)) byGeo[k].sort((a, b) => b.count - a.count);

const chattByIntent = {};
for (const intentName of Object.keys(INTENT)) chattByIntent[intentName] = [];
for (const e of enriched) {
  if (e.geo !== 'chattanooga') continue;
  for (const i of e.intents) chattByIntent[i].push(e);
}
for (const k of Object.keys(chattByIntent)) chattByIntent[k].sort((a, b) => b.count - a.count);

const topOverall = [...enriched].sort((a, b) => b.count - a.count).slice(0, 50);
const bothEngines = enriched.filter(e => e.engines.length === 2).sort((a, b) => b.count - a.count);

const out = {
  meta: {
    sourceFile: 'chattanooga-roofing-pilot.json',
    vertical: 'roofing',
    city: 'chattanooga',
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

console.log(`\n=== Chattanooga Roofing Pilot — Cluster Analysis ===`);
console.log(`Total unique phrases: ${enriched.length}`);
console.log(`Geo: chattanooga=${byGeo.chattanooga.length}, tn_other=${byGeo.tn_other.length}, state_near=${byGeo.state_near.length}, other_city=${byGeo.other_city.length}, no_geo=${byGeo.no_geo.length}`);
console.log(`\nChattanooga phrases by intent (counts):`);
for (const [k, v] of Object.entries(chattByIntent)) {
  if (v.length === 0) continue;
  console.log(`  ${k.padEnd(20)} ${v.length} phrases`);
}
console.log(`\nFull report: ${OUT}`);
