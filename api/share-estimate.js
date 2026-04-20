import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const TTL = 90 * 24 * 60 * 60; // 90 days

function generateId() {
  var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  var id = "";
  for (var i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // GET: retrieve a saved estimate
  if (req.method === "GET") {
    const { id } = req.query;
    if (!id || id.length < 6) {
      return res.status(400).json({ error: "Missing or invalid ID" });
    }

    const key = `share:${id}`;
    const data = await redis.get(key);
    if (!data) {
      return res.status(404).json({ error: "Estimate not found or expired" });
    }

    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return res.status(200).json(parsed);
  }

  // POST: save an estimate for sharing
  if (req.method === "POST") {
    const body = req.body;
    if (!body || !body.vertical || !body.result) {
      return res.status(400).json({ error: "Missing vertical or result data" });
    }

    // Rate limit: 10 shares per IP per hour
    const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
    const rateKey = `share_rate:${ip}`;
    const count = (await redis.get(rateKey)) || 0;
    if (count >= 10) {
      return res.status(429).json({ error: "Too many shares. Try again later." });
    }
    await redis.set(rateKey, Number(count) + 1, { ex: 3600 });

    // Generate unique ID (retry on collision)
    let id;
    for (let attempt = 0; attempt < 5; attempt++) {
      id = generateId();
      const exists = await redis.get(`share:${id}`);
      if (!exists) break;
    }

    const payload = {
      vertical: body.vertical,
      verticalLabel: body.verticalLabel || body.vertical,
      result: body.result,
      city: body.city || "",
      stateCode: body.stateCode || "",
      sharedAt: new Date().toISOString(),
    };

    await redis.set(`share:${id}`, JSON.stringify(payload), { ex: TTL });

    return res.status(200).json({
      ok: true,
      id: id,
      url: `/s/${id}`,
      expiresInDays: 90,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
