import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://truepricehq.com");
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
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[capture-quote] Redis error:", e.message);
    return res.status(200).json({ ok: true }); // silent fail
  }
}
