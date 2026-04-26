// /api/pricing-drift-check
//
// Weekly cron that scans every cal:* aggregate bucket and flags any
// vertical/state/city where the current calibrated avgPrice has stepped
// away from its recent baseline by more than `threshold` (default 10%).
//
// Why a median-of-4 baseline instead of a long-term mean: this catches
// SUDDEN breakage (parser regression, bad seed, scraper bug) without
// false-alerting on slow legitimate drift. Once the new value persists
// for ~3 weeks the median absorbs it and alerts stop on their own.
//
// Side effects:
//   - Always appends current avgPrice to tp:drift_history:<key> (max 8 entries).
//   - Always stores a full report at tp:drift_report:<YYYY-MM-DD>.
//   - Sends one email summary to hello@woogoro.com when any flag fires.
//
// Query params (optional):
//   - dryRun=1     don't update history, don't send email — inspection only
//   - threshold=N  override default drift threshold (e.g. threshold=0.15)
//
// Cron schedule defined in vercel.json: 0 13 * * 1 (Mondays 13:00 UTC).

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const HISTORY_KEY_PREFIX = "tp:drift_history:";
const REPORT_KEY_PREFIX = "tp:drift_report:";
const HISTORY_MAX = 8;
const DEFAULT_THRESHOLD = 0.10;
const MIN_QUOTES_FOR_ALERT = 5;
const REPORT_TTL_SECONDS = 180 * 24 * 60 * 60; // keep 6 months of reports

function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function scanCalKeys() {
  // Upstash supports SCAN. Iterate cursor until 0.
  const keys = [];
  let cursor = 0;
  do {
    const [next, batch] = await redis.scan(cursor, { match: "cal:*", count: 500 });
    cursor = Number(next);
    for (const k of batch) {
      // Skip per-quote keys (cal_quote:*) and rate-limit keys (cal_rate:*, cal_dup:*)
      if (k.startsWith("cal:")) keys.push(k);
    }
  } while (cursor !== 0);
  return keys;
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (!req.headers["x-vercel-cron"]) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";
  const threshold = req.query.threshold ? Number(req.query.threshold) : DEFAULT_THRESHOLD;
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
    return res.status(400).json({ error: "threshold must be a number in (0, 1)" });
  }

  const today = new Date().toISOString().substring(0, 10);

  try {
    const calKeys = await scanCalKeys();

    const flags = [];      // alerts to email
    const seeded = [];     // first-time keys (no prior history)
    const skipped = [];    // skipped due to low volume
    const updated = [];    // history advanced, no alert

    for (const key of calKeys) {
      const raw = await redis.get(key);
      if (!raw) continue;
      const agg = typeof raw === "string" ? JSON.parse(raw) : raw;
      const currentAvg = Number(agg.avgPrice) || 0;
      const currentQuotes = Number(agg.quotes) || 0;
      if (currentAvg <= 0) continue;

      const histKey = HISTORY_KEY_PREFIX + key;
      const histRaw = (await redis.lrange(histKey, 0, HISTORY_MAX - 1)) || [];
      const history = histRaw.map((x) => (typeof x === "string" ? JSON.parse(x) : x));

      // Build baseline from prior 4 snapshots (skip current week if same day)
      const priorSnapshots = history
        .filter((h) => h.date !== today)
        .slice(0, 4)
        .map((h) => Number(h.avgPrice))
        .filter((n) => Number.isFinite(n) && n > 0);

      const baseline = median(priorSnapshots);
      const priorQuotesAvg = history
        .filter((h) => h.date !== today)
        .slice(0, 4)
        .map((h) => Number(h.quotes) || 0)
        .reduce((a, b) => a + b, 0) / Math.max(1, Math.min(4, history.filter((h) => h.date !== today).length));

      let flag = null;
      if (priorSnapshots.length === 0) {
        seeded.push({ key, currentAvg, currentQuotes });
      } else if (currentQuotes < MIN_QUOTES_FOR_ALERT) {
        skipped.push({ key, currentAvg, currentQuotes, reason: "low_volume" });
      } else {
        const deviation = (currentAvg - baseline) / baseline;
        if (Math.abs(deviation) >= threshold) {
          flag = {
            key,
            currentAvg,
            baseline,
            deviation,           // signed: positive = price went up
            currentQuotes,
            priorQuotesAvg: Math.round(priorQuotesAvg),
            volumeChange: priorQuotesAvg > 0 ? (currentQuotes - priorQuotesAvg) / priorQuotesAvg : null,
            history: priorSnapshots,
          };
          flags.push(flag);
        } else {
          updated.push({ key, currentAvg, baseline, deviation });
        }
      }

      // Advance history (unless dryRun, or unless we already snapshotted today)
      if (!dryRun) {
        const hasToday = history.some((h) => h.date === today);
        if (!hasToday) {
          await redis.lpush(
            histKey,
            JSON.stringify({ date: today, avgPrice: currentAvg, quotes: currentQuotes })
          );
          await redis.ltrim(histKey, 0, HISTORY_MAX - 1);
        }
      }
    }

    // Sort flags by absolute deviation, biggest first
    flags.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

    const report = {
      date: today,
      threshold,
      scanned: calKeys.length,
      flags: flags.length,
      seeded: seeded.length,
      skipped: skipped.length,
      updated: updated.length,
      flagDetails: flags,
      dryRun,
    };

    if (!dryRun) {
      try {
        await redis.set(
          REPORT_KEY_PREFIX + today,
          JSON.stringify(report),
          { ex: REPORT_TTL_SECONDS }
        );
      } catch (e) { /* report storage is best-effort */ }
    }

    // Email summary if any flags fired
    let emailStatus = "no_flags";
    if (flags.length > 0 && !dryRun) {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        try {
          const rows = flags.slice(0, 25).map((f) => {
            const pct = (f.deviation * 100).toFixed(1);
            const dir = f.deviation > 0 ? "▲" : "▼";
            const volPct = f.volumeChange === null ? "—" : ((f.volumeChange * 100).toFixed(0) + "%");
            return `<tr>
              <td style="padding:6px 12px 6px 0;font-family:monospace;font-size:12px;">${f.key}</td>
              <td style="padding:6px 12px 6px 0;text-align:right;color:${f.deviation > 0 ? '#b91c1c' : '#1d4ed8'};font-weight:600;">${dir} ${pct}%</td>
              <td style="padding:6px 12px 6px 0;text-align:right;">$${f.currentAvg.toLocaleString()}</td>
              <td style="padding:6px 12px 6px 0;text-align:right;color:#64748b;">$${Math.round(f.baseline).toLocaleString()}</td>
              <td style="padding:6px 12px 6px 0;text-align:right;">${f.currentQuotes} (Δ ${volPct})</td>
            </tr>`;
          }).join("");

          const body = {
            from: "Woogoro Drift <noreply@woogoro.com>",
            to: ["hello@woogoro.com"],
            subject: `[Woogoro] ${flags.length} pricing drift alert${flags.length === 1 ? "" : "s"} — ${today}`,
            html: `<div style="font-family:sans-serif;max-width:760px;padding:20px;">
              <h2 style="color:#1e293b;margin:0 0 8px;">Pricing drift report — ${today}</h2>
              <p style="color:#475569;font-size:14px;margin:0 0 16px;">
                ${flags.length} bucket${flags.length === 1 ? "" : "s"} drifted &gt;${(threshold*100).toFixed(0)}% vs 4-week median.
                Scanned ${calKeys.length} aggregates total.
              </p>
              <table style="font-size:13px;color:#1e293b;border-collapse:collapse;width:100%;">
                <thead>
                  <tr style="border-bottom:2px solid #e2e8f0;">
                    <th style="padding:8px 12px 8px 0;text-align:left;">Bucket</th>
                    <th style="padding:8px 12px 8px 0;text-align:right;">Drift</th>
                    <th style="padding:8px 12px 8px 0;text-align:right;">Now</th>
                    <th style="padding:8px 12px 8px 0;text-align:right;">Baseline</th>
                    <th style="padding:8px 12px 8px 0;text-align:right;">Quotes (Δ vs avg)</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              ${flags.length > 25 ? `<p style="color:#64748b;font-size:12px;margin-top:12px;">…and ${flags.length - 25} more (truncated). Pull tp:drift_report:${today} from Redis for full list.</p>` : ""}
              <p style="color:#64748b;font-size:12px;margin-top:20px;">
                Likely causes: parser regression, scraper bug, bad seed batch, or a real market shift.
                Investigate the largest deviation first.
              </p>
            </div>`
          };
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          });
          emailStatus = r.ok ? "sent" : ("resend_error_" + r.status);
        } catch (e) {
          emailStatus = "exception";
          console.error("[drift-check] email failed:", e.message);
        }
      } else {
        emailStatus = "no_api_key";
      }
    }

    return res.status(200).json({
      ok: true,
      ...report,
      emailStatus,
      // Truncate flagDetails in JSON response when many fired (full set is in Redis report)
      flagDetails: report.flagDetails.slice(0, 25),
    });
  } catch (e) {
    console.error("[drift-check] error:", e);
    return res.status(500).json({ error: e.message });
  }
}
