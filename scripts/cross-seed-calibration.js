#!/usr/bin/env node
/**
 * cross-seed-calibration.js
 *
 * Populates calibration data from TruePrice's own pricing models.
 * Reads city multipliers + pricing models, computes mid-price estimates,
 * and POSTs them to the calibration API as admin-level seed data.
 *
 * Usage:
 *   CAL_ADMIN_KEY=xxxx node scripts/cross-seed-calibration.js [--dry-run] [--service=roofing] [--max=100]
 *
 * Flags:
 *   --dry-run         Print what would be seeded without calling the API
 *   --service=NAME    Only seed a single service (roofing, hvac, plumbing, electrical, solar)
 *   --max=N           Limit to N cities total
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_HOST = 'truepricehq.com';
const API_PATH = '/api/calibration';
const RATE_LIMIT_MS = 200;
const SAVE_EVERY = 10;

const DATA_DIR = path.join(__dirname, '..', 'data');
const TRACKING_FILE = path.join(DATA_DIR, 'seeded-model-ids.json');

const SERVICES = ['roofing', 'hvac', 'plumbing', 'electrical', 'solar'];

const SERVICE_FILES = {
  roofing: 'pricing-model.json',
  hvac: 'hvac-pricing-model.json',
  plumbing: 'plumbing-pricing-model.json',
  electrical: 'electrical-pricing-model.json',
  solar: 'solar-pricing-model.json',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8'));
}

function smartRound(value) {
  if (value >= 1000) return Math.round(value / 100) * 100;
  return Math.round(value / 50) * 50;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadTracking() {
  try {
    return JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveTracking(data) {
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Mid-price compute functions (mirrors widget-data.js logic)
// ---------------------------------------------------------------------------

function midRoofing(model, mult) {
  const roofSquares = 24;
  const waste = model.wasteFactor || 1.1;
  const overhead = model.overheadMultiplier || 1.12;
  // Use architectural shingles as the "typical" material
  const base = model.basePricePerSquare.architectural || model.basePricePerSquare.asphalt || 500;
  const total = base * roofSquares * waste * mult * overhead;
  return smartRound(total);
}

function midHvac(model, mult) {
  const tons = 2.5;
  const overhead = model.overheadMultiplier || 1.15;
  // Use full_system 16_seer as "typical"
  const sys = model.basePriceBySystem.full_system;
  const seerKey = '16_seer_90_afue';
  const price = sys.pricePerTon[seerKey] || Object.values(sys.pricePerTon)[0];
  const total = price * tons * mult * overhead;
  return smartRound(total);
}

function midPlumbing(model, mult) {
  const overhead = model.overheadMultiplier || 1.15;
  // Use water_heater as the representative project
  const svc = model.basePriceByService.water_heater;
  const priceObj = svc.priceByType || svc.priceByMaterial || svc.priceByMethod;
  const prices = Object.values(priceObj);
  const mid = prices.reduce((a, b) => a + b, 0) / prices.length;
  return smartRound(mid * mult * overhead);
}

function midElectrical(model, mult) {
  const overhead = model.overheadMultiplier || 1.15;
  // Use panel_upgrade as the representative project
  const svc = model.basePriceByService.panel_upgrade;
  const mid = (svc.low + svc.high) / 2;
  return smartRound(mid * mult * overhead);
}

function midSolar(model, mult) {
  const watts = 10000;
  const overhead = model.overheadMultiplier || 1.15;
  // Use monocrystalline or first entry as typical
  const types = model.pricePerWatt;
  const key = types.monocrystalline ? 'monocrystalline' : Object.keys(types)[0];
  const t = types[key];
  const mid = ((t.low + t.high) / 2) * watts * mult * overhead;
  return smartRound(mid);
}

const MID_COMPUTE = {
  roofing: midRoofing,
  hvac: midHvac,
  plumbing: midPlumbing,
  electrical: midElectrical,
  solar: midSolar,
};

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

function apiGet(city, state, service) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ city, state, service });
    const options = {
      hostname: API_HOST,
      path: `${API_PATH}?${params}`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ hasCalibration: false }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('GET timeout')); });
    req.end();
  });
}

function apiPost(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: API_HOST,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('POST timeout')); });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, service: null, max: Infinity };
  for (const arg of args) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--service=')) opts.service = arg.split('=')[1];
    else if (arg.startsWith('--max=')) opts.max = parseInt(arg.split('=')[1], 10);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  const adminKey = process.env.CAL_ADMIN_KEY;

  if (!adminKey && !opts.dryRun) {
    console.error('ERROR: CAL_ADMIN_KEY env var is required (or use --dry-run)');
    process.exit(1);
  }

  // Determine which services to seed
  const services = opts.service ? [opts.service] : SERVICES;
  for (const s of services) {
    if (!SERVICE_FILES[s]) {
      console.error(`ERROR: Unknown service "${s}". Valid: ${SERVICES.join(', ')}`);
      process.exit(1);
    }
  }

  // Load data
  const cityMultipliers = loadJson('city-cost-multipliers.json');
  const models = {};
  for (const s of services) {
    models[s] = loadJson(SERVICE_FILES[s]);
  }

  const tracking = loadTracking();
  const cities = Object.keys(cityMultipliers);

  console.log(`Cities: ${cities.length} | Services: ${services.join(', ')} | Max: ${opts.max === Infinity ? 'all' : opts.max}`);
  if (opts.dryRun) console.log('DRY RUN -- no API calls will be made\n');

  let seeded = 0;
  let skippedTracking = 0;
  let skippedRemote = 0;
  let errors = 0;
  let sinceLastSave = 0;
  let cityCount = 0;

  for (const cityKey of cities) {
    if (cityCount >= opts.max) break;
    cityCount++;

    const [city, stateCode] = cityKey.split('|');
    const cityData = cityMultipliers[cityKey];

    for (const service of services) {
      const trackingId = `${city.toLowerCase()}|${stateCode}|${service}`;

      // 1. Check local tracking file
      if (tracking[trackingId]) {
        skippedTracking++;
        continue;
      }

      // 2. Get the service-specific multiplier (fall back to general multiplier)
      const svcMults = cityData.serviceMultipliers || {};
      const mult = svcMults[service] || cityData.multiplier || 1.0;

      // 3. Compute mid-price
      const computeFn = MID_COMPUTE[service];
      const midPrice = computeFn(models[service], mult);

      if (!midPrice || midPrice <= 0) {
        console.log(`  SKIP ${city}, ${stateCode} [${service}] -- computed price is 0`);
        continue;
      }

      // 4. Check remote API for existing calibration
      if (!opts.dryRun) {
        try {
          const remote = await apiGet(city, stateCode, service);
          if (remote.hasCalibration) {
            skippedRemote++;
            tracking[trackingId] = true;
            sinceLastSave++;
            if (sinceLastSave >= SAVE_EVERY) {
              saveTracking(tracking);
              sinceLastSave = 0;
            }
            continue;
          }
        } catch (err) {
          console.log(`  WARN: GET check failed for ${city}, ${stateCode} [${service}]: ${err.message}`);
          // Continue to try seeding anyway
        }
        await sleep(RATE_LIMIT_MS);
      }

      // 5. Seed
      if (opts.dryRun) {
        console.log(`  SEED ${city}, ${stateCode} [${service}] = $${midPrice.toLocaleString()}`);
        seeded++;
        continue;
      }

      const payload = {
        price: midPrice,
        city,
        stateCode,
        service,
        material: 'typical',
        adminKey,
        source: 'model_seed',
        notes: `Auto-seeded from pricing model. Mult=${mult.toFixed(3)}`,
      };

      try {
        const resp = await apiPost(payload);
        if (resp.status === 200 && resp.body.ok) {
          console.log(`  SEED ${city}, ${stateCode} [${service}] = $${midPrice.toLocaleString()} (trust=${resp.body.trustScore})`);
          seeded++;
          tracking[trackingId] = true;
          sinceLastSave++;
        } else {
          console.log(`  FAIL ${city}, ${stateCode} [${service}] -- ${resp.status}: ${JSON.stringify(resp.body)}`);
          errors++;
        }
      } catch (err) {
        console.log(`  ERROR ${city}, ${stateCode} [${service}] -- ${err.message}`);
        errors++;
      }

      // Save progress periodically
      if (sinceLastSave >= SAVE_EVERY) {
        saveTracking(tracking);
        sinceLastSave = 0;
      }

      await sleep(RATE_LIMIT_MS);
    }

    // Progress line every 50 cities
    if (cityCount % 50 === 0) {
      console.log(`... ${cityCount}/${Math.min(cities.length, opts.max)} cities processed (${seeded} seeded, ${skippedTracking + skippedRemote} skipped)`);
    }
  }

  // Final save
  saveTracking(tracking);

  console.log('\n--- Summary ---');
  console.log(`Cities processed: ${cityCount}`);
  console.log(`Seeded:           ${seeded}`);
  console.log(`Skipped (local):  ${skippedTracking}`);
  console.log(`Skipped (remote): ${skippedRemote}`);
  console.log(`Errors:           ${errors}`);
  console.log(`Tracking file:    ${TRACKING_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
