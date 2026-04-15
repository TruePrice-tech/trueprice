#!/usr/bin/env node
/**
 * Generate and optionally post tweet drafts for @truepricehq.
 *
 * Sources (in priority order):
 *   1. Live calibration data from Upstash Redis (cal:* keys) — real quote aggregates
 *   2. Static pricing models (data/*-pricing-model.json) — baseline ranges
 *
 * Output:
 *   - Appends drafts to out/tweet-drafts.md (dated section) for manual review
 *   - Writes structured drafts to out/latest-drafts.json (overwritten each run)
 *
 * Env (optional, for live Redis data):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Env (required for --verify / --post):
 *   X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 *
 * Usage:
 *   node scripts/tweet-drafts.js                   # generate 5 drafts, write to files
 *   node scripts/tweet-drafts.js --count 10        # generate 10 drafts
 *   node scripts/tweet-drafts.js --verify          # test X credentials (no posting)
 *   node scripts/tweet-drafts.js --post 2          # post draft #2 from latest batch
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Auto-load .env.local (created by `vercel env pull`) so local runs pick up
// Vercel-managed env vars without requiring extra CLI flags.
(function loadDotenvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
})();
const DATA_DIR = path.join(ROOT, "data");
const OUT_DIR = path.join(ROOT, "out");
const OUT_FILE = path.join(OUT_DIR, "tweet-drafts.md");
const LATEST_JSON = path.join(OUT_DIR, "latest-drafts.json");

const args = process.argv.slice(2);
const countIdx = args.indexOf("--count");
const DRAFT_COUNT = countIdx >= 0 ? parseInt(args[countIdx + 1], 10) || 5 : 5;
const VERIFY = args.includes("--verify");
const postIdx = args.indexOf("--post");
const POST_N = postIdx >= 0 ? parseInt(args[postIdx + 1], 10) : null;

const TOP_METROS = [
  { city: "Austin", state: "TX" },
  { city: "Phoenix", state: "AZ" },
  { city: "Houston", state: "TX" },
  { city: "Dallas", state: "TX" },
  { city: "Chicago", state: "IL" },
  { city: "Denver", state: "CO" },
  { city: "Atlanta", state: "GA" },
  { city: "Charlotte", state: "NC" },
  { city: "Nashville", state: "TN" },
  { city: "Seattle", state: "WA" },
  { city: "Portland", state: "OR" },
  { city: "San Diego", state: "CA" },
  { city: "Orlando", state: "FL" },
  { city: "Tampa", state: "FL" },
  { city: "Minneapolis", state: "MN" },
];

// Verticals usable for BOTH live calibration and static fallback.
// Live-only verticals (unlocked when Redis is configured) can still appear via calibration.
const VERTICALS = [
  { key: "hvac", label: "HVAC replacement", slugPath: "hvac-quote-analyzer.html" },
  { key: "roofing", label: "roof replacement", slugPath: "roofing-quote-analyzer.html" },
  { key: "plumbing", label: "plumbing work", slugPath: "plumbing-quote-analyzer.html" },
  { key: "electrical", label: "electrical work", slugPath: "electrical-quote-analyzer.html" },
  { key: "solar", label: "solar installation", slugPath: "solar-quote-analyzer.html" },
  { key: "windows", label: "window replacement", slugPath: "window-quote-analyzer.html" },
  { key: "siding", label: "siding", slugPath: "siding-quote-analyzer.html" },
  { key: "painting", label: "exterior painting", slugPath: "painting-quote-analyzer.html" },
  { key: "fencing", label: "fence install", slugPath: "fencing-quote-analyzer.html" },
  { key: "concrete", label: "concrete work", slugPath: "concrete-quote-analyzer.html" },
];

// Only these have clean project-total ranges + stateMultipliers for the static fallback path.
// Others rely on Redis calibration data for accurate ranges.
const STATIC_SAFE_VERTICALS = new Set(["hvac", "roofing"]);

function slugifyCity(city) {
  return city.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
}

function citySlugForUrl(city, state) {
  return `${city.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${state.toLowerCase()}`;
}

function fmtPrice(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

async function loadCalibrationData() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  let Redis;
  try { ({ Redis } = require("@upstash/redis")); }
  catch { return null; }

  const redis = new Redis({ url, token });
  const calKeys = [];
  let cursor = 0;
  // Scan for cal:* keys. Upstash SCAN uses { cursor, match, count }.
  for (let i = 0; i < 50; i++) {
    const [next, batch] = await redis.scan(cursor, { match: "cal:*", count: 200 });
    calKeys.push(...batch);
    cursor = Number(next);
    if (!cursor) break;
  }

  const entries = [];
  for (const key of calKeys) {
    try {
      const raw = await redis.get(key);
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data || !data.avgPrice || !data.quotes) continue;
      const [, cityLc, state, service, repairKey] = key.split(":");
      entries.push({ key, cityLc, state, service, repairKey, ...data });
    } catch { /* skip */ }
  }
  return entries;
}

function draftFromCalibration(entry) {
  const { cityLc, state, service, avgPrice, quotes } = entry;
  const readableCity = cityLc.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const vert = VERTICALS.find((v) => v.key === service) || { label: service, slugPath: "" };
  const analyzerUrl = vert.slugPath ? `https://truepricehq.com/${vert.slugPath}` : "https://truepricehq.com";
  const overchargeThreshold = Math.round(avgPrice * 1.3);
  return [
    `Fair ${vert.label} price in ${readableCity}, ${state}: about ${fmtPrice(avgPrice)}.`,
    `Based on ${quotes} real quote${quotes === 1 ? "" : "s"} from homeowners in the area.`,
    `If your quote is over ${fmtPrice(overchargeThreshold)}, check it here: ${analyzerUrl}`,
  ].join("\n\n");
}

function draftFromStatic(metro, vertical) {
  // Try both naming conventions: -pricing-model.json and -pricing.json
  const candidates = [
    path.join(DATA_DIR, `${vertical.key}-pricing-model.json`),
    path.join(DATA_DIR, `${vertical.key}-pricing.json`),
  ];
  const modelPath = candidates.find((p) => fs.existsSync(p));
  if (!modelPath) return null;
  let model;
  try { model = JSON.parse(fs.readFileSync(modelPath, "utf8")); }
  catch { return null; }

  const mult = model.stateMultipliers?.[metro.state] ?? 1.0;
  const totalRange = findFirstTotal(model);
  if (!totalRange) return null;
  const lo = Math.round(totalRange[0] * mult);
  const hi = Math.round(totalRange[1] * mult);
  const citySlug = citySlugForUrl(metro.city, metro.state);
  const costSlug = vertical.key === "roofing" ? "roof" : vertical.key;
  return [
    `Fair ${vertical.label} range in ${metro.city}, ${metro.state}: ${fmtPrice(lo)} to ${fmtPrice(hi)}.`,
    `Got a quote outside that range? Something's off. Check scope, warranty, and brand tier first.`,
    `Full breakdown: https://truepricehq.com/${citySlug}-${costSlug}-cost.html`,
  ].join("\n\n");
}

function findFirstTotal(node, depth = 0) {
  if (depth > 6 || !node || typeof node !== "object") return null;
  if (Array.isArray(node) && node.length === 2 && typeof node[0] === "number" && typeof node[1] === "number") return node;
  for (const key of Object.keys(node)) {
    if (key === "total" && Array.isArray(node[key]) && node[key].length === 2) return node[key];
  }
  for (const key of Object.keys(node)) {
    const r = findFirstTotal(node[key], depth + 1);
    if (r) return r;
  }
  return null;
}

function pickDistinct(arr, n) {
  const pool = [...arr];
  const out = [];
  while (pool.length && out.length < n) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function getXClient() {
  const required = ["X_API_KEY", "X_API_KEY_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}. Set them in Vercel or pull via 'vercel env pull .env.local' and re-run.`);
  }
  const { TwitterApi } = require("twitter-api-v2");
  return new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_KEY_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });
}

async function verifyCredentials() {
  const client = getXClient();
  const me = await client.v2.me();
  console.log(`✓ X credentials valid. Authenticated as @${me.data.username} (${me.data.name}), id ${me.data.id}.`);
}

async function postDraftN(n) {
  if (!fs.existsSync(LATEST_JSON)) {
    throw new Error(`No drafts found. Run 'node scripts/tweet-drafts.js' first, then 'node scripts/tweet-drafts.js --post ${n}'.`);
  }
  const batch = JSON.parse(fs.readFileSync(LATEST_JSON, "utf8"));
  if (!n || n < 1 || n > batch.drafts.length) {
    throw new Error(`--post expects 1..${batch.drafts.length}. Got ${n}.`);
  }
  const draft = batch.drafts[n - 1];
  console.log("\nAbout to post this tweet:");
  console.log("\n" + "─".repeat(60));
  console.log(draft.text);
  console.log("─".repeat(60));
  console.log(`(source: ${draft.source}, ${draft.text.length} chars)\n`);

  const client = getXClient();
  const res = await client.v2.tweet(draft.text);
  const url = `https://x.com/truepricehq/status/${res.data.id}`;
  console.log(`✓ Posted: ${url}`);
}

async function generate() {
  const drafts = [];
  const calData = await loadCalibrationData();

  if (calData && calData.length) {
    calData.sort((a, b) => (b.quotes || 0) - (a.quotes || 0));
    for (const entry of calData.slice(0, DRAFT_COUNT)) {
      drafts.push({ source: "calibration", key: entry.key, text: draftFromCalibration(entry) });
    }
  }

  if (drafts.length < DRAFT_COUNT) {
    const combos = [];
    for (const m of TOP_METROS) {
      for (const v of VERTICALS) {
        if (STATIC_SAFE_VERTICALS.has(v.key)) combos.push({ m, v });
      }
    }
    for (const { m, v } of pickDistinct(combos, DRAFT_COUNT - drafts.length)) {
      const text = draftFromStatic(m, v);
      if (text) drafts.push({ source: "static", key: `${m.city}:${m.state}:${v.key}`, text });
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  let md = `\n## ${now}  (${drafts.length} drafts, ${calData ? calData.length : 0} calibration cells available)\n\n`;
  drafts.forEach((d, i) => {
    const chars = d.text.length;
    md += `### Draft ${i + 1} — ${d.source}${d.key ? ` (${d.key})` : ""}  \`${chars} chars\`\n\n`;
    md += d.text + "\n\n---\n\n";
  });

  fs.appendFileSync(OUT_FILE, md, "utf8");
  fs.writeFileSync(LATEST_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), drafts }, null, 2), "utf8");
  console.log(`Wrote ${drafts.length} drafts to ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`Structured batch at ${path.relative(ROOT, LATEST_JSON)} (used for --post <n>)`);
  console.log(calData ? `  (${calData.length} calibration cells read from Redis)` : "  (Redis env not set; used static pricing models)");
}

async function main() {
  if (VERIFY) return verifyCredentials();
  if (POST_N !== null) return postDraftN(POST_N);
  return generate();
}

main().catch((e) => { console.error(e); process.exit(1); });
