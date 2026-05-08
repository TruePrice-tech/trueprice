#!/usr/bin/env node
// One-shot wire-up: hub -> state hub link + city -> state hub breadcrumb
// for medical / legal / moving / auto-repair verticals.
// Run from repo root. Pass --dry to preview without writing.

'use strict';
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const ROOT = process.cwd();

const STATE_CODE_TO = {
  al: ['Alabama', 'alabama'], ak: ['Alaska', 'alaska'], az: ['Arizona', 'arizona'],
  ar: ['Arkansas', 'arkansas'], ca: ['California', 'california'], co: ['Colorado', 'colorado'],
  ct: ['Connecticut', 'connecticut'], de: ['Delaware', 'delaware'], fl: ['Florida', 'florida'],
  ga: ['Georgia', 'georgia'], hi: ['Hawaii', 'hawaii'], id: ['Idaho', 'idaho'],
  il: ['Illinois', 'illinois'], in: ['Indiana', 'indiana'], ia: ['Iowa', 'iowa'],
  ks: ['Kansas', 'kansas'], ky: ['Kentucky', 'kentucky'], la: ['Louisiana', 'louisiana'],
  me: ['Maine', 'maine'], md: ['Maryland', 'maryland'], ma: ['Massachusetts', 'massachusetts'],
  mi: ['Michigan', 'michigan'], mn: ['Minnesota', 'minnesota'], ms: ['Mississippi', 'mississippi'],
  mo: ['Missouri', 'missouri'], mt: ['Montana', 'montana'], ne: ['Nebraska', 'nebraska'],
  nv: ['Nevada', 'nevada'], nh: ['New Hampshire', 'new-hampshire'], nj: ['New Jersey', 'new-jersey'],
  nm: ['New Mexico', 'new-mexico'], ny: ['New York', 'new-york'], nc: ['North Carolina', 'north-carolina'],
  nd: ['North Dakota', 'north-dakota'], oh: ['Ohio', 'ohio'], ok: ['Oklahoma', 'oklahoma'],
  or: ['Oregon', 'oregon'], pa: ['Pennsylvania', 'pennsylvania'], ri: ['Rhode Island', 'rhode-island'],
  sc: ['South Carolina', 'south-carolina'], sd: ['South Dakota', 'south-dakota'], tn: ['Tennessee', 'tennessee'],
  tx: ['Texas', 'texas'], ut: ['Utah', 'utah'], vt: ['Vermont', 'vermont'],
  va: ['Virginia', 'virginia'], wa: ['Washington', 'washington'], wv: ['West Virginia', 'west-virginia'],
  wi: ['Wisconsin', 'wisconsin'], wy: ['Wyoming', 'wyoming'],
};

const VERTICALS = [
  { slug: 'medical',     hub: 'medical-cities.html',     style: 'fix',
    rendered_anchor_after: /(<a href="\/medical-cost-guide\.html">Medical (?:Cost Guide|Bills)<\/a> &rsaquo;)(\r?\n)(<span>)/ },
  { slug: 'legal',       hub: 'legal-cities.html',       style: 'fix',
    rendered_anchor_after: /(<a href="\/legal-cost-guide\.html">Legal (?:Cost Guide|Fees|Bills)<\/a> &rsaquo;)(\r?\n)(<span>)/ },
  { slug: 'moving',      hub: 'moving-cities.html',      style: 'inject',
    rendered_anchor_after: /(<a href="\/moving(?:-estimate|-cost-guide)\.html"[^>]*>Moving<\/a> &rsaquo;)(\r?\n)(<span>)/ },
  { slug: 'auto-repair', hub: 'auto-repair-cities.html', style: 'inject',
    rendered_anchor_after: /(<a href="\/auto-repair\.html">Auto Repair<\/a> &rsaquo;)(\r?\n)(<span>)/ },
];

// Build set of city files per vertical: filename = "{city}-{xx}-{vertical}-cost.html"
function listCityFiles(vertSlug) {
  const all = fs.readdirSync(ROOT);
  const suffix = '-' + vertSlug + '-cost.html';
  const out = [];
  for (const f of all) {
    if (!f.endsWith(suffix)) continue;
    const stem = f.slice(0, -suffix.length); // e.g. "mesa-az" or "wyoming"
    const m = stem.match(/^(.+)-([a-z]{2})$/);
    if (!m) continue; // state hub (no -xx)
    const stateCode = m[2];
    if (!STATE_CODE_TO[stateCode]) continue;
    out.push({ file: f, citySlug: m[1], stateCode });
  }
  return out;
}

function processCityPage(file, citySlug, stateCode, vert) {
  const [stateName, stateSlug] = STATE_CODE_TO[stateCode];
  const stateHubHref = `/${stateSlug}-${vert.slug}-cost.html`;
  const fp = path.join(ROOT, file);
  const before = fs.readFileSync(fp, 'utf8');
  let html = before;
  let changes = [];

  // ----- 1. Rendered HTML breadcrumb -----
  // Try 'fix' (replace broken state-name anchor) first; if that misses, try 'inject'.
  let fixed = false;
  if (vert.style === 'fix') {
    const target = `<a href="/${vert.slug}-cost-guide.html">${stateName}</a>`;
    const repl = `<a href="${stateHubHref}">${stateName}</a>`;
    if (html.includes(target)) {
      html = html.replace(target, repl);
      changes.push('rendered-bc-fix');
      fixed = true;
    }
  }
  if (!fixed) {
    // Inject state link between vertical anchor and city span (covers both 'inject'-style
    // verticals and any 'fix' page that's actually a 3-level breadcrumb, e.g. chattanooga).
    const m = vert.rendered_anchor_after.exec(html);
    if (m) {
      const nl = m[2];
      const ins = `${m[1]}${nl}<a href="${stateHubHref}">${stateName}</a> &rsaquo;${nl}${m[3]}`;
      html = html.replace(vert.rendered_anchor_after, ins);
      changes.push('rendered-bc-inject');
    }
  }

  // ----- 2. Schema.org BreadcrumbList -----
  // Find: {"@type":"ListItem","position":3,"name":"<CityName>"}  (no "item" field)
  // and the prior position-2 ListItem to confirm we're in the right block.
  // Bump position 3 -> 4, insert state at position 3.
  const schemaRe = /(\{"@type":"ListItem","position":2,"name":"[^"]+","item":"https:\/\/woogoro\.com\/[^"]+"\},\s*)(\{"@type":"ListItem","position":3,"name":"([^"]+)"\})/;
  const sm = html.match(schemaRe);
  if (sm) {
    const cityName = sm[3];
    const stateItem = `{"@type":"ListItem","position":3,"name":"${stateName}","item":"https://woogoro.com${stateHubHref}"}`;
    const cityItem = `{"@type":"ListItem","position":4,"name":"${cityName}"}`;
    const replaced = `${sm[1]}${stateItem},${cityItem}`;
    html = html.replace(schemaRe, replaced);
    changes.push('schema-bc');
  }

  if (html === before) return { file, changes: [], skipped: true };
  if (!DRY) fs.writeFileSync(fp, html);
  return { file, changes };
}

function processCitiesHub(vert) {
  const fp = path.join(ROOT, vert.hub);
  const before = fs.readFileSync(fp, 'utf8');
  let html = before;
  let upgraded = 0, alreadyLinked = 0;
  // <h2 id="az">Arizona</h2>  =>  <h2 id="az"><a href="/arizona-medical-cost.html">Arizona</a></h2>
  html = html.replace(/<h2 id="([a-z]{2})">([A-Z][A-Za-z ]+)<\/h2>/g, (full, code, name) => {
    if (!STATE_CODE_TO[code]) return full;
    const expectedName = STATE_CODE_TO[code][0];
    if (expectedName !== name) return full;
    const slug = STATE_CODE_TO[code][1];
    const hubFile = `${slug}-${vert.slug}-cost.html`;
    if (!fs.existsSync(path.join(ROOT, hubFile))) return full;
    upgraded++;
    return `<h2 id="${code}"><a href="/${hubFile}">${name}</a></h2>`;
  });
  // also detect already-linked headings (idempotency)
  alreadyLinked = (html.match(/<h2 id="[a-z]{2}"><a href="\/[a-z-]+-cost\.html">/g) || []).length;
  if (html === before) return { hub: vert.hub, upgraded: 0, alreadyLinked };
  if (!DRY) fs.writeFileSync(fp, html);
  return { hub: vert.hub, upgraded, alreadyLinked };
}

const summary = { hubs: [], cityCounts: {} };
for (const vert of VERTICALS) {
  const hubRes = processCitiesHub(vert);
  summary.hubs.push(hubRes);
  const cities = listCityFiles(vert.slug);
  let cChanged = 0, cSkipped = 0, partial = [];
  for (const c of cities) {
    const r = processCityPage(c.file, c.citySlug, c.stateCode, vert);
    if (r.skipped) cSkipped++;
    else cChanged++;
    if (r.changes && r.changes.length > 0 && r.changes.length < (vert.style === 'fix' ? 2 : 2)) {
      partial.push({ file: c.file, changes: r.changes });
    }
  }
  summary.cityCounts[vert.slug] = { total: cities.length, changed: cChanged, skipped: cSkipped, partial };
}

console.log(JSON.stringify(summary, null, 2));
console.log(DRY ? '\n[DRY RUN — no files written]' : '\n[wrote files]');
