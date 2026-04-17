import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  if (req.method === "POST") {
    // Increment counter for a vertical
    const { vertical, action } = req.body || {};
    if (action !== "increment" || !vertical) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const key = `tp:ai_calls:${today}:${vertical}`;
    try {
      const count = await redis.incr(key);
      // Auto-expire after 7 days
      if (count === 1) await redis.expire(key, 7 * 86400);
      return res.status(200).json({ vertical, date: today, count });
    } catch (e) {
      console.error("[ai-counter] Redis error:", e.message);
      return res.status(200).json({ vertical, date: today, count: -1 });
    }
  }

  if (req.method === "GET") {
    // Return all counters for today (or specified date)
    const date = req.query.date || today;
    try {
      const keys = await redis.keys(`tp:ai_calls:${date}:*`);
      const counters = {};
      let total = 0;
      for (const key of keys) {
        const vertical = key.split(":").pop();
        const count = await redis.get(key);
        counters[vertical] = Number(count) || 0;
        total += counters[vertical];
      }
      return res.status(200).json({ date, counters, total });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
