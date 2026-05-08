#!/usr/bin/env node
// Hub -> state-hub -> city wire-up for the 16 contractor verticals.
// Mirrors _wire-state-hubs.js (which handled medical/legal/moving/auto-repair),
// but adapted for three breadcrumb shapes observed in this set:
//   FIX        — 4-level rendered breadcrumb whose state anchor wrongly points
//                back at the vertical-cost-guide URL. Repoint it.
//   INJECT     — 3-level rendered breadcrumb missing the state level entirely.
//                Insert it between the vertical anchor and the city span.
//   SKIP_CITY  — already correct (roof). Touch only the cities-hub h2's.
// Three hubs (kitchen-remodel/fence/solar) have no cities-hub file at all —
// city pages still get wired, hub linkify is skipped.

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

// vh = vertical anchor href in the breadcrumb (parent link)
// vt = vertical anchor visible text
// hub = cities-hub filename (or null if missing)
// mode = 'fix' | 'inject' | 'skip_city'
const VERTICALS = [
  { slug: 'hvac',            mode: 'fix',       hub: 'hvac-cities.html',            vh: '/hvac-cost.html',                vt: 'HVAC Cost' },
  { slug: 'plumbing',        mode: 'inject',    hub: 'plumbing-cities.html',        vh: '/plumbing-cost.html',            vt: 'Plumbing Cost' },
  { slug: 'electrical',      mode: 'fix',       hub: 'electrical-cities.html',      vh: '/electrical-cost.html',          vt: 'Electrical Cost' },
  { slug: 'roof',            mode: 'skip_city', hub: 'roof-cities.html',            vh: null,                             vt: null },
  { slug: 'kitchen-remodel', mode: 'inject',    hub: null,                          vh: '/kitchen-remodel-cost.html',     vt: 'Kitchen Remodel Cost' },
  { slug: 'window',          mode: 'fix',       hub: 'window-cities.html',          vh: '/window-replacement-cost.html',  vt: 'Window Cost' },
  { slug: 'siding',          mode: 'fix',       hub: 'siding-cities.html',          vh: '/siding-cost.html',              vt: 'Siding Cost' },
  { slug: 'painting',        mode: 'inject',    hub: 'painting-cities.html',        vh: '/painting-cost.html',            vt: 'Painting Cost' },
  { slug: 'landscaping',     mode: 'inject',    hub: 'landscaping-cities.html',     vh: '/landscaping-cost.html',         vt: 'Landscaping Cost' },
  { slug: 'insulation',      mode: 'fix',       hub: 'insulation-cities.html',      vh: '/insulation-cost.html',          vt: 'Insulation Cost' },
  { slug: 'gutter',          mode: 'inject',    hub: 'gutter-cities.html',          vh: '/gutters-cost.html',             vt: 'Gutter Cost' },
  { slug: 'garage-door',     mode: 'inject',    hub: 'garage-door-cities.html',     vh: '/garage-door-cost.html',         vt: 'Garage Door Cost' },
  { slug: 'foundation',      mode: 'inject',    hub: 'foundation-cities.html',      vh: '/foundation-repair-cost.html',   vt: 'Foundation Repair Cost' },
  { slug: 'fence',           mode: 'inject',    hub: null,                          vh: '/fence-cost.html',               vt: 'Fence Cost' },
  { slug: 'concrete',        mode: 'inject',    hub: 'concrete-cities.html',        vh: '/concrete-cost.html',            vt: 'Concrete Cost' },
  { slug: 'solar',           mode: 'inject',    hub: null,                          vh: '/solar-cost.html',               vt: 'Solar Cost' },
];

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function listCityFiles(vertSlug) {
  const all = fs.readdirSync(ROOT);
  const suffix = '-' + vertSlug + '-cost.html';
  const out = [];
  for (const f of all) {
    if (!f.endsWith(suffix)) continue;
    const stem = f.slice(0, -suffix.length);
    const m = stem.match(/^(.+)-([a-z]{2})$/);
    if (!m) continue;
    const stateCode = m[2];
    if (!STATE_CODE_TO[stateCode]) continue;
    out.push({ file: f, citySlug: m[1], stateCode });
  }
  return out;
}

function processCityPage(file, stateCode, vert) {
  if (vert.mode === 'skip_city') return { file, changes: [], skipped: true, reason: 'skip_city' };
  const [stateName, stateSlug] = STATE_CODE_TO[stateCode];
  const stateHubHref = `/${stateSlug}-${vert.slug}-cost.html`;
  // Make sure the target state hub actually exists; otherwise we'd link to 404.
  if (!fs.existsSync(path.join(ROOT, stateHubHref.slice(1)))) {
    return { file, changes: [], skipped: true, reason: 'state-hub-missing' };
  }
  const fp = path.join(ROOT, file);
  const before = fs.readFileSync(fp, 'utf8');
  let html = before;
  let changes = [];

  // ----- 1. Rendered HTML breadcrumb -----
  let didFix = false;
  if (vert.mode === 'fix') {
    const target = `<a href="${vert.vh}">${stateName}</a>`;
    const repl = `<a href="${stateHubHref}">${stateName}</a>`;
    if (html.includes(target)) {
      html = html.replace(target, repl);
      changes.push('rendered-bc-fix');
      didFix = true;
    }
  }
  if (!didFix) {
    // INJECT after the vertical anchor, before the city <span>.
    const re = new RegExp(`(<a href="${escRe(vert.vh)}"[^>]*>${escRe(vert.vt)}<\\/a> &rsaquo;)(\\r?\\n)(<span>)`);
    const m = re.exec(html);
    if (m) {
      const nl = m[2];
      html = html.replace(re, () => `${m[1]}${nl}<a href="${stateHubHref}">${stateName}</a> &rsaquo;${nl}${m[3]}`);
      changes.push('rendered-bc-inject');
    }
  }

  // ----- 2. Schema.org BreadcrumbList: 3-position -> 4-position with state at pos 3 -----
  const schemaRe = /(\{"@type":"ListItem","position":2,"name":"[^"]+","item":"https:\/\/woogoro\.com\/[^"]+"\},\s*)(\{"@type":"ListItem","position":3,"name":"([^"]+)"\})/;
  const sm = html.match(schemaRe);
  if (sm) {
    const cityName = sm[3];
    const stateItem = `{"@type":"ListItem","position":3,"name":"${stateName}","item":"https://woogoro.com${stateHubHref}"}`;
    const cityItem = `{"@type":"ListItem","position":4,"name":"${cityName}"}`;
    html = html.replace(schemaRe, () => `${sm[1]}${stateItem},${cityItem}`);
    changes.push('schema-bc');
  }

  if (html === before) return { file, changes: [], skipped: true, reason: 'no-match' };
  if (!DRY) fs.writeFileSync(fp, html);
  return { file, changes };
}

function processCitiesHub(vert) {
  if (!vert.hub) return { hub: null, slug: vert.slug, upgraded: 0, missing: true };
  const fp = path.join(ROOT, vert.hub);
  if (!fs.existsSync(fp)) return { hub: vert.hub, slug: vert.slug, upgraded: 0, missing: true };
  const before = fs.readFileSync(fp, 'utf8');
  let upgraded = 0;
  const after = before.replace(/<h2 id="([a-z]{2})">([A-Z][A-Za-z ]+)<\/h2>/g, (full, code, name) => {
    if (!STATE_CODE_TO[code]) return full;
    const expectedName = STATE_CODE_TO[code][0];
    if (expectedName !== name) return full;
    const slug = STATE_CODE_TO[code][1];
    const hubFile = `${slug}-${vert.slug}-cost.html`;
    if (!fs.existsSync(path.join(ROOT, hubFile))) return full;
    upgraded++;
    return `<h2 id="${code}"><a href="/${hubFile}">${name}</a></h2>`;
  });
  if (after === before) return { hub: vert.hub, slug: vert.slug, upgraded: 0 };
  if (!DRY) fs.writeFileSync(fp, after);
  return { hub: vert.hub, slug: vert.slug, upgraded };
}

const summary = { hubs: [], cities: {} };
for (const vert of VERTICALS) {
  summary.hubs.push(processCitiesHub(vert));
  const cities = listCityFiles(vert.slug);
  let changed = 0, skipped = 0;
  const skipReasons = {};
  const partial = [];
  for (const c of cities) {
    const r = processCityPage(c.file, c.stateCode, vert);
    if (r.skipped) {
      skipped++;
      skipReasons[r.reason] = (skipReasons[r.reason] || 0) + 1;
    } else {
      changed++;
      const expected = vert.mode === 'skip_city' ? 0 : 2;
      if (r.changes.length !== expected && expected !== 0 && partial.length < 3) {
        partial.push({ file: r.file, changes: r.changes });
      }
    }
  }
  summary.cities[vert.slug] = { mode: vert.mode, total: cities.length, changed, skipped, skipReasons, partial };
}

console.log(JSON.stringify(summary, null, 2));
console.log(DRY ? '\n[DRY RUN — no files written]' : '\n[wrote files]');
