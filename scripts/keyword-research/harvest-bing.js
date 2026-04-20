#!/usr/bin/env node
/**
 * Harvest Bing Autocomplete suggestions for every seed. Bing's suggest
 * endpoint is public, no API key, and returns up to ~8 completions per
 * query. For maximum coverage we also enumerate each seed with an appended
 * A-Z letter (e.g., "hvac cost a", "hvac cost b", ...) which reveals
 * long-tail completions that plain seeds miss — a well-known trick in
 * keyword research.
 *
 * Endpoint: https://api.bing.com/osjson.aspx?query=<q>
 *
 * Output: scripts/keyword-research/output/bing-raw.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SEEDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'seeds.json'), 'utf8'));
const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PILOT = process.argv.includes('--pilot');
const DELAY_MS = 500;  // Bing autocomplete tolerates faster calls than Trends

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Woogoro-KeywordResearch/1.0)',
        'Accept': 'application/json, text/javascript, */*',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse fail (status ${res.statusCode}): ${data.slice(0, 100)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function bingSuggest(query) {
  const url = 'https://api.bing.com/osjson.aspx?query=' + encodeURIComponent(query);
  try {
    const json = await fetchJson(url);
    // osjson format: [queryText, [suggestions], [descriptions], [urls]]
    if (Array.isArray(json) && Array.isArray(json[1])) return json[1];
    return [];
  } catch (e) {
    return { error: e.message };
  }
}

// Flatten seeds + letter expansions
const allSeeds = [];
for (const [vertical, seeds] of Object.entries(SEEDS.verticals)) {
  for (const s of seeds) {
    allSeeds.push({ seed: s, vertical, expansion: '' });
    // Letter expansion: "seed a", "seed b", ... "seed z"
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
      allSeeds.push({ seed: s + ' ' + ch, vertical, expansion: ch, baseSeed: s });
    }
  }
}
for (const s of SEEDS.meta) {
  allSeeds.push({ seed: s, vertical: 'meta', expansion: '' });
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
    allSeeds.push({ seed: s + ' ' + ch, vertical: 'meta', expansion: ch, baseSeed: s });
  }
}

const seedsToRun = PILOT ? allSeeds.slice(0, 30) : allSeeds;
console.log(`Running on ${seedsToRun.length} seed expansions (${PILOT ? 'PILOT' : 'FULL'})`);
console.log(`ETA: ~${Math.ceil(seedsToRun.length * DELAY_MS / 1000 / 60)} minutes\n`);

(async () => {
  const output = [];
  let okCount = 0, emptyCount = 0, errorCount = 0;

  for (let i = 0; i < seedsToRun.length; i++) {
    const { seed, vertical, expansion, baseSeed } = seedsToRun[i];
    const result = await bingSuggest(seed);

    if (result?.error) {
      errorCount++;
    } else if (Array.isArray(result) && result.length === 0) {
      emptyCount++;
    } else if (Array.isArray(result)) {
      okCount++;
      for (const suggestion of result) {
        output.push({
          seed: baseSeed || seed,
          vertical,
          expansion,
          suggestion,
        });
      }
    }

    // Progress log every 50 seeds to keep output readable
    if ((i + 1) % 50 === 0 || i === seedsToRun.length - 1) {
      process.stdout.write(`  [${i+1}/${seedsToRun.length}] ok:${okCount} empty:${emptyCount} err:${errorCount} — collected ${output.length} suggestions\r`);
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, PILOT ? 'bing-pilot.json' : 'bing-raw.json'),
    JSON.stringify(output, null, 2),
    'utf8'
  );
  console.log(`\n\nDone. ${output.length} total suggestions collected.`);
  console.log(`Output: ${path.join(OUT_DIR, PILOT ? 'bing-pilot.json' : 'bing-raw.json')}`);
})();
