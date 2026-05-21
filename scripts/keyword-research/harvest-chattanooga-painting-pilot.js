#!/usr/bin/env node
/**
 * One-off pilot harvester for the Chattanooga painting flagship page.
 *
 * Pulls public autocomplete completions from two engines:
 *   - Bing  (api.bing.com/osjson.aspx, no auth)
 *   - Google (suggestqueries.google.com/complete/search, no auth, best-effort)
 *
 * For each base seed, we run the base query plus 26 letter expansions
 * ("seed a", "seed b", ... "seed z") — a standard trick that exposes
 * long-tail completions plain seeds miss.
 *
 * Output: scripts/keyword-research/output/chattanooga-painting-pilot.json
 *
 * Run: node scripts/keyword-research/harvest-chattanooga-painting-pilot.js
 *
 * NOTE: this is a manual, one-off pilot harvester. NOT for CI / cron — per the
 * no-paid-services-in-automation guardrail. The endpoints are free, but
 * scheduling external HTTP harvesting belongs in the same risk class.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const SEEDS = [
  // Direct cost intent
  'painting cost chattanooga tn',
  'painting prices chattanooga tn',
  'house painting cost chattanooga',
  'how much to paint house chattanooga',
  'exterior paint cost chattanooga',
  'interior paint cost chattanooga',
  'cabinet painting cost chattanooga',
  // Contractor intent
  'house painters chattanooga',
  'painters near me chattanooga',
  'painting contractors chattanooga',
  'best painters chattanooga',
  'cheap painters chattanooga',
  'painting companies chattanooga',
  'licensed painters chattanooga',
  'commercial painters chattanooga',
  // Project type intent
  'exterior painting chattanooga',
  'interior painting chattanooga',
  'cabinet painting chattanooga',
  'deck staining chattanooga',
  'fence painting chattanooga',
  'trim painting chattanooga',
  // Quote intent (matches your moat — quote analysis)
  'painting quote chattanooga',
  'painting estimate chattanooga',
  'is painting quote fair chattanooga',
  // Broader Chattanooga area
  'painters lookout mountain',
  'painters east brainerd',
  'painters north shore chattanooga',
  'painters hixson tn',
  'painters east ridge tn',
];

const DELAY_MS = 600; // gentle pacing
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
    // Format: [queryText, [suggestions], [descriptions], [urls]]
    return Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  } catch (e) {
    return { error: e.message };
  }
}

async function googleSuggest(query) {
  // Firefox client returns plain JSON: [queryText, [suggestions]]
  const url = 'https://suggestqueries.google.com/complete/search?client=firefox&q=' + encodeURIComponent(query);
  try {
    const { status, body } = await fetchText(url);
    if (status >= 400) return { error: `HTTP ${status}` };
    const json = JSON.parse(body);
    return Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  } catch (e) {
    return { error: e.message };
  }
}

(async () => {
  const queries = [];
  for (const s of SEEDS) {
    queries.push({ seed: s, expansion: '' });
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
      queries.push({ seed: s + ' ' + ch, expansion: ch, baseSeed: s });
    }
  }
  console.log(`Total queries to run: ${queries.length} (${SEEDS.length} seeds x 27 expansions)`);
  console.log(`Engines: Bing + Google (both free, no auth)`);
  console.log(`ETA: ~${Math.ceil(queries.length * DELAY_MS * 2 / 1000 / 60)} minutes\n`);

  const results = { meta: { harvestedAt: new Date().toISOString(), seedCount: SEEDS.length, queryCount: queries.length }, suggestions: [] };
  let bingOk = 0, googleOk = 0, errCount = 0;

  for (let i = 0; i < queries.length; i++) {
    const { seed, expansion, baseSeed } = queries[i];
    const [bingRes, googleRes] = await Promise.all([bingSuggest(seed), googleSuggest(seed)]);

    if (Array.isArray(bingRes)) {
      bingOk++;
      for (const s of bingRes) {
        results.suggestions.push({ engine: 'bing', seed: baseSeed || seed, query: seed, expansion, suggestion: s });
      }
    } else if (bingRes?.error) errCount++;

    if (Array.isArray(googleRes)) {
      googleOk++;
      for (const s of googleRes) {
        results.suggestions.push({ engine: 'google', seed: baseSeed || seed, query: seed, expansion, suggestion: s });
      }
    } else if (googleRes?.error) errCount++;

    if ((i + 1) % 30 === 0 || i === queries.length - 1) {
      process.stdout.write(`  [${i+1}/${queries.length}] bing-ok:${bingOk} google-ok:${googleOk} err:${errCount} suggestions:${results.suggestions.length}\r`);
    }
    await sleep(DELAY_MS);
  }

  const outPath = path.join(OUT_DIR, 'chattanooga-painting-pilot.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

  // Summary stats
  const uniqueSuggestions = new Set(results.suggestions.map(s => s.suggestion.toLowerCase())).size;
  const byEngine = results.suggestions.reduce((a, s) => { a[s.engine] = (a[s.engine] || 0) + 1; return a; }, {});

  console.log(`\n\nDone.`);
  console.log(`Total suggestions: ${results.suggestions.length} (${byEngine.bing || 0} bing, ${byEngine.google || 0} google)`);
  console.log(`Unique suggestions: ${uniqueSuggestions}`);
  console.log(`Output: ${outPath}`);
})();
