// /api/cron-heartbeat
//
// Watchdog for the other Vercel crons. Runs daily and verifies that each
// expected cron actually ran by looking for its written-to-Redis trace key
// within an acceptable freshness window. If any cron is overdue, emails an
// alert to hello@woogoro.com so silent failures don't go unnoticed for weeks.
//
// Each tracked cron must write a heartbeat key on success: tp:cron_run:<name>
// with value = ISO timestamp string. The runtime here only reads these keys.
// Crons that don't yet write a heartbeat (legacy email-digest-cron) get
// patched to do so in a separate change — until then they're listed as
// `optional: true` and only warn rather than alert.
//
// Cron schedule: 0 15 * * * (15:00 UTC daily — 2hr after pricing-drift on Mon).

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const HEARTBEAT_PREFIX = "tp:cron_run:";

// Each entry: how stale before we alert (in hours).
const TRACKED = [
  { name: "daily-counter-tick",  staleHours: 30,    optional: false },
  { name: "pricing-drift-check", staleHours: 8 * 24, optional: false },
  { name: "vertical-health",     staleHours: 8 * 24, optional: false },
  { name: "flywheel-integrity",  staleHours: 32 * 24, optional: false },
  { name: "pricing-event-scan",  staleHours: 30,    optional: false },
  { name: "email-digest-cron",   staleHours: 32 * 24, optional: true },
];

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) return res.status(503).json({ error: "CRON_SECRET not configured" });
  if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized" });

  const now = Date.now();
  const results = [];
  const overdue = [];

  for (const t of TRACKED) {
    const raw = await redis.get(HEARTBEAT_PREFIX + t.name);
    const ts = raw ? Date.parse(String(raw)) : null;
    const ageHours = ts ? (now - ts) / (1000 * 60 * 60) : null;
    const isOverdue = ts === null || ageHours > t.staleHours;
    const entry = {
      name: t.name,
      lastRun: ts ? new Date(ts).toISOString() : null,
      ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
      threshold: t.staleHours,
      optional: t.optional,
      overdue: isOverdue,
    };
    results.push(entry);
    if (isOverdue && !t.optional) overdue.push(entry);
  }

  // Write own heartbeat last (so we can self-monitor via tp:cron_run:cron-heartbeat)
  await redis.set(HEARTBEAT_PREFIX + "cron-heartbeat", new Date().toISOString());

  let emailStatus = "no_alert";
  if (overdue.length > 0) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const rows = overdue.map((o) => `<tr>
        <td style="padding:6px 12px 6px 0;font-family:monospace;">${o.name}</td>
        <td style="padding:6px 12px 6px 0;">${o.lastRun || '<span style="color:#b91c1c;">never</span>'}</td>
        <td style="padding:6px 12px 6px 0;text-align:right;color:#b91c1c;font-weight:600;">${o.ageHours === null ? '∞' : o.ageHours + 'h'}</td>
        <td style="padding:6px 12px 6px 0;text-align:right;color:#64748b;">${o.threshold}h</td>
      </tr>`).join("");
      const html = `<div style="font-family:sans-serif;max-width:760px;padding:20px;">
        <h2 style="color:#b91c1c;margin:0 0 8px;">Cron heartbeat alert</h2>
        <p style="color:#475569;font-size:14px;margin:0 0 16px;">${overdue.length} scheduled cron${overdue.length === 1 ? ' has' : 's have'} not run within the freshness window. Check Vercel cron logs.</p>
        <table style="font-size:13px;border-collapse:collapse;width:100%;">
          <thead><tr style="border-bottom:2px solid #e2e8f0;">
            <th style="padding:8px 12px 8px 0;text-align:left;">Cron</th>
            <th style="padding:8px 12px 8px 0;text-align:left;">Last run</th>
            <th style="padding:8px 12px 8px 0;text-align:right;">Age</th>
            <th style="padding:8px 12px 8px 0;text-align:right;">Threshold</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Woogoro Heartbeat <noreply@woogoro.com>",
            to: ["hello@woogoro.com"],
            subject: `[Woogoro] Cron heartbeat: ${overdue.length} overdue`,
            html,
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

  return res.status(200).json({
    ok: true,
    checked: results.length,
    overdue: overdue.length,
    emailStatus,
    results,
  });
}
