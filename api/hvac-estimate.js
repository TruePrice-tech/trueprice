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
    systemType: parsed.systemType || null,
    seer: parsed.seer || null,
    afue: parsed.afue || null,
    tonnage: parsed.tonnage || null,
    brand: parsed.brand || null,
    state: parsed.stateCode || null,
    service: parsed.lineItems ? parsed.lineItems.length : 0
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
    const key = `hvac_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[hvac-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
    return res.status(429).json({ error: "Rate limit exceeded. Maximum 10 requests per hour. Please try again later." });
  }

    // Abuse guard: burst detect, IP daily cap, suspicious patterns,
    // image dedup, global Claude ceiling. Returns cached result if hit.
    const _imageBuf = (req.body && req.body.images && req.body.images[0])
      ? Buffer.from((req.body.images[0].split(",")[1] || ""), "base64")
      : null;
    const _guard = await runAbuseGuard(req, { vertical: "hvac", cacheNamespace: "hvac-v2-nullbetter", imageBytes: _imageBuf });
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
      text: `Analyze this HVAC quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "contractor": <string or null - HVAC contracting company name. Look at the top of the quote (letterhead), header, footer, signature line, or "from"/"prepared by" sections. Extract the company name even if it's in a logo image. This is REQUIRED whenever a name is visible.>,
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "laborCost": <number or null - same as laborTotal, alias for compatibility>,
  "equipmentTotal": <number or null - total equipment/materials cost>,
  "equipmentCost": <number or null - same as equipmentTotal, alias for compatibility>,
  "systemType": <"central_ac" | "heat_pump" | "gas_furnace" | "mini_split" | "full_system" | "geothermal" | null>,
  "brand": <string or null - equipment brand name (Carrier, Trane, Lennox, Goodman, Rheem, York, Mitsubishi, Daikin, etc.) - look in line item descriptions and equipment lists>,
  "modelNumber": <string or null - equipment model number>,
  "seer": <number or null - SEER or SEER2 efficiency rating>,
  "afue": <number or null - furnace efficiency percentage>,
  "tonnage": <number or null - system tonnage/capacity>,
  "btu": <number or null - BTU rating if tonnage not given>,
  "zones": <number or null - number of zones for mini-splits>,
  "refrigerantType": <string or null - R410A, R32, R454B, R22, etc.>,
  "city": <string or null - city from the quote>,
  "stateCode": <string or null - 2-letter state code>,
  "homeSqFt": <number or null - home square footage if mentioned>,
  "warrantyPartsYears": <number or null - parts warranty in YEARS as a number, e.g. 10 for "10 years">,
  "warrantyLaborYears": <number or null - labor warranty in YEARS as a number, e.g. 2 for "2 years">,
  "lineItems": [
    {
      "description": <string - line item description>,
      "laborCost": <number or null>,
      "equipmentCost": <number or null>,
      "lineTotal": <number or null>
    }
  ],
  "scopeItems": {
    "equipment": <"yes" | "no" | "unclear" - condenser + air handler/furnace included>,
    "lineSet": <"yes" | "no" | "unclear" - new refrigerant line set>,
    "thermostat": <"yes" | "no" | "unclear" - thermostat included/upgraded>,
    "ductwork": <"yes" | "no" | "unclear" - ductwork inspection or modification>,
    "electrical": <"yes" | "no" | "unclear" - electrical disconnect and wiring>,
    "pad": <"yes" | "no" | "unclear" - equipment pad for condenser>,
    "drainLine": <"yes" | "no" | "unclear" - condensate drain line>,
    "filterRack": <"yes" | "no" | "unclear" - filter rack or cabinet>,
    "permit": <"yes" | "no" | "unclear" - permits and inspections>,
    "disposal": <"yes" | "no" | "unclear" - old equipment removal>,
    "warranty": <"yes" | "no" | "unclear" - warranty terms stated>,
    "loadCalc": <"yes" | "no" | "unclear" - Manual J load calculation>
  },
  "warrantyParts": <string or null - parts warranty duration e.g. "10 years">,
  "warrantyLabor": <string or null - labor warranty duration e.g. "2 years">,
  "possibleUpsells": [<string - descriptions of potential upsell items>],
  "oversizingFlag": <boolean - true if tonnage seems too large for the stated home size>,
  "redFlags": [<string - any concerning items found in the quote>],
  "summary": <string - brief plain-English summary of the quote and value assessment>
}

CRITICAL EXTRACTION RULES — NULL IS BETTER THAN WRONG:
- NEVER fabricate or guess. If you cannot read a value clearly from the document, return null.
- DO NOT default systemType to "central_ac" or any common type when uncertain — return null instead.
- DO NOT invent a totalPrice when none is visible. Return null and let the UI prompt the user.
- If you can read SOME dollar amounts but cannot identify the grand total with confidence, prefer summing visible line items only when the line items clearly add up; otherwise return null.
- If the OCR text is sparse, garbled, or missing key fields (no contractor letterhead, no clear equipment description, no clear total), return null for the uncertain fields and set "confidence": "low" at the top level.
- redFlags: identify concerns ONLY when actually visible in the source. Do not invent transparency gaps to fill the array. An empty redFlags array is acceptable.
- summary: if you don't have enough data to explain WHY a price is high, low, or fair, write "Insufficient data to assess this quote — please verify the extracted fields manually." Do not invent reasoning.

Add this top-level field to your JSON output:
  "confidence": <"high" | "medium" | "low" - your confidence in the overall extraction. Use "low" if more than 2 fields are null/uncertain.>

Rules:
- totalPrice: Use the grand total / bottom line, not sum of line items. Return null if not clearly visible.
- systemType: "central_ac" for cooling only, "heat_pump" for heat pump (heats + cools), "gas_furnace" for furnace only, "mini_split" for ductless, "full_system" for AC + furnace combo, "geothermal" for ground-source. Return null if not clearly stated in the source.
- seer: Extract SEER or SEER2 rating as a number (e.g. 16, 20). Use the higher if both SEER and SEER2 are listed
- afue: Furnace efficiency as a whole number percentage (e.g. 96 for 96% AFUE)
- tonnage: System size in tons (e.g. 3.0, 2.5)
- scopeItems: Mark "yes" only if clearly present in the quote
- oversizingFlag: Set true if tonnage > 1 ton per 500 sqft of home (e.g. 4 ton for 1500 sqft home is oversized)
- redFlags: Include if any of the following are detected:
  * SEER rating below 15 (below 2023 federal minimum for new equipment)
  * R-22 (Freon) refrigerant mentioned (phased out, extremely expensive)
  * CRITICAL: R-410A refrigerant in a NEW install quote. Per EPA AIM Act, R-410A is ILLEGAL in new HVAC equipment manufactured or installed on or after Jan 1 2026. New systems must use A2L refrigerants (R-454B or R-32). Any 2026 quote spec'ing R-410A is a critical red flag - the equipment is either pre-ban inventory (acceptable with disclosure) or the contractor is out of compliance.
  * No Manual J load calculation mentioned for a full system install
  * Warranty is parts-only with no labor coverage
  * No permit included for a system replacement
  * Tonnage seems significantly oversized for the home
  * Any other suspicious or concerning items
- possibleUpsells: Flag UV lights, duct cleaning, whole-house humidifier, zoning systems, or any add-on that may not be necessary for the primary install
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
      await storeImageCache("hvac", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'hvac-pricing-model.json'), 'utf-8'));

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;
      const systemType = parsed.systemType || null;
      const systemData = pricingData.systemTypes?.[systemType] || null;

      // Calculate expected price range for detected system type + efficiency
      let expectedRange = null;
      if (systemData) {
        if (systemData.pricingByEfficiency) {
          // Match by SEER or AFUE
          const seer = parsed.seer;
          const afue = parsed.afue;
          let matchedTier = null;

          if (systemType === "gas_furnace" && afue) {
            // Match furnace by AFUE
            const tiers = Object.keys(systemData.pricingByEfficiency);
            for (const tier of tiers) {
              const tierAfue = parseInt(tier.replace("_afue", ""));
              if (afue >= tierAfue) matchedTier = systemData.pricingByEfficiency[tier];
            }
          } else if (systemType === "full_system" && seer) {
            // Match full system by SEER_AFUE combo
            const tiers = Object.keys(systemData.pricingByEfficiency);
            for (const tier of tiers) {
              const tierSeer = parseInt(tier.split("_")[0]);
              if (seer >= tierSeer) matchedTier = systemData.pricingByEfficiency[tier];
            }
          } else if (seer) {
            // Match AC or heat pump by SEER
            const tiers = Object.keys(systemData.pricingByEfficiency);
            for (const tier of tiers) {
              if (tier === "variable") {
                if (seer >= 22) matchedTier = systemData.pricingByEfficiency[tier];
              } else {
                const tierSeer = parseInt(tier.replace("_seer", ""));
                if (seer >= tierSeer) matchedTier = systemData.pricingByEfficiency[tier];
              }
            }
          }

          if (!matchedTier) {
            // Fall back to first tier
            const firstKey = Object.keys(systemData.pricingByEfficiency)[0];
            matchedTier = systemData.pricingByEfficiency[firstKey];
          }

          if (matchedTier && matchedTier.total) {
            expectedRange = {
              low: Math.round(matchedTier.total[0] * stateMult),
              high: Math.round(matchedTier.total[1] * stateMult)
            };
          }
        } else if (systemData.pricingByZones && parsed.zones) {
          // Mini-split by zone count
          const zoneKey = `${parsed.zones}_zone`;
          const zonePricing = systemData.pricingByZones[zoneKey] || systemData.pricingByZones["1_zone"];
          if (zonePricing && zonePricing.total) {
            expectedRange = {
              low: Math.round(zonePricing.total[0] * stateMult),
              high: Math.round(zonePricing.total[1] * stateMult)
            };
          }
        } else if (systemData.pricingBySize) {
          // Geothermal by size
          const sqft = parsed.homeSqFt;
          let sizeKey = "medium";
          if (sqft && sqft < 1500) sizeKey = "small";
          else if (sqft && sqft > 3000) sizeKey = "large";
          const sizePricing = systemData.pricingBySize[sizeKey];
          if (sizePricing && sizePricing.total) {
            expectedRange = {
              low: Math.round(sizePricing.total[0] * stateMult),
              high: Math.round(sizePricing.total[1] * stateMult)
            };
          }
        }
      }

      // Apply seasonal multiplier based on current month
      const currentMonth = String(new Date().getMonth() + 1);
      const seasonalMult = pricingData.seasonalMultipliers?.[currentMonth] || 1.0;
      if (expectedRange) {
        expectedRange.low = Math.round(expectedRange.low * seasonalMult);
        expectedRange.high = Math.round(expectedRange.high * seasonalMult);
        expectedRange.seasonalMultiplier = seasonalMult;
        expectedRange.seasonNote = seasonalMult > 1.05 ? "Peak season - prices tend to be higher" :
                                   seasonalMult < 0.95 ? "Off-season - better deals may be available" :
                                   "Normal seasonal pricing";
      }

      // Determine brand tier
      let brandTier = null;
      if (parsed.brand) {
        const brandLower = parsed.brand.toLowerCase();
        for (const [tier, info] of Object.entries(pricingData.brandTiers || {})) {
          if (info.brands.some(b => brandLower.includes(b.toLowerCase()))) {
            brandTier = { tier, multiplier: info.multiplier, notes: info.notes };
            break;
          }
        }
      }

      // Tax credit info - 25C EXPIRED Dec 31 2025. Only geothermal 25D still active.
      let taxCreditInfo = null;
      if (systemType === "geothermal") {
        taxCreditInfo = pricingData.taxCredits2026?.geothermal || null;
      }
      // 25C heat-pump / furnace / AC credits EXPIRED 12/31/2025. Do not surface.

      // R-410A red flag - EPA AIM Act bans R-410A in new HVAC from Jan 1 2026
      if (parsed.refrigerantType) {
        const ref = String(parsed.refrigerantType).toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (ref.includes("410A") || ref === "R410" || ref.includes("R410")) {
          if (!parsed.redFlags) parsed.redFlags = [];
          if (!parsed.redFlags.some(f => /410a/i.test(f))) {
            parsed.redFlags.unshift("CRITICAL: R-410A refrigerant is ILLEGAL in new HVAC installs as of Jan 1, 2026 (EPA AIM Act). New systems must use A2L refrigerants (R-454B or R-32). If this is a 2026 install, the contractor is either offloading pre-ban inventory (ask for written disclosure and extended warranty) or is out of compliance. Do not sign until this is resolved.");
          }
        }
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
              typicalCost: upsell.typical_cost,
              notes: upsell.notes
            });
          }
        }
      }
      if (serverUpsells.length > 0) {
        parsed.detectedUpsells = serverUpsells;
      }

      // Check oversizing against home sqft using tonnageByHomeSqFt table
      if (parsed.tonnage && parsed.homeSqFt) {
        const sqft = parsed.homeSqFt;
        const tonnage = parsed.tonnage;
        // Find recommended tonnage from table
        let recommendedTonnage = null;
        const sqftKeys = Object.keys(pricingData.tonnageByHomeSqFt || {}).map(Number).sort((a, b) => a - b);
        for (const key of sqftKeys) {
          if (sqft <= key) {
            recommendedTonnage = pricingData.tonnageByHomeSqFt[String(key)];
            break;
          }
        }
        if (!recommendedTonnage && sqftKeys.length > 0) {
          recommendedTonnage = pricingData.tonnageByHomeSqFt[String(sqftKeys[sqftKeys.length - 1])];
        }
        if (recommendedTonnage && tonnage > recommendedTonnage + 0.5) {
          parsed.oversizingFlag = true;
          if (!parsed.redFlags) parsed.redFlags = [];
          if (!parsed.redFlags.some(f => f.toLowerCase().includes("oversiz"))) {
            parsed.redFlags.push(`System may be oversized: ${tonnage} ton quoted for ${sqft} sqft home (recommended ~${recommendedTonnage} ton). Oversized systems short-cycle, waste energy, and dehumidify poorly.`);
          }
        }
        parsed.recommendedTonnage = recommendedTonnage;
      }

      // Add pricing context
      parsed.pricingContext = {
        state: stateCode,
        stateMultiplier: stateMult,
        systemType: systemType,
        systemLabel: systemData?.label || null,
        expectedRange: expectedRange,
        brandTier: brandTier,
        taxCredit: taxCreditInfo,
        seasonalMultiplier: seasonalMult,
        source: pricingData.metadata?.sources || "DOE, ENERGY STAR, IRA tax credits, ACCA Manual J"
      };

    } catch (e) {
      // Pricing enrichment failed -- still return AI results
      console.log("[hvac-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII before returning or storing
    delete parsed.city;

    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || "";
    const _calState = parsed.stateCode || parsed.state || "";
    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "hvac" });

    if (req.headers["x-woogoro-test"] !== "1") captureAnonymizedData("hvac", parsed); // fire and forget
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
        await guardedFlywheelBump(redis, "hvac", totalPrice, cityLc, st, { incRealQuote: !!_imageBuf });
      }
    } catch (calErr) {
      console.log("[hvac-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("hvac-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
