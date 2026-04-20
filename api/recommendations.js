import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const MAX_RECS = 5000;
const REDIS_KEY = "tp:recommendations";

// Rate limit: max 5 submissions per IP per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const ipSubmits = new Map();

function rateCheck(ip) {
  const now = Date.now();
  let hits = ipSubmits.get(ip) || [];
  hits = hits.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (hits.length >= RATE_LIMIT_MAX) return false;
  hits.push(now);
  ipSubmits.set(ip, hits);
  return true;
}

function getClientIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
         req.headers["x-real-ip"] || "unknown";
}

function sanitize(str, maxLen) {
  return String(str || "").trim().substring(0, maxLen);
}

const VALID_TRADES = new Set([
  "roofing", "hvac", "plumbing", "electrical", "solar", "windows",
  "siding", "insulation", "painting", "fencing", "concrete",
  "landscaping", "garage-doors", "foundation", "kitchen-remodel",
  "gutters", "auto-repair", "moving", "medical", "legal", "other"
]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // GET: fetch recommendations, optionally filtered by city or trade
  if (req.method === "GET") {
    try {
      const city = sanitize(req.query?.city, 100).toLowerCase();
      const trade = sanitize(req.query?.trade, 30).toLowerCase();
      const limit = Math.min(parseInt(req.query?.limit) || 50, 200);

      const all = await redis.lrange(REDIS_KEY, 0, MAX_RECS - 1);
      let recs = (all || []).map(r => typeof r === "string" ? JSON.parse(r) : r);

      if (city) {
        recs = recs.filter(r => r.city && r.city.toLowerCase() === city);
      }
      if (trade) {
        recs = recs.filter(r => r.trade && r.trade.toLowerCase() === trade);
      }

      // Return newest first, capped at limit
      recs = recs.slice(0, limit);

      return res.status(200).json({ ok: true, recommendations: recs, total: recs.length });
    } catch (e) {
      console.error("[recommendations] GET error:", e.message);
      return res.status(500).json({ ok: false, error: "Failed to fetch recommendations" });
    }
  }

  // POST: submit a new recommendation
  if (req.method === "POST") {
    const ip = getClientIP(req);
    if (!rateCheck(ip)) {
      return res.status(429).json({ ok: false, error: "Too many submissions. Try again later." });
    }

    try {
      const data = req.body || {};

      const contractorName = sanitize(data.contractorName, 100);
      const trade = sanitize(data.trade, 30).toLowerCase();
      const city = sanitize(data.city, 100);
      const state = sanitize(data.state, 2).toUpperCase();
      const comment = sanitize(data.comment, 500);
      const submitterName = sanitize(data.submitterName, 50);

      // Validation
      if (!contractorName) {
        return res.status(400).json({ ok: false, error: "Contractor name is required." });
      }
      if (!trade || !VALID_TRADES.has(trade)) {
        return res.status(400).json({ ok: false, error: "Please select a valid trade." });
      }
      if (!city) {
        return res.status(400).json({ ok: false, error: "City is required." });
      }
      if (!state || state.length !== 2) {
        return res.status(400).json({ ok: false, error: "Please enter a 2-letter state code." });
      }
      if (!comment) {
        return res.status(400).json({ ok: false, error: "Please share why you recommend this contractor." });
      }

      const rec = {
        contractorName,
        trade,
        city,
        state,
        comment,
        submitterName: submitterName || "Anonymous",
        ts: Date.now()
      };

      await redis.lpush(REDIS_KEY, JSON.stringify(rec));
      await redis.ltrim(REDIS_KEY, 0, MAX_RECS - 1);

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("[recommendations] POST error:", e.message);
      return res.status(500).json({ ok: false, error: "Failed to save recommendation." });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
