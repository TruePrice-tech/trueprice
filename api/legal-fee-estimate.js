import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed) return null;
  return {
    v: vertical,
    ts: new Date().toISOString(),
    feeStructure: parsed.feeStructure || null,
    hourlyRate: parsed.hourlyRate || null,
    flatFee: parsed.flatFee || null,
    contingencyPct: parsed.contingencyPercent || null,
    retainerAmount: parsed.retainerAmount || null,
    practiceArea: parsed.practiceArea || null,
    billingIncrement: parsed.billingIncrement || null,
    lineItemCount: parsed.lineItems ? parsed.lineItems.length : 0,
    redFlagCount: parsed.redFlags ? parsed.redFlags.length : 0,
    state: parsed.stateCode || null
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
  "firmSize": <"solo" | "small" | "midsize" | "large" | "biglaw" | null>,
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
  "blockBillingEntries": [<array of line item indices (0-based) where block billing is detected>],
  "vagueEntries": [<array of line item indices (0-based) with vague descriptions>],
  "paralegalWorkAtAttorneyRate": [<array of line item indices (0-based) where clerical work is billed at attorney rate>],
  "overheadExpenses": [<array of strings describing overhead items being billed as expenses>],
  "estimatedIncrementOvercharge": <number or null - estimated $ overcharged due to 15-min vs 6-min increments>,
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

CRITICAL EXTRACTION RULES:
- ALWAYS extract dollar amounts. If you see ANY numbers that look like prices, extract them. A rough estimate is better than null.
- If you cannot find an explicit total, SUM the individual line item amounts.
- redFlags: ALWAYS identify at least one concern. Check for: missing warranty, missing itemization, no labor rate disclosed, no parts type specified, no permit mentioned, excessive fees. Real quotes almost always have transparency gaps.
- Never return null for a price field if there are dollar amounts visible anywhere in the document.

- summary: ALWAYS explain WHY a price is high, low, or fair. Reference specific factors: material choice, scope breadth, warranty quality, labor complexity, brand premium. Never just say "above average" -- say "above average, likely due to premium materials and comprehensive warranty." This helps users understand the quote rather than weaponize a number against contractors.

Rules:
- Extract the practice area from context (divorce = family_law, DUI = criminal_defense, etc.)
- For contingency agreements, note the percentage and what it applies to
- Infer firmSize from context: solo (1 attorney), small (2-10), midsize (11-50), large (51-200), biglaw (200+). Use null if unknown.
- Flag block billing: entries with multiple tasks in one time entry (commas/semicolons separating tasks like "research, draft motion, call client") with > 1.0 hours. Add their indices to blockBillingEntries.
- Flag vague entries: descriptions like "research", "review file", "memo to file", "attention to matter", "work on case" without specifics. Add their indices to vagueEntries.
- Flag paralegal work at attorney rate: filing, copying, scheduling, calendar entries, organizing billed at $200+/hr. Add their indices to paralegalWorkAtAttorneyRate.
- Flag overhead expenses: copies charged > $0.10/page, fax charges, postage, generic "administrative fee". List them in overheadExpenses.
- If 15-minute increments detected, estimate the overcharge vs 6-minute for short entries (emails, brief calls). For each short entry (likely < 6 min), the overcharge is (0.25 - 0.1) * rate. Sum these into estimatedIncrementOvercharge.
- Flag non-refundable retainers
- Flag vague scope definitions
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

    // Enrich with local pricing data
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'legal-fee-pricing.json'), 'utf-8'));
      const stateCode = (parsed.stateCode || "").toUpperCase();
      const firmSize = parsed.firmSize || null;
      const practiceArea = parsed.practiceArea || "general_litigation";
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;
      const firmSizeMult = pricingData.firmSizeMultipliers?.[firmSize] || 1.0;

      // Calculate adjusted market rate
      const paData = pricingData.hourlyRatesByPracticeArea?.[practiceArea];
      const baseRate = paData?.rates?.mid || pricingData.metadata?.nationalAvgHourlyRate || 349;
      const adjustedRate = Math.round(baseRate * stateMult * firmSizeMult);

      const pricingContext = {
        state: stateCode || null,
        stateMultiplier: stateMult,
        firmSize: firmSize,
        firmSizeMultiplier: firmSizeMult,
        adjustedMarketRate: adjustedRate,
        marketRateRange: paData ? [
          Math.round(paData.rates.low * stateMult * firmSizeMult),
          Math.round(paData.rates.high * stateMult * firmSizeMult)
        ] : null,
        source: "Clio Legal Trends 2025, LawPay, state bar surveys"
      };

      // Include flat fee comparison if available
      if (paData?.flatFees) {
        pricingContext.flatFeeComparison = {};
        for (const [key, range] of Object.entries(paData.flatFees)) {
          pricingContext.flatFeeComparison[key] = [
            Math.round(range[0] * stateMult),
            Math.round(range[1] * stateMult)
          ];
        }
      }

      parsed.pricingContext = pricingContext;

      // Calculate retainer check score
      if (parsed.retainerChecks && pricingData.retainerCheckItems) {
        let totalWeight = 0;
        let passingWeight = 0;
        for (const item of pricingData.retainerCheckItems) {
          totalWeight += item.weight;
          const val = parsed.retainerChecks[item.key];
          if (val === "yes") passingWeight += item.weight;
        }
        parsed.retainerCheckScore = totalWeight > 0 ? Math.round((passingWeight / totalWeight) * 100) : null;
      }
    } catch (e) {
      // Pricing enrichment failed -- still return AI results
      console.log("[legal-fee-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII before returning or storing
    delete parsed.attorneyName;

    captureAnonymizedData("legal", parsed); // fire and forget

    return res.status(200).json({ success: true, source: "claude-haiku", data: parsed });

  } catch (error) {
    console.error("legal-fee-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
