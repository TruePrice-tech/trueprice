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
    jobType: parsed.jobType || null,
    squareFootage: parsed.squareFootage || null,
    materialType: parsed.materialType || null,
    state: parsed.stateCode || null,
    service: parsed.lineItems ? parsed.lineItems.length : 0
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
    const key = `landscaping_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[landscaping-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
      text: `Analyze this landscaping quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "materialsTotal": <number or null - total materials cost>,
  "jobType": <"sod" | "pavers" | "retaining_wall" | "irrigation" | "tree_removal" | "grading" | "landscape_design" | "french_drain" | "mixed" | null>,
  "squareFootage": <number or null - area in square feet>,
  "linearFeet": <number or null - linear feet for walls/drains>,
  "materialType": <string or null - primary material (e.g. "bluestone pavers", "natural stone", "concrete block")>,
  "brand": <string or null - material brand if mentioned>,
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
    "designPlan": <"yes" | "no" | "unclear" - design/layout plan included>,
    "excavation": <"yes" | "no" | "unclear" - site excavation>,
    "drainage": <"yes" | "no" | "unclear" - drainage plan/French drain>,
    "baseMaterial": <"yes" | "no" | "unclear" - gravel/base layer>,
    "edging": <"yes" | "no" | "unclear" - border/edging>,
    "mulchRock": <"yes" | "no" | "unclear" - mulch or rock cover>,
    "plants": <"yes" | "no" | "unclear" - plants/shrubs/trees>,
    "irrigation": <"yes" | "no" | "unclear" - irrigation/sprinkler system>,
    "lighting": <"yes" | "no" | "unclear" - landscape lighting>,
    "sealing": <"yes" | "no" | "unclear" - paver/stone sealing>,
    "permits": <"yes" | "no" | "unclear" - permits>,
    "cleanup": <"yes" | "no" | "unclear" - cleanup and debris removal>,
    "warranty": <"yes" | "no" | "unclear" - warranty on work>
  },
  "gradingAssessment": <boolean - whether grading/slope assessment is mentioned>,
  "drainagePlan": <boolean - whether a drainage plan is included>,
  "possibleUpsells": [<string - descriptions of potential upsell items>],
  "redFlags": [<string - any concerning items found in the quote>],
  "summary": <string - brief plain-English summary of the quote and value assessment>
}

Rules:
- totalPrice: Use the grand total / bottom line
- jobType: Pick the best match. Use "mixed" if multiple major scopes
- redFlags: Include if any of the following are detected:
  * No drainage plan for hardscaping (pavers, retaining walls)
  * No grading/slope assessment before work begins
  * No base material specified for paver/patio install
  * No compaction mentioned for base layers
  * Retaining wall over 4 feet with no engineering/permit
  * No erosion control plan for grading work
  * No root protection plan for work near mature trees
  * Irrigation without backflow preventer
  * Any other suspicious or concerning items
- possibleUpsells: Flag landscape lighting, premium sealer, extended warranty, decorative edging, smart irrigation controller
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
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'landscaping-pricing-model.json'), 'utf-8'));

      const jobType = parsed.jobType || null;
      const sqft = parsed.squareFootage || null;

      // Map job types to pricing keys
      const jobTypeMap = {
        "pavers": "paver_patio",
        "retaining_wall": "retaining_wall",
        "sod": "sod_installation",
        "landscape_design": "landscape_design_install",
        "french_drain": "french_drain",
        "grading": "grading_leveling"
      };

      const pricingKey = jobTypeMap[jobType] || null;
      const basePricing = pricingKey ? pricingData.basePricing?.[pricingKey] : null;

      // Determine region multiplier from state
      const stateCode = parsed.stateCode || null;
      const stateToRegion = {
        "AL":"south","AK":"west","AZ":"mountain","AR":"south","CA":"west","CO":"mountain",
        "CT":"northeast","DE":"northeast","FL":"southeast","GA":"southeast","HI":"west",
        "ID":"mountain","IL":"midwest","IN":"midwest","IA":"midwest","KS":"midwest",
        "KY":"southeast","LA":"south","ME":"northeast","MD":"northeast","MA":"northeast",
        "MI":"midwest","MN":"midwest","MS":"south","MO":"midwest","MT":"mountain",
        "NE":"midwest","NV":"mountain","NH":"northeast","NJ":"northeast","NM":"mountain",
        "NY":"northeast","NC":"southeast","ND":"midwest","OH":"midwest","OK":"south",
        "OR":"west","PA":"northeast","RI":"northeast","SC":"southeast","SD":"midwest",
        "TN":"southeast","TX":"south","UT":"mountain","VT":"northeast","VA":"southeast",
        "WA":"west","WV":"southeast","WI":"midwest","WY":"mountain","DC":"northeast"
      };
      const region = stateToRegion[stateCode] || "south";
      const regionMult = pricingData.laborMultiplierByRegion?.[region] || 1.0;

      let expectedRange = null;
      if (basePricing && sqft && basePricing.unit !== "project") {
        expectedRange = {
          low: Math.round((basePricing.low * sqft * regionMult) / (pricingData.roundTo || 50)) * (pricingData.roundTo || 50),
          high: Math.round((basePricing.high * sqft * regionMult) / (pricingData.roundTo || 50)) * (pricingData.roundTo || 50)
        };
      } else if (basePricing && basePricing.unit === "project") {
        expectedRange = {
          low: Math.round(basePricing.low * regionMult),
          high: Math.round(basePricing.high * regionMult)
        };
      } else if (basePricing && parsed.linearFeet) {
        expectedRange = {
          low: Math.round((basePricing.low * parsed.linearFeet * regionMult) / (pricingData.roundTo || 50)) * (pricingData.roundTo || 50),
          high: Math.round((basePricing.high * parsed.linearFeet * regionMult) / (pricingData.roundTo || 50)) * (pricingData.roundTo || 50)
        };
      }

      // Server-side red flag checks
      if (!parsed.redFlags) parsed.redFlags = [];
      if (!parsed.drainagePlan && (jobType === "pavers" || jobType === "retaining_wall")) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("drainage"))) {
          parsed.redFlags.push("No drainage plan included for hardscaping project. Water management is critical for longevity.");
        }
      }
      if (!parsed.gradingAssessment && (jobType === "pavers" || jobType === "sod" || jobType === "grading")) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("grading"))) {
          parsed.redFlags.push("No grading/slope assessment mentioned. Improper grading can cause water pooling and damage.");
        }
      }

      parsed.pricingContext = {
        state: stateCode,
        region: region,
        regionMultiplier: regionMult,
        jobType: jobType,
        jobLabel: basePricing?.label || null,
        expectedRange: expectedRange,
        source: "HomeAdvisor, Angi, RSMeans residential landscaping data"
      };

    } catch (e) {
      console.log("[landscaping-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII
    delete parsed.city;

    captureAnonymizedData("landscaping", parsed);

    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("landscaping-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
