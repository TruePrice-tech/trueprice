import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed || !parsed.totalPrice) return null;
  return {
    v: vertical,
    ts: new Date().toISOString(),
    price: parsed.totalPrice,
    moveType: parsed.moveType || null,
    homeSize: parsed.homeSize || null,
    distance: parsed.distance || null,
    hourlyRate: parsed.hourlyRate || null,
    crewSize: parsed.crewSize || null,
    pickupState: parsed.pickupState || null,
    deliveryState: parsed.deliveryState || null
  };
}

async function captureAnonymizedData(vertical, parsed) {
  try {
    const record = buildAnonymizedRecord(vertical, parsed);
    if (!record) return;
    await redis.lpush("tp:pricing_data", JSON.stringify(record));
    // Keep list at max 50,000 entries
    await redis.ltrim("tp:pricing_data", 0, 49999);
  } catch (e) {
    // Silent fail - never block the user response for data capture
    console.log("[data-capture] Error:", e.message);
  }
}

const RATE_LIMIT_MAX = 10;
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
    const key = `mv_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[moving-estimate] Redis rate limit error, falling back to in-memory:", e.message);
    return checkMemoryRateLimit(ip);
  }
}

export default async function handler(req, res) {
  const allowedOrigin = "https://truepricehq.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || "unknown";
  if (!(await checkRateLimit(clientIp))) {
    return res.status(429).json({ error: "Rate limit exceeded. Maximum 10 requests per hour. Please try again later." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { text, images } = req.body;

    if (!text && (!images || images.length === 0)) {
      return res.status(400).json({ error: "No text or images provided" });
    }

    const content = [];

    if (images && images.length > 0) {
      for (const img of images.slice(0, 3)) {
        const match = img.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (match) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: match[1],
              data: match[2]
            }
          });
        }
      }
    }

    content.push({
      type: "text",
      text: `Analyze this moving company estimate/quote. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total estimated cost>,
  "moveType": <"local" | "long_distance" | "unknown">,
  "homeSize": <"studio" | "1br" | "2br" | "3br" | "4br" | null>,
  "estimatedWeight": <number in lbs or null>,
  "distance": <number in miles or null>,
  "crewSize": <number or null>,
  "hourlyRate": <number or null - per-hour rate for crew>,
  "estimatedHours": <number or null>,
  "companyName": <string or null>,
  "pickupCity": <string or null>,
  "pickupState": <2-letter state code or null>,
  "deliveryCity": <string or null>,
  "deliveryState": <2-letter state code or null>,
  "moveDate": <string or null - in YYYY-MM-DD if possible>,
  "isPeakSeason": <boolean - true if move date falls in May-September or around month-end>,
  "usdotNumber": <string or null - USDOT license number if present>,
  "lineItems": [
    {
      "description": <string - line item description>,
      "cost": <number or null>,
      "category": <"labor" | "packing" | "special_item" | "fee" | "insurance" | "storage" | "other">
    }
  ],
  "scopeItems": {
    "inventoryList": <"yes" | "no" | "unclear">,
    "pickupWindow": <"yes" | "no" | "unclear">,
    "deliveryWindow": <"yes" | "no" | "unclear">,
    "insurance": <"yes" | "no" | "unclear">,
    "weightEstimate": <"yes" | "no" | "unclear">,
    "usdotNumber": <"yes" | "no" | "unclear">,
    "cancellationPolicy": <"yes" | "no" | "unclear">,
    "stairsFees": <"yes" | "no" | "unclear">,
    "packingCosts": <"yes" | "no" | "unclear">,
    "fuelSurcharge": <"yes" | "no" | "unclear">
  },
  "redFlags": [<array of strings describing any concerning items found>]
}

Rules:
- totalPrice: Use the grand total / binding estimate amount, not individual line items
- moveType: "local" if within same metro area or under 100 miles, "long_distance" if over 100 miles or interstate, "unknown" if unclear
- homeSize: Infer from inventory list or bedroom count if mentioned
- isPeakSeason: true if move is May-September or falls in last/first few days of any month
- lineItems: List each charge as a separate item with the appropriate category
- category: "labor" for crew/hourly charges, "packing" for boxes/materials/packing service, "special_item" for piano/hot tub/heavy items, "fee" for fuel/stair/long carry/shuttle, "insurance" for valuation/coverage, "storage" for storage-in-transit or warehouse
- redFlags: Flag things like missing USDOT number, no written estimate, large required deposits over 25%, no cancellation policy, vague weight estimates, unusually low prices that suggest a scam
- scopeItems: Mark "yes" only if clearly present in the quote
- Return ONLY the JSON object, nothing else`
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          { role: "user", content }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      return res.status(502).json({ error: "AI parsing failed", status: response.status });
    }

    const data = await response.json();
    const aiText = data.content?.[0]?.text || "";

    let parsed;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText);
    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    captureAnonymizedData("moving", parsed); // fire and forget

    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("moving-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
