#!/usr/bin/env node
// scripts/_audit-drift-buckets.js
//
// One-off READ-ONLY investigation for the 2026-05-25 drift report.
// Inspects the 4 flagged cal:* aggregates, their history, and the
// underlying cal_quote:* entries that feed them, to determine whether
// the drift is (a) ingestion noise, (b) parser regression, (c) bad
// seeded data, or (d) a real market move.
//
// Uses KV_REST_API_READ_ONLY_TOKEN — no writes, no rate impact.

const { Redis } = require("@upstash/redis");
const fs = require("fs");

// Lightweight inline .env.local parser (avoid dotenv dependency).
try {
  const envText = fs.readFileSync(".env.local", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
} catch (e) {
  console.error("[audit-drift] cannot read .env.local:", e.message);
  process.exit(1);
}

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_READ_ONLY_TOKEN
});

const FLAGGED = [
  "cal:atlanta:GA:hvac",
  "cal:austin:TX:hvac",
  "cal:asheville:NC:roofing",
  "cal:atlanta:GA:roofing"
];

function parse(raw) {
  if (raw == null) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function scanQuoteKeys(prefix) {
  // cal_quote:<city>:<state>:<service>:<timestamp>
  const keys = [];
  let cursor = 0;
  do {
    const [next, batch] = await redis.scan(cursor, { match: prefix + "*", count: 500 });
    cursor = Number(next);
    for (const k of batch) keys.push(k);
  } while (cursor !== 0);
  return keys;
}

function summarize(quotes) {
  if (!quotes.length) return null;
  const prices = quotes.map((q) => Number(q.price)).filter((p) => p > 0).sort((a, b) => a - b);
  const min = prices[0];
  const max = prices[prices.length - 1];
  const median = prices[Math.floor(prices.length / 2)];
  const mean = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const bySource = {};
  for (const q of quotes) {
    const s = q.source || "unknown";
    bySource[s] = (bySource[s] || 0) + 1;
  }
  const trustBuckets = { ">=70": 0, "30-69": 0, "<30": 0 };
  for (const q of quotes) {
    const ts = Number(q.trustScore) || 0;
    if (ts >= 70) trustBuckets[">=70"]++;
    else if (ts >= 30) trustBuckets["30-69"]++;
    else trustBuckets["<30"]++;
  }
  return { count: quotes.length, min, max, median, mean, bySource, trustBuckets };
}

function timeBuckets(keys) {
  // Keys end with :<timestamp>; bucket by day.
  const days = {};
  for (const k of keys) {
    const ts = Number(k.split(":").pop());
    if (!Number.isFinite(ts)) continue;
    const day = new Date(ts).toISOString().slice(0, 10);
    days[day] = (days[day] || 0) + 1;
  }
  return days;
}

async function auditBucket(calKey) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(calKey);
  console.log("=".repeat(70));

  const agg = parse(await redis.get(calKey));
  console.log("AGGREGATE:", agg);

  const histRaw = (await redis.lrange("tp:drift_history:" + calKey, 0, 7)) || [];
  const history = histRaw.map(parse);
  console.log("HISTORY (most recent first):");
  for (const h of history) console.log("  ", h);

  // Derive quote-key prefix from cal key: cal:<city>:<state>:<service>
  const parts = calKey.split(":");
  const city = parts[1];
  const state = parts[2];
  const service = parts[3];
  const quotePrefix = `cal_quote:${city}:${state}:${service}:`;

  const quoteKeys = await scanQuoteKeys(quotePrefix);
  console.log(`\nQUOTE KEYS: ${quoteKeys.length}`);

  if (quoteKeys.length === 0) return;

  const days = timeBuckets(quoteKeys);
  console.log("QUOTES BY DAY (last 10 days):");
  const sortedDays = Object.entries(days).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
  for (const [day, n] of sortedDays) console.log(`  ${day}: ${n} quotes`);

  // Fetch all quotes for source/price/trust analysis
  const quotes = [];
  for (let i = 0; i < quoteKeys.length; i += 50) {
    const batch = quoteKeys.slice(i, i + 50);
    const vals = await Promise.all(batch.map((k) => redis.get(k)));
    for (const v of vals) {
      const q = parse(v);
      if (q) quotes.push(q);
    }
  }

  const all = summarize(quotes);
  console.log("\nALL QUOTES SUMMARY:", all);

  // Slice last 7 days vs prior 28 days for comparison
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const recent = quotes.filter((q) => {
    const ts = Number(q.timestamp) || (q.lastUpdated) || 0;
    return ts >= now - 7 * day;
  });
  const prior = quotes.filter((q) => {
    const ts = Number(q.timestamp) || (q.lastUpdated) || 0;
    return ts >= now - 35 * day && ts < now - 7 * day;
  });

  console.log("\nRECENT 7 DAYS:", summarize(recent));
  console.log("PRIOR 28 DAYS (8-35 days ago):", summarize(prior));

  // Sample 5 highest-price recent quotes (likely culprits if there's a parser bug)
  const topRecent = quotes
    .map((q) => ({ price: Number(q.price), source: q.source, ts: q.timestamp, repair: q.repair, trustScore: q.trustScore }))
    .filter((q) => q.price > 0)
    .sort((a, b) => b.price - a.price)
    .slice(0, 5);
  console.log("\nTOP 5 HIGHEST-PRICE QUOTES (any time):");
  for (const q of topRecent) console.log("  ", q);
}

async function auditPricingDataLog() {
  console.log(`\n${"=".repeat(70)}`);
  console.log("tp:pricing_data (beta-quote-submit + community-quote log)");
  console.log("=".repeat(70));
  const items = (await redis.lrange("tp:pricing_data", 0, 199)) || [];
  console.log(`Total in list (sampled first 200): ${items.length}`);
  if (!items.length) return;
  const parsed = items.map(parse).filter(Boolean);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const last7 = parsed.filter((q) => (Number(q.timestamp) || Number(q.createdAt) || 0) >= now - 7 * day);
  console.log(`Of those, last 7 days: ${last7.length}`);
  // Bucket by (state, vertical) to find what's been submitted recently
  const recentByBucket = {};
  for (const q of last7) {
    const state = q.stateCode || q.state || "?";
    const vertical = q.classifiedVertical || q.declaredVertical || q.vertical || q.service || q.serviceType || "?";
    const city = q.city || "?";
    const key = `${city}|${state}|${vertical}`;
    if (!recentByBucket[key]) recentByBucket[key] = { count: 0, prices: [] };
    recentByBucket[key].count++;
    recentByBucket[key].prices.push(Number(q.declaredAmount) || Number(q.price) || 0);
  }
  const entries = Object.entries(recentByBucket).sort((a, b) => b[1].count - a[1].count).slice(0, 20);
  console.log("\nLast-7-days submissions by (city|state|vertical):");
  for (const [k, v] of entries) {
    const min = Math.min(...v.prices);
    const max = Math.max(...v.prices);
    const mean = Math.round(v.prices.reduce((a, b) => a + b, 0) / v.prices.length);
    console.log(`  ${k}: count=${v.count} mean=$${mean.toLocaleString()} range=$${min.toLocaleString()}-$${max.toLocaleString()}`);
  }
  // Spotlight the 4 flagged buckets
  console.log("\nFLAGGED BUCKETS submission detail (last 7d):");
  const flagBuckets = [
    ["atlanta", "GA", "hvac"], ["austin", "TX", "hvac"],
    ["asheville", "NC", "roofing"], ["atlanta", "GA", "roofing"]
  ];
  for (const [c, s, v] of flagBuckets) {
    const matches = last7.filter((q) => {
      const city = (q.city || "").toLowerCase();
      const state = q.stateCode || q.state || "";
      const vert = (q.classifiedVertical || q.declaredVertical || q.vertical || q.service || q.serviceType || "").toLowerCase();
      return city === c && state === s && vert === v;
    });
    console.log(`  ${c}|${s}|${v}: ${matches.length} submissions in last 7d`);
    for (const m of matches.slice(0, 5)) {
      console.log(`    $${Number(m.declaredAmount || m.price || 0).toLocaleString()} on ${new Date(Number(m.timestamp) || Number(m.createdAt)).toISOString().slice(0, 10)} contractor=${m.contractor || "?"} source=${m.source || m.kind || "?"}`);
    }
  }
}

async function main() {
  for (const k of FLAGGED) {
    try {
      await auditBucket(k);
    } catch (e) {
      console.error(`ERROR auditing ${k}:`, e.message);
    }
  }
  await auditPricingDataLog();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
