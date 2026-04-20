#!/usr/bin/env node
/**
 * Inject a "Related Cities + Other Services" nav widget above the footer
 * of every city-cost page. Two columns:
 *   1. Up to 6 sibling cities in the same state for the same vertical
 *   2. All other verticals available for the same city
 *
 * Improves internal linking (crawl depth, authority distribution) without
 * bloating page content. Idempotent — skips pages that already have the
 * widget.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const VERTICALS = {
  'concrete':        'Concrete',
  'electrical':      'Electrical',
  'fence':           'Fencing',
  'foundation':      'Foundation Repair',
  'garage-door':     'Garage Door',
  'gutter':          'Gutters',
  'hvac':            'HVAC',
  'insulation':      'Insulation',
  'kitchen-remodel': 'Kitchen Remodel',
  'landscaping':     'Landscaping',
  'painting':        'Painting',
  'plumbing':        'Plumbing',
  'roof':            'Roofing',
  'siding':          'Siding',
  'solar':           'Solar',
  'window':          'Windows',
  'auto-repair':     'Auto Repair',
  'legal':           'Legal Fees',
  'medical':         'Medical Bills',
  'moving':          'Moving',
};

const SUFFIXES = Object.keys(VERTICALS).map(v => ({ vertical: v, suffix: '-' + v + '-cost.html' }));
// sort longer-first so kitchen-remodel matches before remodel-anything-else (none exist but safe)
SUFFIXES.sort((a, b) => b.suffix.length - a.suffix.length);

function slugToCity(slug) {
  const parts = slug.split('-').map(w => w[0].toUpperCase() + w.slice(1));
  let city = parts.join(' ');
  city = city.replace(/^St /, 'St. ');
  return city;
}

function parse(filename) {
  for (const { vertical, suffix } of SUFFIXES) {
    if (filename.endsWith(suffix)) {
      const prefix = filename.slice(0, -suffix.length);
      const m = prefix.match(/^(.+)-([a-z]{2})$/);
      if (!m) return null;
      return { citySlug: m[1], city: slugToCity(m[1]), state: m[2].toUpperCase(), vertical };
    }
  }
  return null;
}

// Pass 1: scan all city-cost files, build indexes.
const allFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('-cost.html'));
const cityPages = [];
const cityMap = new Map();           // 'City|ST' -> Map<vertical, filename>
const verticalStateMap = new Map();  // 'vertical|ST' -> [{city, filename}]

for (const f of allFiles) {
  const p = parse(f);
  if (!p) continue;
  cityPages.push({ ...p, filename: f });

  const cityKey = p.city + '|' + p.state;
  if (!cityMap.has(cityKey)) cityMap.set(cityKey, new Map());
  cityMap.get(cityKey).set(p.vertical, f);

  const vsKey = p.vertical + '|' + p.state;
  if (!verticalStateMap.has(vsKey)) verticalStateMap.set(vsKey, []);
  verticalStateMap.get(vsKey).push({ city: p.city, filename: f });
}

// Deterministic city ordering within each (vertical, state) group.
for (const arr of verticalStateMap.values()) {
  arr.sort((a, b) => a.city.localeCompare(b.city));
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function renderWidget(parsed) {
  const { city, state, vertical, filename } = parsed;
  const cityKey = city + '|' + state;
  const vsKey = vertical + '|' + state;

  // Related cities: same vertical, same state, excluding self. Cap at 6.
  const siblings = (verticalStateMap.get(vsKey) || [])
    .filter(x => x.filename !== filename)
    .slice(0, 6);

  // Cross-vertical: other verticals for same city. Ordered by VERTICALS map.
  const cityVerts = cityMap.get(cityKey) || new Map();
  const crossLinks = [];
  for (const v of Object.keys(VERTICALS)) {
    if (v === vertical) continue;
    const f = cityVerts.get(v);
    if (f) crossLinks.push({ label: VERTICALS[v], filename: f });
  }

  // If no siblings AND no cross-vertical links, don't inject an empty widget.
  if (siblings.length === 0 && crossLinks.length === 0) return null;

  const verticalLabel = VERTICALS[vertical];
  const cityState = city + ', ' + state;

  const siblingLis = siblings.map(s =>
    `<li><a href="/${s.filename}">${s.city}, ${state}</a></li>`
  ).join('');
  const crossLis = crossLinks.map(c =>
    `<li><a href="/${c.filename}">${c.label}</a></li>`
  ).join('');

  const parts = [];
  parts.push('<section class="tp-city-nav" aria-label="Related pages"><div class="container"><div class="tp-city-nav-grid">');
  if (siblings.length) {
    parts.push(`<div><h3>More ${verticalLabel} Pricing</h3><ul>${siblingLis}</ul></div>`);
  }
  if (crossLinks.length) {
    parts.push(`<div><h3>Other Services in ${escAttr(cityState)}</h3><ul>${crossLis}</ul></div>`);
  }
  parts.push('</div></div></section>');
  return parts.join('');
}

// Pass 2: inject widget into each page.
let injected = 0, skippedNoWidget = 0, skippedHas = 0, skippedNoMain = 0;
for (const p of cityPages) {
  const filePath = path.join(ROOT, p.filename);
  const html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('tp-city-nav')) { skippedHas++; continue; }

  const widget = renderWidget(p);
  if (!widget) { skippedNoWidget++; continue; }

  // Insert immediately after </main>. Find the first </main> — there's only
  // ever one on these pages.
  const mainClose = html.indexOf('</main>');
  if (mainClose < 0) { skippedNoMain++; continue; }

  const insertAt = mainClose + '</main>'.length;
  const updated = html.slice(0, insertAt) + '\n' + widget + html.slice(insertAt);
  fs.writeFileSync(filePath, updated, 'utf8');
  injected++;
}

console.log('Widget injected on', injected, 'files');
console.log('Skipped (already has widget):', skippedHas);
console.log('Skipped (no siblings/cross-links):', skippedNoWidget);
console.log('Skipped (no </main>):', skippedNoMain);
