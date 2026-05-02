#!/usr/bin/env node
// Phase A.3 — backfill data/city-coordinates.json from data/us-cities-coords.csv
// for any city that has a *-cost.html page on disk but no entry in city-coordinates.json.
//
// Slug normalization: lowercase, all non-alphanumeric runs collapse to single hyphen.
// Key format: `${citySlug}|${stateCode}` (state code lowercased).
// Idempotent: re-running adds zero new entries if all gaps are filled.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COORDS_PATH = path.join(ROOT, 'data', 'city-coordinates.json');
const CSV_PATH = path.join(ROOT, 'data', 'us-cities-coords.csv');

const VERTICAL_SUFFIXES = [
  'roof', 'hvac', 'plumbing', 'electrical', 'solar', 'window', 'siding',
  'painting', 'garage-door', 'fence', 'concrete', 'landscaping', 'foundation',
  'insulation', 'gutter', 'auto-repair', 'medical', 'legal', 'moving',
];

const STATE_CODES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy','dc',
]);

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Parse "City Name|STATE" → { citySlug, stateCode }.
function parseCoordKey(k) {
  const idx = k.lastIndexOf('|');
  if (idx < 0) return null;
  return {
    citySlug: slugify(k.slice(0, idx)),
    stateCode: k.slice(idx + 1).toLowerCase(),
    originalKey: k,
  };
}

// From a city HTML filename (e.g. "st.-louis-mo-hvac-cost.html"),
// extract { citySlug, stateCode }. Returns null for state hubs and non-city pages.
function parseCityFilename(filename) {
  for (const v of VERTICAL_SUFFIXES) {
    const suffix = `-${v}-cost.html`;
    if (!filename.endsWith(suffix)) continue;
    const stem = filename.slice(0, -suffix.length); // e.g. "st.-louis-mo"
    const lastDash = stem.lastIndexOf('-');
    if (lastDash < 0) return null;
    const stateCode = stem.slice(lastDash + 1).toLowerCase();
    if (!STATE_CODES.has(stateCode)) return null; // state hub like "alabama-roof-cost.html"
    const citySlug = slugify(stem.slice(0, lastDash));
    if (!citySlug) return null;
    return { citySlug, stateCode };
  }
  return null;
}

function parseCSVLine(line) {
  // CSV with quoted fields (county can contain commas/quotes).
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function main() {
  console.log('reading existing coords...');
  const coords = JSON.parse(fs.readFileSync(COORDS_PATH, 'utf8'));
  console.log(`  ${Object.keys(coords).length} entries in city-coordinates.json`);

  // Build slug-keyed lookup from existing coords
  const haveSlug = new Set();
  for (const k of Object.keys(coords)) {
    const p = parseCoordKey(k);
    if (p) haveSlug.add(`${p.citySlug}|${p.stateCode}`);
  }

  console.log('enumerating city pages on disk...');
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('-cost.html'));
  const needSlug = new Set();
  for (const f of files) {
    const p = parseCityFilename(f);
    if (!p) continue;
    const key = `${p.citySlug}|${p.stateCode}`;
    if (!haveSlug.has(key)) needSlug.add(key);
  }
  console.log(`  ${files.length} *-cost.html files; ${needSlug.size} unique cities missing coords`);

  if (needSlug.size === 0) {
    console.log('no backfill needed');
    return;
  }

  console.log('streaming us-cities-coords.csv...');
  const csv = fs.readFileSync(CSV_PATH, 'utf8').split(/\r?\n/);
  // header: ID,STATE_CODE,STATE_NAME,CITY,COUNTY,LATITUDE,LONGITUDE
  const csvBySlug = new Map();
  for (let i = 1; i < csv.length; i++) {
    const line = csv[i];
    if (!line) continue;
    const cols = parseCSVLine(line);
    if (cols.length < 7) continue;
    const stateCode = cols[1].toLowerCase();
    const city = cols[3];
    const lat = parseFloat(cols[5]);
    const lng = parseFloat(cols[6]);
    if (!STATE_CODES.has(stateCode) || !isFinite(lat) || !isFinite(lng)) continue;
    const slug = slugify(city);
    const key = `${slug}|${stateCode}`;
    // CSV may have multiple entries for same city slug (different counties); keep first.
    if (!csvBySlug.has(key)) {
      csvBySlug.set(key, { city, stateCode: cols[1], lat, lng });
    }
  }
  console.log(`  ${csvBySlug.size} unique city|state slugs in CSV`);

  let added = 0;
  let stillMissing = [];
  for (const key of needSlug) {
    const hit = csvBySlug.get(key);
    if (!hit) { stillMissing.push(key); continue; }
    const coordKey = `${hit.city}|${hit.stateCode}`;
    coords[coordKey] = { lat: hit.lat, lng: hit.lng };
    added++;
  }

  console.log(`backfilled ${added} entries; ${stillMissing.length} still missing`);
  if (stillMissing.length > 0 && stillMissing.length <= 30) {
    console.log('still missing:', stillMissing.join(', '));
  } else if (stillMissing.length > 0) {
    console.log('first 30 still missing:', stillMissing.slice(0, 30).join(', '));
  }

  fs.writeFileSync(COORDS_PATH, JSON.stringify(coords, null, 2) + '\n');
  console.log(`wrote ${COORDS_PATH} (${Object.keys(coords).length} entries total)`);
}

main();
