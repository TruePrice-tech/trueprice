import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";
import { runAbuseGuard, recordClaudeCall, storeImageCache } from "./_abuse-guard.js";
import { runOcr, ocrTextLooksGood } from "./_ocr.js";
import { enrichWithCalibration } from "./_flywheel-read.js";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed || !parsed.totalBilled) return null;
  // No city, no patient name, no dates -- state only for geographic context
  return {
    v: vertical,
    ts: new Date().toISOString(),
    totalBilled: parsed.totalBilled,
    insurancePaid: parsed.insurancePaid || null,
    patientOwes: parsed.patientResponsibility || null,
    adjustments: parsed.adjustments || null,
    facilityType: parsed.facilityType || null,
    lineItemCount: parsed.lineItems ? parsed.lineItems.length : 0,
    cptCodes: parsed.lineItems ? parsed.lineItems.map(li => li.cptCode).filter(Boolean) : [],
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

// Bumped 60 → 120 on 2026-05-02 after M3 changed compare-medical-quotes
// from "regex-then-API" to "always-API" — uploading 3 quotes used to be
// 0-1 API calls, now it's 3. 60/hr was too tight for users running
// multiple compare sessions in an hour. At Claude haiku-4-5 pricing
// (~$0.001/bill) the new cap is ~$0.12/hr per IP, still cheap.
const RATE_LIMIT_MAX = 120;
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
    const key = `med_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[medical-bill-estimate] Redis rate limit error, falling back to in-memory:", e.message);
    return checkMemoryRateLimit(ip);
  }
}

export default async function handler(req, res) {
  const allowedOrigin = "https://woogoro.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-woogoro-mcp-key");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // MCP bypass: requests from the Woogoro MCP server include a shared
  // secret in x-woogoro-mcp-key. When valid, skip the browser-shaped
  // abuse guard and per-IP rate limit (the MCP is a single trusted
  // caller; protect it with key rotation, not browser heuristics).
  const _mcpKey = req.headers["x-woogoro-mcp-key"];
  const _mcpKeyValid =
    !!_mcpKey &&
    !!process.env.WOOGORO_MCP_KEY &&
    _mcpKey === process.env.WOOGORO_MCP_KEY;

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || "unknown";
  if (!_mcpKeyValid && !(await checkRateLimit(clientIp))) {
    return res.status(429).json({ error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} requests per hour. Please try again later.` });
  }

    // Abuse guard: burst detect, IP daily cap, suspicious patterns,
    // image dedup, global Claude ceiling. Returns cached result if hit.
    // Skipped for valid MCP callers (they're a single trusted process).
    const _imageBuf = (req.body && req.body.images && req.body.images[0])
      ? Buffer.from((req.body.images[0].split(",")[1] || ""), "base64")
      : null;
    let _guard;
    if (_mcpKeyValid) {
      _guard = { ok: true, imageHash: null, cachedResult: null };
    } else {
      _guard = await runAbuseGuard(req, { vertical: "medical-bill:v7-credit-balance-narrow-2026-05-03", imageBytes: _imageBuf });
      if (!_guard.ok) {
        return res.status(_guard.status).json({ error: _guard.error });
      }
      if (_guard.cachedResult) {
        return res.status(200).json(_guard.cachedResult);
      }
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
      text: `Analyze this medical bill, Explanation of Benefits (EOB), or healthcare invoice. You are a medical billing expert. Extract information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM BILL:\n" + text.substring(0, 10000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalBilled": <number or null - total amount billed by provider>,
  "insurancePaid": <number or null - amount insurance paid>,
  "adjustments": <number or null - insurance negotiated adjustments/discounts>,
  "patientResponsibility": <number or null - what the patient owes>,
  "facilityName": <string or null - hospital, clinic, or provider name>,
  "facilityType": <"hospital_outpatient" | "hospital_inpatient" | "emergency_room" | "physician_office" | "ambulatory_surgery_center" | "lab" | "imaging_center" | "urgent_care" | null>,
  "serviceDate": <string "YYYY-MM-DD" or null>,
  "stateCode": <string two-letter state or null - state where services were provided>,
  "insuranceName": <string or null>,
  "isEmergency": <boolean - was this an emergency visit?>,
  "lineItems": [
    {
      "description": <string - service description>,
      "cptCode": <string or null - CPT/HCPCS code if listed>,
      "quantity": <number, default 1>,
      "chargedAmount": <number or null>,
      "allowedAmount": <number or null - insurance allowed amount>,
      "insurancePaid": <number or null>,
      "patientOwes": <number or null>,
      "isFacilityFee": <boolean - is this a facility fee vs professional fee?>,
      "category": <"office_visit" | "emergency" | "imaging" | "lab" | "surgery" | "maternity" | "mental_health" | "physical_therapy" | "inpatient" | "procedure" | "anesthesia" | "pharmacy" | "dental" | "other">
    }
  ],
  "billChecks": {
    "cptCodes": <"yes" | "no" | "partial">,
    "itemized": <"yes" | "no" | "partial">,
    "facility": <"yes" | "no" | "unclear" - facility vs professional fee separated?>,
    "insuranceApplied": <"yes" | "no" | "unclear">,
    "inNetwork": <"yes" | "no" | "unclear">,
    "duplicates": <"none_found" | "possible" | "unclear">,
    "dateMatch": <"yes" | "no" | "unclear">,
    "unbundling": <"none_found" | "possible" | "unclear">,
    "upcoding": <"none_found" | "possible" | "unclear">,
    "patientResponsibility": <"yes" | "no" | "unclear">,
    "noSurprisesCompliant": <"yes" | "no" | "unclear" | "not_applicable">
  },
  "unbundlingDetails": [<array of {codes: [string], rule: string} if unbundling detected>],
  "facilityComparison": {
    "currentFacilityType": <string or null>,
    "estimatedSavingsAtASC": <number or null - estimated $ savings if done at ambulatory surgery center>,
    "estimatedSavingsAtImaging": <number or null - savings at freestanding imaging center>,
    "applicableProcedures": [<CPT codes that could be done at lower-cost facility>]
  },
  "noSurprisesFlags": [<array of strings if any No Surprises Act violations detected: balance billing on emergency, OON at in-network facility, no good faith estimate, bill exceeds estimate by $400+>],
  "redFlags": [<array of strings describing any billing concerns, errors, or items worth disputing>],
  "disputeActions": [<array of specific steps the patient should take, e.g. "Call billing at X and request itemized bill", "File appeal with insurance for CPT XXXXX", "Request cash/self-pay discount">],
  "summary": <string - one paragraph plain-English summary of the bill and any concerns>
}

CRITICAL EXTRACTION RULES:
- ALWAYS extract dollar amounts. If ANY dollar figure is visible anywhere in the document (balance due, total charges, amount billed, patient responsibility, remaining balance, "you owe", "due now"), extract it.
- totalBilled is the headline number: use "Total Charges" or "Billed to Insurance" or "Billed" if present; otherwise use "Amount Due" / "Balance Due" / "You Owe" / patient responsibility as a fallback.
- If only line-item amounts are shown, SUM them for totalBilled.
- Never return null for totalBilled, patientResponsibility, or chargedAmount when any dollar figure is visible. If truly no numbers exist, return null.
- redFlags: ALWAYS identify at least one concern on every itemized bill. Medical-relevant checks only — see CRITICAL ANALYSIS RULES below.

ACCOUNTING CONVENTIONS (apply to EVERY dollar field — patientResponsibility, insurancePaid, adjustments, chargedAmount, allowedAmount, line items):
- Parentheses around a number mean NEGATIVE in medical billing (e.g., "($27.00)" is -$27.00, "(2,012.00)" is -$2,012.00). This is the standard accounting convention used on EOBs and patient ledgers.
- A leading minus sign also means negative ("-$650.00" is -$650.00).
- Payments and adjustments are commonly shown as negative against charges. "Insurance Payment: ($2,012.00)" means insurance paid $2,012 — record this as insurancePaid: 2012 (positive), since the field semantically captures the magnitude paid.
- CREDIT BALANCE (narrow rule — apply ONLY when the explicit patient-owed line itself is negative): If the bill has a labeled "Patient Responsibility" / "Amount Due" / "Remaining Amount Due" / "Balance Due" line AND that specific line's number is in parentheses or has a leading minus sign, the patient has OVERPAID. In that case set patientResponsibility to 0 AND add a redFlag like "Credit balance: provider owes patient a refund of $X — call billing to request a refund check or apply to next visit". NEVER report a positive patientResponsibility value when the bill's patient-owed line is negative.
- DO NOT infer a credit balance from negative payment/adjustment lines alone. Negative numbers on "Insurance Payment", "Adjustment", "Contractual Write-off", "Discount" lines are NORMAL accounting (subtractions from charges) and do NOT mean the patient overpaid. If "PATIENT RESPONSIBILITY" or "Amount Due" is shown as a positive number, USE that positive number — even if other lines on the bill are negative.
- If two views of the same number disagree (e.g., a labeled total of $535 but a remaining-due of -$27 after payments), the REMAINING DUE is the patient's actual responsibility, not the gross charges. But this only applies when the remaining-due is itself explicitly negative — do not compute a synthetic remaining-due by subtracting payments from charges and inferring credit from arithmetic alone.

- summary: ALWAYS explain WHY the bill total is high, low, or fair in MEDICAL terms. Reference specific factors: facility type (hospital outpatient is typically 2-3x an ambulatory surgery center for the same procedure), CPT complexity and typical commercial vs Medicare rates, emergency vs scheduled care, in-network vs out-of-network status, whether the patient had met their deductible. Never reference materials, labor rates, permits, or warranties — those do not apply to medical bills.

CRITICAL ANALYSIS RULES:
- Extract ALL line items you can find
- For each line item, identify CPT/HCPCS code if present
- SECTION-HEADER CPT INHERITANCE: If a section header lists a CPT code (e.g., "CT abdomen and pelvis with contrast (CPT 74177)" or "CPT 74177: CT abdomen and pelvis") and the line items beneath are sub-charges of that procedure (facility fee, contrast media, radiologist interpretation, IV catheter, drug administration, etc), apply the header's CPT code to every line item in that section UNLESS the line item explicitly lists a different CPT/HCPCS code. The radiologist interpretation line specifically is conventionally the same CPT with a -26 modifier (e.g., 74177-26). Without inheritance, the entire section's line items render with no CPT and the benchmark engine falls back to wildly wrong category averages.
- CPT INFERENCE FROM PROCEDURE NAME: If a section description plainly identifies a common procedure but the CPT code itself is missing or OCR-mangled (e.g., the parenthesized "(CPT 74177)" is unreadable but the description "CT abdomen and pelvis with IV contrast" is clear), infer the standard CPT from the procedure name. Common inferences: "CT abdomen and pelvis with contrast" → 74177; "CT abdomen and pelvis without contrast" → 74176; "MRI brain without contrast" → 70551; "MRI brain with and without contrast" → 70553; "CT head without contrast" → 70450; "X-ray chest 2 views" → 71046; "ER visit level 3" → 99283; "ER visit level 4" → 99284; "ER visit level 5" → 99285; "office visit established level 3" → 99213; "office visit established level 4" → 99214; "screening colonoscopy" → 45378; "diagnostic colonoscopy with biopsy" → 45380; "screening mammogram" → 77067; "echocardiogram" → 93306; "EKG" → 93000. Mark inferred CPTs the same way as extracted ones; do not fabricate a CPT when the description is generic or ambiguous.
- Flag charges > 3x Medicare rate for that CPT code as potential overcharges
- Flag duplicate charges (same CPT code, same date)
- Flag potential upcoding (level 5 visit for routine care, critical care for non-ICU)
- Check for NCCI unbundling: flag if CMP (80053) billed with BMP (80048) or glucose (82947); if colonoscopy with biopsy (45380) also bills diagnostic (45378); if complete EKG (93000) also bills interpretation (93010); similar bundling violations
- If screening colonoscopy/mammogram was billed as diagnostic, flag as possible ACA preventive care violation
- If emergency visit and patient billed balance (above in-network rate), flag No Surprises Act violation
- If out-of-network provider at in-network facility, flag No Surprises Act violation
- Note facility fees: if facility fee > 30% of total, flag and calculate savings at ASC or freestanding center
- For imaging (MRI, CT, X-ray), calculate savings at freestanding imaging center (typically 40-60% less)
- For surgery done at hospital outpatient, calculate ASC savings (typically 42% less)
- Provide specific, actionable dispute steps, not generic advice
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
      await storeImageCache("medical-bill:v3-direct-call-2026-04-27", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // Enrich with local pricing data
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'medical-cpt-pricing.json'), 'utf-8'));
      const stateCode = (parsed.stateCode || "").toUpperCase();
      const stateMult = pricingData.gpciLocalities?.stateMultipliers?.[stateCode] || 1.0;
      const commercialMult = pricingData.commercialByState?.[stateCode] || 2.54;
      const facilityType = parsed.facilityType || "hospital_outpatient";
      const facilityMult = pricingData.facilityMultipliers?.[facilityType] || 1.0;

      // Enrich each line item with Medicare benchmark
      if (parsed.lineItems) {
        for (const li of parsed.lineItems) {
          if (li.cptCode && pricingData.commonCPTCodes?.[li.cptCode]) {
            const cptData = pricingData.commonCPTCodes[li.cptCode];
            li.medicareRate = Math.round(cptData.medicareRate * stateMult);
            li.commercialEstimate = Math.round(cptData.medicareRate * commercialMult);
            li.fairPriceRange = [
              Math.round(cptData.medicareRate * stateMult),
              Math.round(cptData.medicareRate * commercialMult * 1.1)
            ];
            if (li.chargedAmount && li.medicareRate > 0) {
              li.chargeToMedicareRatio = Math.round((li.chargedAmount / li.medicareRate) * 100) / 100;
              if (li.chargeToMedicareRatio > 3.5) {
                li.overchargeFlag = "Charged " + li.chargeToMedicareRatio + "x Medicare rate";
              }
            }
          }
        }
      }

      // Server-side NCCI bundle check
      if (parsed.lineItems && pricingData.ncciCommonBundles) {
        const billedCodes = new Set(parsed.lineItems.map(li => li.cptCode).filter(Boolean));
        const bundleViolations = [];
        for (const bundle of pricingData.ncciCommonBundles) {
          if (billedCodes.has(bundle.col1) && billedCodes.has(bundle.col2)) {
            bundleViolations.push({
              codes: [bundle.col1, bundle.col2],
              rule: bundle.rule
            });
          }
        }
        if (bundleViolations.length > 0) {
          parsed.unbundlingDetails = (parsed.unbundlingDetails || []).concat(bundleViolations);
          for (const v of bundleViolations) {
            const flag = "Possible unbundling: CPT " + v.codes[0] + " and " + v.codes[1] + " billed together. " + v.rule;
            if (!parsed.redFlags.includes(flag)) parsed.redFlags.push(flag);
          }
        }
      }

      // Add geographic context
      parsed.pricingContext = {
        state: stateCode || null,
        stateMultiplier: stateMult,
        commercialMultiplier: commercialMult,
        facilityType: facilityType,
        facilityMultiplier: facilityMult,
        source: "CMS MPFS 2026 + RAND 2024"
      };

      // Facility savings calculation
      if (!parsed.facilityComparison) parsed.facilityComparison = {};
      if (facilityType === "hospital_outpatient" || facilityType === "emergency_room") {
        const ascMult = pricingData.facilityMultipliers?.ambulatory_surgery_center || 0.58;
        const imagingMult = pricingData.facilityMultipliers?.freestanding_imaging || 0.40;
        let surgeryTotal = 0, imagingTotal = 0;
        for (const li of (parsed.lineItems || [])) {
          if (li.category === "surgery" || li.category === "procedure") surgeryTotal += (li.chargedAmount || 0);
          if (li.category === "imaging") imagingTotal += (li.chargedAmount || 0);
        }
        if (surgeryTotal > 0) parsed.facilityComparison.estimatedSavingsAtASC = Math.round(surgeryTotal * (1 - ascMult));
        if (imagingTotal > 0) parsed.facilityComparison.estimatedSavingsAtImaging = Math.round(imagingTotal * (1 - imagingMult));
      }
    } catch(e) {
      // Pricing enrichment failed -- still return AI results
      console.log("[medical-bill-estimate] Pricing enrichment error:", e.message);
    }

    // Strip any PII before returning or storing
    delete parsed.patientName;

    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || parsed.facilityCity || "";
    const _calState = parsed.stateCode || parsed.state || parsed.facilityState || "";
    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "medical" });

    if (req.headers["x-woogoro-test"] !== "1") captureAnonymizedData("medical", parsed); // fire and forget
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
      // Medical bills use totalBilled, not totalPrice. Try in order:
      // explicit totalPrice > totalBilled > patientResponsibility
      const totalPrice = Number(
        (parsed && parsed.totalPrice) ||
        (parsed && parsed.totalBilled) ||
        (parsed && parsed.patientResponsibility)
      ) || 0;
      if (totalPrice > 0 && !_isTestMode) {

        const cityLc = String((parsed && (parsed.city || parsed.cityName || parsed.facilityCity)) || "")
          .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
        const st = String((parsed && (parsed.stateCode || parsed.state || parsed.facilityState)) || "").toUpperCase();
        const service = "medical";
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
          if (cityLc) await bump(`cal:${cityLc}:${st}:medical`);
          await bump(`cal:metro:${st}:medical`);

          // Counter tick — real image uploads only, never synthetic
          if (_imageBuf) {
            try { await redis.incr("tp:total_quotes"); } catch (_) { /* best-effort */ }
          }
        }
      }
    } catch (calErr) {
      console.log("[medical-bill-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("medical-bill-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
