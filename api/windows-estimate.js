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
    windowType: parsed.windowType || null,
    material: parsed.material || null,
    count: parsed.windowCount || null,
    energyStar: parsed.energyStarRated || null,
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
    const key = `windows_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[windows-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
      text: `Analyze this window replacement/installation quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "materialsTotal": <number or null - total materials/window cost>,
  "windowType": <"double_hung" | "casement" | "sliding" | "bay" | "bow" | "picture" | "awning" | "hopper" | null>,
  "material": <"vinyl" | "fiberglass" | "wood" | "aluminum" | "composite" | null>,
  "windowCount": <number or null - how many windows>,
  "energyStarRated": <boolean or null - ENERGY STAR certified windows>,
  "brand": <string or null - window brand name>,
  "modelNumber": <string or null - model if mentioned>,
  "glassType": <"double_pane" | "triple_pane" | "single_pane" | null>,
  "lowE": <boolean or null - Low-E coating included>,
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
    "partsItemized": <"yes" | "no" | "unclear" - windows and parts listed individually>,
    "permit": <"yes" | "no" | "unclear" - permits included>,
    "warranty": <"yes" | "no" | "unclear" - warranty terms stated>,
    "cleanup": <"yes" | "no" | "unclear" - debris removal/cleanup>,
    "timeline": <"yes" | "no" | "unclear" - project schedule stated>,
    "windowType": <"yes" | "no" | "unclear" - window type/material specified>,
    "energyStar": <"yes" | "no" | "unclear" - ENERGY STAR rating noted>
  },
  "warrantyFrame": <string or null - frame warranty duration>,
  "warrantyGlass": <string or null - glass warranty duration>,
  "warrantyLabor": <string or null - labor warranty duration>,
  "possibleUpsells": [<string - potential upsell items>],
  "redFlags": [<string - concerning items found>],
  "summary": <string - brief plain-English summary of the quote>
}

CRITICAL EXTRACTION RULES:
- ALWAYS extract dollar amounts. If you see ANY numbers that look like prices, extract them. A rough estimate is better than null.
- If you cannot find an explicit total, SUM the individual line item amounts.
- redFlags: ALWAYS identify at least one concern. Check for: missing warranty, missing itemization, no labor rate disclosed, no parts type specified, no permit mentioned, excessive fees. Real quotes almost always have transparency gaps.
- Never return null for a price field if there are dollar amounts visible anywhere in the document.

Rules:
- totalPrice: Use the grand total / bottom line, not sum of line items
- Mark scopeItems "yes" only if clearly present in the quote
- redFlags: Include if any of the following are detected:
  * No ENERGY STAR certification for new windows
  * No permit mentioned for structural window changes (resizing, new openings)
  * Single-pane glass quoted (outdated, poor insulation)
  * No Low-E coating on replacement windows
  * No cleanup/disposal of old windows included
  * Warranty is manufacturer-only with no labor coverage
  * Price per window seems unusually high or low for the material type
  * Any other suspicious or concerning items
- possibleUpsells: Flag triple-pane upgrades, argon gas fill, custom grids, exterior capping, smart glass
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
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'windows-pricing.json'), 'utf-8'));

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;

      // Match window type to commonJobs for expected range
      let expectedRange = null;
      const material = parsed.material || "vinyl";
      const windowType = parsed.windowType || "double_hung";
      const count = parsed.windowCount || 1;

      // Try to match a specific job key
      const jobKeyMap = {
        "vinyl": "vinyl_double_hung",
        "fiberglass": "fiberglass_window",
        "wood": "wood_window",
        "bay": "bay_window"
      };
      let matchKey = jobKeyMap[material] || jobKeyMap[windowType] || "vinyl_double_hung";
      if (windowType === "bay" || windowType === "bow") matchKey = "bay_window";

      // Check for whole-house pricing
      if (count >= 15) {
        matchKey = "whole_house_20";
      } else if (count >= 8) {
        matchKey = "whole_house_10";
      }

      const jobData = pricingData.commonJobs?.[matchKey];
      if (jobData && jobData.total) {
        if (jobData.per_unit && count > 1) {
          expectedRange = {
            low: Math.round(jobData.total[0] * count * stateMult),
            high: Math.round(jobData.total[1] * count * stateMult)
          };
        } else {
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

      // Compute scope score from scopeCheckItems
      let scopeScore = 0;
      let scopeMax = 0;
      if (pricingData.scopeCheckItems && parsed.scopeItems) {
        for (const item of pricingData.scopeCheckItems) {
          scopeMax += item.weight;
          if (parsed.scopeItems[item.key] === "yes") scopeScore += item.weight;
        }
      }

      parsed.pricingContext = {
        state: stateCode,
        stateMultiplier: stateMult,
        windowType: windowType,
        material: material,
        windowCount: count,
        expectedRange: expectedRange,
        scopeScore: scopeScore,
        scopeMax: scopeMax,
        scopeGrade: scopeMax > 0 ? (scopeScore / scopeMax >= 0.8 ? "A" : scopeScore / scopeMax >= 0.6 ? "B" : scopeScore / scopeMax >= 0.4 ? "C" : "D") : null,
        source: pricingData.metadata?.sources || "HomeAdvisor, Angi, window manufacturer data"
      };

    } catch (e) {
      console.log("[windows-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII before returning
    delete parsed.city;

    captureAnonymizedData("windows", parsed);

    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("windows-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
