#!/usr/bin/env node
// Phase A.3.a — backfill data/city-coordinates.json from the US Census Gazetteer
// 2024 Places file for city pages whose slug currently has no centroid.
//
// Source: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip
// (~1.2 MB zip / 6 MB tab-delimited TXT — covers every CDP + incorporated place
// nationwide with INTPTLAT / INTPTLONG centroids).
//
// Caller supplies the unzipped TXT path (or this script downloads it once). For
// repeatable runs we expect the file to live at data/_tmp_gazetteer.txt during
// the backfill; it gets removed at the end.
//
// Strategy:
//   1. Enumerate site filenames matching `*-<state>-<vertical>-cost.html` for
//      each trade vertical to derive the (slug,state) key set used by the rollout.
//   2. Compare against existing coords; collect the set of missing (slug,state).
//   3. Index Gazetteer rows by (slugify(stripLSAD(NAME)), state). slugify mirrors
//      build-<vertical>-pages.js exactly: `[^\w\s]` removed, then space->dash.
//   4. For each missing (slug,state), look up canonical name + lat/lng. Write
//      back to data/city-coordinates.json under key `"CanonicalName|ST"`.
//   5. Print a summary: resolved / unresolved / would-overwrite collisions.
//
// Audit risk: zero. We only ADD entries to coordinates; rollout is idempotent
// and will simply pick better neighbors on next run.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COORDS_PATH = path.join(ROOT, 'data', 'city-coordinates.json');
const GAZ_PATH = path.join(ROOT, 'data', '_tmp_gazetteer.txt');

const STATE_CODES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy','dc',
]);

const VERTICALS = [
  'roof','hvac','plumbing','electrical','solar','window','siding','painting',
  'garage-door','fence','concrete','landscaping','foundation','insulation','gutter',
];

function siteSlugify(s) {
  return s.toLowerCase().replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '-');
}

function stripLSAD(name, lsad) {
  // LSAD codes: 25 city, 43 town, 47 village, 21 borough, 57 CDP, 00 special
  const code = String(lsad).trim();
  const trimMap = {
    '25': /\s+city$/i,
    '43': /\s+town$/i,
    '47': /\s+village$/i,
    '21': /\s+borough$/i,
    '57': /\s+CDP$/i,
    '40': /\s+(?:metro|metropolitan)\s+government.*$/i,
    '24': /\s+(?:metro|metropolitan)\s+government.*$/i,
    '13': /\s+borough.*$/i,
    '37': /\s+(?:municipality|town).*$/i,
    UC:  /\s+urban\s+county.*$/i,
  };
  if (trimMap[code]) return name.replace(trimMap[code], '').trim();
  // LSAD 00 (and uncategorized): strip trailing government qualifiers wholesale
  return name
    .replace(/\s+unified\s+government.*$/i, '')
    .replace(/\s+consolidated\s+government.*$/i, '')
    .replace(/\s+metropolitan\s+government.*$/i, '')
    .replace(/\s+metro\s+government.*$/i, '')
    .replace(/\s+urban\s+county.*$/i, '')
    .replace(/\s+\(balance\)$/i, '')
    .trim();
}

function parseGazetteer() {
  if (!fs.existsSync(GAZ_PATH)) {
    console.error(`Gazetteer file not found at ${GAZ_PATH}`);
    console.error(`Download with: curl -s -o ${GAZ_PATH}.zip "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip" && (cd $(dirname ${GAZ_PATH}) && unzip -p _tmp_gazetteer.txt.zip > _tmp_gazetteer.txt)`);
    console.error(`(or use the steps in the session prompt that already extracted to /tmp/census/)`);
    process.exit(2);
  }
  const lines = fs.readFileSync(GAZ_PATH, 'utf8').split(/\r?\n/);
  const header = lines[0].split('\t').map(s => s.trim());
  const idx = {
    USPS: header.indexOf('USPS'),
    NAME: header.indexOf('NAME'),
    LSAD: header.indexOf('LSAD'),
    ALAND: header.indexOf('ALAND'),
    LAT: header.indexOf('INTPTLAT'),
    LNG: header.indexOf('INTPTLONG'),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v < 0) throw new Error(`Gazetteer column missing: ${k}`);
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(s => s.trim());
    if (cols.length < idx.LNG + 1) continue;
    const usps = cols[idx.USPS].toLowerCase();
    if (!STATE_CODES.has(usps)) continue;
    const rawName = cols[idx.NAME];
    const lsad = cols[idx.LSAD];
    const lat = parseFloat(cols[idx.LAT]);
    const lng = parseFloat(cols[idx.LNG]);
    const aland = parseFloat(cols[idx.ALAND]) || 0;
    if (!isFinite(lat) || !isFinite(lng)) continue;
    const canonicalName = stripLSAD(rawName, lsad);
    if (!canonicalName) continue;
    rows.push({ state: usps, name: canonicalName, slug: siteSlugify(canonicalName), lat, lng, aland });
  }
  return rows;
}

function buildSiteMissingSet(coordsBySlug) {
  // For each trade vertical, enumerate `*-<state>-<vertical>-cost.html` pages.
  // Skip state-hub files (where the segment before the suffix is a state name).
  const missing = new Map(); // key: slug|state -> {slug, state, sampleFiles[]}
  for (const v of VERTICALS) {
    const suffix = `-${v}-cost.html`;
    const files = fs.readdirSync(ROOT).filter(f => f.endsWith(suffix));
    for (const f of files) {
      const stem = f.slice(0, -suffix.length);
      const lastDash = stem.lastIndexOf('-');
      if (lastDash < 0) continue;
      const stateCode = stem.slice(lastDash + 1).toLowerCase();
      if (!STATE_CODES.has(stateCode)) continue; // state-hub
      const slug = stem.slice(0, lastDash);
      if (!slug) continue;
      const key = `${slug}|${stateCode}`;
      if (coordsBySlug.has(key)) continue;
      const e = missing.get(key) || { slug, state: stateCode, files: [] };
      if (e.files.length < 3) e.files.push(f);
      missing.set(key, e);
    }
  }
  return missing;
}

function indexGazetteer(rows) {
  // Many Census places share names within a state (Springfield township vs city).
  // Group by (slug,state); pick the largest-aland entry as canonical.
  const byKey = new Map();
  for (const r of rows) {
    const k = `${r.slug}|${r.state}`;
    const prev = byKey.get(k);
    if (!prev || r.aland > prev.aland) byKey.set(k, r);
  }
  return byKey;
}

function main() {
  const coords = JSON.parse(fs.readFileSync(COORDS_PATH, 'utf8'));
  const coordsBySlug = new Map();
  for (const k of Object.keys(coords)) {
    const idx = k.lastIndexOf('|');
    if (idx < 0) continue;
    const cityName = k.slice(0, idx);
    const stateCode = k.slice(idx + 1).toLowerCase();
    coordsBySlug.set(`${siteSlugify(cityName)}|${stateCode}`, k);
  }
  console.log(`current coords: ${coordsBySlug.size} (slug,state) keys`);

  const missing = buildSiteMissingSet(coordsBySlug);
  console.log(`missing centroids: ${missing.size} distinct (slug,state) pairs`);

  console.log(`parsing Census Gazetteer (${GAZ_PATH})...`);
  const gazRows = parseGazetteer();
  console.log(`gazetteer rows: ${gazRows.length}`);
  const gazIndex = indexGazetteer(gazRows);
  console.log(`gazetteer unique (slug,state) keys: ${gazIndex.size}`);

  const resolved = [];
  const unresolved = [];
  for (const [k, m] of missing.entries()) {
    const hit = gazIndex.get(k);
    if (hit) resolved.push({ ...m, hit });
    else unresolved.push(m);
  }
  console.log(`resolved: ${resolved.length}, unresolved: ${unresolved.length}`);

  // Apply: append to coords, write back
  let added = 0;
  for (const r of resolved) {
    const newKey = `${r.hit.name}|${r.state.toUpperCase()}`;
    if (coords[newKey]) continue;
    coords[newKey] = { lat: r.hit.lat, lng: r.hit.lng };
    added++;
  }
  if (added > 0) {
    // Preserve existing JSON shape (file uses 2-space indent)
    fs.writeFileSync(COORDS_PATH, JSON.stringify(coords, null, 2) + '\n');
    console.log(`wrote ${added} new entries to ${COORDS_PATH}`);
  }

  if (unresolved.length) {
    console.log('\nUNRESOLVED (no Gazetteer match — list for manual review):');
    for (const u of unresolved) {
      console.log(`  ${u.slug.padEnd(30)} ${u.state.toUpperCase()}  e.g. ${u.files[0]}`);
    }
  }
}

main();
