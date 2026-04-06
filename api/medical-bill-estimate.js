import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed || !parsed.totalBilled) return null;
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
    city: parsed.city || null,
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

const RATE_LIMIT_MAX = 10;
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { text, images } = req.body;

    if (!text && (!images || images.length === 0)) {
      return res.status(400).json({ error: "No text or images provided" });
    }

    const content = [];

    if (images && images.length > 0) {
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
  "patientName": <string or null>,
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

CRITICAL ANALYSIS RULES:
- Extract ALL line items you can find
- For each line item, identify CPT/HCPCS code if present
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

    captureAnonymizedData("medical", parsed); // fire and forget

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
