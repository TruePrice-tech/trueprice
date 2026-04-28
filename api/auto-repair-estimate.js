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
    laborRate: parsed.laborRate || null,
    laborHours: parsed.laborHours || null,
    partsTotal: parsed.partsTotal || null,
    laborTotal: parsed.laborTotal || null,
    shopType: parsed.shopType || null,
    state: parsed.stateCode || null,
    repairCount: parsed.repairs ? parsed.repairs.length : 0,
    partsType: parsed.repairs && parsed.repairs.length > 0 ? parsed.repairs[0].partsType : null
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
    const key = `ar_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[auto-repair-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
    const _guard = await runAbuseGuard(req, { vertical: "auto-repair", cacheNamespace: "auto-repair:v4-standalone-upsells", imageBytes: _imageBuf });
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
      text: `Analyze this auto repair / mechanic shop quote. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total price including parts and labor>,
  "laborRate": <number or null - hourly labor rate if stated>,
  "laborHours": <number or null - total labor hours if stated>,
  "laborTotal": <number or null - total labor cost>,
  "partsTotal": <number or null - total parts cost>,
  "shopName": <string or null - mechanic shop / dealer name>,
  "shopType": <"dealer" | "independent" | "chain" | null>,
  "city": <customer/vehicle city or null>,
  "stateCode": <2-letter state code or null>,
  "yearMakeModel": <string like "2019 Honda Civic" or null>,
  "mileage": <number or null>,
  "vehicleCategory": <"economy" | "standard" | "truck_suv" | "luxury" | "performance" | "ev_hybrid" | null - categorize from yearMakeModel>,
  "possibleUpsells": [<string - descriptions of potentially unnecessary add-on services found in the quote>],
  "repairs": [
    {
      "description": <string - repair description>,
      "laborHours": <number or null>,
      "laborCost": <number or null>,
      "partsCost": <number or null>,
      "partsType": <"oem" | "aftermarket" | "reman" | "unknown">,
      "lineTotal": <number or null>,
      "repairUrgency": <"critical" | "soon" | "can_wait" | "maintenance" - how urgent is this repair>,
      "laborHoursFlag": <"high" | "normal" | "low" - whether quoted hours seem high/normal/low vs typical book time>
    }
  ],
  "scopeItems": {
    "partsItemized": <"yes" | "no" | "unclear">,
    "laborRateStated": <"yes" | "no" | "unclear">,
    "laborHoursListed": <"yes" | "no" | "unclear">,
    "partsType": <"yes" | "no" | "unclear">,
    "shopSupplies": <"yes" | "no" | "unclear">,
    "taxIncluded": <"yes" | "no" | "unclear">,
    "partsWarranty": <"yes" | "no" | "unclear">,
    "laborWarranty": <"yes" | "no" | "unclear">,
    "diagnosticFee": <"yes" | "no" | "unclear">,
    "fluidDisposal": <"yes" | "no" | "unclear">
  },
  "redFlags": [<string - any concerning items found in the quote (see CRITICAL RULES below)>],
  "summary": <string - brief plain-English explanation of why the price is high/low/fair (see CRITICAL RULES below)>
}

CRITICAL RULES:
- ALWAYS extract dollar amounts. If you can see ANY numbers that look like prices, extract them. Do not return null for prices if there are dollar amounts visible in the image.
- totalPrice: Look for a grand total, subtotal, balance due, or total amount. If you cannot find an explicit total, SUM the individual line item amounts.
- If individual line amounts are partially readable, give your best estimate. A rough number is better than null.
- repairs: List each distinct repair/service as a separate item. ALWAYS include the dollar amount for each if visible.
- shopType: Look for shop/business name. "dealer" if it mentions a car brand + service/dealer. "chain" if Midas/Firestone/Jiffy Lube/Pep Boys/Brake Check/Valvoline/Meineke/AAMCO/Maaco/Goodyear. "independent" otherwise.
- redFlags: You MUST return at least 1-2 red flags. No real quote is perfect. Check for: missing warranty terms, parts type not specified (OEM vs aftermarket), labor rate not disclosed, labor hours not listed per repair, excessive shop supply fees (>10%), no diagnostic fee waiver mentioned, no parts/labor breakdown. If the quote IS transparent, flag minor items like "no warranty duration specified" or "parts type not labeled."
- partsType: "oem" = original manufacturer, "aftermarket" = third-party new, "reman" = remanufactured/rebuilt
- scopeItems: Mark "yes" only if clearly present in the quote
- vehicleCategory: "economy" for Civic/Corolla/Sentra, "standard" for Camry/Accord, "truck_suv" for trucks/SUVs, "luxury" for BMW/Mercedes/Audi/Lexus, "performance" for Porsche/Corvette/AMG/M-series, "ev_hybrid" for Tesla/Prius/Bolt/Leaf
- possibleUpsells: Flag brake fluid flush added to a brake job, engine flush with oil change, wheel alignment added to brake job (not suspension work), fuel system cleaning with oil change, or any add-on service that appears unnecessary for the primary repair
- laborHoursFlag: Compare quoted hours to typical book time. Flag "high" if labor hours exceed 1.5x what is typical for that repair type, "low" if under 0.5x typical, otherwise "normal"
- repairUrgency: "critical" = safety risk / do not drive, "soon" = fix within 1-2 weeks, "can_wait" = schedule at convenience, "maintenance" = routine service
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
      await storeImageCache("auto-repair:v2", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'auto-repair-pricing.json'), 'utf-8'));
      let cityMultipliers = {};
      try {
        cityMultipliers = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'city-cost-multipliers.json'), 'utf-8'));
      } catch (e) { /* optional; fall back to state multiplier */ }

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;
      // Prefer city-level labor multiplier when the city is known and we have
      // data for it. SC state-median pulls indie rates down to ~$67/hr in
      // Charlotte where actual market is $80-$110/hr; the city multiplier
      // (msa_direct in city-cost-multipliers.json) corrects that.
      const cityKey = parsed.city && stateCode ? `${parsed.city}|${stateCode}` : null;
      const cityData = cityKey ? cityMultipliers[cityKey] : null;
      const cityLaborMult = cityData ? (cityData.laborMult ?? cityData.multiplier) : null;
      const effectiveLaborMult = cityLaborMult != null ? cityLaborMult : stateMult;

      const vehicleCat = parsed.vehicleCategory || null;
      const vehicleMult = pricingData.vehicleCategoryMultipliers?.[vehicleCat]?.mult || 1.0;
      const shopType = parsed.shopType || "independent";
      const shopTypeRate = pricingData.laborRatesByShopType?.[shopType] || pricingData.laborRatesByShopType?.independent;

      // Adjusted labor rate benchmark
      let adjustedLaborRate = Math.round(shopTypeRate.mid * effectiveLaborMult * vehicleMult);

      // Luxury / performance dealer floor: a Charlotte-area Audi/BMW/Mercedes
      // dealership doesn't quote $130/hr regardless of state-median wage.
      // Real luxury-dealer floor is $180-$220/hr nationwide; performance
      // brands push higher.
      if (shopType === "dealer" && (vehicleCat === "luxury" || vehicleCat === "performance")) {
        const luxFloor = shopTypeRate.luxuryFloor || 180;
        if (adjustedLaborRate < luxFloor) adjustedLaborRate = luxFloor;
      }
      // Indie metro floor: any city with population >= 300k OR a labor
      // multiplier within 10% of national has a real-world indie floor that
      // the BLS state-median can drag below. Keeps SC indie rates above the
      // unrealistic $63-$67/hr range when the customer is in Charlotte etc.
      if (shopType === "independent" && shopTypeRate.metroFloor) {
        const isMetro = (cityData && cityData.population >= 300000) ||
                        (cityLaborMult != null && cityLaborMult >= 0.90);
        if (isMetro && adjustedLaborRate < shopTypeRate.metroFloor) {
          adjustedLaborRate = shopTypeRate.metroFloor;
        }
      }

      // Enrich each repair with benchmark data
      let oemPartsTotal = 0;
      let aftermarketPartsTotal = 0;
      if (parsed.repairs && Array.isArray(parsed.repairs)) {
        for (const repair of parsed.repairs) {
          // Try to match repair to commonRepairs by keyword
          const descLower = (repair.description || "").toLowerCase();
          let matched = null;
          for (const [key, data] of Object.entries(pricingData.commonRepairs || {})) {
            const labelLower = data.label.toLowerCase();
            const keyWords = key.replace(/_/g, " ");
            if (descLower.includes(labelLower) || descLower.includes(keyWords) ||
                labelLower.split(" ").every(w => w.length > 2 && descLower.includes(w))) {
              matched = { key, ...data };
              break;
            }
          }
          if (matched) {
            repair.benchmark = {
              repairKey: matched.key,
              label: matched.label,
              totalRange: matched.totalRange,
              typicalLaborHours: matched.laborHours
            };
            // Override urgency from data if available
            if (matched.urgency) {
              repair.repairUrgency = matched.urgency;
            }
            // Labor hours flag: server-side check
            if (repair.laborHours && matched.laborHours) {
              const typicalHigh = matched.laborHours.high;
              if (repair.laborHours > typicalHigh * 1.5) {
                repair.laborHoursFlag = "high";
              } else if (repair.laborHours < matched.laborHours.low * 0.5) {
                repair.laborHoursFlag = "low";
              }
            }
            // OEM vs aftermarket savings
            if (matched.partsRange) {
              const oemMid = matched.partsRange.oem ? (matched.partsRange.oem[0] + matched.partsRange.oem[1]) / 2 : 0;
              const afterMid = matched.partsRange.aftermarket ? (matched.partsRange.aftermarket[0] + matched.partsRange.aftermarket[1]) / 2 : oemMid;
              oemPartsTotal += oemMid;
              aftermarketPartsTotal += afterMid;
            }
          }
        }
      }

      // Check for common upsell patterns from data
      const serverUpsells = [];
      if (parsed.repairs && pricingData.commonUpsells) {
        const repairDescs = parsed.repairs.map(r => (r.description || "").toLowerCase());
        const allDescs = repairDescs.join(" ");
        const hasBrakeJob = repairDescs.some(d => d.includes("brake"));
        const hasOilChange = repairDescs.some(d => d.includes("oil change") || d.includes("oil filter"));
        const hasSuspension = repairDescs.some(d => d.includes("strut") || d.includes("shock") || d.includes("suspension") || d.includes("control arm") || d.includes("ball joint"));

        for (const upsell of pricingData.commonUpsells) {
          let triggered = false;
          if (upsell.trigger === "brake_job" && hasBrakeJob) triggered = true;
          if (upsell.trigger === "oil_change" && hasOilChange) triggered = true;
          if (upsell.trigger === "suspension" && hasSuspension) triggered = true;
          if (upsell.trigger === "any") triggered = true;
          if (upsell.trigger === "check_engine" && allDescs.includes("check engine")) triggered = true;

          if (triggered) {
            const upsellLower = upsell.upsell.toLowerCase();
            if (repairDescs.some(d => d.includes(upsellLower) || upsellLower.split(" ").every(w => w.length > 3 && d.includes(w)))) {
              // Special case: alignment with brake job but no suspension work
              if (upsell.upsell === "wheel alignment" && upsell.trigger === "brake_job" && hasSuspension) continue;
              serverUpsells.push({
                service: upsell.upsell,
                necessary: upsell.necessary,
                typicalCost: upsell.typical_cost,
                notes: upsell.notes
              });
            }
          }
        }
      }
      if (serverUpsells.length > 0) {
        parsed.detectedUpsells = serverUpsells;
      }

      // Standalone overpriced lines: per-repair benchmark.totalRange.high
      // is set above. Any line >=1.5x the high end of the typical range
      // gets flagged into possibleUpsells regardless of trigger pairing.
      // Catches Audi-style standalone overpriced services (pollen filter
      // at 3-5x retail, mount/balance at 3x retail) that the trigger-
      // based commonUpsells loop above can't see because there's no
      // anchor repair.
      if (parsed.repairs && Array.isArray(parsed.repairs)) {
        if (!Array.isArray(parsed.possibleUpsells)) parsed.possibleUpsells = [];
        const seenDesc = new Set((parsed.possibleUpsells || []).map(u => String(u.service || u.name || u).toLowerCase()));
        for (const r of parsed.repairs) {
          const lt = Number(r.lineTotal || (Number(r.partsCost || 0) + Number(r.laborCost || 0))) || 0;
          if (lt <= 0) continue;
          const hi = r.benchmark && r.benchmark.totalRange ? Number(r.benchmark.totalRange.high || r.benchmark.totalRange[1]) || 0 : 0;
          if (hi <= 0) continue;
          if (lt >= hi * 1.5) {
            const descKey = String(r.description || "").toLowerCase();
            if (descKey && !seenDesc.has(descKey)) {
              parsed.possibleUpsells.push({
                service: r.description,
                reason: `priced at $${Math.round(lt)}, ~${(lt / hi).toFixed(1)}x the typical high of $${Math.round(hi)} for this repair`,
                typicalCost: r.benchmark.totalRange
              });
              seenDesc.add(descKey);
            }
          }
        }
      }

      // Add pricing context
      parsed.pricingContext = {
        state: stateCode,
        stateMultiplier: stateMult,
        cityLaborMultiplier: cityLaborMult,
        effectiveLaborMultiplier: effectiveLaborMult,
        vehicleCategory: vehicleCat,
        vehicleCategoryMultiplier: vehicleMult,
        shopType: shopType,
        adjustedLaborRate: adjustedLaborRate,
        laborRateRange: shopTypeRate,
        source: pricingData.metadata?.sources || "AAA 2026, RepairPal, Mitchell labor guides"
      };

      // State consumer protection info
      if (stateCode && pricingData.stateConsumerProtection?.[stateCode]) {
        parsed.stateConsumerProtection = pricingData.stateConsumerProtection[stateCode];
      }

      // OEM vs aftermarket savings summary
      if (oemPartsTotal > 0 && aftermarketPartsTotal > 0 && oemPartsTotal !== aftermarketPartsTotal) {
        parsed.partsSavings = {
          estimatedOemTotal: Math.round(oemPartsTotal),
          estimatedAftermarketTotal: Math.round(aftermarketPartsTotal),
          potentialSavings: Math.round(oemPartsTotal - aftermarketPartsTotal)
        };
      }
    } catch (e) {
      // Pricing enrichment failed -- still return AI results
      console.log("[auto-repair-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII before returning or storing
    delete parsed.shopName;

    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || "";
    const _calState = parsed.stateCode || parsed.state || "";
    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "auto" });

    if (req.headers["x-woogoro-test"] !== "1") captureAnonymizedData("auto", parsed); // fire and forget
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
        await guardedFlywheelBump(redis, "auto", totalPrice, cityLc, st, { incRealQuote: !!_imageBuf });
      }
    } catch (calErr) {
      console.log("[auto-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("auto-repair-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
