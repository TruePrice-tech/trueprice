import { Redis } from "@upstash/redis";
import { runAbuseGuard, recordClaudeCall, storeImageCache } from "./_abuse-guard.js";
import { runOcr, ocrTextLooksGood } from "./_ocr.js";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed || !parsed.totalPrice) return null;
  return {
    v: vertical,
    ts: new Date().toISOString(),
    price: parsed.totalPrice,
    moveType: parsed.moveType || null,
    homeSize: parsed.homeSize || null,
    distance: parsed.distance || null,
    hourlyRate: parsed.hourlyRate || null,
    crewSize: parsed.crewSize || null,
    pickupState: parsed.pickupState || null,
    deliveryState: parsed.deliveryState || null
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
    const key = `mv_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[moving-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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

    // Abuse guard: burst detect, IP daily cap, suspicious patterns,
    // image dedup, global Claude ceiling. Returns cached result if hit.
    const _imageBuf = (req.body && req.body.images && req.body.images[0])
      ? Buffer.from((req.body.images[0].split(",")[1] || ""), "base64")
      : null;
    const _guard = await runAbuseGuard(req, { vertical: "moving", imageBytes: _imageBuf });
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
      text: `Analyze this moving company estimate/quote. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total estimated cost>,
  "moveType": <"local" | "long_distance" | "unknown">,
  "homeSize": <"studio" | "1br" | "2br" | "3br" | "4br" | null>,
  "estimatedWeight": <number in lbs or null>,
  "distance": <number in miles or null>,
  "crewSize": <number or null>,
  "hourlyRate": <number or null - per-hour rate for crew>,
  "estimatedHours": <number or null>,
  "companyName": <string or null>,
  "pickupCity": <string or null>,
  "pickupState": <2-letter state code or null>,
  "deliveryCity": <string or null>,
  "deliveryState": <2-letter state code or null>,
  "moveDate": <string or null - in YYYY-MM-DD if possible>,
  "isPeakSeason": <boolean - true if move date falls in May-September or around month-end>,
  "usdotNumber": <string or null - USDOT license number if present>,
  "lineItems": [
    {
      "description": <string - line item description>,
      "cost": <number or null>,
      "category": <"labor" | "packing" | "special_item" | "fee" | "insurance" | "storage" | "other">
    }
  ],
  "scopeItems": {
    "inventoryList": <"yes" | "no" | "unclear">,
    "pickupWindow": <"yes" | "no" | "unclear">,
    "deliveryWindow": <"yes" | "no" | "unclear">,
    "insurance": <"yes" | "no" | "unclear">,
    "weightEstimate": <"yes" | "no" | "unclear">,
    "usdotNumber": <"yes" | "no" | "unclear">,
    "cancellationPolicy": <"yes" | "no" | "unclear">,
    "stairsFees": <"yes" | "no" | "unclear">,
    "packingCosts": <"yes" | "no" | "unclear">,
    "fuelSurcharge": <"yes" | "no" | "unclear">
  },
  "redFlags": [<array of strings describing any concerning items found>]
}

CRITICAL EXTRACTION RULES:

1. TOTAL PRICE:
   - If the document SHOWS a labeled grand total (look for "Total", "Grand Total", "Binding Price", "Bound Total", "Estimate Total", "Quote Total", "Amount Due"), use that EXACT number. Do NOT sum line items if a grand total is present — the grand total is the source of truth.
   - Only sum line items when there is no labeled total ANYWHERE in the document.
   - Tax and fees are usually already included in the displayed grand total. Do not double-add them.
   - If line items appear to add up to a different number than the displayed total, trust the displayed total but add a redFlag noting the discrepancy.

2. ORIGIN AND DESTINATION CITIES:
   - pickupCity/pickupState: Look for "Origin", "From", "Pickup Address", "Loading Address", "Move From", "Ship From" markers. The city listed there is the pickup.
   - deliveryCity/deliveryState: Look for "Destination", "To", "Delivery Address", "Unloading Address", "Move To", "Ship To" markers. The city listed there is the delivery.
   - SANITY CHECK: If pickupCity and deliveryCity end up the same, you almost certainly mis-parsed one of them — re-read the document and try again.
   - Use full city names (e.g. "Denver" not "DEN", "Fort Worth" not "FTW") and 2-letter state codes.
   - If origin or destination is shown only as a state, leave the city null and fill the state.
   - If the only location info is a generic route like "Long distance" with no city names, leave both null.

3. MULTIPLE QUOTES IN ONE DOCUMENT:
   - If the document contains MORE THAN ONE distinct mover's quote (e.g. a comparison sheet showing two or three movers side by side), return the data from the FIRST quote in the document.
   - Add a redFlag stating: "Document contains multiple quotes (X movers visible). Only the first was analyzed — upload each quote separately for individual analysis."

4. COMPANY NAME:
   - Look for letterhead, logo text, "From:", "Mover:", "Carrier:", "Quote prepared by:", or any branding visible in the document.
   - If the company name is only visible in a logo image and no text matches, leave null.
   - Common moving brands to recognize: Two Men and a Truck, Allied Van Lines, United Van Lines, Mayflower, North American, Atlas Van Lines, U-Pack, PODS, Bellhop, Penske, Budget, College Hunks, You Move Me.

5. PRICES:
   - ALWAYS extract dollar amounts. If you see ANY numbers that look like prices, extract them. Never return null for a price field if there are dollar amounts visible anywhere in the document.
   - Negative numbers represent discounts/credits and should be extracted as negative.
   - Redacted/blacked-out prices should be extracted as null with a redFlag noting that the price was redacted.

6. RED FLAGS:
   - ALWAYS identify at least one concern. Check for: missing USDOT number, no written estimate, large required deposits over 25%, no cancellation policy, vague weight estimates, unusually low prices that suggest a scam, missing pickup/delivery windows, missing valuation coverage, non-binding language, line-item totals that don't match the grand total.
   - Real quotes almost always have transparency gaps — find them.

OTHER RULES:
- moveType: "local" if within same metro area or under 100 miles, "long_distance" if over 100 miles or interstate, "unknown" if unclear
- homeSize: Infer from inventory list or bedroom count if mentioned
- isPeakSeason: true if move is May-September or falls in last/first few days of any month
- lineItems: List each charge as a separate item with the appropriate category
- category: "labor" for crew/hourly charges, "packing" for boxes/materials/packing service, "special_item" for piano/hot tub/heavy items, "fee" for fuel/stair/long carry/shuttle, "insurance" for valuation/coverage, "storage" for storage-in-transit or warehouse
- scopeItems: Mark "yes" only if clearly present in the quote
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

    // Record successful Claude call against the global ceiling
    // and cache the parsed result by image hash for 24h dedup.
    await recordClaudeCall();
    if (_guard.imageHash) {
      await storeImageCache("moving", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    if (req.headers["x-trueprice-test"] !== "1") captureAnonymizedData("moving", parsed); // fire and forget — older tp:pricing_data list
    // Test-mode skip: synthetic test fixtures (X-TruePrice-Test: 1)
    // do NOT count toward the public counter or feed pricing aggregates.
    // Only real-world quotes from real users should affect either.
    const _isTestMode = req.headers["x-trueprice-test"] === "1";
    if (_isTestMode) {
      console.log("[test-mode] skipping flywheel writes for this request");
    }


    // Bridge to the unified calibration flywheel + global quote counter so
    // moving quote uploads light up the same systems as every other vertical.
    // Same pattern used by api/vehicle-estimate.js storeShopQuote.
    try {
      const totalPrice = Number(parsed && parsed.totalPrice) || 0;
      if (totalPrice > 0 && !_isTestMode) {
        await redis.incr("tp:total_quotes").catch(() => {});

        const cityLc = String((parsed && parsed.pickupCity) || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
        const st = String((parsed && parsed.pickupState) || "").toUpperCase();
        const homeSize = String((parsed && parsed.homeSize) || "unknown").toLowerCase();
        const moveType = String((parsed && parsed.moveType) || "unknown").toLowerCase();
        const service = "moving";
        // Trust score for AI-extracted real shop quotes is moderate.
        // Influence weight 0.3 — keeps a single quote from skewing the aggregate.
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
          // Same fallback chain as auto and other verticals
          if (cityLc) await bump(`cal:${cityLc}:${st}:${service}`);
          if (cityLc && homeSize !== "unknown") await bump(`cal:${cityLc}:${st}:${service}:${homeSize}`);
          await bump(`cal:metro:${st}:${service}`);
          if (homeSize !== "unknown") await bump(`cal:metro:${st}:${service}:${homeSize}`);
          if (moveType !== "unknown") await bump(`cal:metro:${st}:${service}:movetype_${moveType}`);
        }
      }
    } catch (calErr) {
      console.log("[moving-estimate] flywheel bridge error:", calErr.message);
    }

    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("moving-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
