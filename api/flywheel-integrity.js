// /api/flywheel-integrity
//
// Monthly cron that scans every cal:* aggregate for malformed or unhealthy
// state. Catches data corruption that would silently feed bad pricing into
// the user-facing flywheel.
//
// Flags:
//   - missingFields:   no avgPrice or no quotes field
//   - invalidNumber:   avgPrice/quotes is NaN, negative, or non-finite
//   - zeroQuotesPriced: quotes === 0 but avgPrice > 0 (impossible state)
//   - extremePrice:    avgPrice outside [50, 500_000] sanity envelope
//   - stale:           lastUpdated older than 365 days (vertical/region dead)
//
// State written:
//   - tp:flywheel_integrity_report:<YYYY-MM-DD>  full report (180-day TTL)
//
// Cron schedule: 0 16 1 * * (1st of month, 16:00 UTC).

import { Redis } from "@upstash/redis";
import { gate } from "./_usage-gate.js";

const redis = Redis.fromEnv();

const REPORT_PREFIX = "tp:flywheel_integrity_report:";
const REPORT_TTL = 180 * 24 * 60 * 60;
const STALE_DAYS = 365;
const PRICE_FLOOR = 50;
const PRICE_CEILING = 500_000;

function classify(key, agg) {
  const issues = [];
  if (!("avgPrice" in agg) || !("quotes" in agg)) {
    issues.push("missingFields");
    return issues;
  }
  const p = Number(agg.avgPrice);
  const q = Number(agg.quotes);
  if (!Number.isFinite(p) || !Number.isFinite(q) || p < 0 || q < 0) {
    issues.push("invalidNumber");
  }
  if (q === 0 && p > 0) issues.push("zeroQuotesPriced");
  if (Number.isFinite(p) && (p < PRICE_FLOOR || p > PRICE_CEILING) && p > 0) {
    issues.push("extremePrice");
  }
  const lu = Number(agg.lastUpdated) || 0;
  const ageDays = lu ? (Date.now() - lu) / (1000 * 60 * 60 * 24) : Infinity;
  if (ageDays > STALE_DAYS) issues.push("stale");
  return issues;
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) return res.status(503).json({ error: "CRON_SECRET not configured" });
  if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized" });
  if (await gate(req, res, 2)) return;

  const today = new Date().toISOString().substring(0, 10);

  const flagged = [];
  const counts = { missingFields: 0, invalidNumber: 0, zeroQuotesPriced: 0, extremePrice: 0, stale: 0 };
  let scanned = 0;
  let cursor = 0;

  do {
    const [next, batch] = await redis.scan(cursor, { match: "cal:*", count: 500 });
    cursor = Number(next);
    for (const k of batch) {
      if (!k.startsWith("cal:")) continue;
      // Skip non-aggregate keys (per-quote, rate-limit, dup detection)
      if (k.startsWith("cal_quote:") || k.startsWith("cal_rate:") || k.startsWith("cal_dup:")) continue;
      const raw = await redis.get(k);
      if (!raw) continue;
      const agg = typeof raw === "string" ? JSON.parse(raw) : raw;
      scanned++;
      const issues = classify(k, agg);
      if (issues.length > 0) {
        for (const i of issues) counts[i] = (counts[i] || 0) + 1;
        flagged.push({
          key: k,
          issues,
          avgPrice: agg.avgPrice,
          quotes: agg.quotes,
          lastUpdated: agg.lastUpdated || null,
        });
      }
    }
  } while (cursor !== 0);

  // Sort: most-issues first, then by alphabetical key
  flagged.sort((a, b) => (b.issues.length - a.issues.length) || a.key.localeCompare(b.key));

  const report = {
    date: today,
    scanned,
    flaggedCount: flagged.length,
    countsByIssue: counts,
    samples: flagged.slice(0, 100),  // first 100 for email; full set in Redis report
  };
  await redis.set(REPORT_PREFIX + today, JSON.stringify({ ...report, all: flagged }), { ex: REPORT_TTL });

  let emailStatus = "no_alert";
  if (flagged.length > 0) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const rows = flagged.slice(0, 30).map((f) => `<tr>
        <td style="padding:6px 12px 6px 0;font-family:monospace;font-size:11px;">${f.key}</td>
        <td style="padding:6px 12px 6px 0;color:#b91c1c;font-size:12px;">${f.issues.join(", ")}</td>
        <td style="padding:6px 12px 6px 0;text-align:right;">$${f.avgPrice ?? "—"}</td>
        <td style="padding:6px 12px 6px 0;text-align:right;">${f.quotes ?? "—"}</td>
      </tr>`).join("");
      const issueRows = Object.entries(counts).filter(([_, n]) => n > 0).map(([k, n]) => `<li><strong>${k}:</strong> ${n}</li>`).join("");
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Woogoro Integrity <noreply@woogoro.com>",
            to: ["hello@woogoro.com"],
            subject: `[Woogoro] Flywheel integrity: ${flagged.length} of ${scanned} buckets flagged — ${today}`,
            html: `<div style="font-family:sans-serif;max-width:900px;padding:20px;">
              <h2 style="margin:0 0 8px;">Flywheel integrity — ${today}</h2>
              <p style="color:#475569;font-size:14px;margin:0 0 12px;">Scanned ${scanned} cal:* buckets. ${flagged.length} have issues.</p>
              <ul style="color:#475569;font-size:13px;margin:0 0 16px;">${issueRows}</ul>
              <table style="font-size:12px;border-collapse:collapse;width:100%;">
                <thead><tr style="border-bottom:2px solid #e2e8f0;">
                  <th style="padding:8px 12px 8px 0;text-align:left;">Key</th>
                  <th style="padding:8px 12px 8px 0;text-align:left;">Issues</th>
                  <th style="padding:8px 12px 8px 0;text-align:right;">avgPrice</th>
                  <th style="padding:8px 12px 8px 0;text-align:right;">quotes</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>
              ${flagged.length > 30 ? `<p style="color:#64748b;font-size:12px;margin-top:12px;">…and ${flagged.length - 30} more. Pull tp:flywheel_integrity_report:${today} from Redis for full list.</p>` : ""}
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

  await redis.set("tp:cron_run:flywheel-integrity", new Date().toISOString());

  return res.status(200).json({ ok: true, ...report, emailStatus });
}
