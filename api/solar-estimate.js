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
    systemSizeKW: parsed.systemSizeKW || null,
    panelBrand: parsed.panelBrand || null,
    inverterType: parsed.inverterType || null,
    battery: parsed.batteryIncluded || null,
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
    const key = `solar_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[solar-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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

    // Abuse guard: burst detect, IP daily cap, suspicious patterns,
    // image dedup, global Claude ceiling. Returns cached result if hit.
    const _imageBuf = (req.body && req.body.images && req.body.images[0])
      ? Buffer.from((req.body.images[0].split(",")[1] || ""), "base64")
      : null;
    const _guard = await runAbuseGuard(req, { vertical: "solar", imageBytes: _imageBuf });
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
      text: `Analyze this solar panel installation quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price BEFORE tax credits>,
  "priceAfterTaxCredit": <number or null - price after 30% IRA federal tax credit>,
  "laborTotal": <number or null - total labor cost>,
  "equipmentTotal": <number or null - total equipment/materials cost>,
  "systemSizeKW": <number or null - system size in kilowatts>,
  "panelBrand": <string or null - solar panel brand>,
  "panelModel": <string or null - panel model number>,
  "panelCount": <number or null - number of panels>,
  "panelWattage": <number or null - wattage per panel>,
  "inverterType": <"string" | "micro" | "hybrid" | null - inverter type>,
  "inverterBrand": <string or null - inverter brand>,
  "batteryIncluded": <boolean or null - battery storage included>,
  "batteryBrand": <string or null - battery brand if included>,
  "batteryCapacityKWh": <number or null - battery capacity in kWh>,
  "roofCondition": <"good" | "needs_repair" | "not_assessed" | null>,
  "estimatedAnnualProduction": <number or null - estimated kWh per year>,
  "estimatedOffset": <number or null - percentage of electricity offset>,
  "financingType": <"cash" | "loan" | "lease" | "ppa" | null - how it is being financed>,
  "city": <string or null - city from the quote>,
  "stateCode": <string or null - 2-letter state code>,
  "lineItems": [
    {
      "description": <string - line item description>,
      "laborCost": <number or null>,
      "equipmentCost": <number or null>,
      "lineTotal": <number or null>
    }
  ],
  "scopeItems": {
    "laborRate": <"yes" | "no" | "unclear" - labor rate clearly stated>,
    "partsItemized": <"yes" | "no" | "unclear" - equipment listed individually>,
    "permit": <"yes" | "no" | "unclear" - permits and interconnection included>,
    "warranty": <"yes" | "no" | "unclear" - warranty terms stated>,
    "cleanup": <"yes" | "no" | "unclear" - site cleanup>,
    "timeline": <"yes" | "no" | "unclear" - installation timeline stated>,
    "systemSize": <"yes" | "no" | "unclear" - system size (kW) specified>,
    "panelBrand": <"yes" | "no" | "unclear" - panel brand/model specified>,
    "inverterType": <"yes" | "no" | "unclear" - inverter type specified>,
    "roofCondition": <"yes" | "no" | "unclear" - roof condition assessment>,
    "structuralAssessment": <"yes" | "no" | "unclear" - roof structural assessment>,
    "monitoring": <"yes" | "no" | "unclear" - production monitoring system>
  },
  "warrantyPanels": <string or null - panel warranty duration>,
  "warrantyInverter": <string or null - inverter warranty>,
  "warrantyWorkmanship": <string or null - installation workmanship warranty>,
  "costPerWatt": <number or null - total cost divided by system wattage>,
  "possibleUpsells": [<string - potential upsell items>],
  "redFlags": [<string - concerning items found>],
  "summary": <string - brief plain-English summary of the quote>
}

CRITICAL EXTRACTION RULES:
- ALWAYS extract dollar amounts. If you see ANY numbers that look like prices, extract them. A rough estimate is better than null.
- If you cannot find an explicit total, SUM the individual line item amounts.
- redFlags: ALWAYS identify at least one concern. Check for: missing warranty, missing itemization, no labor rate disclosed, no parts type specified, no permit mentioned, excessive fees. Real quotes almost always have transparency gaps.
- Never return null for a price field if there are dollar amounts visible anywhere in the document.

- summary: ALWAYS explain WHY a price is high, low, or fair. Reference specific factors: material choice, scope breadth, warranty quality, labor complexity, brand premium. Never just say "above average" -- say "above average, likely due to premium materials and comprehensive warranty." This helps users understand the quote rather than weaponize a number against contractors.

Rules:
- totalPrice: Use the gross price BEFORE any tax credits
- priceAfterTaxCredit: Subtract 30% IRA federal tax credit from totalPrice if cash/loan purchase
- costPerWatt: Calculate totalPrice / (systemSizeKW * 1000) if both are available
- Mark scopeItems "yes" only if clearly present in the quote
- redFlags: Include if any of the following are detected:
  * No building/electrical permit mentioned
  * No roof structural assessment for rooftop install
  * Lease vs buy not clearly disclosed (lease means you don't own the panels)
  * PPA terms not clearly explained
  * No production guarantee or estimate
  * Cost per watt above $4.00 or below $2.00 (suspicious pricing)
  * No monitoring system included
  * Warranty shorter than 25 years on panels
  * No mention of utility interconnection / net metering application
  * Any other suspicious or concerning items
- possibleUpsells: Flag battery storage, critter guard, EV charger bundle, panel-level monitoring, roof repair
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
      await storeImageCache("solar", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'solar-pricing.json'), 'utf-8'));

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;

      // Match system size to commonJobs for expected range
      let expectedRange = null;
      const sizeKW = parsed.systemSizeKW || null;

      if (sizeKW) {
        // Find closest system size match
        let matchKey = null;
        if (sizeKW <= 7) matchKey = "residential_6kw";
        else if (sizeKW <= 9) matchKey = "residential_8kw";
        else if (sizeKW <= 11) matchKey = "residential_10kw";
        else matchKey = "residential_12kw";

        const jobData = pricingData.commonJobs?.[matchKey];
        if (jobData && jobData.total) {
          expectedRange = {
            low: Math.round(jobData.total[0] * stateMult),
            high: Math.round(jobData.total[1] * stateMult)
          };
        }
      }

      // Add battery range if battery is included
      let batteryRange = null;
      if (parsed.batteryIncluded) {
        const batteryData = pricingData.commonJobs?.battery_storage;
        if (batteryData && batteryData.total) {
          batteryRange = {
            low: Math.round(batteryData.total[0] * stateMult),
            high: Math.round(batteryData.total[1] * stateMult)
          };
        }
      }

      // IRA 30% tax credit enrichment
      const taxCreditInfo = pricingData.taxCredit || null;
      let taxCreditAmount = null;
      if (parsed.totalPrice && (parsed.financingType === "cash" || parsed.financingType === "loan" || !parsed.financingType)) {
        taxCreditAmount = Math.round(parsed.totalPrice * 0.30);
        if (!parsed.priceAfterTaxCredit) {
          parsed.priceAfterTaxCredit = parsed.totalPrice - taxCreditAmount;
        }
      }

      // Cost per watt check
      if (parsed.totalPrice && sizeKW) {
        const cpw = parsed.totalPrice / (sizeKW * 1000);
        parsed.costPerWatt = Math.round(cpw * 100) / 100;
      }

      // Server-side red flag checks
      if (!parsed.redFlags) parsed.redFlags = [];

      if (parsed.scopeItems?.permit === "no" || parsed.scopeItems?.permit === "unclear") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("permit"))) {
          parsed.redFlags.push("No building/electrical permit mentioned. Solar installations require permits in virtually all jurisdictions.");
        }
      }
      if (parsed.scopeItems?.structuralAssessment === "no" || parsed.scopeItems?.structuralAssessment === "unclear") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("structural"))) {
          parsed.redFlags.push("No roof structural assessment mentioned. Panels add significant weight; older roofs may need reinforcement.");
        }
      }
      if (parsed.financingType === "lease" || parsed.financingType === "ppa") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("lease") || f.toLowerCase().includes("ppa"))) {
          parsed.redFlags.push("This appears to be a lease/PPA arrangement. You will not own the panels and may not receive the 30% federal tax credit directly. Ensure terms are clearly disclosed.");
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
        systemSizeKW: sizeKW,
        expectedRange: expectedRange,
        batteryRange: batteryRange,
        taxCredit: taxCreditInfo,
        taxCreditAmount: taxCreditAmount,
        costPerWatt: parsed.costPerWatt || null,
        scopeScore: scopeScore,
        scopeMax: scopeMax,
        scopeGrade: scopeMax > 0 ? (scopeScore / scopeMax >= 0.8 ? "A" : scopeScore / scopeMax >= 0.6 ? "B" : scopeScore / scopeMax >= 0.4 ? "C" : "D") : null,
        source: pricingData.metadata?.sources || "EnergySage, SEIA, EIA, NREL, contractor surveys"
      };

    } catch (e) {
      console.log("[solar-estimate] Pricing enrichment error:", e.message);
    }

    delete parsed.city;
    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || "";
    const _calState = parsed.stateCode || parsed.state || "";
    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "solar" });

    if (req.headers["x-trueprice-test"] !== "1") captureAnonymizedData("solar", parsed);
    // Test-mode skip: synthetic test fixtures (X-TruePrice-Test: 1)
    // do NOT count toward the public counter or feed pricing aggregates.
    // Only real-world quotes from real users should affect either.
    const _isTestMode = req.headers["x-trueprice-test"] === "1";
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
        await guardedFlywheelBump(redis, "solar", totalPrice, cityLc, st);
      }
    } catch (calErr) {
      console.log("[solar-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("solar-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
