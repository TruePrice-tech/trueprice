import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

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
    const key = `ar_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[auto-repair-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
      text: `Analyze this auto repair / mechanic shop quote. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total price including parts and labor>,
  "laborRate": <number or null - hourly labor rate if stated>,
  "laborHours": <number or null - total labor hours if stated>,
  "laborTotal": <number or null - total labor cost>,
  "partsTotal": <number or null - total parts cost>,
  "shopName": <string or null - mechanic shop / dealer name>,
  "shopType": <"dealer" | "independent" | "chain" | null>,
  "city": <customer/vehicle city or null>,
  "stateCode": <2-letter state code or null>,
  "yearMakeModel": <string like "2019 Honda Civic" or null>,
  "mileage": <number or null>,
  "repairs": [
    {
      "description": <string - repair description>,
      "laborHours": <number or null>,
      "laborCost": <number or null>,
      "partsCost": <number or null>,
      "partsType": <"oem" | "aftermarket" | "reman" | "unknown">,
      "lineTotal": <number or null>
    }
  ],
  "scopeItems": {
    "partsItemized": <"yes" | "no" | "unclear">,
    "laborRateStated": <"yes" | "no" | "unclear">,
    "laborHoursListed": <"yes" | "no" | "unclear">,
    "partsType": <"yes" | "no" | "unclear">,
    "shopSupplies": <"yes" | "no" | "unclear">,
    "taxIncluded": <"yes" | "no" | "unclear">,
    "partsWarranty": <"yes" | "no" | "unclear">,
    "laborWarranty": <"yes" | "no" | "unclear">,
    "diagnosticFee": <"yes" | "no" | "unclear">,
    "fluidDisposal": <"yes" | "no" | "unclear">
  }
}

Rules:
- totalPrice: Use the grand total, not individual line items
- repairs: List each distinct repair/service as a separate item
- partsType: "oem" = original manufacturer, "aftermarket" = third-party new, "reman" = remanufactured/rebuilt
- shopType: "dealer" if dealership, "chain" if Midas/Firestone/Jiffy Lube/Pep Boys/etc, "independent" otherwise
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

    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("auto-repair-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
