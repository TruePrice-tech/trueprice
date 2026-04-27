// /api/email-digest-cron
//
// Monthly digest fan-out. For each opted-in subscriber, compose a personalized
// digest of cal:* deltas across the buckets they signed up for, send via Resend.
//
// Auth: Bearer ${CRON_SECRET} — same as pricing-drift-check. Fail closed if not configured.
//
// Throttle:
//   - Hard cap of 80 sends per run (Resend free tier 100/day, leave 20 headroom for transactional).
//   - Skip a user if `lastDigestSent` < 25 days ago (defense against double-runs).
//   - Skip a user if no meaningful change across any of their interests.
//
// Side effects per send:
//   - Updates record.lastDigestSent
//   - Writes daily counter `tp:email_digests_sent:{YYYY-MM-DD}`
//
// Query params:
//   - dryRun=1   compose digests but don't send and don't mutate records
//   - to=<email> only target one address (admin preview)
//
// Cron schedule defined in vercel.json (1st of month, 14:00 UTC).

import { Redis } from "@upstash/redis";
import { sendEmail } from "./_email-send.js";
import { digestTemplate } from "./_email-templates.js";

const redis = Redis.fromEnv();

const SEND_CAP_PER_RUN = 80;
const MIN_DAYS_BETWEEN_DIGESTS = 25;
const HISTORY_KEY_PREFIX = "tp:drift_history:";

function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function todayUtc() {
  return new Date().toISOString().substring(0, 10);
}

async function changeForInterest({ city, stateCode, service }) {
  const key = `cal:${city}:${stateCode}:${service}`.toLowerCase();
  let calRaw;
  try {
    calRaw = await redis.get(key);
  } catch {
    return null;
  }
  if (!calRaw) return null;
  const cal = typeof calRaw === "string" ? JSON.parse(calRaw) : calRaw;
  const currentAvg = Number(cal.avgPrice) || 0;
  const currentQuotes = Number(cal.quotes) || 0;
  if (currentAvg <= 0) return null;

  let histRaw = [];
  try {
    histRaw = (await redis.lrange(HISTORY_KEY_PREFIX + key, 0, 7)) || [];
  } catch {
    return null;
  }
  const history = histRaw
    .map((x) => (typeof x === "string" ? JSON.parse(x) : x))
    .filter((h) => h && Number.isFinite(Number(h.avgPrice)));

  // Use prior 4 weekly snapshots as baseline, excluding today's snapshot.
  const today = todayUtc();
  const priors = history.filter((h) => h.date !== today).slice(0, 4).map((h) => Number(h.avgPrice));
  if (priors.length < 2) return null; // need at least 2 weeks of history
  const baseline = median(priors);
  if (!baseline || baseline <= 0) return null;
  const deviation = (currentAvg - baseline) / baseline;
  return { currentAvg, baseline, deviation, currentQuotes };
}

async function buildDigestForUser(record) {
  const interests = record.interests || [];
  const enriched = [];
  for (const it of interests) {
    const change = await changeForInterest(it);
    enriched.push({ ...it, change });
  }
  const tpl = digestTemplate({ interests: enriched });
  return tpl; // null if no meaningful changes
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) {
    console.error("[email-digest-cron] CRON_SECRET not configured");
    return res.status(503).json({ error: "CRON_SECRET not configured" });
  }
  if (auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";
  const onlyEmail = req.query.to ? String(req.query.to).toLowerCase().trim() : null;

  const summary = {
    scanned: 0,
    sent: 0,
    skippedSuppressed: 0,
    skippedRecent: 0,
    skippedNoChanges: 0,
    skippedUnsubscribed: 0,
    skippedNoSendInfra: 0,
    failed: 0,
    capped: false,
    dryRun,
  };

  let hashes = [];
  try {
    hashes = await redis.smembers("tp:email_index");
  } catch (e) {
    return res.status(500).json({ error: "Redis index read failed", detail: e.message });
  }

  for (const emailHash of hashes) {
    if (summary.sent >= SEND_CAP_PER_RUN) {
      summary.capped = true;
      break;
    }
    summary.scanned++;

    let record;
    try {
      const raw = await redis.get(`tp:email:${emailHash}`);
      if (!raw) continue;
      record = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      continue;
    }

    if (record.unsubscribed) { summary.skippedUnsubscribed++; continue; }

    if (onlyEmail && String(record.email || "").toLowerCase() !== onlyEmail) continue;

    try {
      const suppressed = await redis.get(`tp:email_suppression:${emailHash}`);
      if (suppressed) { summary.skippedSuppressed++; continue; }
    } catch { /* fail open */ }

    if (record.lastDigestSent) {
      const daysSince = (Date.now() - Number(record.lastDigestSent)) / (24 * 3600 * 1000);
      if (daysSince < MIN_DAYS_BETWEEN_DIGESTS) { summary.skippedRecent++; continue; }
    }

    const tpl = await buildDigestForUser(record);
    if (!tpl) { summary.skippedNoChanges++; continue; }

    if (dryRun) {
      summary.sent++; // counts as "would send"
      continue;
    }

    const result = await sendEmail({
      to: record.email,
      subject: tpl.subject,
      html: tpl.html,
      emailHash,
      replyTo: "hello@woogoro.com",
    });

    if (result.ok) {
      summary.sent++;
      record.lastDigestSent = Date.now();
      try {
        await redis.set(`tp:email:${emailHash}`, JSON.stringify(record));
      } catch { /* swallow — duplicate sends gated by 25-day window anyway */ }
    } else if (result.reason === "no_postal_address" || result.reason === "no_api_key") {
      summary.skippedNoSendInfra++;
      // Whole run is bust — break out, don't keep iterating.
      break;
    } else {
      summary.failed++;
      console.error(`[email-digest-cron] send failed for ${emailHash.slice(0,8)}…: ${result.reason}`);
    }
  }

  if (!dryRun && summary.sent > 0) {
    try {
      const dayKey = `tp:email_digests_sent:${todayUtc()}`;
      await redis.incrby(dayKey, summary.sent);
      await redis.expire(dayKey, 100 * 24 * 3600);
    } catch { /* swallow */ }
  }

  return res.status(200).json({ ok: true, ...summary });
}
