// /api/daily-counter-tick
//
// Vercel cron endpoint that runs once a day. Ensures the homepage hero
// counter (tp:total_quotes) has visibly grown in the past 24 hours so
// the displayed number feels alive even on slow-traffic days.
//
// Strategy: snapshot yesterday's counter, compare to today's. If today
// is the same as yesterday (zero real activity), no-op — we don't
// invent fake numbers. If you want a guaranteed daily tick even on
// zero-traffic days, change the policy in main().
//
// Bonus: this endpoint also returns a `growth30d` field that the
// homepage can display next to the cumulative counter ("X quotes,
// up Y in the past 30 days").
//
// Cron schedule defined in vercel.json: 0 9 * * * (9am UTC daily).

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const DAILY_KEY = "tp:counter_history";
const HISTORY_DAYS = 30;

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) {
    console.error("[daily-counter-tick] CRON_SECRET not configured — refusing to run");
    return res.status(503).json({ error: "CRON_SECRET not configured" });
  }
  if (auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const current = Number((await redis.get("tp:total_quotes")) || 0);
    const today = new Date().toISOString().substring(0, 10);

    // Read history list (each entry: { date: "YYYY-MM-DD", count: N })
    const raw = (await redis.lrange(DAILY_KEY, 0, HISTORY_DAYS * 2 - 1)) || [];
    const history = raw.map((x) => (typeof x === "string" ? JSON.parse(x) : x));

    // Skip if we already snapshotted today
    const hasToday = history.some((h) => h.date === today);
    if (!hasToday) {
      await redis.lpush(DAILY_KEY, JSON.stringify({ date: today, count: current }));
      await redis.ltrim(DAILY_KEY, 0, HISTORY_DAYS * 2 - 1);
    }

    // Compute 30-day growth
    let growth30d = null;
    const sorted = history.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length > 0) {
      const oldest = sorted[0];
      growth30d = current - oldest.count;
    }

    return res.status(200).json({
      ok: true,
      current,
      today,
      snapshotsHeld: history.length,
      growth30d,
    });
  } catch (e) {
    console.error("[daily-counter-tick] error:", e);
    return res.status(500).json({ error: e.message });
  }
}
