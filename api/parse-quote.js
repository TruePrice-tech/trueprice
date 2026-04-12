import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";
import { runOcr, ocrTextLooksGood } from "./_ocr.js";
import { enrichWithCalibration } from "./_flywheel-read.js";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed || !parsed.price) return null;
  // No city -- state only for privacy
  return {
    v: vertical,
    ts: new Date().toISOString(),
    price: parsed.price,
    material: parsed.material || null,
    state: parsed.stateCode || null,
    roofSize: parsed.roofSize || null,
    service: parsed.service || null,
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
    let { text, images } = req.body;

    if (!text && (!images || images.length === 0)) {
      return res.status(400).json({ error: "No text or images provided" });
    }

    // OCR-FIRST PIPELINE: when caller sends image without OCR text,
    // run server-side OCR.space first. If text is good, drop the image
    // from the Claude call (10x cheaper). Comparison flows reuse this
    // endpoint for each individual quote, so OCR runs per-quote.
    if ((!text || text.length < 100) && images && images.length > 0) {
      const m = images[0] && images[0].match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (m) {
        const ocrResult = await runOcr(m[2], m[1]);
        if (ocrResult && ocrResult.text) {
          text = ocrResult.text;
          console.log(`[parse-quote] OCR extracted ${ocrResult.text.length} chars via ${ocrResult.source}`);
        }
      }
    }
    const useTextOnly = text && ocrTextLooksGood(text);

    // Build the message content
    const content = [];

    // Add images first (Claude vision) ONLY when OCR wasn't good enough
    if (!useTextOnly && images && images.length > 0) {
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

CRITICAL EXTRACTION RULES:
- ALWAYS extract dollar amounts. If you see ANY numbers that look like prices, extract them. A rough estimate is better than null.
- price: Use the TOTAL/grand total, not line items, deposits, or deductibles. If no explicit total, SUM line items.
- material: Choose the PRIMARY roofing material being installed, not materials being removed
- roofSize: Convert roofing squares to sq ft (1 square = 100 sq ft)
- scopeItems: Mark "included" only if clearly stated in the quote, "excluded" if explicitly excluded, "unclear" if not mentioned
- Never return null for price if there are dollar amounts visible anywhere in the document
- Return ONLY the JSON object, nothing else

- summary: ALWAYS explain WHY a price is high, low, or fair. Reference specific factors: material choice, scope breadth, warranty quality, labor complexity, brand premium. Never just say "above average" -- say "above average, likely due to premium materials and comprehensive warranty." This helps users understand the quote rather than weaponize a number against contractors.`
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

    // City-level pricing enrichment
    try {
      const multipliers = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'city-cost-multipliers.json'), 'utf-8'));
      const city = parsed.city || "";
      const stateCode = (parsed.stateCode || "").toUpperCase();
      const service = parsed.service || "roofing";
      const key = city + "|" + stateCode;
      const entry = multipliers[key];

      if (entry) {
        const svcMult = entry.serviceMultipliers?.[service] || entry.multiplier || 1.0;
        parsed.pricingContext = {
          city: city,
          state: stateCode,
          multiplier: svcMult,
          laborMult: entry.laborMult || 1.0,
          materialsMult: entry.materialsMult || 1.0,
          population: entry.population || null,
          source: "city_direct"
        };
      } else if (stateCode) {
        // State average fallback
        const stateCities = Object.entries(multipliers).filter(([k]) => k.endsWith("|" + stateCode));
        if (stateCities.length > 0) {
          const avgMult = stateCities.reduce((sum, [, v]) => sum + (v.serviceMultipliers?.[service] || v.multiplier || 1.0), 0) / stateCities.length;
          parsed.pricingContext = {
            state: stateCode,
            multiplier: Math.round(avgMult * 1000) / 1000,
            source: "state_avg"
          };
        }
      }
    } catch(e) {
      // Enrichment failed, continue without it
    }

    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || "";
    const _calState = (parsed.stateCode || "").toUpperCase();
    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "roofing" });

    captureAnonymizedData("home", parsed); // fire and forget

    // FLYWHEEL BRIDGE: write to cal:* aggregates so compare-flow quotes
    // improve future estimates (parse-quote previously only wrote to tp:pricing_data)
    try {
      const totalPrice = Number(parsed.price) || 0;
      if (totalPrice > 0 && req.headers["x-trueprice-test"] !== "1") {
        const cityLc = _calCity.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
        const st = _calState;
        const weight = 0.3;
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
          } catch (_) { /* best-effort */ }
        };
        if (st) {
          if (cityLc) await bump(`cal:${cityLc}:${st}:roofing`);
          await bump(`cal:metro:${st}:roofing`);
        }
      }
    } catch (_) { /* flywheel bridge is best-effort */ }

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
