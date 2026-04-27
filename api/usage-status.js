// /api/usage-status?key=<ANALYTICS_ADMIN_KEY>
//
// Read-only usage snapshot. Returns:
//   - current month's invocation count + percent of budget
//   - which tier(s) are currently being dropped
//   - which warning thresholds have already fired this month
//
// Lane uses this to spot-check Vercel exposure without logging into the
// Vercel dashboard. Counts itself as 1 Tier 4 invocation.

import { Redis } from "@upstash/redis";
import { getUsage, track } from "./_usage-gate.js";

const redis = Redis.fromEnv();
const ADMIN_KEY = process.env.ANALYTICS_ADMIN_KEY || "tp_admin_2026";

const TIER_DROP_THRESHOLDS = { 1: 0.85, 2: 0.95, 3: 0.99 };

export default async function handler(req, res) {
  if ((req.query.key || "") !== ADMIN_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await track();

  const usage = await getUsage();
  const droppingTiers = [];
  for (const [tier, threshold] of Object.entries(TIER_DROP_THRESHOLDS)) {
    if (usage.percent >= threshold) droppingTiers.push(Number(tier));
  }

  // Which warning thresholds have fired this month
  const firedWarnings = [];
  for (const t of [70, 85, 95, 99]) {
    const flag = await redis.get(`tp:vercel_warned:${usage.month}:${t}`);
    if (flag) firedWarnings.push(t);
  }

  return res.status(200).json({
    ok: true,
    month: usage.month,
    invocations: usage.invocations,
    budget: usage.budget,
    percent: Math.round(usage.percent * 1000) / 10,
    droppingTiers,
    firedWarnings,
    nextThreshold: [70, 85, 95, 99].find((t) => usage.percent * 100 < t) || null,
  });
}
