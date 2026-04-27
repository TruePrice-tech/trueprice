// Usage gate: hard-bound Vercel function-invocation cost.
//
// Each endpoint that opts in calls `gate(req, res, tier)` before doing
// expensive work. The helper:
//   1. Increments tp:vercel_invocations:<YYYY-MM> (best-effort, fail-open).
//   2. Computes percent-of-monthly-budget.
//   3. If percent >= the tier's threshold, responds 503 and tells caller
//      to bail.
//
// Tiers (per Lane's confirmation, 2026-04-27):
//   1 = cosmetic / non-essential analytics (drop at 85%)
//   2 = internal monitoring crons (drop at 95%)
//   3 = degraded-mode features (drop at 99%)
//   4 = core product (never gate, but still counted for accurate usage)
//
// Severity-3 pricing events bypass Tier 1 gating — that's literally the
// highest-stakes use of the banner.
//
// The counter is approximate (best-effort, no transaction with Vercel
// billing). Goal is to throttle BEFORE Vercel bills us, not to match
// Vercel's exact metric.

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const MONTHLY_INVOCATIONS_BUDGET = 1_000_000;

const TIER_DROP_THRESHOLDS = {
  1: 0.85,
  2: 0.95,
  3: 0.99,
  4: 9.99,  // never drops
};

// Warning thresholds — first crossing each fires a one-time email per month.
const WARNING_THRESHOLDS = [0.70, 0.85, 0.95, 0.99];

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getUsage() {
  try {
    const month = monthKey();
    const count = Number((await redis.get(`tp:vercel_invocations:${month}`)) || 0);
    return {
      month,
      invocations: count,
      budget: MONTHLY_INVOCATIONS_BUDGET,
      percent: count / MONTHLY_INVOCATIONS_BUDGET,
    };
  } catch (e) {
    return { month: monthKey(), invocations: 0, budget: MONTHLY_INVOCATIONS_BUDGET, percent: 0, error: e.message };
  }
}

async function bumpAndRead() {
  try {
    const key = `tp:vercel_invocations:${monthKey()}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 35 * 24 * 60 * 60);
    return n / MONTHLY_INVOCATIONS_BUDGET;
  } catch (e) {
    return 0;  // fail open — better to over-spend than 503 the whole site on a Redis blip
  }
}

// gate: increments the usage counter and decides whether to drop.
// Returns true if the request should be dropped — caller MUST return immediately.
// `opts.bypass = true` makes the request count but never drop (used for the
// severity-3 pricing-event banner exception).
export async function gate(req, res, tier, opts = {}) {
  const percent = await bumpAndRead();
  const threshold = TIER_DROP_THRESHOLDS[tier] ?? 9.99;
  if (opts.bypass) return false;
  if (percent < threshold) return false;
  // Drop: 503 + Retry-After hint based on month-end
  const now = new Date();
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const secsUntilReset = Math.max(60, Math.floor((monthEnd - now) / 1000));
  res.setHeader("Retry-After", String(secsUntilReset));
  res.status(503).json({
    ok: false,
    reason: "usage_throttle",
    tier,
    usagePercent: Math.round(percent * 100),
    budget: MONTHLY_INVOCATIONS_BUDGET,
    resetsAt: monthEnd.toISOString(),
  });
  return true;
}

// Lightweight tracker that only increments — never drops. Use from Tier 4
// endpoints (estimate APIs, parse-quote, calibration) so the counter
// reflects real usage and the warning thresholds fire accurately.
export async function track() {
  await bumpAndRead();
}

// Check the current usage percent against the warning thresholds. Sends an
// email at most once per threshold per month. Designed to be called from the
// daily cron-heartbeat — not from request handlers (would be wasteful).
export async function maybeWarn() {
  const usage = await getUsage();
  const month = usage.month;
  const fired = [];
  for (const t of WARNING_THRESHOLDS) {
    if (usage.percent < t) continue;
    const flagKey = `tp:vercel_warned:${month}:${Math.round(t * 100)}`;
    let isNew = false;
    try {
      const setRes = await redis.set(flagKey, "1", { nx: true, ex: 40 * 24 * 60 * 60 });
      isNew = setRes === "OK" || setRes === true;
    } catch (e) { /* fail open */ }
    if (!isNew) continue;
    fired.push(t);
    await sendWarningEmail(t, usage);
  }
  return { usage, fired };
}

async function sendWarningEmail(threshold, usage) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;
  const pct = Math.round(threshold * 100);
  const usagePct = Math.round(usage.percent * 100);
  const tierAction = pct >= 99 ? "Tier 3 (degraded mode)"
    : pct >= 95 ? "Tier 2 (internal monitoring crons)"
    : pct >= 85 ? "Tier 1 (cosmetic analytics, banner, widget beacon)"
    : "no behavior change yet";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Woogoro Usage <noreply@woogoro.com>",
        to: ["hello@woogoro.com"],
        subject: `[Woogoro] Vercel usage at ${pct}% — ${tierAction}`,
        html: `<div style="font-family:sans-serif;max-width:680px;padding:20px;">
          <h2 style="color:${pct >= 95 ? '#b91c1c' : pct >= 85 ? '#9a3412' : '#1e3a8a'};margin:0 0 8px;">Vercel function-invocation budget alert</h2>
          <p style="color:#475569;font-size:14px;margin:0 0 16px;">Crossed the ${pct}% threshold for ${usage.month}. Currently dropping: <strong>${tierAction}</strong>.</p>
          <table style="font-size:14px;border-collapse:collapse;">
            <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Usage</td><td>${usage.invocations.toLocaleString()} / ${usage.budget.toLocaleString()} invocations (${usagePct}%)</td></tr>
            <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Month</td><td>${usage.month}</td></tr>
          </table>
          <p style="color:#64748b;font-size:12px;margin-top:14px;">This warning fires once per threshold per month. Higher thresholds will warn separately as you cross them.</p>
        </div>`,
      }),
    });
  } catch (e) { /* swallow — warning is best-effort */ }
}
