import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";
import { runAbuseGuard, recordClaudeCall, storeImageCache } from "./_abuse-guard.js";
import { runOcr, ocrTextLooksGood } from "./_ocr.js";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed || !parsed.totalPrice) return null;
  return {
    v: vertical,
    ts: new Date().toISOString(),
    price: parsed.totalPrice,
    jobType: parsed.jobType || null,
    pipeType: parsed.pipeType || null,
    laborRate: parsed.laborRate || null,
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
    const key = `plumbing_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[plumbing-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
    const _guard = await runAbuseGuard(req, { vertical: "plumbing", cacheNamespace: "plumbing-v2-nullbetter", imageBytes: _imageBuf });
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
      text: `Analyze this plumbing quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "contractor": <string or null - plumbing company name. Look at the top of the quote (letterhead), header, footer, signature line, or "from"/"prepared by" sections. Extract the company name even if it's in a logo image. This is REQUIRED whenever a name is visible.>,
  "totalPrice": <number or null - the total quoted price>,
  "jobType": <"water_heater_tank" | "water_heater_tankless" | "whole_house_repipe" | "sewer_line_repair" | "sewer_line_replace" | "drain_cleaning" | "toilet_install" | "faucet_install" | "garbage_disposal" | "sump_pump" | "gas_line_install" | "leak_repair" | "water_softener" | "backflow_preventer" | "other" | null>,
  "fixture": <string or null - the specific fixture or equipment being installed/replaced (e.g. "50-gal gas water heater", "tankless water heater", "kitchen faucet", "toilet")>,
  "brand": <string or null - manufacturer brand name (Bradford White, Rheem, A.O. Smith, Navien, Rinnai, Kohler, Moen, Delta, Bosch, etc.) - look in line item descriptions and equipment lists>,
  "modelNumber": <string or null - equipment model number>,
  "fixtureSize": <string or null - size/capacity (e.g. "50 gal", "75 gal", "9.8 GPM", "1.5 hp")>,
  "pipeType": <"PEX" | "copper" | "PVC" | "CPVC" | "cast_iron" | "galvanized" | null - pipe material specified>,
  "laborRate": <number or null - hourly labor rate>,
  "laborHours": <number or null - estimated labor hours>,
  "laborTotal": <number or null - total labor cost>,
  "laborCost": <number or null - same as laborTotal, alias for compatibility>,
  "partsTotal": <number or null - total parts/materials cost>,
  "materialsTotal": <number or null - same as partsTotal, alias for compatibility>,
  "diagnosticFee": <number or null - diagnostic or service call fee>,
  "emergencyFee": <number or null - emergency/after-hours surcharge>,
  "city": <string or null - city from the quote>,
  "stateCode": <string or null - 2-letter state code>,
  "warrantyPartsYears": <number or null - parts warranty in YEARS as a number, e.g. 6 for "6 year tank warranty">,
  "warrantyLaborYears": <number or null - labor warranty in YEARS as a number, e.g. 1 for "1 year on installation labor">,
  "lineItems": [
    {
      "description": <string - line item description>,
      "laborCost": <number or null>,
      "partsCost": <number or null>,
      "lineTotal": <number or null>
    }
  ],
  "scopeItems": {
    "laborRate": <"yes" | "no" | "unclear" - hourly rate clearly stated>,
    "partsItemized": <"yes" | "no" | "unclear" - parts listed and priced separately>,
    "permit": <"yes" | "no" | "unclear" - permits included>,
    "warranty": <"yes" | "no" | "unclear" - warranty on parts and labor>,
    "cleanup": <"yes" | "no" | "unclear" - cleanup and disposal included>,
    "materialSpec": <"yes" | "no" | "unclear" - pipe/material type specified>,
    "codeCompliance": <"yes" | "no" | "unclear" - code compliance mentioned>,
    "diagnosticFee": <"yes" | "no" | "unclear" - diagnostic/service call fee noted>
  },
  "warrantyParts": <string or null - parts warranty duration e.g. "5 years">,
  "warrantyLabor": <string or null - labor warranty duration e.g. "1 year">,
  "possibleUpsells": [<string - descriptions of potential upsell items>],
  "redFlags": [<string - any concerning items found in the quote>],
  "summary": <string - brief plain-English summary of the quote and value assessment>
}

CRITICAL EXTRACTION RULES — NULL IS BETTER THAN WRONG:
- NEVER fabricate or guess. If you cannot read a value clearly from the document, return null.
- DO NOT default jobType to "water_heater" or any common type when uncertain — use "other" or null instead.
- DO NOT invent a totalPrice when none is visible. Return null and let the UI prompt the user.
- If you can read SOME dollar amounts but cannot identify the grand total with confidence, prefer summing visible line items only when the line items clearly add up; otherwise return null.
- If the OCR text is sparse, garbled, or missing key fields (no contractor letterhead, no clear job description, no clear total), return null for the uncertain fields and set "confidence": "low" at the top level.
- redFlags: identify concerns ONLY when actually visible in the source. Do not invent transparency gaps to fill the array. An empty redFlags array is acceptable.
- summary: if you don't have enough data to explain WHY a price is high, low, or fair, write "Insufficient data to assess this quote — please verify the extracted fields manually." Do not invent reasoning.

Add this top-level field to your JSON output:
  "confidence": <"high" | "medium" | "low" - your confidence in the overall extraction. Use "low" if more than 2 fields are null/uncertain.>

Rules:
- totalPrice: Use the grand total / bottom line, not sum of line items. Return null if not clearly visible.
- jobType: Match to the closest category from the visible job description. Use "other" if unclear, null if no job description visible.
- pipeType: Extract the pipe material if mentioned (PEX, copper, PVC, CPVC, cast_iron, galvanized)
- scopeItems: Mark "yes" only if clearly present in the quote
- redFlags: Include if any of the following are detected:
  * No permit mentioned for water heater install or gas line work
  * No material/pipe type specified for repipe or major plumbing work
  * Emergency markup not disclosed (after-hours work with no surcharge explanation)
  * Phone-only quote without on-site inspection for major work (repipe, sewer, water heater)
  * No warranty mentioned
  * Galvanized or cast iron pipe being patched rather than replaced
  * No backflow prevention mentioned for sewer work
  * Diagnostic fee seems excessive (over $200)
  * Any other suspicious or concerning items
- possibleUpsells: Flag camera inspection, whole-house water filter, expansion tank, PRV (pressure reducing valve), or any add-on that may not be necessary
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
      await storeImageCache("plumbing", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'plumbing-pricing.json'), 'utf-8'));

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;
      const jobType = parsed.jobType || null;
      const jobData = pricingData.commonJobs?.[jobType] || null;

      // Calculate expected price range for detected job type
      let expectedRange = null;
      if (jobData && jobData.total) {
        expectedRange = {
          low: Math.round(jobData.total[0] * stateMult),
          high: Math.round(jobData.total[1] * stateMult)
        };
      }

      // Check labor rate against benchmarks
      let laborBenchmark = null;
      if (parsed.laborRate && pricingData.laborRates) {
        const rate = parsed.laborRate;
        const rates = pricingData.laborRates;
        laborBenchmark = {
          quoted: rate,
          low: rates.low,
          mid: rates.mid,
          high: rates.high,
          emergency: rates.emergency,
          assessment: rate <= rates.low ? "Below average" :
                      rate <= rates.mid ? "Average" :
                      rate <= rates.high ? "Above average" :
                      "Premium/emergency rate"
        };
      }

      // Check labor hours against benchmark for job type
      let laborHoursBenchmark = null;
      if (parsed.laborHours && jobData && jobData.labor_hrs) {
        const hours = parsed.laborHours;
        laborHoursBenchmark = {
          quoted: hours,
          expectedLow: jobData.labor_hrs[0],
          expectedHigh: jobData.labor_hrs[1],
          assessment: hours < jobData.labor_hrs[0] ? "Below typical range" :
                      hours <= jobData.labor_hrs[1] ? "Within typical range" :
                      "Above typical range"
        };
      }

      // Check parts cost against benchmark
      let partsBenchmark = null;
      if (parsed.partsTotal && jobData && jobData.parts) {
        const parts = parsed.partsTotal;
        const adjustedLow = Math.round(jobData.parts[0] * stateMult);
        const adjustedHigh = Math.round(jobData.parts[1] * stateMult);
        partsBenchmark = {
          quoted: parts,
          expectedLow: adjustedLow,
          expectedHigh: adjustedHigh,
          assessment: parts < adjustedLow ? "Below typical range" :
                      parts <= adjustedHigh ? "Within typical range" :
                      "Above typical range"
        };
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
              typicalCost: upsell.cost,
              notes: upsell.notes
            });
          }
        }
      }
      if (serverUpsells.length > 0) {
        parsed.detectedUpsells = serverUpsells;
      }

      // Add server-side red flags
      if (!parsed.redFlags) parsed.redFlags = [];

      // No permit for water heater or gas work
      if (parsed.scopeItems?.permit === "no" &&
          (jobType === "water_heater_tank" || jobType === "water_heater_tankless" || jobType === "gas_line_install")) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("permit"))) {
          parsed.redFlags.push(`No permit mentioned for ${jobData?.label || jobType}. Most jurisdictions require permits for water heater and gas line work.`);
        }
      }

      // No material spec for repipe
      if (parsed.scopeItems?.materialSpec !== "yes" &&
          (jobType === "whole_house_repipe" || jobType === "sewer_line_replace")) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("material"))) {
          parsed.redFlags.push("No pipe material type specified for major plumbing work. Always confirm PEX, copper, PVC, etc. before signing.");
        }
      }

      // Emergency fee check
      if (parsed.emergencyFee && parsed.emergencyFee > 0 && parsed.scopeItems?.diagnosticFee !== "yes") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("emergency"))) {
          parsed.redFlags.push("Emergency/after-hours surcharge present but diagnostic fee structure unclear. Verify total emergency markup.");
        }
      }

      // --- Regex-driven red flag pattern engine (data-layer rules) ---
      try {
        const haystackParts = [
          text || "",
          parsed.summary || "",
          ...(parsed.lineItems || []).map(li => `${li.description || ""} ${li.partsCost || ""} ${li.laborCost || ""}`),
          ...(parsed.possibleUpsells || []),
        ];
        const haystack = haystackParts.join("\n").toLowerCase();
        const structuredFlags = [];
        for (const pat of (pricingData.redFlagPatterns || [])) {
          try {
            const primary = new RegExp(pat.regex, "i");
            const primaryHit = primary.test(haystack);
            if (pat.detectMode === "absence") {
              // Fire when primary regex is ABSENT
              if (!primaryHit) {
                structuredFlags.push({ name: pat.name, severity: pat.severity, explanation: pat.explanation, action: pat.action });
              }
              continue;
            }
            if (!primaryHit) continue;
            if (pat.secondaryRegex) {
              const secondary = new RegExp(pat.secondaryRegex, "i");
              const secondaryHit = secondary.test(haystack);
              if (pat.secondaryMode === "absence" && secondaryHit) continue;
              if (pat.secondaryMode !== "absence" && !secondaryHit) continue;
            }
            structuredFlags.push({ name: pat.name, severity: pat.severity, explanation: pat.explanation, action: pat.action });
          } catch (_e) { /* bad regex, skip */ }
        }
        if (structuredFlags.length > 0) {
          parsed.structuredRedFlags = structuredFlags;
          // Also surface the top 3 high-severity in the plain redFlags array
          const high = structuredFlags.filter(f => f.severity === "high").slice(0, 3);
          for (const f of high) {
            if (!parsed.redFlags.some(existing => (existing || "").toLowerCase().includes(f.name.replace(/_/g, " ")))) {
              parsed.redFlags.push(f.explanation);
            }
          }
        }
      } catch (patErr) {
        console.log("[plumbing-estimate] red flag pattern engine error:", patErr.message);
      }

      // --- Brand tier detection ---
      try {
        const combinedText = ((text || "") + " " + (parsed.summary || "") + " " +
          (parsed.lineItems || []).map(li => li.description || "").join(" ")).toLowerCase();
        const tierMap = {
          water_heater_tank: "waterHeaterTank",
          water_heater_tankless: "waterHeaterTankless",
          whole_house_repipe: parsed.pipeType === "copper" ? "repipeCopper" : "repipePex",
        };
        const tierKey = tierMap[jobType];
        if (tierKey && pricingData.brandTiers?.[tierKey]) {
          const tiers = pricingData.brandTiers[tierKey];
          let detectedTier = null;
          for (const tierName of ["premium", "mid", "value"]) {
            const tier = tiers[tierName];
            if (!tier || !tier.brands) continue;
            for (const brand of tier.brands) {
              if (combinedText.includes(brand.toLowerCase())) {
                detectedTier = { tier: tierName, brand, tierData: tier };
                break;
              }
            }
            if (detectedTier) break;
          }
          // Detect heat pump specifically
          if (/\b(heat pump water heater|hpwh|hybrid water heater|proterra|voltex|aerotherm)\b/i.test(combinedText)) {
            const hpwhTiers = pricingData.brandTiers.heatPumpWaterHeater;
            for (const tierName of ["premium", "mid", "value"]) {
              const tier = hpwhTiers[tierName];
              for (const brand of tier.brands) {
                if (combinedText.includes(brand.toLowerCase().split(" ")[0])) {
                  detectedTier = { tier: tierName, brand, tierData: tier, category: "heat_pump_water_heater" };
                  break;
                }
              }
              if (detectedTier?.category === "heat_pump_water_heater") break;
            }
          }
          if (detectedTier) {
            parsed.brandTier = detectedTier;
          }
        }
      } catch (btErr) {
        console.log("[plumbing-estimate] brand tier detection error:", btErr.message);
      }

      // --- IRA 25C heat pump water heater credit surfacing ---
      try {
        const combinedText = ((text || "") + " " + (parsed.summary || "") + " " +
          (parsed.lineItems || []).map(li => li.description || "").join(" ")).toLowerCase();
        const isHPWH = /\b(heat pump water heater|hpwh|hybrid water heater|proterra|voltex|aerotherm)\b/i.test(combinedText)
          || parsed.brandTier?.category === "heat_pump_water_heater";
        if (isHPWH && pricingData.iraCredit) {
          const qualifyingCost = Number(parsed.totalPrice) || 0;
          const estimatedCredit = Math.min(
            Math.round(qualifyingCost * pricingData.iraCredit.rate),
            pricingData.iraCredit.annualCap
          );
          parsed.iraCredit = {
            applies: true,
            section: pricingData.iraCredit.section,
            rate: pricingData.iraCredit.rate,
            cap: pricingData.iraCredit.annualCap,
            estimatedCredit,
            requirements: [
              "Heat pump water heater with UEF >= 2.2",
              "Principal residence (not rentals, not new construction)",
              "Manufacturer Qualified Manufacturer PIN required on Form 5695 (2025+)"
            ],
            claimForm: pricingData.iraCredit.claimForm,
            notes: pricingData.iraCredit.notes,
            stacksWith: pricingData.iraCredit.stacksWith,
          };
          if (!(parsed.redFlags || []).some(f => /25c|tax credit|ira/i.test(f))) {
            parsed.redFlags = parsed.redFlags || [];
            parsed.redFlags.push(
              `Note: the federal 25C tax credit for heat pump water heaters EXPIRED Dec 31 2025 and is not available for 2026 installs. Check state utility rebates and IRA HEAR (income-qualified) programs at dsireusa.org.`
            );
          }
        }
      } catch (iraErr) {
        console.log("[plumbing-estimate] IRA credit surfacing error:", iraErr.message);
      }

      // --- State licensing surfacing ---
      try {
        if (stateCode && pricingData.stateLicensing?.[stateCode]) {
          parsed.stateLicensing = {
            state: stateCode,
            ...pricingData.stateLicensing[stateCode]
          };
        }
      } catch (_e) {}

      // --- Utility rebate surfacing (HPWH) ---
      try {
        if (stateCode && pricingData.utilityRebates) {
          const applicable = pricingData.utilityRebates.filter(r =>
            r.active2026 && Array.isArray(r.states) && r.states.includes(stateCode)
          );
          if (applicable.length > 0) {
            parsed.utilityRebates = applicable;
          }
        }
      } catch (_e) {}

      // Add pricing context
      parsed.pricingContext = {
        state: stateCode,
        stateMultiplier: stateMult,
        jobType: jobType,
        jobLabel: jobData?.label || null,
        urgency: jobData?.urgency || null,
        expectedRange: expectedRange,
        laborBenchmark: laborBenchmark,
        laborHoursBenchmark: laborHoursBenchmark,
        partsBenchmark: partsBenchmark,
        source: pricingData.metadata?.sources || "HomeAdvisor, Angi, BLS, contractor surveys"
      };

    } catch (e) {
      // Pricing enrichment failed -- still return AI results
      console.log("[plumbing-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII before returning or storing
    delete parsed.city;

    if (req.headers["x-trueprice-test"] !== "1") captureAnonymizedData("plumbing", parsed); // fire and forget
    // Test-mode skip: synthetic test fixtures (X-TruePrice-Test: 1)
    // do NOT count toward the public counter or feed pricing aggregates.
    // Only real-world quotes from real users should affect either.
    const _isTestMode = req.headers["x-trueprice-test"] === "1";
    if (_isTestMode) {
      console.log("[test-mode] skipping flywheel writes for this request");
    }



    // FLYWHEEL BRIDGE: increment global counter + write to cal:* aggregates
    // so this vertical's quotes feed the same systems as moving and auto.
    try {
      const totalPrice = Number(parsed && parsed.totalPrice) || 0;
      if (totalPrice > 0 && !_isTestMode) {

        const cityLc = String((parsed && (parsed.city || parsed.cityName)) || "")
          .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
        const st = String((parsed && (parsed.stateCode || parsed.state)) || "").toUpperCase();
        const service = "plumbing";
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
          if (cityLc) await bump(`cal:${cityLc}:${st}:plumbing`);
          await bump(`cal:metro:${st}:plumbing`);
        }
      }
    } catch (calErr) {
      console.log("[plumbing-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("plumbing-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
