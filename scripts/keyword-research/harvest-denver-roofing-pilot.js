#!/usr/bin/env node
/**
 * One-off pilot harvester for the Denver roofing flagship page.
 *
 * Third instance of the flagship-research model. Seed shape is HAIL-DOMINANT
 * (not cost-dominant like LA, not trust-dominant like Chattanooga painting):
 *   - Denver = Front Range hail capital; insurance-claim intent is the moat
 *   - Class 4 impact-resistant shingle decision is a real local question
 *   - HB-1212 (CO public-adjuster restriction on roofers) is unique to CO
 *   - LADBS-equivalent is Denver Community Planning & Development + Title 33
 *   - Neighborhoods: Cherry Creek, Highlands, Stapleton/Central Park, Aurora, Lakewood
 *
 * Pulls public autocomplete from Bing + Google (free, no auth).
 *
 * Run: node scripts/keyword-research/harvest-denver-roofing-pilot.js
 *
 * NOTE: manual one-off only. NOT for CI / cron per
 * feedback_no_paid_services_in_automation.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const SEEDS = [
  // Direct cost intent (baseline coverage)
  'roof replacement cost denver',
  'roof replacement cost denver co',
  'new roof cost denver',
  'roofing cost denver',
  'average roof cost denver',
  // HAIL-DOMINANT (the differentiator)
  'denver hail damage roof',
  'denver hail damage roof repair',
  'hail damage roof denver cost',
  'denver roof hail claim',
  'roof hail damage insurance claim denver',
  'denver hail roof inspection',
  'denver hail storm 2026',
  'after hail storm denver roof',
  'how to file roof hail claim colorado',
  // Impact-resistant / Class 4 (local decision)
  'class 4 impact resistant shingles denver',
  'impact resistant roof denver',
  'hail proof roof denver',
  'best shingles for hail denver',
  'insurance discount class 4 shingles colorado',
  // Material-specific
  'asphalt shingle roof cost denver',
  'metal roof cost denver',
  'tile roof denver',
  'cedar shake roof denver',
  // CO-specific code + permit
  'denver roofing permit',
  'denver building department roof',
  'colorado roof permit',
  'colorado roofing license',
  'hb 1212 colorado roofer',
  'colorado roofer public adjuster',
  'class a fire rated roof colorado',
  // Insurance / DORA / supplements
  'colorado dora insurance complaint',
  'roof insurance supplement denver',
  'acv vs rcv roof colorado',
  'depreciation roof claim colorado',
  // Contractor / trust
  'roofing contractors denver',
  'best roofers denver',
  'licensed roofer denver',
  // Quote intent (our moat)
  'roofing quote denver',
  'is my roofing quote fair denver',
  // Repair / leaks
  'roof leak repair denver',
  'storm damage roof denver',
  // Neighborhoods
  'roofers cherry creek',
  'roofers highlands denver',
  'roofers aurora co',
  'roofers lakewood co',
  'roofers stapleton denver',
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
  } catch (e) {
    return { error: e.message };
  }
}

async function googleSuggest(query) {
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
  console.log(`ETA: ~${Math.ceil(queries.length * DELAY_MS / 1000 / 60)} minutes\n`);

  const results = { meta: { harvestedAt: new Date().toISOString(), seedCount: SEEDS.length, queryCount: queries.length, city: 'Denver', state: 'CO', vertical: 'roofing', angle: 'hail-damage + insurance-claim' }, suggestions: [] };
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

  const outPath = path.join(OUT_DIR, 'denver-roofing-pilot.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

  const uniqueSuggestions = new Set(results.suggestions.map(s => s.suggestion.toLowerCase())).size;
  const byEngine = results.suggestions.reduce((a, s) => { a[s.engine] = (a[s.engine] || 0) + 1; return a; }, {});

  console.log(`\n\nDone.`);
  console.log(`Total suggestions: ${results.suggestions.length} (${byEngine.bing || 0} bing, ${byEngine.google || 0} google)`);
  console.log(`Unique suggestions: ${uniqueSuggestions}`);
  console.log(`Output: ${outPath}`);
})();
