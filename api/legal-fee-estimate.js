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
    const key = `legal_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[legal-fee-estimate] Redis rate limit error, falling back to in-memory:", e.message);
    return checkMemoryRateLimit(ip);
  }
}

export default async function handler(req, res) {
  const allowedOrigin = "https://truepricehq.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || "unknown";
  if (!(await checkRateLimit(clientIp))) {
    return res.status(429).json({ error: "Rate limit exceeded. Maximum 10 requests per hour." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

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
          content.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
        }
      }
    }

    content.push({
      type: "text",
      text: `Analyze this legal fee agreement, retainer agreement, or attorney invoice. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM DOCUMENT:\n" + text.substring(0, 10000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "documentType": <"retainer_agreement" | "invoice" | "fee_agreement" | "engagement_letter" | "other">,
  "firmName": <string or null>,
  "attorneyName": <string or null>,
  "practiceArea": <"family_law" | "personal_injury" | "criminal_defense" | "estate_planning" | "real_estate" | "business_law" | "immigration" | "bankruptcy" | "employment_law" | "intellectual_property" | "tax_law" | "general_litigation" | "other">,
  "feeStructure": <"hourly" | "flat_fee" | "contingency" | "hybrid" | "unclear">,
  "hourlyRate": <number or null>,
  "flatFee": <number or null>,
  "contingencyPercent": <number or null>,
  "retainerAmount": <number or null>,
  "estimatedTotalLow": <number or null>,
  "estimatedTotalHigh": <number or null>,
  "billingIncrement": <"6_min" | "10_min" | "15_min" | "other" | null>,
  "city": <string or null>,
  "stateCode": <2-letter state code or null>,
  "caseDescription": <brief string or null>,
  "lineItems": [
    {
      "description": <string>,
      "hours": <number or null>,
      "rate": <number or null>,
      "amount": <number or null>
    }
  ],
  "retainerChecks": {
    "scopeDefined": <"yes" | "no" | "unclear">,
    "rateStated": <"yes" | "no" | "unclear">,
    "billingIncrement": <"yes" | "no" | "unclear">,
    "retainerAmount": <"yes" | "no" | "unclear">,
    "expensePolicy": <"yes" | "no" | "unclear">,
    "estimatedCost": <"yes" | "no" | "unclear">,
    "communicationPolicy": <"yes" | "no" | "unclear">,
    "terminationClause": <"yes" | "no" | "unclear">,
    "conflictCheck": <"yes" | "no" | "unclear">,
    "feeDispute": <"yes" | "no" | "unclear">
  },
  "redFlags": [<array of strings describing concerns>],
  "summary": <string - one paragraph plain-English summary>
}

Rules:
- Extract the practice area from context (divorce = family_law, DUI = criminal_defense, etc.)
- For contingency agreements, note the percentage and what it applies to
- Flag billing in 15-minute increments as a concern
- Flag non-refundable retainers
- Flag vague scope definitions
- Flag charges for clerical work at attorney rates
- Flag any unusual or potentially unethical fee provisions
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
        max_tokens: 4096,
        messages: [{ role: "user", content }]
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

    return res.status(200).json({ success: true, source: "claude-haiku", data: parsed });

  } catch (error) {
    console.error("legal-fee-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
