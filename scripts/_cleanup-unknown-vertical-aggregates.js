#!/usr/bin/env node
// scripts/_cleanup-unknown-vertical-aggregates.js
//
// Scans every cal:* aggregate and deletes any whose trailing
// vertical slug isn't in the KNOWN_VERTICALS allowlist from
// api/_quote-input-guard.js. These are residual cruft from
// pre-guard bypass writes (e.g. cal:austin:TX:other / general /
// flooring captured pre-2026-05-26).
//
// Usage:
//   node scripts/_cleanup-unknown-vertical-aggregates.js              # DRY RUN
//   node scripts/_cleanup-unknown-vertical-aggregates.js --commit     # delete

const { Redis } = require("@upstash/redis");
const fs = require("fs");

try {
  const envText = fs.readFileSync(".env.local", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
} catch (e) {
  console.error("[cleanup] cannot read .env.local:", e.message);
  process.exit(1);
}

const commit = process.argv.includes("--commit");
const tokenKey = commit ? "KV_REST_API_TOKEN" : "KV_REST_API_READ_ONLY_TOKEN";
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env[tokenKey]
});

// Must stay in sync with api/_quote-input-guard.js
const KNOWN_VERTICALS = new Set([
  "hvac", "plumbing", "roofing", "electrical", "solar", "windows",
  "siding", "painting", "garage-doors", "garage-door", "fencing",
  "concrete", "landscaping", "foundation", "insulation", "gutters",
  "kitchen", "kitchen-remodel", "moving", "auto-repair", "medical",
  "legal"
]);

async function scanCalKeys() {
  const keys = [];
  let cursor = 0;
  do {
    const [next, batch] = await redis.scan(cursor, { match: "cal:*", count: 500 });
    cursor = Number(next);
    for (const k of batch) {
      // skip non-aggregate keys
      if (k.startsWith("cal_quote:") || k.startsWith("cal_rate:") || k.startsWith("cal_dup:")) continue;
      keys.push(k);
    }
  } while (cursor !== 0);
  return keys;
}

function extractVertical(key) {
  // cal:<city>:<state>:<vertical>           or
  // cal:<city>:<state>:<vertical>:<repair>  or
  // cal:metro:<state>:<vertical>            or
  // cal:metro:<state>:<vertical>:<repair>
  const parts = key.split(":");
  if (parts.length < 4) return null;
  return parts[3];
}

async function main() {
  console.log(commit ? "=== LIVE CLEANUP ===" : "=== DRY RUN (use --commit to delete) ===");
  console.log("");

  const allKeys = await scanCalKeys();
  console.log(`Scanned ${allKeys.length} cal:* aggregate keys`);

  const unknownVerticalKeys = [];
  for (const k of allKeys) {
    const v = extractVertical(k);
    if (!v) continue;
    if (!KNOWN_VERTICALS.has(v.toLowerCase())) {
      unknownVerticalKeys.push({ key: k, vertical: v });
    }
  }

  console.log(`Unknown-vertical aggregates found: ${unknownVerticalKeys.length}`);
  console.log("");

  for (const { key, vertical } of unknownVerticalKeys) {
    const raw = await redis.get(key);
    const agg = typeof raw === "string" ? JSON.parse(raw) : raw;
    console.log(`  ${key}`);
    console.log(`    vertical=${vertical} quotes=${agg?.quotes ?? "?"} avgPrice=$${agg?.avgPrice?.toLocaleString() ?? "?"}`);
    if (commit) {
      await redis.del(key);
      console.log(`    DELETED`);
    } else {
      console.log(`    (dry run, not deleted)`);
    }
  }

  console.log("");
  if (!commit) {
    console.log(`To commit: node scripts/_cleanup-unknown-vertical-aggregates.js --commit`);
  } else {
    console.log(`Deleted ${unknownVerticalKeys.length} unknown-vertical aggregates.`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
