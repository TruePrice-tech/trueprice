#!/usr/bin/env node
// Phase A.3 — inject haversine-picked neighbor cross-links into the existing
// `<section class="tp-city-nav">` widget on city pages.
//
// PATH A: replaces the contents of <ul>...</ul> inside the "More <Vertical> Pricing"
// column with 5–10 same-vertical city pages within ~75 miles of the page's city.
// Keeps the section shell, h3, and "Other Services" column untouched.
//
// Scope: trade verticals only (16 of 20). Service verticals (auto-repair / medical /
// legal / moving) don't have a same-vertical column in the existing widget — out of
// scope for Path A; addressed separately.
//
// Excluded from injection: state-hub pages (filename = `<state-name>-<vertical>-cost.html`),
// pages whose city has no centroid in city-coordinates.json, pages whose widget structure
// doesn't match the expected pattern (skipped + logged).
//
// Idempotent: rerunning produces the same output as running once (we always replace
// the whole <ul>...</ul> block deterministically based on current coords).
//
// Usage:
//   node scripts/phase-a3-inject-neighbors.js --vertical=hvac --limit=100 [--dry-run]
//   node scripts/phase-a3-inject-neighbors.js --vertical=hvac           (full run)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COORDS_PATH = path.join(ROOT, 'data', 'city-coordinates.json');

// Vertical-specific config: filename suffix, h3 text in the existing widget,
// and the displayed-state-name vocabulary (used to exclude state-hub files).
const VERTICAL_CONFIG = {
  roof:        { suffix: 'roof-cost.html',        h3: 'More Roofing Pricing' },
  hvac:        { suffix: 'hvac-cost.html',        h3: 'More HVAC Pricing' },
  plumbing:    { suffix: 'plumbing-cost.html',    h3: 'More Plumbing Pricing' },
  electrical:  { suffix: 'electrical-cost.html',  h3: 'More Electrical Pricing' },
  solar:       { suffix: 'solar-cost.html',       h3: 'More Solar Pricing' },
  window:      { suffix: 'window-cost.html',      h3: 'More Windows Pricing' },
  siding:      { suffix: 'siding-cost.html',      h3: 'More Siding Pricing' },
  painting:    { suffix: 'painting-cost.html',    h3: 'More Painting Pricing' },
  'garage-door': { suffix: 'garage-door-cost.html', h3: 'More Garage Door Pricing' },
  fence:       { suffix: 'fence-cost.html',       h3: 'More Fencing Pricing' },
  concrete:    { suffix: 'concrete-cost.html',    h3: 'More Concrete Pricing' },
  landscaping: { suffix: 'landscaping-cost.html', h3: 'More Landscaping Pricing' },
  foundation:  { suffix: 'foundation-cost.html',  h3: 'More Foundation Repair Pricing' },
  insulation:  { suffix: 'insulation-cost.html',  h3: 'More Insulation Pricing' },
  gutter:      { suffix: 'gutter-cost.html',      h3: 'More Gutters Pricing' },
};

const STATE_CODES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy','dc',
]);

const RADIUS_MI = 75;
const RADIUS_FALLBACK_MI = 150; // expand if <3 neighbors within 75
const MIN_NEIGHBORS = 3;
const MAX_NEIGHBORS = 8;

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseCoordKey(k) {
  const idx = k.lastIndexOf('|');
  if (idx < 0) return null;
  return {
    cityName: k.slice(0, idx),
    citySlug: slugify(k.slice(0, idx)),
    stateCode: k.slice(idx + 1).toLowerCase(),
    stateCodeUpper: k.slice(idx + 1),
  };
}

function parseCityFilename(filename, suffix) {
  const fullSuffix = `-${suffix}`;
  if (!filename.endsWith(fullSuffix)) return null;
  const stem = filename.slice(0, -fullSuffix.length);
  const lastDash = stem.lastIndexOf('-');
  if (lastDash < 0) return null;
  const stateCode = stem.slice(lastDash + 1).toLowerCase();
  if (!STATE_CODES.has(stateCode)) return null; // state hub
  const citySlug = slugify(stem.slice(0, lastDash));
  if (!citySlug) return null;
  return { citySlug, stateCode };
}

function haversineMi(a, b) {
  const R = 3958.7613; // miles
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Build {cityName, stateCodeUpper, lat, lng, slug, filename} for every page in vertical.
function buildVerticalIndex(vertical, coordsBySlug) {
  const cfg = VERTICAL_CONFIG[vertical];
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith(`-${cfg.suffix}`));
  const out = [];
  for (const f of files) {
    const p = parseCityFilename(f, cfg.suffix);
    if (!p) continue; // state hub
    const key = `${p.citySlug}|${p.stateCode}`;
    const c = coordsBySlug.get(key);
    if (!c) continue; // no centroid → can't compute neighbors
    out.push({
      filename: f,
      citySlug: p.citySlug,
      stateCode: p.stateCode,
      cityName: c.cityName,
      stateCodeUpper: c.stateCodeUpper,
      lat: c.lat,
      lng: c.lng,
    });
  }
  return out;
}

function pickNeighbors(self, all) {
  const distances = [];
  for (const other of all) {
    if (other.filename === self.filename) continue;
    const d = haversineMi(self, other);
    distances.push({ other, d });
  }
  distances.sort((a, b) => a.d - b.d);

  let picked = distances.filter(x => x.d <= RADIUS_MI).slice(0, MAX_NEIGHBORS);
  if (picked.length < MIN_NEIGHBORS) {
    picked = distances.filter(x => x.d <= RADIUS_FALLBACK_MI).slice(0, MAX_NEIGHBORS);
  }
  if (picked.length < MIN_NEIGHBORS) {
    picked = distances.slice(0, MIN_NEIGHBORS); // last resort
  }
  return picked.map(x => x.other);
}

function neighborsToHTML(neighbors) {
  const items = neighbors.map(n =>
    `<li><a href="/${n.filename}">${n.cityName}, ${n.stateCodeUpper}</a></li>`
  ).join('');
  return `<ul>${items}</ul>`;
}

function injectIntoPage(html, h3Text, neighbors) {
  // Find: <h3>{h3Text}</h3><ul>...</ul>
  // The widget is rendered on a single line; the <ul> immediately follows the </h3>.
  const pattern = new RegExp(
    `(<h3>${h3Text.replace(/[.*+?^${}()|[\\\]\\\\]/g, '\\\\$&')}</h3>)<ul>[\\s\\S]*?</ul>`
  );
  if (!pattern.test(html)) return null;
  const newUL = neighborsToHTML(neighbors);
  return html.replace(pattern, `$1${newUL}`);
}

function parseArgs() {
  const args = { vertical: null, limit: null, dryRun: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--vertical=')) args.vertical = a.slice('--vertical='.length);
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice('--limit='.length), 10);
  }
  return args;
}

function main() {
  const args = parseArgs();
  if (!args.vertical || !VERTICAL_CONFIG[args.vertical]) {
    console.error('usage: --vertical=<one of: ' + Object.keys(VERTICAL_CONFIG).join(',') + '> [--limit=N] [--dry-run]');
    process.exit(2);
  }
  const cfg = VERTICAL_CONFIG[args.vertical];
  console.log(`Phase A.3 inject: vertical=${args.vertical} limit=${args.limit ?? 'all'} dry-run=${args.dryRun}`);

  const coords = JSON.parse(fs.readFileSync(COORDS_PATH, 'utf8'));
  const coordsBySlug = new Map();
  for (const [k, v] of Object.entries(coords)) {
    const p = parseCoordKey(k);
    if (!p) continue;
    coordsBySlug.set(`${p.citySlug}|${p.stateCode}`, {
      cityName: p.cityName,
      stateCodeUpper: p.stateCodeUpper,
      lat: v.lat,
      lng: v.lng,
    });
  }

  const idx = buildVerticalIndex(args.vertical, coordsBySlug);
  console.log(`  ${idx.length} ${args.vertical} city pages have coords (eligible for injection)`);

  // Deterministic pilot: sort filename alphabetically, take first N.
  idx.sort((a, b) => a.filename.localeCompare(b.filename));
  const target = args.limit ? idx.slice(0, args.limit) : idx;
  console.log(`  injecting on ${target.length} pages`);

  let injected = 0, skipped_no_match = 0, skipped_too_few_neighbors = 0;
  const samples = [];
  for (const self of target) {
    const filePath = path.join(ROOT, self.filename);
    const html = fs.readFileSync(filePath, 'utf8');
    const neighbors = pickNeighbors(self, idx);
    if (neighbors.length < MIN_NEIGHBORS) {
      skipped_too_few_neighbors++;
      continue;
    }
    const newHTML = injectIntoPage(html, cfg.h3, neighbors);
    if (newHTML === null) {
      skipped_no_match++;
      continue;
    }
    if (samples.length < 3) {
      samples.push({
        file: self.filename,
        neighbors: neighbors.map(n => `${n.cityName},${n.stateCodeUpper} (${haversineMi(self, n).toFixed(0)}mi)`),
      });
    }
    if (!args.dryRun) {
      fs.writeFileSync(filePath, newHTML);
    }
    injected++;
  }
  console.log(`  injected: ${injected}`);
  console.log(`  skipped (no widget match): ${skipped_no_match}`);
  console.log(`  skipped (too few neighbors): ${skipped_too_few_neighbors}`);
  console.log('  samples:');
  for (const s of samples) {
    console.log(`    ${s.file}: ${s.neighbors.join(' / ')}`);
  }
}

main();
