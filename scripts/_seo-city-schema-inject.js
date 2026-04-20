#!/usr/bin/env node
/**
 * One-shot: inject Service + AggregateOffer schema AND Place schema (with
 * geo coordinates) into every legal/medical/moving/auto-repair city page.
 *
 * Matches the pattern used on HVAC city pages (e.g., atlanta-ga-hvac-cost.html).
 * Inserts both schema blocks immediately before </head>.
 *
 * Baseline price ranges are national typical. We scale them per-city using
 * city-cost-multipliers.json so each page shows a regionally-adjusted range.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COORDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'city-coordinates.json'), 'utf8'));
const MULT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'city-cost-multipliers.json'), 'utf8'));

// National baseline ranges (USD). Per-city values get multiplied by the city's
// cost multiplier, so high-cost metros see higher ranges.
const VERTICALS = {
  'auto-repair': { name: 'Auto Repair',       low:  150, high: 2500 },
  'legal':       { name: 'Legal Services',    low:  225, high:  500 },
  'medical':     { name: 'Medical Services',  low:  150, high: 5000 },
  'moving':      { name: 'Moving Services',   low:  600, high: 7500 },
};

// Slug -> city name conversion. Title-cases words and normalizes common
// abbreviations that appear in our authoritative data files.
function slugToCity(slug) {
  const parts = slug.split('-').map(w => w[0].toUpperCase() + w.slice(1));
  let city = parts.join(' ');
  // Saint Louis is stored with a period in both data files.
  city = city.replace(/^St /, 'St. ');
  return city;
}

function parseFilename(filename) {
  for (const v of Object.keys(VERTICALS)) {
    const suffix = '-' + v + '-cost.html';
    if (filename.endsWith(suffix)) {
      const prefix = filename.slice(0, -suffix.length);
      const m = prefix.match(/^(.+)-([a-z]{2})$/);
      if (!m) return null;
      return {
        vertical: v,
        city: slugToCity(m[1]),
        state: m[2].toUpperCase(),
      };
    }
  }
  return null;
}

function buildSchemas(parsed) {
  const vInfo = VERTICALS[parsed.vertical];
  const key = `${parsed.city}|${parsed.state}`;
  const mult = MULT[key];
  const coord = COORDS[key];
  if (!mult || !coord) return null;

  const m = mult.multiplier;
  const lowPrice = Math.round(vInfo.low * m);
  const highPrice = Math.round(vInfo.high * m);
  const cityState = `${parsed.city}, ${parsed.state}`;

  // Service schema — matches HVAC pattern used elsewhere on the site.
  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${vInfo.name} in ${cityState}`,
    provider: { '@type': 'Organization', name: 'Woogoro', url: 'https://woogoro.com' },
    areaServed: { '@type': 'City', name: cityState },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: String(lowPrice),
      highPrice: String(highPrice),
    },
  };

  // Place schema — gives Google a hard geo signal for local ranking.
  const place = {
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

  return [service, place];
}

function renderBlock(obj) {
  return '<script type="application/ld+json">\n' + JSON.stringify(obj) + '\n</script>';
}

const files = fs.readdirSync(ROOT).filter(f => {
  return /^.+-(auto-repair|legal|medical|moving)-cost\.html$/.test(f);
});

let changed = 0, skippedExisting = 0, skippedNoData = 0, skippedNoHead = 0;
const unresolved = [];

for (const file of files) {
  const filePath = path.join(ROOT, file);
  const html = fs.readFileSync(filePath, 'utf8');

  // Safety: don't double-inject
  if (/"@type":\s*"Service"/.test(html) || /"@type":\s*"Place"/.test(html)) {
    skippedExisting++;
    continue;
  }

  const parsed = parseFilename(file);
  if (!parsed) { unresolved.push(file + ' (parse fail)'); continue; }

  const schemas = buildSchemas(parsed);
  if (!schemas) {
    skippedNoData++;
    unresolved.push(file + ' (no data for ' + parsed.city + '|' + parsed.state + ')');
    continue;
  }

  const block = schemas.map(renderBlock).join('\n');

  // Insert immediately before </head>. Preserve any leading whitespace so the
  // injected block sits naturally in the surrounding markup.
  const headClose = html.indexOf('</head>');
  if (headClose < 0) { skippedNoHead++; continue; }

  const updated = html.slice(0, headClose) + block + '\n' + html.slice(headClose);
  fs.writeFileSync(filePath, updated, 'utf8');
  changed++;
}

console.log('Injected Service + Place schema into', changed, 'files');
console.log('Skipped (already has Service or Place):', skippedExisting);
console.log('Skipped (no data for city):', skippedNoData);
console.log('Skipped (no </head>):', skippedNoHead);
if (unresolved.length) {
  console.log('\nUnresolved:');
  unresolved.forEach(u => console.log(' -', u));
}
