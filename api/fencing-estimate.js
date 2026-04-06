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
    fenceType: parsed.fenceType || null,
    material: parsed.material || null,
    linearFeet: parsed.linearFeet || null,
    height: parsed.height || null,
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
    const key = `fencing_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[fencing-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
      text: `Analyze this fence installation/replacement quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "materialsTotal": <number or null - total materials cost>,
  "fenceType": <"privacy" | "picket" | "split_rail" | "chain_link" | "ornamental" | "ranch" | "shadow_box" | null>,
  "material": <"wood" | "vinyl" | "chain_link" | "aluminum" | "wrought_iron" | "composite" | "steel" | null>,
  "linearFeet": <number or null - total linear feet of fence>,
  "height": <number or null - fence height in feet>,
  "gateCount": <number or null - number of gates>,
  "gateType": <string or null - gate type (walk gate, double drive gate, etc.)>,
  "postType": <"concrete_footing" | "gravel_set" | "driven" | null - how posts are set>,
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
    "materialType": <"yes" | "no" | "unclear" - fence material specified>,
    "height": <"yes" | "no" | "unclear" - fence height specified>,
    "postType": <"yes" | "no" | "unclear" - post setting method stated>,
    "propertySurvey": <"yes" | "no" | "unclear" - property survey referenced>,
    "oldFenceRemoval": <"yes" | "no" | "unclear" - old fence removal included>,
    "utilityLocate": <"yes" | "no" | "unclear" - utility line locate (811) mentioned>
  },
  "warrantyProduct": <string or null - product/materials warranty>,
  "warrantyLabor": <string or null - labor warranty duration>,
  "costPerLinearFoot": <number or null - total / linear feet>,
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
- costPerLinearFoot: Calculate totalPrice / linearFeet if both available
- Mark scopeItems "yes" only if clearly present in the quote
- redFlags: Include if any of the following are detected:
  * No concrete footings for posts (gravel-set posts lean and fail within years)
  * No property survey mentioned (fence on wrong side of property line = tear down)
  * No utility locate / 811 call mentioned (hitting gas/electric lines is dangerous)
  * No permit mentioned (most jurisdictions require fence permits)
  * Wood fence with no stain/seal discussed (untreated wood rots in 3-5 years)
  * Price per linear foot unusually high or low for the material
  * No old fence removal plan when replacing existing fence
  * Any other suspicious or concerning items
- possibleUpsells: Flag stain/seal, concrete post footings upgrade, decorative post caps, automated gate opener, lattice topper
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
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'fencing-pricing.json'), 'utf-8'));

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;

      // Match fence material to commonJobs for expected range
      let expectedRange = null;
      const material = parsed.material || "wood";
      const linearFeet = parsed.linearFeet || null;
      const height = parsed.height || 6;
      const gateCount = parsed.gateCount || 0;

      const jobKeyMap = {
        "wood": height >= 6 ? "wood_privacy_6ft" : "wood_privacy_6ft",
        "vinyl": "vinyl_privacy",
        "chain_link": "chain_link_4ft",
        "aluminum": "aluminum_ornamental",
        "wrought_iron": "wrought_iron",
        "composite": "composite"
      };
      const matchKey = jobKeyMap[material] || "wood_privacy_6ft";
      const jobData = pricingData.commonJobs?.[matchKey];

      if (jobData && jobData.total && linearFeet) {
        if (jobData.per_foot) {
          let low = Math.round(jobData.total[0] * linearFeet * stateMult);
          let high = Math.round(jobData.total[1] * linearFeet * stateMult);
          // Add gate costs
          if (gateCount > 0) {
            const gateData = pricingData.commonJobs?.gate_install;
            if (gateData && gateData.total) {
              low += gateData.total[0] * gateCount;
              high += gateData.total[1] * gateCount;
            }
          }
          expectedRange = { low, high };
        }
      }

      // Cost per linear foot
      if (parsed.totalPrice && linearFeet) {
        parsed.costPerLinearFoot = Math.round((parsed.totalPrice / linearFeet) * 100) / 100;
      }

      // Server-side red flag checks
      if (!parsed.redFlags) parsed.redFlags = [];

      if (parsed.postType !== "concrete_footing" && parsed.scopeItems?.postType !== "yes") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("concrete") && f.toLowerCase().includes("footing"))) {
          parsed.redFlags.push("No concrete footings for posts mentioned. Posts set in gravel or dirt lean and fail much sooner. Concrete footings are the industry standard for lasting fences.");
        }
      }
      if (parsed.scopeItems?.propertySurvey === "no" || parsed.scopeItems?.propertySurvey === "unclear") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("survey"))) {
          parsed.redFlags.push("No property survey mentioned. Building a fence on the wrong side of a property line can result in forced removal. Get a survey or confirm property pins before installing.");
        }
      }
      if (parsed.scopeItems?.utilityLocate === "no" || parsed.scopeItems?.utilityLocate === "unclear") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("811") || f.toLowerCase().includes("utility"))) {
          parsed.redFlags.push("No utility locate (call 811) mentioned. Digging post holes without locating underground lines is dangerous and may be illegal.");
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

      parsed.pricingContext = {
        state: stateCode,
        stateMultiplier: stateMult,
        material: material,
        linearFeet: linearFeet,
        expectedRange: expectedRange,
        costPerLinearFoot: parsed.costPerLinearFoot || null,
        scopeScore: scopeScore,
        scopeMax: scopeMax,
        scopeGrade: scopeMax > 0 ? (scopeScore / scopeMax >= 0.8 ? "A" : scopeScore / scopeMax >= 0.6 ? "B" : scopeScore / scopeMax >= 0.4 ? "C" : "D") : null,
        source: pricingData.metadata?.sources || "HomeAdvisor, Angi, fencing contractor surveys"
      };

    } catch (e) {
      console.log("[fencing-estimate] Pricing enrichment error:", e.message);
    }

    delete parsed.city;
    captureAnonymizedData("fencing", parsed);

    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("fencing-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
