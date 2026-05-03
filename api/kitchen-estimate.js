import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";
import { runAbuseGuard, recordClaudeCall, storeImageCache } from "./_abuse-guard.js";
import { runOcr, ocrTextLooksGood } from "./_ocr.js";
import { enrichWithCalibration } from "./_flywheel-read.js";
import { guardedFlywheelBump } from "./_flywheel-guard.js";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed || !parsed.totalPrice) return null;
  return {
    v: vertical,
    ts: new Date().toISOString(),
    price: parsed.totalPrice,
    remodelScope: parsed.remodelScope || null,
    cabinetType: parsed.cabinetType || null,
    countertopMaterial: parsed.countertopMaterial || null,
    appliancesIncluded: parsed.appliancesIncluded || null,
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
    const key = `kitchen_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[kitchen-estimate] Redis rate limit error, falling back to in-memory:", e.message);
    return checkMemoryRateLimit(ip);
  }
}

export default async function handler(req, res) {
  const allowedOrigin = "https://woogoro.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || "unknown";
  if (!(await checkRateLimit(clientIp))) {
    return res.status(429).json({ error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} requests per hour. Please try again later.` });
  }

    // Abuse guard: burst detect, IP daily cap, suspicious patterns,
    // image dedup, global Claude ceiling. Returns cached result if hit.
    const _imageBuf = (req.body && req.body.images && req.body.images[0])
      ? Buffer.from((req.body.images[0].split(",")[1] || ""), "base64")
      : null;
    const _guard = await runAbuseGuard(req, { vertical: "kitchen", cacheNamespace: "kitchen:v3-l6-2026-05-03", imageBytes: _imageBuf });
    if (!_guard.ok) {
      return res.status(_guard.status).json({ error: _guard.error });
    }
    if (_guard.cachedResult) {
      return res.status(200).json(_guard.cachedResult);
    }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  try {
    let { text, images } = req.body;
    if (!text && (!images || images.length === 0)) {
      return res.status(400).json({ error: "No text or images provided" });
    }

    // OCR-FIRST PIPELINE: when caller sends image without OCR text,
    // run server-side OCR.space first. If text is good, drop the image
    // from the Claude call (~10x cheaper). Falls back to Claude vision.
    if ((!text || text.length < 100) && images && images.length > 0) {
      const _firstImg = images[0];
      const _m = _firstImg && _firstImg.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (_m) {
        const _ocrResult = await runOcr(_m[2], _m[1]);
        if (_ocrResult && _ocrResult.text) {
          text = _ocrResult.text;
          console.log(`[ocr-first] extracted ${_ocrResult.text.length} chars via ${_ocrResult.source}`);
        }
      }
    }
    const _useTextOnly = text && ocrTextLooksGood(text);


    const content = [];
    if (!_useTextOnly && images && images.length > 0) {
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
      text: `Analyze this kitchen remodel quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "materialsTotal": <number or null - total materials cost>,
  "remodelScope": <"minor" | "midrange" | "major" | "cabinet_refacing" | null>,
  "kitchenSqFt": <number or null - kitchen square footage>,
  "cabinetType": <"reface" | "stock" | "semi_custom" | "custom" | null>,
  "cabinetBrand": <string or null - cabinet brand>,
  "countertopMaterial": <"granite" | "quartz" | "laminate" | "marble" | "butcher_block" | "solid_surface" | null>,
  "countertopSqFt": <number or null - countertop square footage>,
  "appliancesIncluded": <boolean or null - whether appliances are in the quote>,
  "applianceList": [<string - list of appliances included>],
  "applianceBrand": <string or null - appliance brand if mentioned>,
  "flooringType": <string or null - flooring material>,
  "city": <string or null - city from the quote>,
  "stateCode": <string or null - 2-letter state code>,
  "timeline": <string or null - estimated project timeline>,
  "lineItems": [
    {
      "description": <string - line item description>,
      "laborCost": <number or null>,
      "materialCost": <number or null>,
      "lineTotal": <number or null>
    }
  ],
  "scopeItems": {
    "demo": <"yes" | "no" | "unclear" - demolition and removal>,
    "cabinets": <"yes" | "no" | "unclear" - cabinets>,
    "countertops": <"yes" | "no" | "unclear" - countertops>,
    "flooring": <"yes" | "no" | "unclear" - flooring>,
    "backsplash": <"yes" | "no" | "unclear" - backsplash tile>,
    "plumbing": <"yes" | "no" | "unclear" - plumbing (sink, faucet, disposal)>,
    "electrical": <"yes" | "no" | "unclear" - electrical (outlets, lighting circuits)>,
    "appliances": <"yes" | "no" | "unclear" - appliances>,
    "lighting": <"yes" | "no" | "unclear" - lighting>,
    "painting": <"yes" | "no" | "unclear" - painting and trim>,
    "permits": <"yes" | "no" | "unclear" - permits>,
    "design": <"yes" | "no" | "unclear" - design and planning>,
    "warranty": <"yes" | "no" | "unclear" - warranty on workmanship>
  },
  "warrantyWorkmanship": <string or null - workmanship warranty duration>,
  "hasDesignPlan": <boolean - whether a design plan or layout is included>,
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
- remodelScope: "minor" = cosmetic (paint, hardware, countertops), "midrange" = new cabinets + counters + some appliances, "major" = full gut, layout changes, high-end everything
- redFlags: Include if any of the following are detected:
  * No design plan or layout drawing for a mid-range or major remodel
  * No appliance specs/models listed when appliances are included
  * No timeline provided for a major remodel (these typically take 8-16 weeks)
  * No permit mentioned for work involving plumbing, electrical, or structural changes
  * Countertop measurement says "approximate" with no template visit
  * No demolition/removal cost broken out (may be hidden markup)
  * Cabinet "custom" pricing with stock-level lead times (may not be truly custom)
  * No plumbing or electrical rough-in for layout changes
  * Labor cost below 30% of total (suspiciously low, may indicate cut corners)
  * Any other suspicious or concerning items
- possibleUpsells: Flag under-cabinet lighting, pot filler faucet, built-in wine fridge, drawer organizers, soft-close upgrades, pendant lighting, touchless faucet
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

      // Record successful Claude call against the global ceiling. Cache
      // write moved below — must run AFTER pricing enrichment + delete
      // parsed.city so cache hits include pricingContext (legal dive
      // 2026-05-03 cross-vertical L6 finding).
      await recordClaudeCall();
    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'kitchen-pricing-model.json'), 'utf-8'));

      const remodelScope = parsed.remodelScope || null;
      const stateCode = parsed.stateCode || null;
      const kitchenSqFt = parsed.kitchenSqFt || null;

      // Tier pricing
      const tierData = pricingData.basePriceByTier?.[remodelScope] || null;

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

      // Kitchen size multiplier
      let sizeMult = 1.0;
      if (kitchenSqFt) {
        if (kitchenSqFt < 100) sizeMult = 0.75;
        else if (kitchenSqFt <= 150) sizeMult = 1.0;
        else if (kitchenSqFt <= 200) sizeMult = 1.3;
        else sizeMult = 1.65;
      }

      let expectedRange = null;
      if (tierData) {
        const roundTo = pricingData.roundTo || 500;
        expectedRange = {
          low: Math.round((tierData.low * regionMult * sizeMult) / roundTo) * roundTo,
          high: Math.round((tierData.high * regionMult * sizeMult) / roundTo) * roundTo
        };
      }

      // Server-side red flag checks
      if (!parsed.redFlags) parsed.redFlags = [];

      if (!parsed.hasDesignPlan && (remodelScope === "midrange" || remodelScope === "major")) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("design plan"))) {
          parsed.redFlags.push("No design plan or layout included for a " + (remodelScope === "major" ? "major" : "mid-range") + " remodel. A detailed design prevents costly mid-project changes.");
        }
      }

      if (parsed.appliancesIncluded && (!parsed.applianceList || parsed.applianceList.length === 0)) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("appliance spec"))) {
          parsed.redFlags.push("Appliances included in quote but no specific models or specs listed. Get exact model numbers to verify pricing.");
        }
      }

      if (remodelScope === "major" && !parsed.timeline) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("timeline"))) {
          parsed.redFlags.push("No timeline provided for major kitchen remodel. Typical major remodels take 8-16 weeks. A missing timeline often leads to project delays.");
        }
      }

      // Check labor ratio
      if (parsed.totalPrice && parsed.laborTotal) {
        const laborRatio = parsed.laborTotal / parsed.totalPrice;
        if (laborRatio < 0.30) {
          if (!parsed.redFlags.some(f => f.toLowerCase().includes("labor cost"))) {
            parsed.redFlags.push(`Labor is only ${Math.round(laborRatio * 100)}% of the total. Kitchen remodel labor is typically 30-40%. Low labor costs may indicate inexperienced workers or cut corners.`);
          }
        }
      }

      parsed.pricingContext = {
        state: stateCode,
        region: region,
        regionMultiplier: regionMult,
        remodelScope: remodelScope,
        scopeLabel: tierData?.label || null,
        sizeMultiplier: sizeMult,
        expectedRange: expectedRange,
        source: "NKBA, HomeAdvisor, Angi, RSMeans kitchen remodeling data"
      };

    } catch (e) {
      console.log("[kitchen-estimate] Pricing enrichment error:", e.message);
    }

    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || "";
    const _calState = parsed.stateCode || parsed.state || "";
    delete parsed.city;

    // L6 cross-vertical: cache write happens HERE so cached payload includes
    // pricingContext + excludes the inflight parsed.city.
    if (_guard.imageHash) {
      await storeImageCache(
        "kitchen:v3-l6-2026-05-03",
        _guard.imageHash,
        { success: true, source: "claude-haiku", data: parsed }
      );
    }

    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "kitchen" });

    if (req.headers["x-woogoro-test"] !== "1") captureAnonymizedData("kitchen", parsed);
    // Test-mode skip: synthetic test fixtures (X-Woogoro-Test: 1)
    // do NOT count toward the public counter or feed pricing aggregates.
    // Only real-world quotes from real users should affect either.
    const _isTestMode = req.headers["x-woogoro-test"] === "1";
    if (_isTestMode) {
      console.log("[test-mode] skipping flywheel writes for this request");
    }



    // FLYWHEEL BRIDGE: guarded write to cal:* aggregates
    try {
      const totalPrice = Number(parsed && parsed.totalPrice) || 0;
      if (totalPrice > 0 && !_isTestMode) {
        const cityLc = String(_calCity)
          .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
        const st = String(_calState).toUpperCase();
        await guardedFlywheelBump(redis, "kitchen", totalPrice, cityLc, st, { incRealQuote: !!_imageBuf });
      }
    } catch (calErr) {
      console.log("[kitchen-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("kitchen-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
