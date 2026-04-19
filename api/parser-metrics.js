import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { vertical, ocrChars, ocrConfidence, regexFoundPrice, aiCalled, aiFoundPrice, priceFound, finalSource } = req.body || {};

    if (!vertical) return res.status(400).json({ error: "missing vertical" });

    const day = new Date().toISOString().substring(0, 10);
    const key = "tp:parser_metrics:" + day;

    const entry = {
      v: vertical,
      ocrC: ocrChars || 0,
      ocrP: ocrConfidence || 0,
      regex: regexFoundPrice ? 1 : 0,
      aiCall: aiCalled ? 1 : 0,
      aiOk: aiFoundPrice ? 1 : 0,
      price: priceFound ? 1 : 0,
      src: finalSource || "none",
      ts: Date.now()
    };

    await redis.lpush(key, JSON.stringify(entry));
    await redis.expire(key, 90 * 86400); // keep 90 days

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.log("[parser-metrics] Error:", e.message);
    return res.status(200).json({ ok: true }); // never fail the client
  }
}
