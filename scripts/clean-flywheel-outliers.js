/**
 * Clean flywheel calibration data: reset cal:* keys where avgPrice
 * is outside realistic residential ranges.
 *
 * Usage:
 *   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node scripts/clean-flywheel-outliers.js
 *   Add --dry-run to preview without changing anything.
 */

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const PRICE_GUARDS = {
  roofing:     { min: 2000,  max: 35000 },
  hvac:        { min: 1500,  max: 25000 },
  plumbing:    { min: 150,   max: 20000 },
  electrical:  { min: 100,   max: 25000 },
  solar:       { min: 5000,  max: 80000 },
  windows:     { min: 1000,  max: 60000 },
  painting:    { min: 500,   max: 30000 },
  landscaping: { min: 500,   max: 80000 },
  fencing:     { min: 500,   max: 30000 },
  concrete:    { min: 500,   max: 30000 },
  foundation:  { min: 1000,  max: 50000 },
  gutters:     { min: 500,   max: 15000 },
  insulation:  { min: 500,   max: 20000 },
  kitchen:     { min: 3000,  max: 100000 },
  siding:      { min: 2000,  max: 40000 },
  "garage-door": { min: 300, max: 10000 },
  moving:      { min: 200,   max: 25000 },
  auto:        { min: 50,    max: 15000 },
  medical:     { min: 50,    max: 500000 },
  legal:       { min: 100,   max: 100000 },
};

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(dryRun ? "=== DRY RUN ===" : "=== LIVE CLEANUP ===");

  // Scan all cal:* keys
  let cursor = 0;
  let totalScanned = 0;
  let totalBad = 0;
  let totalDeleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: "cal:*", count: 100 });
    cursor = Number(nextCursor);

    for (const key of keys) {
      totalScanned++;
      try {
        const raw = await redis.get(key);
        if (!raw) continue;
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!data.avgPrice) continue;

        // Extract service from key: cal:city:ST:service or cal:metro:ST:service
        const parts = key.split(":");
        const service = parts.length >= 4 ? parts[3] : null;
        if (!service) continue;

        const guard = PRICE_GUARDS[service];
        if (!guard) continue;

        if (data.avgPrice < guard.min || data.avgPrice > guard.max) {
          totalBad++;
          console.log(`BAD: ${key} avgPrice=$${data.avgPrice} quotes=${data.quotes} (range: $${guard.min}-$${guard.max})`);
          if (!dryRun) {
            await redis.del(key);
            totalDeleted++;
            console.log(`  DELETED`);
          }
        }
      } catch (e) {
        console.log(`ERR reading ${key}: ${e.message}`);
      }
    }
  } while (cursor !== 0);

  console.log(`\nScanned: ${totalScanned} keys`);
  console.log(`Bad data: ${totalBad}`);
  console.log(`Deleted: ${totalDeleted}`);
}

main().catch(e => { console.error(e); process.exit(1); });
