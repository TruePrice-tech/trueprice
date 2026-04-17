import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { vertical, price, state, jobType, brand, scope, source } = req.body || {};

  // Require at minimum vertical + price
  if (!vertical || !price || price < 10 || price > 500000) {
    return res.status(400).json({ error: "Invalid data" });
  }

  const record = {
    v: vertical,
    ts: new Date().toISOString(),
    price: Number(price),
    state: state || null,
    jobType: jobType || null,
    brand: brand || null,
    scope: scope || null, // number of scope items detected
    src: source || "regex", // "regex" or "ai"
  };

  try {
    await redis.lpush("tp:pricing_data", JSON.stringify(record));
    await redis.ltrim("tp:pricing_data", 0, 49999);
    await redis.incr("tp:total_quotes");

    // FLYWHEEL BRIDGE: also write to cal:* aggregates so captured
    // quotes feed back into future estimate calibration
    const totalPrice = Number(price);
    const st = (state || "").toUpperCase();
    if (totalPrice > 0 && st) {
      const weight = 0.3;
      const bump = async (k) => {
        try {
          const ex = await redis.get(k) || { quotes: 0, weightedSum: 0, totalWeight: 0, avgPrice: 0, lastUpdated: 0 };
          const e = typeof ex === "string" ? JSON.parse(ex) : ex;
          e.quotes += 1;
          e.weightedSum += totalPrice * weight;
          e.totalWeight += weight;
          e.avgPrice = Math.round(e.weightedSum / e.totalWeight);
          e.lastUpdated = Date.now();
          await redis.set(k, JSON.stringify(e));
        } catch (_) { /* best-effort */ }
      };
      await bump(`cal:metro:${st}:${vertical}`);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[capture-quote] Redis error:", e.message);
    return res.status(200).json({ ok: true }); // silent fail
  }
}
