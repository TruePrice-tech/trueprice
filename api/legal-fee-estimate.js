import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";
import { runAbuseGuard, recordClaudeCall, cacheResult } from "./_abuse-guard.js";
import { runOcr, ocrTextLooksGood } from "./_ocr.js";
import { enrichWithCalibration } from "./_flywheel-read.js";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed) return null;
  return {
    v: vertical,
    ts: new Date().toISOString(),
    feeStructure: parsed.feeStructure || null,
    hourlyRate: parsed.hourlyRate || null,
    flatFee: parsed.flatFee || null,
    contingencyPct: parsed.contingencyPercent || null,
    retainerAmount: parsed.retainerAmount || null,
    practiceArea: parsed.practiceArea || null,
    billingIncrement: parsed.billingIncrement || null,
    lineItemCount: parsed.lineItems ? parsed.lineItems.length : 0,
    redFlagCount: parsed.redFlags ? parsed.redFlags.length : 0,
    state: parsed.stateCode || null
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
    const key = `legal_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[legal-fee-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
    return res.status(429).json({ error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} requests per hour.` });
  }

    // Abuse guard: burst detect, IP daily cap, suspicious patterns,
    // image dedup, global Claude ceiling. Returns cached result if hit.
    const _imageBuf = (req.body && req.body.images && req.body.images[0])
      ? Buffer.from((req.body.images[0].split(",")[1] || ""), "base64")
      : null;
    // cacheNamespace: bump the suffix when the prompt or pricingContext shape
    // changes to invalidate stale cache. v7 added contingencyRange +
    // practiceFeeType + nulled adjustedMarketRate for contingency-only practice
    // areas (price-sanity audit LP-4, 2026-05-03).
    // cacheNamespace bumped to v6 (legal dive 2026-05-03) — the v5 namespace
    // got polluted with stale entries during the gradual deploy window before
    // L6 fully rolled to all warm Vercel function instances. v6 starts clean.
    const _guard = await runAbuseGuard(req, { vertical: "legal-fee", imageBytes: _imageBuf, cacheNamespace: "legal-fee:v7-pctx" });
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

    // OCR-FIRST PIPELINE: When the caller sends an image without OCR text
    // (browser OCR failed, API consumer, test runner), run server-side OCR
    // via OCR.space and use the extracted text. If the text looks good,
    // DROP the image from the Claude call entirely (text-only is ~10x cheaper).
    let ocrSource = null;
    if ((!text || text.length < 100) && images && images.length > 0) {
      const firstImg = images[0];
      const match = firstImg && firstImg.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (match) {
        const ocrResult = await runOcr(match[2], match[1]);
        if (ocrResult && ocrResult.text) {
          text = ocrResult.text;
          ocrSource = ocrResult.source;
          console.log(`[legal-fee] OCR extracted ${ocrResult.text.length} chars via ${ocrResult.source}`);
        }
      }
    }

    // Decide whether to send the image to Claude vision or text-only.
    // If OCR text is good enough, drop the image (~90% cost savings on Claude).
    const useTextOnly = text && ocrTextLooksGood(text);

    const content = [];
    if (!useTextOnly && images && images.length > 0) {
      for (const img of images.slice(0, 3)) {
        const match = img.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (match) {
          content.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
        }
      }
    }

    content.push({
      type: "text",
      text: `Analyze this legal fee agreement, retainer agreement, or attorney invoice. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM DOCUMENT:\n" + text.substring(0, 10000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "documentType": <"retainer_agreement" | "invoice" | "fee_agreement" | "engagement_letter" | "other">,
  "firmName": <string or null>,
  "attorneyName": <string or null>,
  "practiceArea": <"family_law" | "personal_injury" | "criminal_defense" | "estate_planning" | "real_estate" | "business_law" | "immigration" | "bankruptcy" | "employment_law" | "intellectual_property" | "tax_law" | "general_litigation" | "other">,
  "firmSize": <"solo" | "small" | "midsize" | "large" | "biglaw" | null>,
  "feeStructure": <"hourly" | "flat_fee" | "contingency" | "hybrid" | "unclear">,
  "hourlyRate": <number or null>,
  "flatFee": <number or null>,
  "contingencyPercent": <number or null>,
  "retainerAmount": <number or null>,
  "estimatedTotalLow": <number or null>,
  "estimatedTotalHigh": <number or null>,
  "billingIncrement": <"6_min" | "10_min" | "15_min" | "other" | null>,
  "city": <string or null>,
  "stateCode": <2-letter state code or null>,
  "caseDescription": <brief string or null>,
  "lineItems": [
    {
      "description": <string>,
      "hours": <number or null>,
      "rate": <number or null>,
      "amount": <number or null>
    }
  ],
  "blockBillingEntries": [<array of line item indices (0-based) where block billing is detected>],
  "vagueEntries": [<array of line item indices (0-based) with vague descriptions>],
  "paralegalWorkAtAttorneyRate": [<array of line item indices (0-based) where clerical work is billed at attorney rate>],
  "overheadExpenses": [<array of strings describing overhead items being billed as expenses>],
  "estimatedIncrementOvercharge": <number or null - estimated $ overcharged due to 15-min vs 6-min increments>,
  "retainerChecks": {
    "scopeDefined": <"yes" | "no" | "unclear">,
    "rateStated": <"yes" | "no" | "unclear">,
    "billingIncrement": <"yes" | "no" | "unclear">,
    "retainerAmount": <"yes" | "no" | "unclear">,
    "expensePolicy": <"yes" | "no" | "unclear">,
    "estimatedCost": <"yes" | "no" | "unclear">,
    "communicationPolicy": <"yes" | "no" | "unclear">,
    "terminationClause": <"yes" | "no" | "unclear">,
    "conflictCheck": <"yes" | "no" | "unclear">,
    "feeDispute": <"yes" | "no" | "unclear">
  },
  "redFlags": [<array of strings describing concerns>],
  "summary": <string - one paragraph plain-English summary>
}

CRITICAL EXTRACTION RULES (read carefully):

PICKING THE HEADLINE FEE — only ONE of these fields gets the primary number:

  flatFee: The single dollar amount the client pays the FIRM for the legal
    services described, when there is one. Look for labels like "Flat Fee",
    "Total Flat Fee", "Total Cost for Services", "Engagement Fee", "FLAT FEE
    FOR LEGAL SERVICES". Examples:
      "Total flat fee: $3,500"           -> flatFee = 3500
      "FLAT FEE FOR LEGAL SERVICES: $895" -> flatFee = 895
      "The total flat fee is $1,250"     -> flatFee = 1250
      "Total flat fee: $1,495"           -> flatFee = 1495
      "$850" (LLC formation flat fee)    -> flatFee = 850

  retainerAmount: A trust-account deposit the client pays UP FRONT to be
    drawn down hourly. Use this when there is no flat fee, only an hourly
    rate plus an initial deposit. Examples:
      "Initial Retainer: $15,000"        -> retainerAmount = 15000
      "Client agrees to deposit $7,500"  -> retainerAmount = 7500

  contingencyPercent: The lowest tier percentage from a contingency
    agreement. Use this for personal injury, employment, etc. Examples:
      "33 1/3% if before lawsuit"        -> contingencyPercent = 33.33
      "40% if matter resolves before trial" (only tier shown) -> contingencyPercent = 40

NEVER use a down-payment, deposit, or installment as the headline fee.
  WRONG: "Total flat fee: $3,500. $1,500 due upon signing." -> flatFee = 1500
  RIGHT: "Total flat fee: $3,500. $1,500 due upon signing." -> flatFee = 3500

NEVER include filing fees, court costs, title insurance, recording fees,
  credit reports, or any other pass-through cost in flatFee. Those are
  third-party costs, not the firm's legal fee. Put them in lineItems
  with category notes; do NOT add them to flatFee.

NEVER sum a flat fee with an "additional services" hourly rate to get a
  bigger number. Example:
    "Flat fee: $1,250. Additional services beyond scope: $325/hr"
    -> flatFee = 1250, hourlyRate = 325 (DO NOT report 1575 or 3250)

When in doubt: pick the LOWEST clearly-labeled total, not the highest.
  The user wants to know what they will most likely pay; the highest
  number is usually a worst-case range or a "could go up to" amount.

OTHER FIELDS:
  - hourlyRate: lead attorney rate when an hourly model is used
  - estimatedTotalLow / estimatedTotalHigh: explicit range like "$8,000 to $25,000"
  - city / stateCode: from firm letterhead
  - practiceArea: divorce = family_law, DUI = criminal_defense, will = estate_planning, etc.
  - firmSize: solo (1), small (2-10), midsize (11-50), large (51-200), biglaw (200+), null if unknown
  - feeStructure: hourly | flat_fee | contingency | hybrid | unclear
  - documentType: retainer_agreement | engagement_letter | invoice | fee_agreement | other
  - lineItems: each fee/rate/cost as a row
  - redFlags: vague scope, non-refundable retainer, no termination clause,
    no expense policy, unusually high rates, broad fee ranges, missing
    conflict check, paralegal work at attorney rate, etc. Always at least one.

NEVER RETURN ALL-NULL for a real legal document with visible dollar amounts.
At least one of flatFee, retainerAmount, hourlyRate, contingencyPercent,
or estimatedTotalLow MUST be populated.

Return ONLY the JSON object, no markdown, no explanation.`
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

      // Record successful Claude call against the global ceiling. The image
      // cache write moved below — it must run AFTER pricing enrichment and
      // attorneyName PII strip so cached responses match fresh ones and don't
      // leak PII (legal dive 2026-05-03 finding L6).
      await recordClaudeCall();
    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // Enrich with local pricing data
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'legal-fee-pricing.json'), 'utf-8'));
      const stateCode = (parsed.stateCode || "").toUpperCase();
      const firmSize = parsed.firmSize || null;
      const practiceArea = parsed.practiceArea || "general_litigation";
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;
      const firmSizeMult = pricingData.firmSizeMultipliers?.[firmSize] || 1.0;

      // Calculate adjusted market rate
      const paData = pricingData.hourlyRatesByPracticeArea?.[practiceArea];
      const baseRate = paData?.rates?.mid || pricingData.metadata?.nationalAvgHourlyRate || 349;
      const adjustedRate = Math.round(baseRate * stateMult * firmSizeMult);

      // LP-4 (price-sanity audit 2026-05-03): for contingency-driven practice
      // areas (personal_injury), paData.rates is [0,0,0] so adjustedMarketRate
      // is meaningless. The frontend needs paData.contingencyRange + feeType to
      // render "Typical 25-40%" instead of "Market Mid $0/hr". Also surface the
      // hourly band [low, high] alongside the mid so the frontend can stop
      // recomputing it from a coarse local table (mirror FENCE-B2 upstream
      // apiResult-override pattern).
      const isContingencyOnly = paData?.feeType === "contingency" &&
                                (!paData.rates || (paData.rates.low === 0 && paData.rates.mid === 0));

      const pricingContext = {
        state: stateCode || null,
        stateMultiplier: stateMult,
        firmSize: firmSize,
        firmSizeMultiplier: firmSizeMult,
        adjustedMarketRate: isContingencyOnly ? null : adjustedRate,
        marketRateRange: paData && !isContingencyOnly ? [
          Math.round(paData.rates.low * stateMult * firmSizeMult),
          Math.round(paData.rates.high * stateMult * firmSizeMult)
        ] : null,
        practiceFeeType: paData?.feeType || null,
        contingencyRange: paData?.contingencyRange || null,
        source: "Clio Legal Trends 2025, LawPay, state bar surveys"
      };

      // Include flat fee comparison if available
      if (paData?.flatFees) {
        pricingContext.flatFeeComparison = {};
        for (const [key, range] of Object.entries(paData.flatFees)) {
          pricingContext.flatFeeComparison[key] = [
            Math.round(range[0] * stateMult),
            Math.round(range[1] * stateMult)
          ];
        }
      }

      parsed.pricingContext = pricingContext;

      // Calculate retainer check score
      if (parsed.retainerChecks && pricingData.retainerCheckItems) {
        let totalWeight = 0;
        let passingWeight = 0;
        for (const item of pricingData.retainerCheckItems) {
          totalWeight += item.weight;
          const val = parsed.retainerChecks[item.key];
          if (val === "yes") passingWeight += item.weight;
        }
        parsed.retainerCheckScore = totalWeight > 0 ? Math.round((passingWeight / totalWeight) * 100) : null;
      }
    } catch (e) {
      // Pricing enrichment failed -- still return AI results
      console.log("[legal-fee-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII before returning or storing
    delete parsed.attorneyName;

    // L6 (legal dive 2026-05-03): cache write happens HERE so the cached payload
    // includes pricingContext + retainerCheckScore (added in the enrichment block
    // above) and excludes attorneyName (just deleted). Previously the cache held
    // a pre-enrichment, pre-PII-strip snapshot, so subsequent uploads of the same
    // image silently leaked attorneyName and rendered with empty pricingContext /
    // Agreement Score N/A.
    await cacheResult(_guard, { success: true, source: "claude-haiku", data: parsed });

    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || parsed.firmCity || "";
    const _calState = parsed.stateCode || parsed.state || parsed.firmState || "";
    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "legal" });

    if (req.headers["x-woogoro-test"] !== "1") captureAnonymizedData("legal", parsed); // fire and forget
    // Test-mode skip: synthetic test fixtures (X-Woogoro-Test: 1)
    // do NOT count toward the public counter or feed pricing aggregates.
    // Only real-world quotes from real users should affect either.
    const _isTestMode = req.headers["x-woogoro-test"] === "1";
    if (_isTestMode) {
      console.log("[test-mode] skipping flywheel writes for this request");
    }



    // FLYWHEEL BRIDGE: increment global counter + write to cal:* aggregates
    // so this vertical's quotes feed the same systems as moving and auto.
    try {
      // Legal docs come in many shapes. Pick the most "headline" price in this order:
      //   1. explicit totalPrice (rare)
      //   2. flatFee (estate/criminal/closing/bankruptcy/LLC)
      //   3. retainerAmount (litigation/family law)
      //   4. estimatedTotalLow (when only a range is shown)
      //   5. contingencyPercent * 50000 (typical PI gross recovery for counter purposes)
      //   6. hourlyRate * 10 (typical short engagement fallback)
      const _p = parsed || {};
      let totalPrice = Number(_p.totalPrice) || Number(_p.flatFee) || Number(_p.retainerAmount) || 0;
      if (!totalPrice && _p.estimatedTotalLow) {
        totalPrice = Number(_p.estimatedTotalLow);
      }
      if (!totalPrice && _p.contingencyPercent) {
        // Contingency cases don't have an upfront price — use a synthetic
        // representative case value for counter/aggregate purposes only.
        totalPrice = Math.round(50000 * (Number(_p.contingencyPercent) / 100));
      }
      if (!totalPrice && _p.hourlyRate) {
        totalPrice = Number(_p.hourlyRate) * 10;
      }
      if (totalPrice > 0 && !_isTestMode) {

        const cityLc = String((parsed && (parsed.city || parsed.cityName || parsed.firmCity)) || "")
          .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
        const st = String((parsed && (parsed.stateCode || parsed.state || parsed.firmState)) || "").toUpperCase();
        const service = "legal";
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
          if (cityLc) await bump(`cal:${cityLc}:${st}:legal`);
          await bump(`cal:metro:${st}:legal`);

          // Counter tick — real image uploads only, never synthetic
          if (_imageBuf) {
            try { await redis.incr("tp:total_quotes"); } catch (_) { /* best-effort */ }
          }
        }
      }
    } catch (calErr) {
      console.log("[legal-fee-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({ success: true, source: "claude-haiku", data: parsed });

  } catch (error) {
    console.error("legal-fee-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
