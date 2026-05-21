#!/usr/bin/env node
// P1 from SEO audit 2026-05-20: city-vertical pages link to analyzers,
// estimators, compare, and find-contractors hubs WITHOUT ?city= or ?state=
// params, so jumping into the analyzer from a city page cold-starts the
// form. Flagship Chattanooga + new roof templates already include the
// params; ~6-7K legacy city pages do not.
//
// This pass walks every *-cost.html that matches the city-state-vertical
// filename shape, extracts the city display form and state code from the
// filename, and appends `?city=<City>&state=<ST>` to every href in a
// fixed allowlist of internal hub URLs that does not already have a query
// string. Files marked HANDWRITTEN-PROTECTED are auto-skipped via the
// monkey-patched fs.writeFileSync in _handwritten-guard.js.
//
// Idempotent: if a target href already contains '?', it is left alone.

require('./_handwritten-guard.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Known state codes (US 50 + DC). Used to anchor city/state/vertical parse.
const STATES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy','dc'
]);

// Multi-word verticals must be checked first so they aren't mis-parsed as
// "<word>-cost" (e.g. garage-door, kitchen-remodel, auto-repair).
const VERTICALS = [
  'auto-repair','garage-door','kitchen-remodel',
  'roof','hvac','plumbing','electrical','solar','concrete','painting','fence',
  'foundation','siding','window','insulation','gutter','landscaping',
  'medical','legal','moving',
];

// Internal hub URLs we want city/state context on. Each entry is a regex
// that matches the path portion (without query/fragment) inside href="...".
const HUB_PATH_RE = new RegExp(
  '^/(?:' +
    // Generic hubs
    'analyze-my-quote|get-an-estimate|compare-quotes-picker|find-contractors' +
    // Per-vertical analyzers/estimators/compare pages
    '|[a-z-]+-quote-analyzer|[a-z-]+-estimate|compare-[a-z-]+-quotes' +
  ')\\.html$'
);

function parseFilename(file) {
  // file: e.g. "akron-oh-painting-cost.html" → {city:'Akron', st:'OH'}
  //       or  "new-york-ny-painting-cost.html" → {city:'New York', st:'NY'}
  //       or  "spartanburg-sc-garage-door-cost.html" → {city:'Spartanburg', st:'SC'}
  if (!file.endsWith('-cost.html')) return null;
  const stem = file.slice(0, -'-cost.html'.length);
  // Try to strip a known vertical suffix (longest first to match multi-word).
  let cityState = null;
  for (const v of VERTICALS) {
    const suffix = '-' + v;
    if (stem.endsWith(suffix)) {
      cityState = stem.slice(0, -suffix.length);
      break;
    }
  }
  if (!cityState) return null;
  // cityState is now e.g. "akron-oh" or "new-york-ny". Last 2-letter token
  // is the state code.
  const m = cityState.match(/^(.+)-([a-z]{2})$/);
  if (!m) return null;
  const citySlug = m[1];
  const stateCode = m[2];
  if (!STATES.has(stateCode)) return null;
  const cityDisplay = citySlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return { city: cityDisplay, st: stateCode.toUpperCase() };
}

function rewriteHrefs(html, city, st) {
  const param = `?city=${encodeURIComponent(city)}&state=${st}`;
  let count = 0;
  // Match href="..." where the path part matches a hub URL and there is
  // no existing query string (no '?' before the closing quote or fragment).
  // Group 1: opening quote + path. We accept the next char being '"' (no
  // fragment) OR '#' (fragment but no query).
  const out = html.replace(
    /href="(\/[a-z0-9-]+\.html)([#"])/gi,
    (full, urlPath, nextChar) => {
      if (!HUB_PATH_RE.test(urlPath)) return full;
      count++;
      return `href="${urlPath}${param}${nextChar}`;
    }
  );
  return { html: out, count };
}

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('-cost.html'));

let scanned = 0;
let parsedOK = 0;
let touched = 0;
let totalHrefsFixed = 0;
let skippedProtected = 0;
let skippedNoChange = 0;
let unparseable = 0;

for (const f of files) {
  scanned++;
  const info = parseFilename(f);
  if (!info) { unparseable++; continue; }
  parsedOK++;

  const filePath = path.join(ROOT, f);
  const orig = fs.readFileSync(filePath, 'utf8');
  const { html: updated, count } = rewriteHrefs(orig, info.city, info.st);
  if (count === 0) { skippedNoChange++; continue; }

  const beforeLen = fs.statSync(filePath).size;
  fs.writeFileSync(filePath, updated, 'utf8');
  const afterLen = fs.statSync(filePath).size;
  if (beforeLen === afterLen) { skippedProtected++; continue; }
  touched++;
  totalHrefsFixed += count;
}

console.log('\nCTA city/state param hoist — summary');
console.log(`  files scanned (-cost.html):  ${scanned}`);
console.log(`  files parseable:             ${parsedOK}`);
console.log(`  files unparseable (state pages etc.): ${unparseable}`);
console.log(`  files modified:              ${touched}`);
console.log(`  files skipped (protected):   ${skippedProtected}`);
console.log(`  files skipped (no hrefs to fix): ${skippedNoChange}`);
console.log(`  total hrefs param-hoisted:   ${totalHrefsFixed}`);
