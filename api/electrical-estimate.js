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
    wireType: parsed.wireType || null,
    amperage: parsed.amperage || null,
    licensed: parsed.licensed || null,
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
    const key = `electrical_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[electrical-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
    const _guard = await runAbuseGuard(req, { vertical: "electrical", imageBytes: _imageBuf });
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
      text: `Analyze this electrical quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "jobType": <"panel_upgrade_100_200" | "panel_upgrade_200_400" | "whole_house_rewire" | "outlet_install" | "gfci_outlet" | "ceiling_fan" | "light_fixture" | "ev_charger" | "generator_install" | "recessed_lights" | "circuit_breaker" | "smoke_detector_hardwired" | "knob_tube_removal" | "other" | null>,
  "wireType": <string or null - wire type/gauge (e.g. "12 AWG Romex", "10/3 NM-B")>,
  "amperage": <number or null - amperage rating (e.g. 200 for a 200A panel)>,
  "laborRate": <number or null - hourly labor rate>,
  "laborHours": <number or null - estimated labor hours>,
  "laborTotal": <number or null - total labor cost>,
  "partsTotal": <number or null - total parts/materials cost>,
  "licensed": <boolean or null - whether a licensed electrician is performing the work>,
  "city": <string or null - city from the quote>,
  "stateCode": <string or null - 2-letter state code>,
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
    "partsItemized": <"yes" | "no" | "unclear" - parts/materials listed and priced separately>,
    "permit": <"yes" | "no" | "unclear" - permits and inspection included>,
    "warranty": <"yes" | "no" | "unclear" - warranty on workmanship>,
    "codeCompliance": <"yes" | "no" | "unclear" - NEC code compliance mentioned>,
    "licensed": <"yes" | "no" | "unclear" - licensed electrician performing work>,
    "wireSpec": <"yes" | "no" | "unclear" - wire gauge/type specified>,
    "cleanup": <"yes" | "no" | "unclear" - cleanup included>
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
- totalPrice: Use the grand total / bottom line, not sum of line items
- jobType: Match to the closest category. Use "other" if none fit
- licensed: Set true if quote explicitly states licensed electrician, false if unlicensed/handyman, null if not mentioned
- scopeItems: Mark "yes" only if clearly present in the quote
- redFlags: Include if any of the following are detected:
  * No permit mentioned for panel upgrade, rewire, or EV charger work
  * Unlicensed person performing electrical work
  * No NEC (National Electrical Code) compliance mention for major work
  * Knob-and-tube wiring present but not addressed or flagged
  * Aluminum wiring present but not flagged as a concern
  * No GFCI protection mentioned for kitchen/bathroom/outdoor outlets
  * Panel brand is Federal Pacific, Zinsco, or Pushmatic (known safety issues)
  * Wire gauge seems undersized for the stated amperage
  * No warranty mentioned for major work
  * Any other suspicious or concerning items
- possibleUpsells: Flag whole-house surge protector, smart switches/dimmers, landscape lighting, USB outlets, or any add-on that may not be necessary for the primary job
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
      await storeImageCache("electrical", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'electrical-pricing.json'), 'utf-8'));

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
          master: rates.master,
          assessment: rate <= rates.low ? "Below average" :
                      rate <= rates.mid ? "Average" :
                      rate <= rates.high ? "Above average" :
                      "Master electrician / premium rate"
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

      // No permit for panel or major work
      if (parsed.scopeItems?.permit === "no" &&
          (jobType === "panel_upgrade_100_200" || jobType === "panel_upgrade_200_400" ||
           jobType === "whole_house_rewire" || jobType === "ev_charger" ||
           jobType === "generator_install" || jobType === "knob_tube_removal")) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("permit"))) {
          parsed.redFlags.push(`No permit mentioned for ${jobData?.label || jobType}. Electrical permits are required by code in virtually all jurisdictions for this type of work.`);
        }
      }

      // Unlicensed work
      if (parsed.licensed === false || parsed.scopeItems?.licensed === "no") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("unlicensed") || f.toLowerCase().includes("licensed"))) {
          parsed.redFlags.push("Work appears to be performed by an unlicensed individual. Electrical work should be done by a licensed electrician for safety and code compliance.");
        }
      }

      // No NEC compliance for major work
      if (parsed.scopeItems?.codeCompliance !== "yes" &&
          (jobType === "panel_upgrade_100_200" || jobType === "panel_upgrade_200_400" ||
           jobType === "whole_house_rewire" || jobType === "knob_tube_removal")) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("nec") || f.toLowerCase().includes("code compliance"))) {
          parsed.redFlags.push("No NEC (National Electrical Code) compliance mentioned for major electrical work. Ensure all work meets current code requirements.");
        }
      }

      // Knob and tube note from pricing data
      if (jobType === "knob_tube_removal" && jobData?.notes) {
        parsed.jobNotes = jobData.notes;
      }

      // --- Data-driven red flag pattern detection (15-20 patterns) ---
      try {
        const haystack = ((text || "") + " " +
          (parsed.lineItems || []).map(li => (li.description || "")).join(" ") + " " +
          (parsed.summary || "") + " " +
          (parsed.redFlags || []).join(" ")
        ).toLowerCase();
        const detectedPatterns = [];
        for (const pat of (pricingData.redFlagPatterns || [])) {
          try {
            if (pat.scopedToJobTypes && pat.scopedToJobTypes.length &&
                jobType && !pat.scopedToJobTypes.includes(jobType)) continue;

            const primary = new RegExp(pat.regex, "i");
            const primaryHit = primary.test(haystack);
            const primaryPass = pat.detectMode === "absence" ? !primaryHit : primaryHit;
            if (!primaryPass) continue;

            if (pat.secondaryRegex) {
              const secondary = new RegExp(pat.secondaryRegex, "i");
              const secondaryHit = secondary.test(haystack);
              const secondaryPass = pat.secondaryMode === "absence" ? !secondaryHit : secondaryHit;
              if (!secondaryPass) continue;
            }

            detectedPatterns.push({
              name: pat.name,
              severity: pat.severity,
              explanation: pat.explanation,
              action: pat.action
            });

            if (!parsed.redFlags.some(f => (f || "").toLowerCase().includes(pat.name.replace(/_/g, " ")))) {
              parsed.redFlags.push(`[${pat.severity.toUpperCase()}] ${pat.explanation} Action: ${pat.action}`);
            }
          } catch (_e) { /* skip malformed pattern */ }
        }
        if (detectedPatterns.length > 0) parsed.detectedRedFlagPatterns = detectedPatterns;
      } catch (_e) {
        console.log("[electrical-estimate] red-flag pattern scan error:", _e.message);
      }

      // --- State licensing context ---
      try {
        if (stateCode && pricingData.stateLicensing?.states?.[stateCode]) {
          const lic = pricingData.stateLicensing.states[stateCode];
          parsed.stateLicensing = {
            state: stateCode,
            authority: lic.authority,
            masterRequired: lic.master_required,
            journeymanRequired: lic.journeyman_required,
            reciprocity: lic.reciprocity || [],
            notes: lic.notes || null
          };
        }
      } catch (_e) { /* optional */ }

      // --- IRA 25C EXPIRED Dec 31 2025; 30C still active for EV chargers (verify per current IRS guidance) ---
      try {
        const iraApplicable = [];
        if (jobType && jobType.startsWith("panel_upgrade")) {
          iraApplicable.push({
            program: "25C Panelboard Credit (EXPIRED Dec 31 2025)",
            amount: "30% up to $600/yr",
            condition: "Panel must be upgraded to enable a heat pump, HPWH, EV charger, or similar electrification upgrade placed in service same tax year",
            form: "IRS Form 5695 Part II"
          });
        }
        if (jobType === "ev_charger_level2") {
          iraApplicable.push({
            program: "30C EV Charger Credit",
            amount: "30% up to $1,000",
            condition: "Residence must be in an eligible low-income or non-urban census tract; check Argonne 30C eligibility map",
            form: "IRS Form 8911"
          });
        }
        if (jobType === "heat_pump_circuit") {
          iraApplicable.push({
            program: "25C Heat Pump Credit (EXPIRED Dec 31 2025)",
            amount: "30% up to $2,000/yr",
            condition: "Electrical work bundled with qualified heat pump install",
            form: "IRS Form 5695 Part II"
          });
        }
        if (iraApplicable.length) parsed.iraApplicable = iraApplicable;
      } catch (_e) { /* optional */ }

      // --- Utility rebate context ---
      try {
        if (stateCode && Array.isArray(pricingData.utilityRebates)) {
          const state_rebates = pricingData.utilityRebates
            .filter(r => Array.isArray(r.states) && r.states.includes(stateCode) && r.active2026 !== false)
            .slice(0, 4);
          if (state_rebates.length) parsed.utilityRebates = state_rebates;
        }
      } catch (_e) { /* optional */ }

      // --- Dangerous panel brand detection ---
      try {
        const panelAvoid = pricingData.brandTiers?.panels_avoid || [];
        const dangerous = [];
        const hay = haystackLower();
        for (const p of panelAvoid) {
          if (hay.includes(p.brand.toLowerCase()) || (p.model && p.model !== "all" && hay.includes(p.model.toLowerCase()))) {
            dangerous.push(p);
          }
        }
        function haystackLower() {
          return ((text || "") + " " + (parsed.lineItems || []).map(li => (li.description || "")).join(" ")).toLowerCase();
        }
        if (dangerous.length) parsed.dangerousPanels = dangerous;
      } catch (_e) { /* optional */ }

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
        source: pricingData.metadata?.sources || "HomeAdvisor, Angi, BLS, NFPA, contractor surveys"
      };

    } catch (e) {
      // Pricing enrichment failed -- still return AI results
      console.log("[electrical-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII before returning or storing
    delete parsed.city;

    if (req.headers["x-trueprice-test"] !== "1") captureAnonymizedData("electrical", parsed); // fire and forget
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
        await redis.incr("tp:total_quotes").catch(() => {});
        const cityLc = String((parsed && (parsed.city || parsed.cityName)) || "")
          .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
        const st = String((parsed && (parsed.stateCode || parsed.state)) || "").toUpperCase();
        const service = "electrical";
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
          if (cityLc) await bump(`cal:${cityLc}:${st}:electrical`);
          await bump(`cal:metro:${st}:electrical`);
        }
      }
    } catch (calErr) {
      console.log("[electrical-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("electrical-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
