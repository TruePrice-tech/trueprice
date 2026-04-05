import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed || !parsed.price) return null;
  return {
    v: vertical,
    ts: new Date().toISOString(),
    price: parsed.price,
    material: parsed.material || null,
    city: parsed.city || null,
    state: parsed.stateCode || null,
    roofSize: parsed.roofSize || null,
    scopeIncluded: parsed.scopeItems ? Object.values(parsed.scopeItems).filter(v => v === "included").length : null,
    scopeTotal: parsed.scopeItems ? Object.keys(parsed.scopeItems).length : null
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

const PQ_RATE_LIMIT_MAX = 10;
const PQ_RATE_LIMIT_WINDOW_SEC = 3600; // 1 hour

// In-memory fallback rate limiter when Redis is down
const memoryRateLimit = new Map();
function checkMemoryRateLimit(ip) {
  const now = Date.now();
  const entry = memoryRateLimit.get(ip);
  if (!entry || now - entry.start > PQ_RATE_LIMIT_WINDOW_SEC * 1000) {
    memoryRateLimit.set(ip, { count: 1, start: now });
    return true;
  }
  entry.count++;
  return entry.count <= PQ_RATE_LIMIT_MAX;
}

async function checkRateLimit(ip) {
  try {
    const key = `pq_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, PQ_RATE_LIMIT_WINDOW_SEC);
    return count <= PQ_RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[parse-quote] Redis rate limit error, falling back to in-memory:", e.message);
    return checkMemoryRateLimit(ip);
  }
}

export default async function handler(req, res) {
  // CORS
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

  // Rate limit by IP (10 req/hour - this calls Claude API)
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

    // Build the message content
    const content = [];

    // Add images first (Claude vision)
    if (images && images.length > 0) {
      for (const img of images.slice(0, 3)) { // Max 3 images
        // img should be a base64 data URL like "data:image/png;base64,..."
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

    // Add text
    content.push({
      type: "text",
      text: `Analyze this roofing contractor quote. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "price": <number or null — the total project price, not deposits or line items>,
  "material": <"architectural" | "asphalt" | "metal" | "tile" | null>,
  "materialLabel": <human readable material name or null>,
  "contractor": <contractor/company name or null>,
  "city": <customer/property city, NOT the contractor's business city>,
  "stateCode": <customer/property 2-letter state code, NOT the contractor's>,
  "roofSize": <number in sq ft or null>,
  "warrantyYears": <number or null>,
  "warranty": <warranty description or null>,
  "scopeItems": {
    "tearOff": <"included" | "excluded" | "unclear">,
    "underlayment": <"included" | "excluded" | "unclear">,
    "flashing": <"included" | "excluded" | "unclear">,
    "iceShield": <"included" | "excluded" | "unclear">,
    "dripEdge": <"included" | "excluded" | "unclear">,
    "ventilation": <"included" | "excluded" | "unclear">,
    "ridgeVent": <"included" | "excluded" | "unclear">,
    "starterStrip": <"included" | "excluded" | "unclear">,
    "ridgeCap": <"included" | "excluded" | "unclear">,
    "decking": <"included" | "excluded" | "unclear">,
    "disposal": <"included" | "excluded" | "unclear">,
    "permit": <"included" | "excluded" | "unclear">
  }
}

Rules:
- price: Use the TOTAL/grand total, not line items, deposits, or deductibles
- material: Choose the PRIMARY roofing material being installed, not materials being removed
- roofSize: Convert roofing squares to sq ft (1 square = 100 sq ft)
- scopeItems: Mark "included" only if clearly stated in the quote, "excluded" if explicitly excluded, "unclear" if not mentioned
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
        max_tokens: 1024,
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

    // Parse the JSON from Claude's response
    let parsed;
    try {
      // Try to extract JSON from the response (Claude sometimes wraps in markdown)
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(aiText);
    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    captureAnonymizedData("home", parsed); // fire and forget

    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("parse-quote error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
