#!/usr/bin/env node
/**
 * Recompute tp:real_quote_count — the honest homepage number.
 *
 *   node scripts/recompute-real-quote-count.js          # report only
 *   node scripts/recompute-real-quote-count.js --write  # report + write the key
 *
 * Counts DISTINCT quotes actually submitted by humans:
 *   - excludes source "verified_seed" (admin bootstrap rows, ip "admin")
 *   - dedupes on contractor + price + size + city + state, because the same
 *     fixture re-uploaded during testing is one quote, not N
 *
 * Why this exists: tp:total_quotes is a monotonic INCR written by 7 endpoints.
 * It reached 6,756 against ~59 real distinct submissions — it had counted the
 * 5,622 admin seeds written before calibration.js gated the INCR, and it never
 * decrements. The homepage rendered that as "6,909 quotes checked". See
 * api/analytics.js (counter branch) for the full writeup.
 *
 * Safe to run repeatedly. Only ever writes tp:real_quote_count.
 */
const fs = require('fs');
const path = require('path');

for (const f of ['.env', '.env.local']) {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, '');
    if (v) process.env[m[1]] = v;
  }
}

const URL = process.env.KV_REST_API_URL;
const TOK = process.env.KV_REST_API_TOKEN;
const SEED_SOURCES = new Set(['verified_seed']);

async function cmd(args) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

function fingerprint(r) {
  return [r.contractor, r.price, r.roofSize || r.size || '', r.city, r.stateCode]
    .map((x) => String(x == null ? '' : x).trim().toLowerCase())
    .join('|');
}

function isGarbage(r) {
  if (!r.contractor || /not detected/i.test(r.contractor)) return true;
  if (!r.city || /^[^A-Za-z]/.test(String(r.city))) return true;
  return false;
}

(async () => {
  if (!URL || !TOK) { console.error('missing KV_REST_API_URL / KV_REST_API_TOKEN'); process.exit(1); }

  let cursor = '0', keys = [], guard = 0;
  do {
    const [next, batch] = await cmd(['scan', cursor, 'match', 'cal_quote:*', 'count', '1000']);
    cursor = next; keys.push(...batch);
  } while (cursor !== '0' && ++guard < 200);

  const vals = [];
  for (let i = 0; i < keys.length; i += 200) vals.push(...await cmd(['mget', ...keys.slice(i, i + 200)]));

  const recs = vals.map((v) => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
  const real = recs.filter((r) => !SEED_SOURCES.has(r.source));
  const distinct = new Set(real.map(fingerprint));
  const clean = new Set(real.filter((r) => !isGarbage(r)).map(fingerprint));

  console.log(`cal_quote:* rows        ${recs.length}`);
  console.log(`  seeded (excluded)     ${recs.length - real.length}`);
  console.log(`  real (human-submitted)${String(real.length).padStart(6)}`);
  console.log(`  real, DISTINCT        ${String(distinct.size).padStart(6)}   <- tp:real_quote_count`);
  console.log(`  real, distinct, clean ${String(clean.size).padStart(6)}   (usable contractor + city)`);

  const legacy = await cmd(['get', 'tp:total_quotes']);
  console.log(`\nlegacy tp:total_quotes  ${legacy}  (no longer read by the public counter)`);

  if (process.argv.includes('--write')) {
    await cmd(['set', 'tp:real_quote_count', String(distinct.size)]);
    console.log(`\nwrote tp:real_quote_count = ${distinct.size}`);
    console.log(distinct.size < 100
      ? 'below the homepage MIN_DISPLAY of 100 — the counter will stay hidden. Correct.'
      : 'above MIN_DISPLAY — the counter will render this number.');
  } else {
    console.log('\n(dry run — pass --write to set the key)');
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
