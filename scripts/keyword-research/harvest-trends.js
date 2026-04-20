#!/usr/bin/env node
/**
 * Harvest related queries + geo interest from Google Trends for every seed.
 * Rate-limited at ~2.5 seconds between calls to avoid throttling. Trends is
 * finicky — expect ~10-20% of seeds to return empty (low-volume seeds) and
 * handle gracefully.
 *
 * Output: scripts/keyword-research/output/trends-raw.json
 *
 * Usage:
 *   node scripts/keyword-research/harvest-trends.js              # full run
 *   node scripts/keyword-research/harvest-trends.js --pilot      # first 5 seeds only
 */

const fs = require('fs');
const path = require('path');
const trends = require('google-trends-api');

const ROOT = path.resolve(__dirname, '..', '..');
const SEEDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'seeds.json'), 'utf8'));
const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PILOT = process.argv.includes('--pilot');
const DELAY_MS = 2500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Flatten seeds into a single list with vertical tag.
const allSeeds = [];
for (const [vertical, seeds] of Object.entries(SEEDS.verticals)) {
  for (const s of seeds) allSeeds.push({ seed: s, vertical });
}
for (const s of SEEDS.meta) allSeeds.push({ seed: s, vertical: 'meta' });

const seedsToRun = PILOT ? allSeeds.slice(0, 5) : allSeeds;
console.log(`Running on ${seedsToRun.length} seeds (${PILOT ? 'PILOT' : 'FULL'} mode)\n`);

async function fetchRelated(seed) {
  try {
    const raw = await trends.relatedQueries({
      keyword: seed,
      geo: 'US',
      hl: 'en-US',
    });
    const parsed = JSON.parse(raw);
    const lists = parsed.default?.rankedList || [];
    const queries = [];
    // rankedList[0] = top (historical relative), rankedList[1] = rising (recent growth)
    const kinds = ['top', 'rising'];
    for (let i = 0; i < lists.length; i++) {
      const kind = kinds[i] || 'other';
      const items = lists[i].rankedKeyword || [];
      for (const item of items) {
        queries.push({ query: item.query, value: item.value, kind });
      }
    }
    return queries;
  } catch (e) {
    return { error: e.message };
  }
}

async function fetchGeo(seed) {
  try {
    const raw = await trends.interestByRegion({
      keyword: seed,
      geo: 'US',
      hl: 'en-US',
      resolution: 'DMA',
    });
    const parsed = JSON.parse(raw);
    const items = parsed.default?.geoMapData || [];
    const top = items
      .filter(x => Array.isArray(x.value) && x.value[0] > 0)
      .map(x => ({ metro: x.geoName, interest: x.value[0] }))
      .sort((a, b) => b.interest - a.interest)
      .slice(0, 10);
    return top;
  } catch (e) {
    return { error: e.message };
  }
}

(async () => {
  const output = [];
  let okCount = 0, emptyCount = 0, errorCount = 0;

  for (let i = 0; i < seedsToRun.length; i++) {
    const { seed, vertical } = seedsToRun[i];
    process.stdout.write(`[${i+1}/${seedsToRun.length}] ${vertical} / "${seed}" ... `);

    const related = await fetchRelated(seed);
    await sleep(DELAY_MS);
    const geo = await fetchGeo(seed);
    await sleep(DELAY_MS);

    const relatedCount = Array.isArray(related) ? related.length : 0;
    const geoCount = Array.isArray(geo) ? geo.length : 0;
    const relatedErr = related?.error || null;
    const geoErr = geo?.error || null;

    if (relatedErr && geoErr) {
      errorCount++;
      console.log(`ERR (${relatedErr.slice(0, 60)})`);
    } else if (relatedCount === 0 && geoCount === 0) {
      emptyCount++;
      console.log('empty');
    } else {
      okCount++;
      console.log(`${relatedCount} related, ${geoCount} metros`);
    }

    output.push({
      seed,
      vertical,
      relatedQueries: Array.isArray(related) ? related : [],
      relatedError: relatedErr,
      geoMetros: Array.isArray(geo) ? geo : [],
      geoError: geoErr,
    });

    // Save incrementally so we don't lose progress on crash
    fs.writeFileSync(
      path.join(OUT_DIR, PILOT ? 'trends-pilot.json' : 'trends-raw.json'),
      JSON.stringify(output, null, 2),
      'utf8'
    );
  }

  console.log(`\nDone. ok: ${okCount}, empty: ${emptyCount}, errors: ${errorCount}`);
  console.log(`Output: ${path.join(OUT_DIR, PILOT ? 'trends-pilot.json' : 'trends-raw.json')}`);
})();
