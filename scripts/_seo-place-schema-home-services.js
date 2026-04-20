#!/usr/bin/env node
/**
 * Extend Place schema (with geo coordinates + postal address) to all home-
 * services city pages. These already have Service schema from the vertical
 * builders; Place adds a hard geo signal that reinforces local ranking.
 *
 * Only touches pages that don't already have a Place block. Skips cities
 * whose coords aren't in data/city-coordinates.json (typically slug-compound
 * names like 'athens-clarke-county' that don't map cleanly).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COORDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'city-coordinates.json'), 'utf8'));

function slugToCity(slug) {
  const parts = slug.split('-').map(w => w[0].toUpperCase() + w.slice(1));
  let city = parts.join(' ');
  city = city.replace(/^St /, 'St. ');
  return city;
}

// Match city-state-vertical pattern. Excludes legal/medical/moving/auto-repair
// because those already got Place in the previous pass.
const EXCLUDE_VERTICALS = new Set(['legal', 'medical', 'moving', 'auto-repair']);

function parse(filename) {
  const m = filename.match(/^(.+)-([a-z]{2})-([a-z]+[a-z-]*)-cost\.html$/);
  if (!m) return null;
  // The third capture needs to be a valid vertical suffix. Greedy matching
  // could capture "kitchen-remodel" as vertical "remodel" with city
  // "abilene-tx-kitchen", so we test with a whitelist of known verticals.
  // Instead, we peel the final `-{vertical}-cost.html` off the known set.
  return m;
}

// Extract city, state, vertical by peeling known vertical suffixes.
const VERTICAL_SUFFIXES = [
  'concrete', 'electrical', 'fence', 'foundation', 'garage-door', 'gutter',
  'hvac', 'insulation', 'kitchen-remodel', 'landscaping', 'painting',
  'plumbing', 'roof', 'siding', 'solar', 'window',
];

function splitFilename(filename) {
  for (const v of VERTICAL_SUFFIXES) {
    const suffix = '-' + v + '-cost.html';
    if (filename.endsWith(suffix)) {
      const prefix = filename.slice(0, -suffix.length);
      const m = prefix.match(/^(.+)-([a-z]{2})$/);
      if (!m) return null;
      return {
        citySlug: m[1],
        city: slugToCity(m[1]),
        state: m[2].toUpperCase(),
        vertical: v,
      };
    }
  }
  return null;
}

function buildPlaceSchema(parsed, coord) {
  const cityState = `${parsed.city}, ${parsed.state}`;
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: cityState,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: coord.lat,
      longitude: coord.lng,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: parsed.city,
      addressRegion: parsed.state,
      addressCountry: 'US',
    },
  };
  return '<script type="application/ld+json">\n' + JSON.stringify(obj) + '\n</script>';
}

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('-cost.html') && /^[a-z-]+-[a-z]{2}-/.test(f));

let injected = 0, skippedHasPlace = 0, skippedNoCoord = 0, skippedParseFail = 0, skippedExcluded = 0, skippedNoHead = 0;

for (const file of files) {
  const parsed = splitFilename(file);
  if (!parsed) { skippedParseFail++; continue; }
  if (EXCLUDE_VERTICALS.has(parsed.vertical)) { skippedExcluded++; continue; }

  const filePath = path.join(ROOT, file);
  const html = fs.readFileSync(filePath, 'utf8');

  if (/"@type":\s*"Place"/.test(html)) { skippedHasPlace++; continue; }

  const key = `${parsed.city}|${parsed.state}`;
  const coord = COORDS[key];
  if (!coord) { skippedNoCoord++; continue; }

  const headClose = html.indexOf('</head>');
  if (headClose < 0) { skippedNoHead++; continue; }

  const block = buildPlaceSchema(parsed, coord);
  const updated = html.slice(0, headClose) + block + '\n' + html.slice(headClose);
  fs.writeFileSync(filePath, updated, 'utf8');
  injected++;
}

console.log('Injected Place schema into:', injected);
console.log('Skipped (already has Place):', skippedHasPlace);
console.log('Skipped (no coord data):', skippedNoCoord);
console.log('Skipped (parse fail):', skippedParseFail);
console.log('Skipped (excluded vertical):', skippedExcluded);
console.log('Skipped (no </head>):', skippedNoHead);
