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
    insulationType: parsed.insulationType || null,
    location: parsed.location || null,
    rValue: parsed.rValue || null,
    squareFootage: parsed.squareFootage || null,
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
    const key = `insulation_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[insulation-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
      text: `Analyze this insulation quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "materialsTotal": <number or null - total materials cost>,
  "insulationType": <"blown_in" | "spray_foam_open" | "spray_foam_closed" | "batts" | "rigid_foam" | "mixed" | null>,
  "location": <"attic" | "walls" | "crawlspace" | "rim_joist" | "basement" | "multiple" | null>,
  "rValue": <number or null - R-value specified>,
  "rValueTarget": <number or null - target R-value for the area>,
  "squareFootage": <number or null - area to be insulated>,
  "thickness": <string or null - insulation thickness>,
  "brand": <string or null - insulation brand>,
  "existingInsulation": <string or null - description of existing insulation being removed/supplemented>,
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
    "airSealing": <"yes" | "no" | "unclear" - air sealing included>,
    "vaporBarrier": <"yes" | "no" | "unclear" - vapor barrier>,
    "ventBaffles": <"yes" | "no" | "unclear" - ventilation baffles for attic>,
    "oldRemoval": <"yes" | "no" | "unclear" - removal of old insulation>,
    "accessCreation": <"yes" | "no" | "unclear" - creating access points>,
    "energyAudit": <"yes" | "no" | "unclear" - energy audit>,
    "permits": <"yes" | "no" | "unclear" - permits>,
    "cleanup": <"yes" | "no" | "unclear" - cleanup and disposal>,
    "warranty": <"yes" | "no" | "unclear" - warranty>,
    "rValueCert": <"yes" | "no" | "unclear" - R-value certification>
  },
  "ventilationPlan": <boolean - whether ventilation plan is included for spray foam>,
  "airSealingIncluded": <boolean - whether air sealing is part of the scope>,
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
- totalPrice: Use the grand total / bottom line
- insulationType: "blown_in" for cellulose or fiberglass blown-in, "spray_foam_open" for open-cell, "spray_foam_closed" for closed-cell, "batts" for fiberglass or mineral wool batts, "rigid_foam" for foam board
- redFlags: Include if any of the following are detected:
  * No R-value specified for the insulation being installed
  * Spray foam insulation without a ventilation plan (can trap moisture and cause mold)
  * No air sealing included (air sealing is essential for insulation effectiveness)
  * Attic insulation without ventilation baffles (can block soffit vents)
  * R-value below DOE recommendations for the climate zone
  * No vapor barrier for crawlspace insulation
  * No mention of existing insulation assessment
  * Spray foam applied over knob-and-tube wiring (fire hazard)
  * No cleanup or disposal of old insulation containing vermiculite (possible asbestos)
  * Any other suspicious or concerning items
- possibleUpsells: Flag smart vents, radiant barrier, whole-house energy audit, attic fan, weatherstripping, duct sealing
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
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'insulation-pricing-model.json'), 'utf-8'));

      const insulationType = parsed.insulationType || null;
      const sqft = parsed.squareFootage || null;
      const stateCode = parsed.stateCode || null;

      // Type pricing
      const typeData = pricingData.basePriceByType?.[insulationType] || null;

      // Region multiplier
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
      if (typeData && sqft) {
        const roundTo = pricingData.roundTo || 50;
        expectedRange = {
          low: Math.round((typeData.lowPerSqft * sqft * regionMult) / roundTo) * roundTo,
          high: Math.round((typeData.highPerSqft * sqft * regionMult) / roundTo) * roundTo
        };
      }

      // Brand tier
      let brandTier = null;
      if (parsed.brand) {
        const brandLower = parsed.brand.toLowerCase();
        for (const [tier, brands] of Object.entries(pricingData.brands || {})) {
          if (brands.some(b => brandLower.includes(b.toLowerCase()))) {
            brandTier = tier;
            break;
          }
        }
      }

      // IRA 25C tax credit for insulation
      const taxCreditInfo = {
        program: "IRA Section 25C - Energy Efficient Home Improvement Credit",
        maxCredit: 1200,
        percentage: 30,
        description: "30% of project cost up to $1,200 for insulation and air sealing materials (not labor). Applies to insulation that meets IECC prescriptive criteria.",
        eligibleItems: ["Insulation materials", "Air sealing materials", "Ventilation baffles"],
        notEligible: ["Labor costs", "Removal of old insulation"],
        requiresForm: "IRS Form 5695",
        expiresYear: 2032
      };

      // Calculate estimated credit
      if (parsed.materialsTotal) {
        const estimatedCredit = Math.min(Math.round(parsed.materialsTotal * 0.30), 1200);
        taxCreditInfo.estimatedCredit = estimatedCredit;
        taxCreditInfo.effectiveCost = parsed.totalPrice ? parsed.totalPrice - estimatedCredit : null;
      } else if (parsed.totalPrice) {
        // Estimate materials at ~50% of total for insulation
        const estMaterials = parsed.totalPrice * 0.5;
        const estimatedCredit = Math.min(Math.round(estMaterials * 0.30), 1200);
        taxCreditInfo.estimatedCredit = estimatedCredit;
        taxCreditInfo.estimatedCreditNote = "Based on estimated material cost (materials breakdown not provided in quote)";
        taxCreditInfo.effectiveCost = parsed.totalPrice - estimatedCredit;
      }

      // Server-side red flag checks
      if (!parsed.redFlags) parsed.redFlags = [];

      if (!parsed.rValue && !parsed.rValueTarget) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("r-value"))) {
          parsed.redFlags.push("No R-value specified in the quote. Insulation should always specify the target R-value for your climate zone.");
        }
      }

      if ((insulationType === "spray_foam_open" || insulationType === "spray_foam_closed") && !parsed.ventilationPlan) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("ventilation"))) {
          parsed.redFlags.push("Spray foam insulation quoted without a ventilation plan. Spray foam in attics can create moisture problems without proper ventilation strategy.");
        }
      }

      if (!parsed.airSealingIncluded) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("air seal"))) {
          parsed.redFlags.push("No air sealing included. Air sealing is the single most important step for insulation effectiveness. Without it, insulation alone loses 25-40% of its value.");
        }
      }

      if (parsed.location === "attic" && parsed.scopeItems?.ventBaffles === "no") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("baffle"))) {
          parsed.redFlags.push("Attic insulation without ventilation baffles. Baffles prevent insulation from blocking soffit vents, which is essential for attic moisture control.");
        }
      }

      parsed.pricingContext = {
        state: stateCode,
        region: region,
        regionMultiplier: regionMult,
        insulationType: insulationType,
        typeLabel: typeData?.label || null,
        expectedRange: expectedRange,
        brandTier: brandTier,
        taxCredit: taxCreditInfo,
        source: "DOE, ENERGY STAR, IRA 25C credits, RSMeans insulation data"
      };

    } catch (e) {
      console.log("[insulation-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII
    delete parsed.city;

    captureAnonymizedData("insulation", parsed);


    // FLYWHEEL BRIDGE: increment global counter + write to cal:* aggregates
    // so this vertical's quotes feed the same systems as moving and auto.
    try {
      const totalPrice = Number(parsed && parsed.totalPrice) || 0;
      if (totalPrice > 0) {
        await redis.incr("tp:total_quotes").catch(() => {});
        const cityLc = String((parsed && (parsed.city || parsed.cityName)) || "")
          .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
        const st = String((parsed && (parsed.stateCode || parsed.state)) || "").toUpperCase();
        const service = "insulation";
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
          if (cityLc) await bump(`cal:${cityLc}:${st}:insulation`);
          await bump(`cal:metro:${st}:insulation`);
        }
      }
    } catch (calErr) {
      console.log("[insulation-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("insulation-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
