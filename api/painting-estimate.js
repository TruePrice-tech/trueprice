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
    paintBrand: parsed.paintBrand || null,
    paintQuality: parsed.paintQuality || null,
    numCoats: parsed.numCoats || null,
    squareFootage: parsed.squareFootage || null,
    numRooms: parsed.numRooms || null,
    state: parsed.stateCode || null,
    lineItemCount: parsed.lineItems ? parsed.lineItems.length : 0
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

const RATE_LIMIT_MAX = 60;
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
    const key = `painting_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[painting-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
      text: `Analyze this painting quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "partsTotal": <number or null - total paint + materials cost>,
  "laborRate": <number or null - hourly or per-sqft labor rate>,
  "jobType": <"interior_room" | "interior_whole_house" | "exterior_whole_house" | "cabinet_painting" | "deck_staining" | "trim_painting" | "ceiling_painting" | "accent_wall" | "popcorn_removal" | "pressure_washing" | null>,
  "paintBrand": <string or null - paint brand name>,
  "paintQuality": <"economy" | "mid" | "premium" | null - paint quality tier>,
  "numCoats": <number or null - number of coats>,
  "squareFootage": <number or null - square footage being painted>,
  "numRooms": <number or null - number of rooms>,
  "prepWorkIncluded": <boolean or null - whether prep work (sanding, patching, caulking) is included>,
  "primerIncluded": <boolean or null - whether primer is included>,
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
    "laborRate": <"yes" | "no" | "unclear" - labor rate or per-sqft price stated>,
    "paintBrand": <"yes" | "no" | "unclear" - paint brand/quality specified>,
    "coats": <"yes" | "no" | "unclear" - number of coats specified>,
    "prepWork": <"yes" | "no" | "unclear" - prep work included (sanding, patching, caulking)>,
    "primerIncluded": <"yes" | "no" | "unclear" - primer included or noted>,
    "warranty": <"yes" | "no" | "unclear" - warranty on workmanship>,
    "furniture": <"yes" | "no" | "unclear" - furniture moving/covering included>,
    "cleanup": <"yes" | "no" | "unclear" - cleanup and touch-up included>
  },
  "possibleUpsells": [<string - descriptions of potential upsell items>],
  "redFlags": [<string - any concerning items found in the quote>],
  "summary": <string - brief plain-English summary of the quote and value assessment>
}

CRITICAL EXTRACTION RULES:
- ALWAYS extract dollar amounts. If you see ANY numbers that look like prices, extract them. A rough estimate is better than null.
- If you cannot find an explicit total, SUM the individual line item amounts.
- redFlags: ALWAYS identify at least one concern. Check for: missing warranty, missing itemization, no labor rate disclosed, no parts type specified, no permit mentioned, excessive fees. Real quotes almost always have transparency gaps.
- Never return null for a price field if there are dollar amounts visible anywhere in the document.

- summary: ALWAYS explain WHY a price is high, low, or fair. Reference specific factors: material choice, scope breadth, warranty quality, labor complexity, brand premium. Never just say "above average" -- say "above average, likely due to premium materials and comprehensive warranty." This helps users understand the quote rather than weaponize a number against contractors.

Rules:
- totalPrice: Use the grand total / bottom line, not sum of line items
- jobType: Pick the best match from the enum. Use "interior_whole_house" for multi-room interior jobs
- paintQuality: "economy" for Glidden, Valspar, store brands; "mid" for Behr, PPG, Dutch Boy; "premium" for Sherwin-Williams, Benjamin Moore, Farrow & Ball
- scopeItems: Mark "yes" only if clearly present in the quote
- redFlags: Include if any of the following are detected:
  * No prep work mentioned (sanding, patching, caulking are essential for lasting results)
  * Only 1 coat stated (most jobs need 2 coats minimum for proper coverage)
  * No paint brand specified (could mean cheap paint)
  * No primer on bare surfaces, new drywall, or dark-to-light color changes
  * Pre-1978 home with no lead paint test mentioned (federal law requires testing)
  * Popcorn ceiling removal without asbestos testing (pre-1980 homes)
  * Any other suspicious or concerning items
- possibleUpsells: Flag color consultation, lead paint testing, wallpaper removal, accent walls, or any add-on that may not be necessary
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

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'painting-pricing.json'), 'utf-8'));

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;
      const jobType = parsed.jobType || null;
      const jobData = pricingData.commonJobs?.[jobType] || null;

      // Calculate expected price range for detected job type
      let expectedRange = null;
      if (jobData) {
        let baseLow = jobData.total[0];
        let baseHigh = jobData.total[1];

        // For per-room jobs, multiply by number of rooms
        if ((jobType === "interior_room" || jobType === "ceiling_painting") && parsed.numRooms && parsed.numRooms > 1) {
          baseLow *= parsed.numRooms;
          baseHigh *= parsed.numRooms;
        }

        // Apply paint quality multiplier
        const qualityMultipliers = { economy: 0.85, mid: 1.0, premium: 1.2 };
        const qualityMult = qualityMultipliers[parsed.paintQuality] || 1.0;

        expectedRange = {
          low: Math.round(baseLow * stateMult * qualityMult),
          high: Math.round(baseHigh * stateMult * qualityMult)
        };
      }

      // Paint quality info
      let paintQualityInfo = null;
      if (parsed.paintQuality && pricingData.paintQuality?.[parsed.paintQuality]) {
        paintQualityInfo = pricingData.paintQuality[parsed.paintQuality];
      }

      // Check for upsell patterns from commonUpsells
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
      if (serverUpsells.length > 0) {
        parsed.detectedUpsells = serverUpsells;
      }

      // Add pricing context
      parsed.pricingContext = {
        state: stateCode,
        stateMultiplier: stateMult,
        jobType: jobType,
        jobLabel: jobData?.label || null,
        expectedRange: expectedRange,
        paintQualityInfo: paintQualityInfo,
        source: pricingData.metadata?.sources || "HomeAdvisor, Angi, painting contractor surveys"
      };

    } catch (e) {
      console.log("[painting-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII before returning or storing
    delete parsed.city;

    captureAnonymizedData("painting", parsed); // fire and forget


    // FLYWHEEL BRIDGE: increment global counter + write to cal:* aggregates
    // so this vertical's quotes feed the same systems as moving and auto.
    try {
      const totalPrice = Number(parsed && parsed.totalPrice) || 0;
      if (totalPrice > 0) {
        await redis.incr("tp:total_quotes").catch(() => {});
        const cityLc = String((parsed && (parsed.city || parsed.cityName)) || "")
          .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
        const st = String((parsed && (parsed.stateCode || parsed.state)) || "").toUpperCase();
        const service = "painting";
        const weight = 0.3;
        if (st) {
          const bump = async (k) => {
            try {
              const ex = await redis.get(k) || { quotes: 0, weightedSum: 0, totalWeight: 0, avgPrice: 0, lastUpdated: 0 };
              const e = typeof ex === "string" ? JSON.parse(ex) : ex;
              e.quotes += 1;
              e.weightedSum += totalPrice * weight;
              e.totalWeight += weight;
              e.avgPrice = Math.round(e.weightedSum / e.totalWeight);
              e.lastUpdated = Date.now();
              await redis.set(k, JSON.stringify(e));
            } catch (e) { /* aggregates are best-effort */ }
          };
          if (cityLc) await bump(`cal:${cityLc}:${st}:painting`);
          await bump(`cal:metro:${st}:painting`);
        }
      }
    } catch (calErr) {
      console.log("[painting-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("painting-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
