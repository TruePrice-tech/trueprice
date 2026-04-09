// Lightweight feedback (thumbs up/down) endpoint.
// Stores anonymized vote events in Upstash Redis so we can monitor
// per-vertical helpfulness over time. No PII collected.
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const MAX_ENTRIES = 10000;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://truepricehq.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const vertical = String(body.vertical || "").slice(0, 40);
    const vote = String(body.vote || "").slice(0, 10);
    const timestamp = Number(body.timestamp) || Date.now();

    if (!vertical || (vote !== "up" && vote !== "down")) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const entry = { vertical, vote, timestamp };

    try {
      await redis.lpush("tp:feedback", JSON.stringify(entry));
      await redis.ltrim("tp:feedback", 0, MAX_ENTRIES - 1);
      await redis.hincrby("tp:feedback:counts", vertical + ":" + vote, 1);
    } catch (e) {
      // Don't fail the request if Redis is unavailable — feedback is best-effort
      console.error("[feedback] redis error:", e && e.message);
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("[feedback] handler error:", e && e.message);
    return res.status(500).json({ error: "Server error" });
  }
}
