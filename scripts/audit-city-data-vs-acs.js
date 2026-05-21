#!/usr/bin/env node
/**
 * Audit data/city-cost-multipliers.json (population) and data/city-context.json
 * (avgHomeAge) against the U.S. Census ACS 5-year estimates.
 *
 * Two modes:
 *   --report  (default) -- writes JSON report to output/audits/, no file changes
 *   --patch            -- applies fixes to the JSON files, with .bak backups
 *
 * Setup:
 *   1) Get a free Census API key: https://api.census.gov/data/key_signup.html
 *   2) export CENSUS_API_KEY=<your-key>   (or set in Windows env)
 *   3) node scripts/audit-city-data-vs-acs.js [--report|--patch] [--sample=N]
 *
 * Thresholds for flagging:
 *   - population: stored value off by > 5% vs ACS
 *   - avgHomeAge: stored value off by > 5 years vs (currentYear - ACS medianYearBuilt)
 *
 * Name collisions (e.g., "Mesquite, TX" has both a city of 150K AND a town of 219)
 * are resolved by keeping the largest-population place per (normalized name, state).
 *
 * Note: manual one-off script. NOT for CI/cron (per the
 * no-paid-services-in-automation guardrail; Census API is free but external).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const MULT_PATH = path.join(ROOT, 'data', 'city-cost-multipliers.json');
const CTX_PATH = path.join(ROOT, 'data', 'city-context.json');
const OUT_DIR = path.join(ROOT, 'output', 'audits');

const args = process.argv.slice(2);
const PATCH_MODE = args.includes('--patch');
const SAMPLE = (args.find(a => a.startsWith('--sample=')) || '').split('=')[1];
const SAMPLE_SIZE = SAMPLE ? parseInt(SAMPLE, 10) : null;
const REFERENCE_YEAR = 2024; // ACS 5-yr 2019-2023 = release year 2024; matches B25035 semantics

const API_KEY = process.env.CENSUS_API_KEY;
if (!API_KEY) {
  console.error('ERROR: CENSUS_API_KEY env var not set.');
  console.error('Get a free key at https://api.census.gov/data/key_signup.html');
  console.error('Then: export CENSUS_API_KEY=<your-key>  (or set in Windows env)');
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const STATE_FIPS = {
  AL:'01', AK:'02', AZ:'04', AR:'05', CA:'06', CO:'08', CT:'09', DE:'10',
  DC:'11', FL:'12', GA:'13', HI:'15', ID:'16', IL:'17', IN:'18', IA:'19',
  KS:'20', KY:'21', LA:'22', ME:'23', MD:'24', MA:'25', MI:'26', MN:'27',
  MS:'28', MO:'29', MT:'30', NE:'31', NV:'32', NH:'33', NJ:'34', NM:'35',
  NY:'36', NC:'37', ND:'38', OH:'39', OK:'40', OR:'41', PA:'42', RI:'44',
  SC:'45', SD:'46', TN:'47', TX:'48', UT:'49', VT:'50', VA:'51', WA:'53',
  WV:'54', WI:'55', WY:'56'
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Woogoro-DataAudit/1.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse fail: ${data.slice(0, 200)}`)); }
      });
    }).on('error', reject).setTimeout(30000, function() { this.destroy(); reject(new Error('timeout')); });
  });
}

function placeAliases(rawName) {
  // Census names cover many shapes. Return ALL plausible normalized keys a
  // user/Lane might store for this place so we can index the place under each.
  //   "Chattanooga city, Tennessee"                          -> ["chattanooga"]
  //   "Carson City, Nevada"                                  -> ["carson city", "carson"]
  //   "Indianapolis city (balance), Indiana"                 -> ["indianapolis"]
  //   "Nashville-Davidson metropolitan government (balance)" -> ["nashville-davidson", "nashville"]
  //   "Louisville/Jefferson County metro government (balance)" -> ["louisville/jefferson county", "louisville"]
  //   "Lexington-Fayette urban county, Kentucky"             -> ["lexington-fayette"]
  //   "Macon-Bibb County, Georgia"                           -> ["macon-bibb county", "macon"]
  //   "Methuen Town city, Massachusetts"                     -> ["methuen town", "methuen"]
  //   "Urban Honolulu CDP, Hawaii"                           -> ["urban honolulu", "honolulu"]
  let n = String(rawName).split(',')[0].trim();
  // Explanatory suffixes
  n = n.replace(/\s*\(balance\)\s*$/i, '');
  n = n.replace(/\s+(unified government|metropolitan government|metro government|consolidated government|urban county)$/i, '');
  // Place-type suffixes
  n = n.replace(/\s+(city|town|village|borough|CDP|municipality)$/i, '');
  // Strip leading "Urban " (Honolulu)
  n = n.replace(/^urban\s+/i, '');
  const base = n.toLowerCase().trim();
  const aliases = new Set([base]);
  // If hyphenated like "Nashville-Davidson" or "Lexington-Fayette", also index under the first segment
  if (base.includes('-')) aliases.add(base.split('-')[0].trim());
  // If slash-separated like "Louisville/Jefferson County", also index under the first segment
  if (base.includes('/')) aliases.add(base.split('/')[0].trim());
  // If has a trailing " County" word, also index without it (e.g., "Macon-Bibb County" -> "Macon-Bibb")
  if (/\s+county$/i.test(base)) {
    const noCounty = base.replace(/\s+county$/i, '').trim();
    aliases.add(noCounty);
    if (noCounty.includes('-')) aliases.add(noCounty.split('-')[0].trim());
  }
  // Some Census names have an extra "Town" word that isn't part of the place name (Methuen Town)
  if (/\s+town$/i.test(base)) aliases.add(base.replace(/\s+town$/i, '').trim());
  // Also index the FULL original (pre-strip) name lowercased — covers "Carson City"
  const fullLower = String(rawName).split(',')[0].trim().toLowerCase();
  aliases.add(fullLower);
  return [...aliases].filter(a => a.length > 0);
}

async function fetchStatePlaces(stateCode, stateFips) {
  // Pull all places in a state with name, population, median year built
  const url = `https://api.census.gov/data/2023/acs/acs5?get=NAME,B01003_001E,B25035_001E&for=place:*&in=state:${stateFips}&key=${API_KEY}`;
  try {
    const rows = await fetchJson(url);
    // First row is headers; subsequent are [NAME, pop, year_built, state_fips, place_fips]
    if (!Array.isArray(rows) || rows.length < 2) return [];
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const [rawName, popStr, yearStr] = rows[i];
      const aliases = placeAliases(rawName);
      const pop = parseInt(popStr, 10);
      const yearBuilt = parseInt(yearStr, 10);
      if (Number.isFinite(pop) && pop > 0) {
        out.push({
          stateCode,
          aliases,
          population: pop,
          medianYearBuilt: Number.isFinite(yearBuilt) && yearBuilt > 1800 ? yearBuilt : null,
          rawName,
        });
      }
    }
    return out;
  } catch (e) {
    console.error(`  state ${stateCode}: ${e.message}`);
    return [];
  }
}

(async () => {
  console.log('=== City Data Audit vs. Census ACS ===');
  console.log(`Mode: ${PATCH_MODE ? 'PATCH' : 'REPORT'}${SAMPLE_SIZE ? ` (sample ${SAMPLE_SIZE})` : ''}`);
  console.log('');

  const multipliers = JSON.parse(fs.readFileSync(MULT_PATH, 'utf8'));
  const context = JSON.parse(fs.readFileSync(CTX_PATH, 'utf8'));

  // Build the set of states we actually need (from the multipliers data)
  const neededStates = new Set();
  for (const key of Object.keys(multipliers)) {
    const [, state] = key.split('|');
    if (state && STATE_FIPS[state]) neededStates.add(state);
  }
  console.log(`Cities to audit: ${Object.keys(multipliers).length} across ${neededStates.size} states`);

  // Fetch all places per state
  console.log('Fetching Census ACS place data...');
  const censusByStateAndNorm = {}; // "TN" -> { "chattanooga": {pop, ybuilt} }
  let stateIdx = 0;
  for (const stateCode of neededStates) {
    stateIdx++;
    const stateFips = STATE_FIPS[stateCode];
    const places = await fetchStatePlaces(stateCode, stateFips);
    censusByStateAndNorm[stateCode] = {};
    for (const p of places) {
      // Each place may be indexed under multiple aliases (e.g., "Nashville-Davidson"
      // AND "nashville"). For each alias, keep the largest-population place if
      // there's a collision (prevents tiny CDPs from overwriting real cities).
      for (const alias of p.aliases) {
        const existing = censusByStateAndNorm[stateCode][alias];
        if (!existing || p.population > existing.population) {
          censusByStateAndNorm[stateCode][alias] = p;
        }
      }
    }
    process.stdout.write(`  [${stateIdx}/${neededStates.size}] ${stateCode}: ${places.length} places\r`);
  }
  console.log('\n');

  // Audit
  const discrepancies = { population: [], avgHomeAge: [], unmatched: [] };
  let popMatched = 0, ageMatched = 0;

  const cityKeys = Object.keys(multipliers);
  const keysToCheck = SAMPLE_SIZE ? cityKeys.slice(0, SAMPLE_SIZE) : cityKeys;

  for (const key of keysToCheck) {
    const [cityRaw, state] = key.split('|');
    if (!state || !STATE_FIPS[state]) continue;
    const norm = cityRaw.toLowerCase().trim();
    const census = censusByStateAndNorm[state]?.[norm];
    if (!census) {
      discrepancies.unmatched.push({ key, storedPop: multipliers[key].population });
      continue;
    }
    // Population check
    const storedPop = multipliers[key].population;
    if (storedPop && census.population) {
      const pctDiff = (census.population - storedPop) / storedPop;
      if (Math.abs(pctDiff) > 0.05) {
        discrepancies.population.push({
          key, stored: storedPop, census: census.population,
          diffPct: Math.round(pctDiff * 1000) / 10,
        });
      }
      popMatched++;
    }
    // avgHomeAge check (via city-context)
    const ctx = context[key];
    if (ctx && typeof ctx.avgHomeAge === 'number' && census.medianYearBuilt) {
      const expectedAge = REFERENCE_YEAR - census.medianYearBuilt;
      const ageDiff = expectedAge - ctx.avgHomeAge;
      if (Math.abs(ageDiff) > 5) {
        discrepancies.avgHomeAge.push({
          key, stored: ctx.avgHomeAge, censusMedianYearBuilt: census.medianYearBuilt,
          expectedAge, diff: ageDiff,
        });
      }
      ageMatched++;
    }
  }

  // Sort discrepancies by magnitude (most-wrong first)
  discrepancies.population.sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct));
  discrepancies.avgHomeAge.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  // Write report
  const ts = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(OUT_DIR, `city-data-acs-audit-${ts}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    meta: {
      generatedAt: new Date().toISOString(),
      mode: PATCH_MODE ? 'patch' : 'report',
      sampleSize: SAMPLE_SIZE,
      referenceYear: REFERENCE_YEAR,
      acsVintage: 'acs5 2023 release (covers 2019-2023)',
    },
    summary: {
      citiesAudited: keysToCheck.length,
      populationMatched: popMatched,
      ageMatched: ageMatched,
      populationDiscrepancies: discrepancies.population.length,
      ageDiscrepancies: discrepancies.avgHomeAge.length,
      unmatched: discrepancies.unmatched.length,
    },
    discrepancies,
  }, null, 2), 'utf8');

  console.log('Audit summary:');
  console.log(`  Cities audited: ${keysToCheck.length}`);
  console.log(`  Population: ${popMatched} matched, ${discrepancies.population.length} discrepancies (>5% diff)`);
  console.log(`  avgHomeAge: ${ageMatched} matched, ${discrepancies.avgHomeAge.length} discrepancies (>5 yr diff)`);
  console.log(`  Unmatched (name lookup failed): ${discrepancies.unmatched.length}`);
  console.log(`  Worst population gaps: ${discrepancies.population.slice(0, 5).map(d => `${d.key} ${d.diffPct}%`).join(', ')}`);
  console.log(`  Worst age gaps: ${discrepancies.avgHomeAge.slice(0, 5).map(d => `${d.key} ${d.diff}yr`).join(', ')}`);
  console.log('');
  console.log(`Report written: ${reportPath}`);

  if (!PATCH_MODE) {
    console.log('\nReview the report. To apply patches, run again with --patch.');
    return;
  }

  // PATCH MODE — back up files and write fixes
  console.log('\n=== APPLYING PATCHES ===');
  fs.copyFileSync(MULT_PATH, MULT_PATH + `.bak-${ts}`);
  fs.copyFileSync(CTX_PATH, CTX_PATH + `.bak-${ts}`);
  console.log(`Backups: ${MULT_PATH}.bak-${ts} and ${CTX_PATH}.bak-${ts}`);

  let popPatches = 0;
  for (const d of discrepancies.population) {
    multipliers[d.key].population = d.census;
    popPatches++;
  }
  let agePatches = 0;
  for (const d of discrepancies.avgHomeAge) {
    if (context[d.key]) {
      context[d.key].avgHomeAge = d.expectedAge;
      agePatches++;
    }
  }
  fs.writeFileSync(MULT_PATH, JSON.stringify(multipliers, null, 2), 'utf8');
  fs.writeFileSync(CTX_PATH, JSON.stringify(context, null, 2), 'utf8');
  console.log(`Patched: ${popPatches} population, ${agePatches} avgHomeAge.`);
})();
