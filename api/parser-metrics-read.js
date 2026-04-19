import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const key = req.query.key;
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const days = parseInt(req.query.days) || 7;

  try {
    const results = {};
    const totals = { total: 0, priceFound: 0, regexOk: 0, aiCalled: 0, aiOk: 0 };

    for (let d = 0; d < days; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dayStr = date.toISOString().substring(0, 10);
      const dayKey = "tp:parser_metrics:" + dayStr;

      const entries = await redis.lrange(dayKey, 0, -1);
      if (!entries || entries.length === 0) continue;

      const dayStats = { total: 0, priceFound: 0, regexOk: 0, aiCalled: 0, aiOk: 0, byVertical: {} };

      for (const raw of entries) {
        const e = typeof raw === "string" ? JSON.parse(raw) : raw;
        dayStats.total++;
        if (e.price) dayStats.priceFound++;
        if (e.regex) dayStats.regexOk++;
        if (e.aiCall) dayStats.aiCalled++;
        if (e.aiOk) dayStats.aiOk++;

        if (!dayStats.byVertical[e.v]) dayStats.byVertical[e.v] = { total: 0, priceFound: 0, regexOk: 0, aiCalled: 0, aiOk: 0 };
        const vStat = dayStats.byVertical[e.v];
        vStat.total++;
        if (e.price) vStat.priceFound++;
        if (e.regex) vStat.regexOk++;
        if (e.aiCall) vStat.aiCalled++;
        if (e.aiOk) vStat.aiOk++;

        totals.total++;
        if (e.price) totals.priceFound++;
        if (e.regex) totals.regexOk++;
        if (e.aiCall) totals.aiCalled++;
        if (e.aiOk) totals.aiOk++;
      }

      results[dayStr] = dayStats;
    }

    return res.status(200).json({
      period: days + " days",
      totals: totals,
      successRate: totals.total > 0 ? Math.round((totals.priceFound / totals.total) * 100) + "%" : "N/A",
      regexRate: totals.total > 0 ? Math.round((totals.regexOk / totals.total) * 100) + "%" : "N/A",
      aiCallRate: totals.total > 0 ? Math.round((totals.aiCalled / totals.total) * 100) + "%" : "N/A",
      aiSuccessRate: totals.aiCalled > 0 ? Math.round((totals.aiOk / totals.aiCalled) * 100) + "%" : "N/A",
      daily: results
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
