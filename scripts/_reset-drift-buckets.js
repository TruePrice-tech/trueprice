#!/usr/bin/env node
// scripts/_reset-drift-buckets.js
//
// One-off reset of the 4 cal:* aggregates that drifted in the
// 2026-05-25 incident. Restores each to its 2026-05-18 baseline
// snapshot (from tp:drift_history), wiping the polluted growth that
// came in via bypass writers (community-quote / beta-quote-submit /
// capture-quote) before the _quote-input-guard validation landed.
//
// Usage:
//   node scripts/_reset-drift-buckets.js              # DRY RUN (default)
//   node scripts/_reset-drift-buckets.js --commit     # actually write
//
// Read-only token is used for dry runs; writes require KV_REST_API_TOKEN.

const { Redis } = require("@upstash/redis");
const fs = require("fs");

// Parse .env.local inline
try {
  const envText = fs.readFileSync(".env.local", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
} catch (e) {
  console.error("[reset-drift] cannot read .env.local:", e.message);
  process.exit(1);
}

const commit = process.argv.includes("--commit");
const tokenKey = commit ? "KV_REST_API_TOKEN" : "KV_REST_API_READ_ONLY_TOKEN";
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env[tokenKey]
});

// Restoration targets — pre-spike baseline from tp:drift_history snapshots.
// avgPrice + quotes are taken from the 2026-05-18 weekly snapshot, which
// was stable for 3 prior weeks (a clean baseline). totalWeight is set to
// quotes * 0.3 (the average per-quote weight seen in pre-spike data —
// midway between scrape 0.15 and user 0.5). weightedSum derived from
// avgPrice * totalWeight so the math is self-consistent.
const TARGETS = [
  { key: "cal:atlanta:GA:hvac",     quotes: 10, avgPrice: 7652  },
  { key: "cal:austin:TX:hvac",      quotes: 7,  avgPrice: 5730  },
  { key: "cal:asheville:NC:roofing", quotes: 1,  avgPrice: 11700 },
  { key: "cal:atlanta:GA:roofing",  quotes: 4,  avgPrice: 16423 }
];

function buildResetValue({ quotes, avgPrice }) {
  const totalWeight = +(quotes * 0.3).toFixed(2);
  const weightedSum = Math.round(avgPrice * totalWeight);
  return {
    quotes,
    weightedSum,
    totalWeight,
    avgPrice,
    lastUpdated: Date.now()
  };
}

async function main() {
  console.log(commit ? "=== LIVE RESET ===" : "=== DRY RUN (use --commit to write) ===");
  console.log("");

  for (const t of TARGETS) {
    const before = await redis.get(t.key);
    const beforeParsed = typeof before === "string" ? JSON.parse(before) : before;
    const after = buildResetValue(t);

    console.log(t.key);
    console.log("  BEFORE:", beforeParsed);
    console.log("  AFTER: ", after);

    if (commit) {
      await redis.set(t.key, JSON.stringify(after));
      console.log("  WRITTEN");
    } else {
      console.log("  (dry run, not written)");
    }
    console.log("");
  }

  if (!commit) {
    console.log("To commit: node scripts/_reset-drift-buckets.js --commit");
  } else {
    console.log("Done. Next drift-check run will re-baseline against these values.");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
