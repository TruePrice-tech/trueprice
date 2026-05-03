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
    repairType: parsed.repairType || null,
    numPiers: parsed.numPiers || null,
    warrantyType: parsed.warrantyType || null,
    transferable: parsed.transferable || null,
    engineerReport: parsed.engineerReport || null,
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
    const key = `foundation_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[foundation-estimate] Redis rate limit error, falling back to in-memory:", e.message);
    return checkMemoryRateLimit(ip);
  }
}

export default async function handler(req, res) {
  const allowedOrigin = "https://woogoro.com";
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
    return res.status(429).json({ error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} requests per hour. Please try again later.` });
  }

    // Abuse guard: burst detect, IP daily cap, suspicious patterns,
    // image dedup, global Claude ceiling. Returns cached result if hit.
    const _imageBuf = (req.body && req.body.images && req.body.images[0])
      ? Buffer.from((req.body.images[0].split(",")[1] || ""), "base64")
      : null;
    const _guard = await runAbuseGuard(req, { vertical: "foundation", cacheNamespace: "foundation:v3-l6-2026-05-03", imageBytes: _imageBuf });
    if (!_guard.ok) {
      return res.status(_guard.status).json({ error: _guard.error });
    }
    if (_guard.cachedResult) {
      return res.status(200).json(_guard.cachedResult);
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
      text: `Analyze this foundation repair quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "partsTotal": <number or null - total parts/materials cost>,
  "laborRate": <number or null - hourly labor rate if stated>,
  "repairType": <"pier_push" | "pier_helical" | "slabjacking" | "polyurethane_foam" | "wall_anchors" | "carbon_fiber_straps" | "crack_injection" | "waterproofing_interior" | "waterproofing_exterior" | "french_drain" | "sump_pump_foundation" | null>,
  "repairMethod": <string or null - specific repair method described>,
  "numPiers": <number or null - number of piers, anchors, or straps>,
  "warrantyType": <"lifetime" | "limited" | "none" | null>,
  "transferable": <boolean or null - whether warranty is transferable to new owner>,
  "engineerReport": <boolean or null - whether a structural engineer report is referenced or included>,
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
    "engineerReport": <"yes" | "no" | "unclear" - structural engineer report referenced>,
    "repairMethod": <"yes" | "no" | "unclear" - repair method clearly specified>,
    "numPiers": <"yes" | "no" | "unclear" - number of piers/anchors specified>,
    "permit": <"yes" | "no" | "unclear" - permits included>,
    "warranty": <"yes" | "no" | "unclear" - warranty (transferable, lifetime preferred)>,
    "drainage": <"yes" | "no" | "unclear" - drainage/root cause addressed>,
    "timeline": <"yes" | "no" | "unclear" - project timeline stated>,
    "cleanup": <"yes" | "no" | "unclear" - cleanup and restoration included>
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
- repairType: Pick the best match from the enum
- numPiers: Count of individual piers, anchors, or carbon fiber straps
- engineerReport: true only if a structural engineer assessment is clearly referenced
- scopeItems: Mark "yes" only if clearly present in the quote
- redFlags: Include if any of the following are detected:
  * No structural engineer assessment before recommending repairs
  * Quote given over the phone without inspecting the foundation in person
  * Recommending piers when crack injection would suffice (minor cracks only)
  * Pressure tactics (e.g. "sign today" discounts, scare language about imminent collapse)
  * No warranty or non-transferable warranty on structural work
  * Not addressing the root cause (drainage, grading, gutters)
  * No permit mentioned (required in most jurisdictions for structural work)
  * Any other suspicious or concerning items
- possibleUpsells: Flag cosmetic crack repair, full waterproofing bundles, drainage upgrades, or any add-on that may not be necessary
- IMPORTANT: Always note in the summary that homeowners should get an independent structural engineer report before accepting any foundation repair quote
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

      // Record successful Claude call. Cache write moved below (legal dive
      // 2026-05-03 cross-vertical L6 finding).
      await recordClaudeCall();
    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'foundation-pricing.json'), 'utf-8'));

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;
      const repairType = parsed.repairType || null;
      const jobData = pricingData.commonJobs?.[repairType] || null;

      // Calculate expected price range for detected repair type
      let expectedRange = null;
      if (jobData) {
        let baseLow = jobData.total[0];
        let baseHigh = jobData.total[1];

        // For per-pier/per-anchor jobs, multiply by number of piers
        const perUnitTypes = ["pier_push", "pier_helical", "wall_anchors", "carbon_fiber_straps"];
        if (perUnitTypes.includes(repairType) && parsed.numPiers && parsed.numPiers > 1) {
          baseLow *= parsed.numPiers;
          baseHigh *= parsed.numPiers;
        }

        expectedRange = {
          low: Math.round(baseLow * stateMult),
          high: Math.round(baseHigh * stateMult)
        };
      }

      // Always recommend structural engineer report
      if (!parsed.engineerReport) {
        if (!parsed.redFlags) parsed.redFlags = [];
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("structural engineer"))) {
          parsed.redFlags.push("No structural engineer report referenced. We strongly recommend getting an independent structural engineer assessment ($300-$800) before accepting any foundation repair quote.");
        }
      }

      // Flag non-transferable warranty
      if (parsed.transferable === false) {
        if (!parsed.redFlags) parsed.redFlags = [];
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("non-transferable"))) {
          parsed.redFlags.push("Warranty is non-transferable. Foundation repair warranties should be transferable to protect resale value.");
        }
      }

      // Add structural engineer report cost reference
      const engineerReportData = pricingData.commonJobs?.structural_engineer_report || null;

      // Add pricing context
      parsed.pricingContext = {
        state: stateCode,
        stateMultiplier: stateMult,
        repairType: repairType,
        repairLabel: jobData?.label || null,
        expectedRange: expectedRange,
        urgency: jobData?.urgency || null,
        engineerReportCost: engineerReportData ? engineerReportData.total : [300, 800],
        engineerReportNote: "Get an independent structural engineer report BEFORE accepting any foundation repair quote.",
        source: pricingData.metadata?.sources || "HomeAdvisor, Angi, structural engineer surveys, foundation contractor data"
      };

    } catch (e) {
      console.log("[foundation-estimate] Pricing enrichment error:", e.message);
    }

    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || "";
    const _calState = parsed.stateCode || parsed.state || "";
    delete parsed.city;

    // L6: cache write happens HERE so cached payload includes pricingContext.
    if (_guard.imageHash) {
      await storeImageCache(
        "foundation:v3-l6-2026-05-03",
        _guard.imageHash,
        { success: true, source: "claude-haiku", data: parsed }
      );
    }

    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "foundation" });

    if (req.headers["x-woogoro-test"] !== "1") captureAnonymizedData("foundation", parsed); // fire and forget
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
        await guardedFlywheelBump(redis, "foundation", totalPrice, cityLc, st, { incRealQuote: !!_imageBuf });
      }
    } catch (calErr) {
      console.log("[foundation-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("foundation-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
