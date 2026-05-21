#!/usr/bin/env node
/**
 * Read los-angeles-roofing-pilot.json, cluster suggestions by intent + geo,
 * write a structured report to los-angeles-roofing-pilot-clusters.json,
 * and print a tight summary to stdout.
 *
 * Mirror of analyze-chattanooga-painting-pilot.js with intents/geo retuned
 * for the LA roofing vertical (Stage 4 of the locked flagship playbook).
 */

const fs = require('fs');
const path = require('path');

const IN = path.join(__dirname, 'output', 'los-angeles-roofing-pilot.json');
const OUT = path.join(__dirname, 'output', 'los-angeles-roofing-pilot-clusters.json');

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

// Intent classifier — roofing tuned. A phrase can sit in multiple buckets.
const INTENT = {
  cost: /\b(cost|price|prices|how much|expensive|cheap|cheapest|affordable|estimate|estimates|quote|quotes|fee|fees|per sq ?ft|per square|per square foot|per square ?foot)\b/,
  contractor: /\b(roofer|roofers|contractor|contractors|company|companies|service|services|crew|business|professional|pro|near me|best|top|local|licensed|insured|bonded|reviews?|cslb)\b/,
  // Roofing project / sub-vertical types
  material_asphalt: /\b(asphalt|3[- ]?tab|three[- ]?tab|architectural|laminated|composition|comp shingle)\b/,
  material_tile: /\b(tile|clay tile|concrete tile|spanish tile|mission tile|barrel tile|s[- ]?tile)\b/,
  material_metal: /\b(metal|standing seam|corrugated|galvalume|steel|aluminum|copper|zinc)\b/,
  material_slate: /\b(slate|natural slate|synthetic slate)\b/,
  material_solar: /\b(solar|tesla|solar roof|solar shingle|photovoltaic|pv roof)\b/,
  material_flat: /\b(flat|tpo|epdm|pvc|modified bitumen|built[- ]?up|bur|cool roof|low slope|low[- ]?slope)\b/,
  material_wood: /\b(wood shake|cedar shake|cedar|shake)\b/,
  // Project type / work scope
  project_repair: /\b(repair|repairs|leak|leaks|patch|patching|fix|fixing|replace shingle|reseal|resealing|tarp|tarping|emergency)\b/,
  project_replacement: /\b(replace|replacement|re[- ]?roof|reroof|new roof|tear off|tear[- ]?off|full replacement)\b/,
  project_storm: /\b(storm|wind|hail|wildfire|smoke|ash|debris|fire damage|earthquake|seismic)\b/,
  project_commercial: /\b(commercial|business|office|warehouse|industrial|apartment|multifamily|hoa property)\b/,
  // LA-specific code / regulatory intent
  code_title24: /\b(title 24|title24|t-24|t24|cool roof|cool[- ]?roof|energy code|cec)\b/,
  code_fire: /\b(class a|class[- ]?a|fire rated|fire[- ]?rated|fire resistant|wui|wildland|chapter 7a|wildfire zone|fire zone|fhsz)\b/,
  code_permit: /\b(permit|permits|ladbs|building department|building and safety|inspection|inspector|hillside|hillside ordinance)\b/,
  code_hoa: /\b(hoa|homeowners association|association approved|color restriction|architectural committee)\b/,
  code_license: /\b(cslb|license|licensed|c[- ]?39|contractor license|state license)\b/,
  // Insurance / damage funnel (likely low for LA — sanity check)
  insurance: /\b(insurance|claim|claims|deductible|acv|rcv|adjuster|coverage|policy|covered)\b/,
  // Trust / decision support
  trust_review: /\b(review|reviews|rating|ratings|complaint|complaints|bbb|better business|scam|red flag|red[- ]?flags|rip[- ]?off|warranty|warranties|guarantee)\b/,
  // Roof brand (matters for material section depth)
  brand: /\b(gaf|owens corning|certainteed|certain[- ]?teed|iko|tamko|atlas|malarkey|eagle|boral|monier|ludowici|ms international|tesla)\b/,
  // Decking / scope add-ons
  scope_addon: /\b(decking|plywood|osb|underlayment|flashing|drip edge|ridge vent|ventilation|skylight|gutter|fascia|soffit|chimney|valley|ice and water|starter strip|ridge cap)\b/,
  // How-to / informational
  how_to: /\b(how to|how do|how can|diy|do it yourself|yourself|tips|guide|tutorial|step by step|signs)\b/,
  timing: /\b(how long|last|lasts|lifespan|years|season|seasonal|spring|summer|fall|winter|weather|rain|when to|when should|how often)\b/,
  comparison: /\b(vs|or|versus|compare|comparison|better than|differences|difference|best for|pros and cons)\b/,
  question: /\b(faq|faqs|questions|what is|what are|why|should i|do i need|when should|do you need|is it worth)\b/,
  paid_rebate: /\b(rebate|tax credit|tax[- ]?credit|discount|coupon|finance|financing|payment plan|ladwp rebate|utility rebate|incentive)\b/,
};

// Geo classifier — LA proper + neighborhoods + LA County + CA + neighbors + decoy cities
const LA_GEO = /\b(los angeles|^la$|^l\.a\.$| la |west la|south la|east la|north la|downtown la|dtla|santa monica|beverly hills|pasadena|long beach|glendale|burbank|west hollywood|weho|culver city|manhattan beach|redondo beach|hermosa beach|venice|santa clarita|torrance|downey|inglewood|hollywood|sherman oaks|studio city|encino|tarzana|woodland hills|north hollywood|noho|silver lake|echo park|koreatown|ktown|mid city|west adams|highland park|eagle rock|san fernando valley|sfv|the valley|brentwood|westwood|mar vista|playa vista|culver|el segundo|hawthorne|gardena|carson|compton|lancaster|palmdale|antelope valley|whittier|monterey park|alhambra|arcadia|temple city|montebello)\b/i;
const CA_OTHER = /\b(san diego|san francisco|sf bay|san jose|sacramento|fresno|oakland|bakersfield|anaheim|riverside|orange county|oc|irvine|costa mesa|huntington beach|newport beach|laguna|santa ana|fullerton|ventura|santa barbara|oxnard|simi valley|thousand oaks|moorpark|camarillo)\b/i;
const STATE_NEAR = /\b(nv|nevada|az|arizona|or|oregon|las vegas|phoenix|portland|reno|henderson|tucson|mesa)\b/i;
const OTHER_CITY_HINT = /\b(nashville|chattanooga|knoxville|memphis|chicago|new york|nyc|houston|dallas|denver|atlanta|miami|tampa|seattle|portland|boise|salt lake|kansas city)\b/i;
const CA_STATE = /\b(california|^ca$| ca\b)\b/i;

function classify(phrase) {
  const intents = [];
  for (const [name, re] of Object.entries(INTENT)) if (re.test(phrase)) intents.push(name);
  const geo = LA_GEO.test(phrase) ? 'los_angeles'
    : CA_OTHER.test(phrase) ? 'ca_other_city'
    : CA_STATE.test(phrase) ? 'ca_state'
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
for (const k of Object.keys(byIntent)) {
  byIntent[k].sort((a, b) => b.count - a.count);
}

const byGeo = { los_angeles: [], ca_other_city: [], ca_state: [], state_near: [], other_city: [], no_geo: [] };
for (const e of enriched) byGeo[e.geo].push(e);
for (const k of Object.keys(byGeo)) byGeo[k].sort((a, b) => b.count - a.count);

// Cross-tab: LA × intent (most actionable view)
const laByIntent = {};
for (const intentName of Object.keys(INTENT)) laByIntent[intentName] = [];
for (const e of enriched) {
  if (e.geo !== 'los_angeles') continue;
  for (const i of e.intents) laByIntent[i].push(e);
}
for (const k of Object.keys(laByIntent)) laByIntent[k].sort((a, b) => b.count - a.count);

const topOverall = [...enriched].sort((a, b) => b.count - a.count).slice(0, 50);
const bothEngines = enriched.filter(e => e.engines.length === 2).sort((a, b) => b.count - a.count);

const out = {
  meta: {
    sourceFile: 'los-angeles-roofing-pilot.json',
    harvestedAt: data.meta?.harvestedAt,
    analyzedAt: new Date().toISOString(),
    totalRawSuggestions: data.suggestions.length,
    totalUnique: enriched.length,
    geoBreakdown: Object.fromEntries(Object.entries(byGeo).map(([k, v]) => [k, v.length])),
    intentBreakdown: Object.fromEntries(Object.entries(byIntent).map(([k, v]) => [k, v.length])),
  },
  topOverall: topOverall.map(e => ({ phrase: e.phrase, count: e.count, geo: e.geo, intents: e.intents })),
  bothEngines: bothEngines.slice(0, 30).map(e => ({ phrase: e.phrase, count: e.count, geo: e.geo, intents: e.intents })),
  laByIntent: Object.fromEntries(Object.entries(laByIntent).map(([k, v]) => [
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

console.log(`\n=== Los Angeles Roofing Pilot - Cluster Analysis ===`);
console.log(`Total unique phrases: ${enriched.length}`);
console.log(`Geo: la=${byGeo.los_angeles.length}, ca_other=${byGeo.ca_other_city.length}, ca_state=${byGeo.ca_state.length}, state_near=${byGeo.state_near.length}, other_city=${byGeo.other_city.length}, no_geo=${byGeo.no_geo.length}`);
console.log(`\nLA phrases by intent (counts):`);
for (const [k, v] of Object.entries(laByIntent)) {
  if (v.length === 0) continue;
  console.log(`  ${k.padEnd(20)} ${v.length} phrases`);
}
console.log(`\nFull report: ${OUT}`);
