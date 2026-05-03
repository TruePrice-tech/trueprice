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
    doorType: parsed.doorType || null,
    doorSize: parsed.doorSize || null,
    material: parsed.material || null,
    openerIncluded: parsed.openerIncluded || null,
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
    const key = `garage_door_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[garage-door-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
    const _guard = await runAbuseGuard(req, { vertical: "garage-door", cacheNamespace: "garage-door:v2", imageBytes: _imageBuf });
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
      text: `Analyze this garage door quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "materialsTotal": <number or null - total materials/equipment cost>,
  "doorType": <"single" | "double" | "custom_carriage" | null>,
  "doorSize": <string or null - dimensions like "16x7" or "8x7">,
  "material": <"steel_basic" | "steel_insulated" | "wood" | "aluminum" | "fiberglass" | "composite" | null>,
  "insulationRValue": <number or null - R-value of door insulation>,
  "openerIncluded": <boolean or null - whether a new opener is included>,
  "openerType": <"chain" | "belt" | "screw" | "wall_mount" | "direct_drive" | null>,
  "openerBrand": <string or null - opener brand>,
  "springType": <"torsion" | "extension" | null>,
  "springsIncluded": <boolean or null - new springs included>,
  "brand": <string or null - door brand>,
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
    "oldDoorRemoval": <"yes" | "no" | "unclear" - old door removal and disposal>,
    "tracks": <"yes" | "no" | "unclear" - tracks and hardware>,
    "springs": <"yes" | "no" | "unclear" - torsion or extension springs>,
    "opener": <"yes" | "no" | "unclear" - garage door opener>,
    "remotes": <"yes" | "no" | "unclear" - remotes and wall button>,
    "weatherstripping": <"yes" | "no" | "unclear" - weatherstripping and seals>,
    "insulation": <"yes" | "no" | "unclear" - door insulation>,
    "safetySensors": <"yes" | "no" | "unclear" - safety sensors and auto-reverse>,
    "keypad": <"yes" | "no" | "unclear" - wireless keypad>,
    "warranty": <"yes" | "no" | "unclear" - warranty (parts + labor)>,
    "permits": <"yes" | "no" | "unclear" - permits and inspections>
  },
  "warrantyParts": <string or null - parts warranty duration>,
  "warrantyLabor": <string or null - labor warranty duration>,
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
- redFlags: Include if any of the following are detected:
  * DIY spring replacement mentioned or implied (extremely dangerous, high-tension springs can cause serious injury or death)
  * No safety sensors or auto-reverse mechanism included with opener
  * No insulation R-value specified for insulated door
  * Extension springs without safety cables
  * No weatherstripping or bottom seal included
  * Opener without battery backup (required in some states)
  * No warranty on springs (should be lifetime on torsion)
  * Using extension springs instead of torsion on heavy doors
  * Any other suspicious or concerning items
- possibleUpsells: Flag smart home integration, Wi-Fi opener, keypad entry, premium weatherstripping, insulation upgrade, decorative hardware, windows
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

    // Record successful Claude call against the global ceiling
    // and cache the parsed result by image hash for 24h dedup.
    await recordClaudeCall();
    if (_guard.imageHash) {
      await storeImageCache("garage-door:v2", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'garage-door-pricing-model.json'), 'utf-8'));
      // Also load the rich pricing JSON for red-flag regex patterns + scope
      // weights. Keep `pricingData` (the simple model) for benchmark math
      // since the existing code branches on basePriceByType / multipliers.
      let richPricing = null;
      try {
        richPricing = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'garage-door-pricing.json'), 'utf-8'));
      } catch (rpErr) {
        console.log("[garage-door-estimate] rich pricing JSON not loaded:", rpErr.message);
      }

      const doorType = parsed.doorType || null;
      const material = parsed.material || null;
      const stateCode = parsed.stateCode || null;

      // Map door type to pricing key
      const typeMap = {
        "single": "single_car",
        "double": "double_car",
        "custom_carriage": "custom_carriage"
      };
      const typeKey = typeMap[doorType] || null;
      const baseData = typeKey ? pricingData.basePriceByType?.[typeKey] : null;

      // Material multiplier
      const matMult = pricingData.materialUpgrades?.[material]?.multiplier || 1.0;

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
      if (baseData) {
        const base = baseData.basePrice;
        // Low = base * material * region, High = base * 1.4 * material * region (install variance)
        expectedRange = {
          low: Math.round((base * matMult * regionMult) / (pricingData.roundTo || 25)) * (pricingData.roundTo || 25),
          high: Math.round((base * 1.4 * matMult * regionMult) / (pricingData.roundTo || 25)) * (pricingData.roundTo || 25)
        };
        // Add opener cost if included
        if (parsed.openerIncluded) {
          const openerBase = pricingData.basePriceByType?.opener_only?.basePrice || 450;
          expectedRange.low += Math.round(openerBase * regionMult);
          expectedRange.high += Math.round(openerBase * 1.3 * regionMult);
        }
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

      // Server-side red flag checks
      if (!parsed.redFlags) parsed.redFlags = [];

      // Check for DIY spring replacement
      const allDescs = (parsed.lineItems || []).map(li => (li.description || "").toLowerCase()).join(" ");
      if (allDescs.includes("diy") && allDescs.includes("spring")) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("diy spring"))) {
          parsed.redFlags.push("DIY spring replacement detected. Garage door springs are under extreme tension and can cause serious injury or death. Always hire a professional.");
        }
      }

      if (parsed.scopeItems?.safetySensors === "no" && parsed.openerIncluded) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("safety sensor"))) {
          parsed.redFlags.push("No safety sensors included with new opener. Federal law requires safety sensors on all automatic garage door openers.");
        }
      }

      if (parsed.material && parsed.material.includes("insulated") && !parsed.insulationRValue) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("r-value"))) {
          parsed.redFlags.push("Insulated door quoted but no R-value specified. R-value determines actual insulation performance (R-6 to R-18 typical).");
        }
      }

      // Apply rich-JSON red-flag regex patterns (DASMA wind rating, deposit
      // above 50%, no warranty stated, spring lifecycle, no door brand,
      // attached-garage insulation, etc.) — these were dead before because
      // the API didn't load garage-door-pricing.json.
      if (richPricing && Array.isArray(richPricing.redFlagPatterns)) {
        const _allText = ((text || "") + " " + ((parsed.lineItems || []).map(li => li.description || "").join(" "))).toLowerCase();
        for (const pat of richPricing.redFlagPatterns) {
          try {
            const primary = new RegExp(pat.regex, "i");
            const primaryMatch = primary.test(_allText);
            const inversePrimary = pat.matchInverse ? !primaryMatch : primaryMatch;
            if (!inversePrimary) continue;
            if (pat.secondaryRegex) {
              const secondary = new RegExp(pat.secondaryRegex, "i");
              const secondaryMatch = secondary.test(_allText);
              const inverseSec = pat.matchInverseSecondary ? !secondaryMatch : secondaryMatch;
              if (!inverseSec) continue;
            }
            if (!parsed.redFlags.some(f => f.toLowerCase().includes(pat.key.replace(/_/g, " ").slice(0, 12)))) {
              parsed.redFlags.push(pat.explanation);
            }
          } catch (rxErr) {
            console.log("[garage-door-estimate] red-flag regex error for " + pat.key + ":", rxErr.message);
          }
        }
      }

      parsed.pricingContext = {
        state: stateCode,
        region: region,
        regionMultiplier: regionMult,
        doorType: doorType,
        doorLabel: baseData?.label || null,
        materialMultiplier: matMult,
        expectedRange: expectedRange,
        brandTier: brandTier,
        source: "HomeAdvisor, Angi, Clopay/Amarr dealer pricing, RSMeans"
      };

    } catch (e) {
      console.log("[garage-door-estimate] Pricing enrichment error:", e.message);
    }

    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || "";
    const _calState = parsed.stateCode || parsed.state || "";
    delete parsed.city;
    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "garage-door" });

    if (req.headers["x-woogoro-test"] !== "1") captureAnonymizedData("garage_door", parsed);
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
        await guardedFlywheelBump(redis, "garage-door", totalPrice, cityLc, st, { incRealQuote: !!_imageBuf });
      }
    } catch (calErr) {
      console.log("[garage-door-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("garage-door-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
