import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SEC = 3600;

const memoryRateLimit = new Map();
function checkMemoryRateLimit(ip) {
  const now = Date.now();
  const entry = memoryRateLimit.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_SEC * 1000) {
    memoryRateLimit.set(ip, { count: 1, start: now });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

async function checkRateLimit(ip) {
  try {
    const key = `ve_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    return checkMemoryRateLimit(ip);
  }
}

// Store shop quote data for the flywheel
async function storeShopQuote(shopData) {
  if (!shopData || !shopData.shopName || !shopData.state) return;
  try {
    const slug = shopData.shopName.toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 50);
    const key = `shop:${slug}:${(shopData.city || "").toLowerCase()}:${shopData.state.toUpperCase()}`;

    const existing = await redis.get(key);
    const record = existing ? (typeof existing === "string" ? JSON.parse(existing) : existing) : {
      shopName: shopData.shopName,
      city: shopData.city || "",
      state: shopData.state.toUpperCase(),
      quotes: [],
      avgPrice: {},
      quoteCount: 0,
      lastUpdated: 0
    };

    // Add new quote
    record.quotes.push({
      repair: shopData.repair,
      price: shopData.price,
      laborHours: shopData.laborHours || null,
      laborRate: shopData.laborRate || null,
      partsType: shopData.partsType || null,
      ts: Date.now()
    });

    // Keep last 100 quotes per shop
    if (record.quotes.length > 100) record.quotes = record.quotes.slice(-100);
    record.quoteCount = record.quotes.length;
    record.lastUpdated = Date.now();

    // Update averages by repair type
    const byRepair = {};
    record.quotes.forEach(q => {
      if (!byRepair[q.repair]) byRepair[q.repair] = [];
      byRepair[q.repair].push(q.price);
    });
    record.avgPrice = {};
    for (const [repair, prices] of Object.entries(byRepair)) {
      record.avgPrice[repair] = {
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        count: prices.length,
        low: Math.min(...prices),
        high: Math.max(...prices)
      };
    }

    await redis.set(key, JSON.stringify(record));
    return true;
  } catch (e) {
    console.log("[shop-store] Error:", e.message);
    return false;
  }
}

// Lookup shop pricing data
async function lookupShop(shopName, city, state) {
  if (!shopName) return null;
  try {
    const slug = shopName.toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 50);
    const key = `shop:${slug}:${(city || "").toLowerCase()}:${state.toUpperCase()}`;
    const data = await redis.get(key);
    if (!data) return null;
    const record = typeof data === "string" ? JSON.parse(data) : data;
    return {
      shopName: record.shopName,
      city: record.city,
      state: record.state,
      quoteCount: record.quoteCount,
      avgPrice: record.avgPrice,
      lastUpdated: record.lastUpdated
    };
  } catch (e) {
    return null;
  }
}

// Search for shops in a city with data
async function searchShops(city, state, repair) {
  if (!state) return [];
  try {
    // Scan for shop keys in this city/state
    const pattern = `shop:*:${(city || "").toLowerCase()}:${state.toUpperCase()}`;
    const keys = await redis.keys(pattern);
    const results = [];
    for (const key of keys.slice(0, 20)) {
      const data = await redis.get(key);
      if (!data) continue;
      const record = typeof data === "string" ? JSON.parse(data) : data;
      if (repair && record.avgPrice && record.avgPrice[repair]) {
        results.push({
          shopName: record.shopName,
          quoteCount: record.quoteCount,
          repairData: record.avgPrice[repair]
        });
      } else if (!repair) {
        results.push({
          shopName: record.shopName,
          quoteCount: record.quoteCount,
          repairs: Object.keys(record.avgPrice || {}).length
        });
      }
    }
    return results.sort((a, b) => (b.quoteCount || 0) - (a.quoteCount || 0));
  } catch (e) {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://truepricehq.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || "unknown";
  if (!(await checkRateLimit(clientIp))) {
    return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
  }

  // GET: Look up shop pricing or search shops in area
  if (req.method === "GET") {
    const { shop, city, state, repair, action } = req.query;

    if (action === "search") {
      const shops = await searchShops(city, state, repair);
      return res.status(200).json({ shops, count: shops.length });
    }

    if (shop) {
      const data = await lookupShop(shop, city, state);
      return res.status(200).json({ found: !!data, data });
    }

    return res.status(400).json({ error: "Missing shop or action parameter" });
  }

  // POST: Get AI vehicle-specific estimate OR store shop quote
  if (req.method === "POST") {
    const { action } = req.body;

    // Store a shop quote (flywheel data collection)
    if (action === "store_quote") {
      const { shopName, city, state, repair, price, laborHours, laborRate, partsType } = req.body;
      if (!shopName || !state || !repair || !price) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const stored = await storeShopQuote({ shopName, city, state, repair, price: Number(price), laborHours: Number(laborHours) || null, laborRate: Number(laborRate) || null, partsType });
      return res.status(200).json({ ok: stored });
    }

    // AI vehicle-specific estimate
    if (action === "estimate") {
      const { year, make, model, repair, city, state } = req.body;
      if (!repair) return res.status(400).json({ error: "Missing repair" });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "API key not configured" });

      const vehicleDesc = [year, make, model].filter(Boolean).join(" ") || "average vehicle";

      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            messages: [{
              role: "user",
              content: `You are an expert auto mechanic estimator. Give a precise repair cost estimate for this specific vehicle. Return ONLY valid JSON.

Vehicle: ${vehicleDesc}
Repair: ${repair}
Location: ${city ? city + ", " : ""}${state || "US average"}

Return this JSON:
{
  "laborHours": <number - estimated labor hours for THIS specific vehicle, not a generic range>,
  "laborHoursRange": [<low>, <high>],
  "partsEstimate": {
    "oem": <number - OEM parts cost for this vehicle>,
    "aftermarket": <number - quality aftermarket parts cost>,
    "reman": <number or null - remanufactured if available>
  },
  "vehicleNotes": "<string - anything specific about this vehicle that affects the repair: access difficulty, common issues, special tools needed, manual vs auto transmission impact>",
  "complexity": "<simple | moderate | complex> - relative to average vehicle",
  "commonIssues": "<string or null - known issues when doing this repair on this vehicle>"
}

Be specific to the exact year/make/model. A 1984 Nissan Sentra is very different from a 2024 BMW X5. Consider: engine bay access, part availability, vehicle age/rust, manual vs automatic transmission effects on the repair, and regional parts availability.`
            }]
          })
        });

        if (!response.ok) {
          return res.status(502).json({ error: "AI estimate failed" });
        }

        const data = await response.json();
        const aiText = data.content?.[0]?.text || "";

        let parsed;
        try {
          const jsonMatch = aiText.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText);
        } catch (e) {
          return res.status(502).json({ error: "Could not parse AI response" });
        }

        // Look up local shops with data for this repair
        let localShops = [];
        if (state) {
          localShops = await searchShops(city, state, repair.toLowerCase().replace(/[^a-z0-9]/g, "_"));
        }

        return res.status(200).json({
          success: true,
          vehicle: vehicleDesc,
          repair,
          estimate: parsed,
          localShops: localShops.slice(0, 5)
        });

      } catch (error) {
        return res.status(500).json({ error: error.message || "Internal error" });
      }
    }

    return res.status(400).json({ error: "Unknown action. Expected: estimate or store_quote" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
