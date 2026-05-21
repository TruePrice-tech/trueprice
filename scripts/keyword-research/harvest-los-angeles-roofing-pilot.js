#!/usr/bin/env node
/**
 * One-off pilot harvester for the Los Angeles roofing flagship page.
 *
 * Second instance of the flagship-research model (Chattanooga painting was
 * first). Seeds are tuned from the 2026-05-21 GSC pull which revealed:
 *   - 246 imp / 0 clicks / pos 28.5 site-wide for *roof* pages over 90d
 *   - LA dominates: 6 of top 10 queries are LA-specific, 2 more CA-state
 *   - Intent is COST-dominant (not trust-dominant like painting)
 *   - Tile + slate + solar materials are over-indexed in real queries
 *   - Zero insurance-claim / contractor-trust queries visible
 *
 * Pulls public autocomplete from Bing + Google (free, no auth). Same shape
 * as harvest-chattanooga-painting-pilot.js; per current playbook stage
 * scripts stay copy-and-edit until measurement validates the model
 * (parameterization is deferred until then).
 *
 * Run: node scripts/keyword-research/harvest-los-angeles-roofing-pilot.js
 *
 * NOTE: manual one-off only. NOT for CI / cron per
 * feedback_no_paid_services_in_automation (free endpoints, but scheduled
 * external HTTP harvesting lives in the same risk class).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const SEEDS = [
  // Direct cost intent (GSC validated)
  'roof replacement cost los angeles',
  'roof replacement cost los angeles ca',
  'new roof cost los angeles',
  'roofing prices los angeles',
  'roofing cost los angeles',
  'average roof replacement cost los angeles',
  'flat roof replacement cost los angeles',
  // Material-specific (GSC shows tile/slate/solar over-indexed)
  'tile roof cost los angeles',
  'clay tile roof cost los angeles',
  'spanish tile roof los angeles',
  'slate roof cost los angeles',
  'asphalt roof cost los angeles',
  'metal roof cost los angeles',
  'solar roof cost los angeles',
  'cool roof los angeles',
  // LA-specific code / permits (Title 24, WUI, hillside)
  'title 24 cool roof los angeles',
  'class a fire rated roof los angeles',
  'roof replacement permit los angeles',
  'ladbs roof permit',
  'hillside roof replacement los angeles',
  // Contractor / trust (supporting, not lead)
  'roofing contractors los angeles',
  'licensed roofer los angeles',
  'best roofers los angeles',
  'cslb roofer license',
  // Quote intent (our moat)
  'roofing quote los angeles',
  // Repair / damage
  'roof repair los angeles',
  'storm damage roof los angeles',
  'roof leak repair los angeles',
  // Broader LA neighborhoods (parallel to Chattanooga "lookout mountain" seed group)
  'roofers santa monica',
  'roofers pasadena',
  'roofers long beach',
  'roofers san fernando valley',
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

  const results = { meta: { harvestedAt: new Date().toISOString(), seedCount: SEEDS.length, queryCount: queries.length, city: 'Los Angeles', state: 'CA', vertical: 'roofing' }, suggestions: [] };
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

  const outPath = path.join(OUT_DIR, 'los-angeles-roofing-pilot.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

  const uniqueSuggestions = new Set(results.suggestions.map(s => s.suggestion.toLowerCase())).size;
  const byEngine = results.suggestions.reduce((a, s) => { a[s.engine] = (a[s.engine] || 0) + 1; return a; }, {});

  console.log(`\n\nDone.`);
  console.log(`Total suggestions: ${results.suggestions.length} (${byEngine.bing || 0} bing, ${byEngine.google || 0} google)`);
  console.log(`Unique suggestions: ${uniqueSuggestions}`);
  console.log(`Output: ${outPath}`);
})();
