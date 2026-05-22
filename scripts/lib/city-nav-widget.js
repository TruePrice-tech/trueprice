// Shared "Related pages" widget (tp-city-nav) used by every per-vertical
// city-page builder. Single source of truth for the widget that gets dropped
// in place of {{TP_CITY_NAV_WIDGET}} at build time.
//
// Two columns:
//   1. "More <Vertical> Pricing" — 5-8 same-vertical city pages within ~75mi
//      by haversine distance (fallback 150mi, then top-N globally). Falls back
//      to alphabetical-by-state if the city has no centroid in
//      data/city-coordinates.json.
//   2. "Other Services in <City, ST>" — every other vertical that has a page
//      for the same city.
//
// Why this lives here: the previous architecture had _seo-city-nav-widget.js
// (alphabetical neighbors) and phase-a3-inject-neighbors.js (haversine swap)
// as POST-process scripts that the builders didn't call. The 2026-05-20
// `[SEO-P0-2]` commit regenerated every city page from template and silently
// nuked ~10K widgets because the templates don't include them. Template-
// integrating the widget (via this lib + {{TP_CITY_NAV_WIDGET}} placeholder)
// makes regression impossible: the widget is part of the build output.

const fs = require('fs');
const path = require('path');

// Display name per vertical for h3 headings + cross-vertical link labels.
const VERTICAL_LABELS = {
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

// h3 heading text per vertical for the "More <Vertical> Pricing" column.
// Must match the historical phase-a3-inject-neighbors.js values so any
// remaining post-process script still recognizes the widget.
const COLUMN_H3 = {
  'roof':            'More Roofing Pricing',
  'hvac':            'More HVAC Pricing',
  'plumbing':        'More Plumbing Pricing',
  'electrical':      'More Electrical Pricing',
  'solar':           'More Solar Pricing',
  'window':          'More Windows Pricing',
  'siding':          'More Siding Pricing',
  'painting':        'More Painting Pricing',
  'garage-door':     'More Garage Door Pricing',
  'fence':           'More Fencing Pricing',
  'concrete':        'More Concrete Pricing',
  'landscaping':     'More Landscaping Pricing',
  'foundation':      'More Foundation Repair Pricing',
  'insulation':      'More Insulation Pricing',
  'gutter':          'More Gutters Pricing',
  'kitchen-remodel': 'More Kitchen Remodel Pricing',
};

const STATE_CODES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy','dc',
]);

const RADIUS_MI = 75;
const RADIUS_FALLBACK_MI = 150;
const MIN_NEIGHBORS = 3;
const MAX_NEIGHBORS = 6;
const ALPHABETICAL_FALLBACK_MAX = 6;

// MUST mirror build-<vertical>-pages.js slugifyCity:
//   .toLowerCase().replace(/[^\w\s]/g, "").trim().replace(/\s+/g, "-")
function slugify(s) {
  return s.toLowerCase().replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '-');
}

// Parse a city-page filename like "abilene-tx-hvac-cost.html" into
// { citySlug, stateCode, vertical }. Returns null for state-hub pages
// (e.g., "texas-hvac-cost.html" — texas isn't a 2-letter code) and
// non-city files.
const VERTICAL_SUFFIXES = Object.keys(VERTICAL_LABELS)
  .map(v => ({ vertical: v, suffix: '-' + v + '-cost.html' }))
  .sort((a, b) => b.suffix.length - a.suffix.length); // longest-first

function parseFilename(filename) {
  for (const { vertical, suffix } of VERTICAL_SUFFIXES) {
    if (!filename.endsWith(suffix)) continue;
    const stem = filename.slice(0, -suffix.length);
    const lastDash = stem.lastIndexOf('-');
    if (lastDash < 0) return null;
    const stateCode = stem.slice(lastDash + 1).toLowerCase();
    if (!STATE_CODES.has(stateCode)) return null; // state hub
    const citySlug = stem.slice(0, lastDash);
    return { citySlug, stateCode, vertical };
  }
  return null;
}

function haversineMi(a, b) {
  const R = 3958.7613;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Build indexes once per builder run. Pass the absolute repo root.
//
// Returns:
//   cityMap          Map<"City|ST", Map<vertical, filename>>
//   verticalCityIdx  Map<vertical, Array<{ citySlug, stateCode, cityName, stateCodeUpper, lat?, lng?, filename }>>
//   coordsBySlugKey  Map<"city-slug|st", { cityName, stateCodeUpper, lat, lng }>
//
// Reads `data/city-coordinates.json` for haversine support. Cities without
// centroids still appear in cityMap/verticalCityIdx but lack lat/lng — they
// fall back to alphabetical-by-state rendering.
function buildIndexes(rootDir) {
  const coordsPath = path.join(rootDir, 'data', 'city-coordinates.json');
  const coordsRaw = JSON.parse(fs.readFileSync(coordsPath, 'utf8'));
  const coordsBySlugKey = new Map();
  for (const [k, v] of Object.entries(coordsRaw)) {
    const idx = k.lastIndexOf('|');
    if (idx < 0) continue;
    const cityName = k.slice(0, idx);
    const stateCodeUpper = k.slice(idx + 1);
    coordsBySlugKey.set(`${slugify(cityName)}|${stateCodeUpper.toLowerCase()}`, {
      cityName,
      stateCodeUpper,
      lat: v.lat,
      lng: v.lng,
    });
  }

  const cityMap = new Map();
  const verticalCityIdx = new Map();
  for (const v of Object.keys(VERTICAL_LABELS)) verticalCityIdx.set(v, []);

  for (const f of fs.readdirSync(rootDir)) {
    if (!f.endsWith('-cost.html')) continue;
    const parsed = parseFilename(f);
    if (!parsed) continue;
    const { citySlug, stateCode, vertical } = parsed;
    const coordKey = `${citySlug}|${stateCode}`;
    const coord = coordsBySlugKey.get(coordKey);
    // Prefer the canonical city name from coordinates when we have it;
    // otherwise reconstruct from the slug.
    const cityName = coord ? coord.cityName : slugToCityName(citySlug);
    const stateCodeUpper = stateCode.toUpperCase();

    const cityKey = cityName + '|' + stateCodeUpper;
    if (!cityMap.has(cityKey)) cityMap.set(cityKey, new Map());
    cityMap.get(cityKey).set(vertical, f);

    verticalCityIdx.get(vertical).push({
      citySlug,
      stateCode,
      cityName,
      stateCodeUpper,
      lat: coord ? coord.lat : null,
      lng: coord ? coord.lng : null,
      filename: f,
    });
  }

  return { cityMap, verticalCityIdx, coordsBySlugKey };
}

// "abilene" -> "Abilene"; "winston-salem" -> "Winston Salem"; "st-louis" -> "St Louis"
function slugToCityName(slug) {
  return slug.split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function pickHaversineNeighbors(self, verticalIdx) {
  if (self.lat == null || self.lng == null) return null; // no coords → caller falls back
  const distances = [];
  for (const other of verticalIdx) {
    if (other.filename === self.filename) continue;
    if (other.lat == null || other.lng == null) continue;
    const d = haversineMi(self, other);
    distances.push({ other, d });
  }
  distances.sort((a, b) => a.d - b.d);
  let picked = distances.filter(x => x.d <= RADIUS_MI).slice(0, MAX_NEIGHBORS);
  if (picked.length < MIN_NEIGHBORS) {
    picked = distances.filter(x => x.d <= RADIUS_FALLBACK_MI).slice(0, MAX_NEIGHBORS);
  }
  if (picked.length < MIN_NEIGHBORS) {
    picked = distances.slice(0, MIN_NEIGHBORS); // last-resort: global nearest
  }
  return picked.map(x => x.other);
}

function pickAlphabeticalSameState(self, verticalIdx) {
  return verticalIdx
    .filter(c => c.stateCode === self.stateCode && c.filename !== self.filename)
    .sort((a, b) => a.cityName.localeCompare(b.cityName))
    .slice(0, ALPHABETICAL_FALLBACK_MAX);
}

// Render the widget for one city page.
//
// opts:
//   city            "Abilene"
//   state           "TX"
//   vertical        "hvac"
//   filename        "abilene-tx-hvac-cost.html"
//   indexes         from buildIndexes()
//
// Returns HTML string (empty string if both columns end up empty).
function renderWidget(opts) {
  const { city, state, vertical, filename, indexes } = opts;
  const { cityMap, verticalCityIdx, coordsBySlugKey } = indexes;
  const h3 = COLUMN_H3[vertical];
  const stateLower = state.toLowerCase();
  const citySlug = slugify(city);
  const coordKey = `${citySlug}|${stateLower}`;
  const coord = coordsBySlugKey.get(coordKey);

  const self = {
    citySlug,
    stateCode: stateLower,
    cityName: city,
    stateCodeUpper: state,
    lat: coord ? coord.lat : null,
    lng: coord ? coord.lng : null,
    filename,
  };

  // Column 1: "More <Vertical> Pricing" — prefer haversine neighbors, else alphabetical.
  let column1Cities = null;
  if (h3) {
    const verticalIdx = verticalCityIdx.get(vertical) || [];
    column1Cities = pickHaversineNeighbors(self, verticalIdx);
    if (!column1Cities || column1Cities.length === 0) {
      column1Cities = pickAlphabeticalSameState(self, verticalIdx);
    }
  }

  // Column 2: "Other Services in <City, ST>" — every other vertical with a page for this city.
  const cityKey = city + '|' + state;
  const cityVerts = cityMap.get(cityKey) || new Map();
  const crossLinks = [];
  for (const v of Object.keys(VERTICAL_LABELS)) {
    if (v === vertical) continue;
    const f = cityVerts.get(v);
    if (f) crossLinks.push({ label: VERTICAL_LABELS[v], filename: f });
  }

  const haveCol1 = h3 && column1Cities && column1Cities.length > 0;
  const haveCol2 = crossLinks.length > 0;
  if (!haveCol1 && !haveCol2) return '';

  const parts = [];
  parts.push('<section class="tp-city-nav" aria-label="Related pages"><div class="container"><div class="tp-city-nav-grid">');
  if (haveCol1) {
    const lis = column1Cities.map(c =>
      `<li><a href="/${c.filename}">${c.cityName}, ${c.stateCodeUpper}</a></li>`
    ).join('');
    parts.push(`<div><h3>${h3}</h3><ul>${lis}</ul></div>`);
  }
  if (haveCol2) {
    const lis = crossLinks.map(c =>
      `<li><a href="/${c.filename}">${c.label}</a></li>`
    ).join('');
    parts.push(`<div><h3>Other Services in ${escAttr(city + ', ' + state)}</h3><ul>${lis}</ul></div>`);
  }
  parts.push('</div></div></section>');
  return parts.join('');
}

module.exports = {
  buildIndexes,
  renderWidget,
  slugify,
  VERTICAL_LABELS,
  COLUMN_H3,
};
