#!/usr/bin/env node
/**
 * Chattanooga + ROOFING autocomplete harvester (Bing + Google).
 * Mirrors harvest-chattanooga-painting-pilot.js with roofing-specific seeds.
 *
 * Run: node scripts/keyword-research/harvest-chattanooga-roofing-pilot.js
 * Output: scripts/keyword-research/output/chattanooga-roofing-pilot.json
 *
 * Manual one-off; not for CI/cron.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const SEEDS = [
  // Direct cost intent
  'roof replacement cost chattanooga tn',
  'roof cost chattanooga tn',
  'new roof cost chattanooga',
  'how much for new roof chattanooga',
  'roof repair cost chattanooga',
  'shingle roof cost chattanooga',
  'metal roof cost chattanooga',
  // Contractor intent
  'roofers chattanooga tn',
  'roofers near me chattanooga',
  'roofing contractors chattanooga',
  'best roofers chattanooga',
  'cheap roofers chattanooga',
  'roofing companies chattanooga',
  'licensed roofers chattanooga',
  'commercial roofers chattanooga',
  // Project type intent
  'shingle roofing chattanooga',
  'metal roofing chattanooga',
  'flat roof chattanooga',
  'tile roof chattanooga',
  'roof repair chattanooga',
  'roof leak repair chattanooga',
  'hail damage roof chattanooga',
  'storm damage roof chattanooga',
  'gutter replacement chattanooga',
  // Quote intent (matches your moat)
  'roofing quote chattanooga',
  'roofing estimate chattanooga',
  'is roofing quote fair chattanooga',
  'roof inspection chattanooga',
  // Broader Chattanooga area neighborhoods
  'roofers lookout mountain',
  'roofers east brainerd',
  'roofers north shore chattanooga',
  'roofers hixson tn',
  'roofers signal mountain',
];

const DELAY_MS = 600;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Woogoro-KeywordResearch/1.0)',
        'Accept': 'application/json, text/javascript, */*',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function bingSuggest(query) {
  const url = 'https://api.bing.com/osjson.aspx?query=' + encodeURIComponent(query);
  try {
    const { status, body } = await fetchText(url);
    if (status >= 400) return { error: `HTTP ${status}` };
    const json = JSON.parse(body);
    return Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  } catch (e) { return { error: e.message }; }
}

async function googleSuggest(query) {
  const url = 'https://suggestqueries.google.com/complete/search?client=firefox&q=' + encodeURIComponent(query);
  try {
    const { status, body } = await fetchText(url);
    if (status >= 400) return { error: `HTTP ${status}` };
    const json = JSON.parse(body);
    return Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  } catch (e) { return { error: e.message }; }
}

(async () => {
  const queries = [];
  for (const s of SEEDS) {
    queries.push({ seed: s, expansion: '' });
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
      queries.push({ seed: s + ' ' + ch, expansion: ch, baseSeed: s });
    }
  }
  console.log(`Total queries: ${queries.length} (${SEEDS.length} seeds x 27 expansions)`);
  console.log(`Engines: Bing + Google. ETA: ~${Math.ceil(queries.length * DELAY_MS / 1000 / 60)} min\n`);

  const results = { meta: { harvestedAt: new Date().toISOString(), seedCount: SEEDS.length, queryCount: queries.length, vertical: 'roofing', city: 'chattanooga' }, suggestions: [] };
  let bingOk = 0, googleOk = 0, errCount = 0;

  for (let i = 0; i < queries.length; i++) {
    const { seed, expansion, baseSeed } = queries[i];
    const [bingRes, googleRes] = await Promise.all([bingSuggest(seed), googleSuggest(seed)]);

    if (Array.isArray(bingRes)) {
      bingOk++;
      for (const s of bingRes) results.suggestions.push({ engine: 'bing', seed: baseSeed || seed, query: seed, expansion, suggestion: s });
    } else if (bingRes?.error) errCount++;

    if (Array.isArray(googleRes)) {
      googleOk++;
      for (const s of googleRes) results.suggestions.push({ engine: 'google', seed: baseSeed || seed, query: seed, expansion, suggestion: s });
    } else if (googleRes?.error) errCount++;

    if ((i + 1) % 30 === 0 || i === queries.length - 1) {
      process.stdout.write(`  [${i+1}/${queries.length}] bing-ok:${bingOk} google-ok:${googleOk} err:${errCount} suggestions:${results.suggestions.length}\r`);
    }
    await sleep(DELAY_MS);
  }

  const outPath = path.join(OUT_DIR, 'chattanooga-roofing-pilot.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

  const uniqueSuggestions = new Set(results.suggestions.map(s => s.suggestion.toLowerCase())).size;
  const byEngine = results.suggestions.reduce((a, s) => { a[s.engine] = (a[s.engine] || 0) + 1; return a; }, {});

  console.log(`\n\nDone.`);
  console.log(`Total suggestions: ${results.suggestions.length} (${byEngine.bing || 0} bing, ${byEngine.google || 0} google)`);
  console.log(`Unique suggestions: ${uniqueSuggestions}`);
  console.log(`Output: ${outPath}`);
})();
