// /api/vertical-health
//
// Weekly cron that detects when a vertical stops receiving quotes — a real
// failure mode of the flywheel that drift-check would not catch (drift-check
// alerts on price changes, not on volume disappearing).
//
// Strategy: for each vertical, sum `quotes` and `lastUpdated` recency across
// all cal:metro:*:<vertical> aggregates. Compare current weekly delta to a
// 4-week median. Alert if a vertical's weekly intake drops >=50% or its
// freshest aggregate is older than 21 days.
//
// State written:
//   - tp:vertical_health_history:<vertical>  list of weekly snapshots (max 8)
//   - tp:vertical_health_report:<YYYY-MM-DD> full report (180-day TTL)
//
// Cron schedule: 0 12 * * 1 (Mon 12:00 UTC, runs before drift-check at 13:00).

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const HISTORY_PREFIX = "tp:vertical_health_history:";
const REPORT_PREFIX = "tp:vertical_health_report:";
const HISTORY_MAX = 8;
const QUOTE_DROP_THRESHOLD = 0.5;          // 50% drop vs 4-week median
const STALE_AGGREGATE_DAYS = 21;           // freshest aggregate older than this = vertical dead
const REPORT_TTL = 180 * 24 * 60 * 60;

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function scanCalMetro() {
  const keys = [];
  let cursor = 0;
  do {
    const [next, batch] = await redis.scan(cursor, { match: "cal:metro:*", count: 500 });
    cursor = Number(next);
    for (const k of batch) keys.push(k);
  } while (cursor !== 0);
  return keys;
}

function deriveVertical(key) {
  // cal:metro:<state>:<service>[:<repairKey>] — vertical is segment 3 (0-indexed)
  const parts = key.split(":");
  if (parts.length < 4) return null;
  return parts[3];
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) return res.status(503).json({ error: "CRON_SECRET not configured" });
  if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized" });

  const today = new Date().toISOString().substring(0, 10);
  const now = Date.now();

  const verticals = {};  // { [name]: { quotes, freshestUpdate, aggregates } }
  const keys = await scanCalMetro();

  for (const k of keys) {
    const v = deriveVertical(k);
    if (!v) continue;
    const raw = await redis.get(k);
    if (!raw) continue;
    const agg = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!verticals[v]) verticals[v] = { quotes: 0, freshestUpdate: 0, aggregates: 0 };
    verticals[v].quotes += Number(agg.quotes) || 0;
    verticals[v].aggregates += 1;
    const lu = Number(agg.lastUpdated) || 0;
    if (lu > verticals[v].freshestUpdate) verticals[v].freshestUpdate = lu;
  }

  const flags = [];
  const seeded = [];
  const ok = [];

  for (const [name, v] of Object.entries(verticals)) {
    const histKey = HISTORY_PREFIX + name;
    const histRaw = (await redis.lrange(histKey, 0, HISTORY_MAX - 1)) || [];
    const history = histRaw.map((x) => (typeof x === "string" ? JSON.parse(x) : x));

    const priorWeeks = history.filter((h) => h.date !== today).slice(0, 4);
    // Each prior week's INCREMENTAL quotes = quotes(this) - quotes(next prior)
    // Simpler heuristic: track total quotes over time, compare weekly delta.
    let weeklyDelta = null;
    if (priorWeeks.length > 0) {
      weeklyDelta = v.quotes - Number(priorWeeks[0].quotes || 0);
    }
    const priorDeltas = [];
    for (let i = 0; i < priorWeeks.length - 1; i++) {
      priorDeltas.push(Number(priorWeeks[i].quotes || 0) - Number(priorWeeks[i + 1].quotes || 0));
    }
    const baselineDelta = median(priorDeltas);

    const ageHours = v.freshestUpdate ? (now - v.freshestUpdate) / (1000 * 60 * 60) : Infinity;
    const stale = ageHours > STALE_AGGREGATE_DAYS * 24;

    let flag = null;
    if (priorWeeks.length === 0) {
      seeded.push({ vertical: name, quotes: v.quotes, aggregates: v.aggregates });
    } else if (stale) {
      flag = {
        vertical: name,
        reason: "stale",
        ageHours: Math.round(ageHours),
        quotes: v.quotes,
        aggregates: v.aggregates,
      };
    } else if (weeklyDelta !== null && baselineDelta !== null && baselineDelta > 5) {
      const dropRatio = baselineDelta > 0 ? (baselineDelta - weeklyDelta) / baselineDelta : 0;
      if (dropRatio >= QUOTE_DROP_THRESHOLD) {
        flag = {
          vertical: name,
          reason: "volume_drop",
          weeklyDelta,
          baselineDelta,
          dropRatio: Math.round(dropRatio * 100) / 100,
          quotes: v.quotes,
        };
      }
    }
    if (flag) flags.push(flag);
    else if (priorWeeks.length > 0) ok.push({ vertical: name, weeklyDelta, quotes: v.quotes });

    // Advance history
    const hasToday = history.some((h) => h.date === today);
    if (!hasToday) {
      await redis.lpush(histKey, JSON.stringify({
        date: today,
        quotes: v.quotes,
        aggregates: v.aggregates,
        freshestUpdate: v.freshestUpdate,
      }));
      await redis.ltrim(histKey, 0, HISTORY_MAX - 1);
    }
  }

  const report = {
    date: today,
    verticalsScanned: Object.keys(verticals).length,
    flags: flags.length,
    seeded: seeded.length,
    flagDetails: flags,
    seededDetails: seeded,
    ok: ok.length,
  };
  await redis.set(REPORT_PREFIX + today, JSON.stringify(report), { ex: REPORT_TTL });

  let emailStatus = "no_flags";
  if (flags.length > 0) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const rows = flags.map((f) => `<tr>
        <td style="padding:6px 12px 6px 0;font-family:monospace;">${f.vertical}</td>
        <td style="padding:6px 12px 6px 0;color:#b91c1c;font-weight:600;">${f.reason}</td>
        <td style="padding:6px 12px 6px 0;font-size:12px;color:#475569;">${f.reason === "stale" ? "freshest agg " + Math.round(f.ageHours / 24) + "d old" : "delta " + f.weeklyDelta + " vs baseline " + f.baselineDelta + " (" + Math.round(f.dropRatio * 100) + "% drop)"}</td>
      </tr>`).join("");
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Woogoro Health <noreply@woogoro.com>",
            to: ["hello@woogoro.com"],
            subject: `[Woogoro] ${flags.length} vertical health alert${flags.length === 1 ? "" : "s"} — ${today}`,
            html: `<div style="font-family:sans-serif;max-width:760px;padding:20px;">
              <h2 style="color:#b91c1c;margin:0 0 8px;">Vertical health — ${today}</h2>
              <p style="color:#475569;font-size:14px;margin:0 0 16px;">${flags.length} vertical${flags.length === 1 ? "" : "s"} flagged. Seeded: ${seeded.length}. OK: ${ok.length}.</p>
              <table style="font-size:13px;border-collapse:collapse;width:100%;">
                <thead><tr style="border-bottom:2px solid #e2e8f0;">
                  <th style="padding:8px 12px 8px 0;text-align:left;">Vertical</th>
                  <th style="padding:8px 12px 8px 0;text-align:left;">Reason</th>
                  <th style="padding:8px 12px 8px 0;text-align:left;">Detail</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`,
          }),
        });
        emailStatus = r.ok ? "sent" : ("resend_error_" + r.status);
      } catch (e) {
        emailStatus = "exception:" + e.message;
      }
    } else {
      emailStatus = "no_api_key";
    }
  }

  await redis.set("tp:cron_run:vertical-health", new Date().toISOString());

  return res.status(200).json({ ok: true, ...report, emailStatus });
}
