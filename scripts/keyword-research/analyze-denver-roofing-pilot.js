#!/usr/bin/env node
/**
 * Mirror of analyze-los-angeles-roofing-pilot.js retuned for Denver:
 *   - geo regex: Denver proper + neighborhoods + CO Front Range + CO state
 *   - intent regex: adds hail / insurance-claim / Class-4-IR-shingle / HB-1212
 *
 * Stage 4 of the flagship playbook. Run after the Denver harvester finishes.
 *
 * Output: scripts/keyword-research/output/denver-roofing-pilot-clusters.json
 */

const fs = require('fs');
const path = require('path');

const IN = path.join(__dirname, 'output', 'denver-roofing-pilot.json');
const OUT = path.join(__dirname, 'output', 'denver-roofing-pilot-clusters.json');

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
  phrase: x.phrase,
  count: x.count,
  engines: [...x.engines],
  seedCount: x.seeds.size,
}));

const INTENT = {
  cost: /\b(cost|price|prices|how much|expensive|cheap|cheapest|affordable|estimate|estimates|quote|quotes|fee|fees|per sq ?ft|per square|per square foot)\b/,
  contractor: /\b(roofer|roofers|contractor|contractors|company|companies|service|services|crew|business|professional|pro|near me|best|top|local|licensed|insured|bonded|reviews?)\b/,
  // Material sub-verticals
  material_asphalt: /\b(asphalt|3[- ]?tab|three[- ]?tab|architectural|laminated|composition|comp shingle)\b/,
  material_metal: /\b(metal|standing seam|corrugated|galvalume|steel|aluminum|copper|zinc)\b/,
  material_tile: /\b(tile|clay tile|concrete tile|spanish tile)\b/,
  material_wood: /\b(wood shake|cedar shake|cedar|shake|shakes)\b/,
  material_solar: /\b(solar|tesla|solar roof|solar shingle|photovoltaic|pv roof)\b/,
  // THE DENVER STORY — hail + class 4 + insurance
  hail: /\b(hail|hailstorm|hail damage|hail damaged|hail-damaged|wind damage|storm damage|wind hail)\b/,
  ir_shingle: /\b(class[- ]?4|class 4 shingle|impact[- ]?resistant|impact resistant shingle|hail[- ]?proof|hail[- ]?resistant|stormmaster|northgate|climateflex|sbs modified|polymer modified)\b/,
  insurance: /\b(insurance|claim|claims|deductible|acv|rcv|adjuster|public adjuster|coverage|policy|covered|allstate|state farm|usaa|farmers|liberty mutual|geico|nationwide|travelers|hippo|supplement|depreciation|xactimate)\b/,
  hb1212: /\b(hb[- ]?1212|hb1212|house bill 1212|colorado roofer law|colorado contractor law|roofer act as adjuster|public adjuster law)\b/,
  // Project type / work scope
  project_repair: /\b(repair|repairs|leak|leaks|patch|patching|fix|fixing|replace shingle|reseal|resealing|tarp|tarping|emergency)\b/,
  project_replacement: /\b(replace|replacement|re[- ]?roof|reroof|new roof|tear off|tear[- ]?off|full replacement)\b/,
  project_commercial: /\b(commercial|business|office|warehouse|industrial|apartment|multifamily|hoa property)\b/,
  // CO-specific code / regulatory intent
  code_permit: /\b(permit|permits|building department|building and safety|inspection|inspector|cpd|community planning)\b/,
  code_license: /\b(license|licensed|state license|colorado license|dora license)\b/,
  code_fire: /\b(class a|class[- ]?a|fire rated|fire[- ]?rated|fire resistant|wildfire|wildland|defensible space)\b/,
  code_hoa: /\b(hoa|homeowners association|association approved|color restriction|architectural committee)\b/,
  // Trust / decision support
  trust_review: /\b(review|reviews|rating|ratings|complaint|complaints|bbb|better business|scam|red flag|red[- ]?flags|rip[- ]?off|warranty|warranties|guarantee|dora complaint)\b/,
  // Brands
  brand: /\b(gaf|owens corning|certainteed|certain[- ]?teed|iko|tamko|atlas|malarkey|timberline|northgate|stormmaster)\b/,
  // Scope add-ons
  scope_addon: /\b(decking|plywood|osb|underlayment|flashing|drip edge|ridge vent|ventilation|skylight|gutter|fascia|soffit|chimney|valley|ice and water|starter strip|ridge cap|synthetic underlayment)\b/,
  // How-to / informational
  how_to: /\b(how to|how do|how can|diy|do it yourself|yourself|tips|guide|tutorial|step by step|signs)\b/,
  timing: /\b(how long|last|lasts|lifespan|years|season|seasonal|spring|summer|fall|winter|weather|when to|when should|how often|hail season)\b/,
  comparison: /\b(vs|or|versus|compare|comparison|better than|differences|difference|best for|pros and cons)\b/,
  question: /\b(faq|faqs|questions|what is|what are|why|should i|do i need|when should|do you need|is it worth)\b/,
  paid_rebate: /\b(rebate|tax credit|tax[- ]?credit|discount|coupon|finance|financing|payment plan|incentive)\b/,
};

// Geo classifier — Denver proper + named neighborhoods + suburbs + CO Front Range
const DENVER_GEO = /\b(denver|^den$|downtown denver|lodo|rino|capitol hill|cap hill|cherry creek|highlands|highland|sloan'?s lake|sloans lake|stapleton|central park|park hill|wash park|washington park|baker|five points|montbello|green valley ranch|gvr|berkeley|sunnyside|sloan|west wash park|south park hill|hampden|virginia village|university park|university hills|globeville|elyria|swansea|cole|whittier|congress park|hilltop|crestmoor|lowry|montclair|mar lee|harvey park|college view|athmar|ruby hill|overland|platt park|santa fe|west colfax|jefferson park|valverde|barnum|villa park|west highland)\b/i;
const CO_FRONT_RANGE = /\b(aurora|lakewood|arvada|westminster|thornton|centennial|highlands ranch|broomfield|parker|castle rock|englewood|wheat ridge|littleton|commerce city|northglenn|brighton|lone tree|greenwood village|cherry hills|sheridan|edgewater|golden|morrison|evergreen|conifer|elizabeth|franktown|sedalia|louisville|lafayette|superior|erie|firestone|frederick|dacono|berthoud|loveland|boulder|fort collins|longmont|greeley|pueblo|colorado springs|monument|woodland park)\b/i;
const STATE_NEAR = /\b(wy|wyoming|ut|utah|ne|nebraska|nm|new mexico|ks|kansas|cheyenne|salt lake|albuquerque|santa fe|laramie|casper)\b/i;
const OTHER_CITY_HINT = /\b(nashville|chattanooga|knoxville|memphis|chicago|new york|nyc|houston|dallas|los angeles|la|atlanta|miami|tampa|seattle|portland|boise|kansas city)\b/i;
const CO_STATE = /\b(colorado|^co$| co\b|front range)\b/i;

function classify(phrase) {
  const intents = [];
  for (const [name, re] of Object.entries(INTENT)) if (re.test(phrase)) intents.push(name);
  const geo = DENVER_GEO.test(phrase) ? 'denver'
    : CO_FRONT_RANGE.test(phrase) ? 'co_front_range'
    : CO_STATE.test(phrase) ? 'co_state'
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

const byGeo = { denver: [], co_front_range: [], co_state: [], state_near: [], other_city: [], no_geo: [] };
for (const e of enriched) byGeo[e.geo].push(e);
for (const k of Object.keys(byGeo)) byGeo[k].sort((a, b) => b.count - a.count);

const denverByIntent = {};
for (const intentName of Object.keys(INTENT)) denverByIntent[intentName] = [];
for (const e of enriched) {
  if (e.geo !== 'denver') continue;
  for (const i of e.intents) denverByIntent[i].push(e);
}
for (const k of Object.keys(denverByIntent)) denverByIntent[k].sort((a, b) => b.count - a.count);

const topOverall = [...enriched].sort((a, b) => b.count - a.count).slice(0, 50);
const bothEngines = enriched.filter(e => e.engines.length === 2).sort((a, b) => b.count - a.count);

const out = {
  meta: {
    sourceFile: 'denver-roofing-pilot.json',
    harvestedAt: data.meta?.harvestedAt,
    analyzedAt: new Date().toISOString(),
    totalRawSuggestions: data.suggestions.length,
    totalUnique: enriched.length,
    geoBreakdown: Object.fromEntries(Object.entries(byGeo).map(([k, v]) => [k, v.length])),
    intentBreakdown: Object.fromEntries(Object.entries(byIntent).map(([k, v]) => [k, v.length])),
  },
  topOverall: topOverall.map(e => ({ phrase: e.phrase, count: e.count, geo: e.geo, intents: e.intents })),
  bothEngines: bothEngines.slice(0, 30).map(e => ({ phrase: e.phrase, count: e.count, geo: e.geo, intents: e.intents })),
  denverByIntent: Object.fromEntries(Object.entries(denverByIntent).map(([k, v]) => [
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

console.log(`\n=== Denver Roofing Pilot - Cluster Analysis ===`);
console.log(`Total unique phrases: ${enriched.length}`);
console.log(`Geo: denver=${byGeo.denver.length}, co_front_range=${byGeo.co_front_range.length}, co_state=${byGeo.co_state.length}, state_near=${byGeo.state_near.length}, other_city=${byGeo.other_city.length}, no_geo=${byGeo.no_geo.length}`);
console.log(`\nDenver phrases by intent:`);
for (const [k, v] of Object.entries(denverByIntent)) {
  if (v.length === 0) continue;
  console.log(`  ${k.padEnd(20)} ${v.length} phrases`);
}
console.log(`\nFull report: ${OUT}`);
