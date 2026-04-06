import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed || !parsed.totalPrice) return null;
  return {
    v: vertical,
    ts: new Date().toISOString(),
    price: parsed.totalPrice,
    sidingType: parsed.sidingType || null,
    sqft: parsed.squareFootage || null,
    state: parsed.stateCode || null,
    items: parsed.lineItems ? parsed.lineItems.length : 0
  };
}

async function captureAnonymizedData(vertical, parsed) {
  try {
    const record = buildAnonymizedRecord(vertical, parsed);
    if (!record) return;
    await redis.lpush("tp:pricing_data", JSON.stringify(record));
    await redis.ltrim("tp:pricing_data", 0, 49999);
  } catch (e) {
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
    const key = `siding_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[siding-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
    return res.status(429).json({ error: "Rate limit exceeded. Maximum 10 requests per hour. Please try again later." });
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
          content.push({
            type: "image",
            source: { type: "base64", media_type: match[1], data: match[2] }
          });
        }
      }
    }

    content.push({
      type: "text",
      text: `Analyze this siding installation/replacement quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "materialsTotal": <number or null - total materials cost>,
  "sidingType": <"vinyl" | "fiber_cement" | "wood" | "engineered_wood" | "stone_veneer" | "stucco" | "aluminum" | null>,
  "squareFootage": <number or null - total siding square footage>,
  "brand": <string or null - siding brand (e.g. James Hardie, CertainTeed)>,
  "profile": <string or null - siding profile (e.g. lap, dutch lap, board and batten, shake)>,
  "city": <string or null - city from the quote>,
  "stateCode": <string or null - 2-letter state code>,
  "lineItems": [
    {
      "description": <string - line item description>,
      "laborCost": <number or null>,
      "materialCost": <number or null>,
      "lineTotal": <number or null>
    }
  ],
  "scopeItems": {
    "laborRate": <"yes" | "no" | "unclear" - labor rate clearly stated>,
    "partsItemized": <"yes" | "no" | "unclear" - materials listed individually>,
    "permit": <"yes" | "no" | "unclear" - permits included>,
    "warranty": <"yes" | "no" | "unclear" - warranty terms stated>,
    "cleanup": <"yes" | "no" | "unclear" - debris removal/cleanup>,
    "timeline": <"yes" | "no" | "unclear" - project schedule stated>,
    "materialType": <"yes" | "no" | "unclear" - siding material specified>,
    "insulation": <"yes" | "no" | "unclear" - insulation board included>,
    "houseWrap": <"yes" | "no" | "unclear" - house wrap / weather barrier mentioned>,
    "moistureBarrier": <"yes" | "no" | "unclear" - moisture barrier / rain screen>
  },
  "warrantyProduct": <string or null - product warranty duration>,
  "warrantyLabor": <string or null - labor warranty duration>,
  "oldSidingRemoval": <boolean or null - includes removal of old siding>,
  "possibleUpsells": [<string - potential upsell items>],
  "redFlags": [<string - concerning items found>],
  "summary": <string - brief plain-English summary of the quote>
}

Rules:
- totalPrice: Use the grand total / bottom line, not sum of line items
- Mark scopeItems "yes" only if clearly present in the quote
- redFlags: Include if any of the following are detected:
  * No house wrap / weather-resistant barrier mentioned
  * No moisture barrier or rain screen for fiber cement installs
  * No old siding removal included (installing over old siding can hide rot)
  * No flashing around windows/doors mentioned
  * Price per sqft seems unusually high or low for the material
  * No warranty mentioned
  * No permit for full re-side
  * Any other suspicious or concerning items
- possibleUpsells: Flag soffit/fascia replacement, house wrap upgrade, insulation board, custom trim, accent stone veneer
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

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'siding-pricing.json'), 'utf-8'));

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;

      // Match siding type to commonJobs
      let expectedRange = null;
      const sidingType = parsed.sidingType || "vinyl";
      const sqft = parsed.squareFootage || null;

      const jobKeyMap = {
        "vinyl": "vinyl_siding",
        "fiber_cement": "fiber_cement",
        "wood": "wood_siding",
        "engineered_wood": "engineered_wood",
        "stone_veneer": "stone_veneer"
      };
      const matchKey = jobKeyMap[sidingType] || "vinyl_siding";
      const jobData = pricingData.commonJobs?.[matchKey];

      if (jobData) {
        if (sqft && jobData.per_sqft) {
          expectedRange = {
            low: Math.round(jobData.per_sqft[0] * sqft * stateMult),
            high: Math.round(jobData.per_sqft[1] * sqft * stateMult)
          };
        } else if (jobData.total) {
          expectedRange = {
            low: Math.round(jobData.total[0] * stateMult),
            high: Math.round(jobData.total[1] * stateMult)
          };
        }
      }

      // Check for upsell patterns
      const serverUpsells = [];
      if (parsed.lineItems && pricingData.commonUpsells) {
        const allDescs = parsed.lineItems.map(li => (li.description || "").toLowerCase()).join(" ");
        for (const upsell of pricingData.commonUpsells) {
          const itemLower = upsell.item.toLowerCase();
          const itemWords = itemLower.split(/[\s\/]+/).filter(w => w.length > 3);
          if (itemWords.some(w => allDescs.includes(w)) || allDescs.includes(itemLower)) {
            serverUpsells.push({
              item: upsell.item,
              necessary: upsell.necessary,
              typicalCost: upsell.cost,
              notes: upsell.notes
            });
          }
        }
      }
      if (serverUpsells.length > 0) parsed.detectedUpsells = serverUpsells;

      // Compute scope score
      let scopeScore = 0;
      let scopeMax = 0;
      if (pricingData.scopeCheckItems && parsed.scopeItems) {
        for (const item of pricingData.scopeCheckItems) {
          scopeMax += item.weight;
          if (parsed.scopeItems[item.key] === "yes") scopeScore += item.weight;
        }
      }

      // Server-side red flag checks
      if (!parsed.redFlags) parsed.redFlags = [];
      if (parsed.scopeItems?.houseWrap === "no" || parsed.scopeItems?.houseWrap === "unclear") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("house wrap"))) {
          parsed.redFlags.push("No house wrap / weather-resistant barrier mentioned. This is critical for preventing moisture damage behind siding.");
        }
      }
      if (sidingType === "fiber_cement" && (parsed.scopeItems?.moistureBarrier === "no" || parsed.scopeItems?.moistureBarrier === "unclear")) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("moisture"))) {
          parsed.redFlags.push("No moisture barrier or rain screen mentioned for fiber cement siding. James Hardie requires a gap or rain screen per installation specs.");
        }
      }

      parsed.pricingContext = {
        state: stateCode,
        stateMultiplier: stateMult,
        sidingType: sidingType,
        squareFootage: sqft,
        expectedRange: expectedRange,
        scopeScore: scopeScore,
        scopeMax: scopeMax,
        scopeGrade: scopeMax > 0 ? (scopeScore / scopeMax >= 0.8 ? "A" : scopeScore / scopeMax >= 0.6 ? "B" : scopeScore / scopeMax >= 0.4 ? "C" : "D") : null,
        source: pricingData.metadata?.sources || "HomeAdvisor, Angi, siding contractor surveys"
      };

    } catch (e) {
      console.log("[siding-estimate] Pricing enrichment error:", e.message);
    }

    delete parsed.city;
    captureAnonymizedData("siding", parsed);

    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("siding-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
