import { Redis } from "@upstash/redis";

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
      text: `Analyze this medical bill, Explanation of Benefits (EOB), or healthcare invoice. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

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
  "patientName": <string or null>,
  "insuranceName": <string or null>,
  "lineItems": [
    {
      "description": <string - service description>,
      "cptCode": <string or null - CPT/HCPCS code if listed>,
      "quantity": <number or null>,
      "chargedAmount": <number or null>,
      "allowedAmount": <number or null - insurance allowed amount>,
      "insurancePaid": <number or null>,
      "patientOwes": <number or null>,
      "category": <"office_visit" | "emergency" | "imaging" | "lab" | "surgery" | "maternity" | "mental_health" | "physical_therapy" | "inpatient" | "procedure" | "anesthesia" | "pharmacy" | "other">
    }
  ],
  "billChecks": {
    "cptCodes": <"yes" | "no" | "partial" - are CPT codes listed?>,
    "itemized": <"yes" | "no" | "partial" - are charges itemized?>,
    "facility": <"yes" | "no" | "unclear" - facility vs professional fee separated?>,
    "insuranceApplied": <"yes" | "no" | "unclear" - insurance adjustments applied?>,
    "inNetwork": <"yes" | "no" | "unclear" - is provider in-network?>,
    "duplicates": <"none_found" | "possible" | "unclear" - any duplicate charges?>,
    "dateMatch": <"yes" | "no" | "unclear" - do dates look consistent?>,
    "unbundling": <"none_found" | "possible" | "unclear" - any unbundled charges?>,
    "upcoding": <"none_found" | "possible" | "unclear" - any potential upcoding?>,
    "patientResponsibility": <"yes" | "no" | "unclear" - is patient amount clearly stated?>
  },
  "redFlags": [<array of strings describing any billing concerns, errors, or items worth disputing>],
  "summary": <string - one paragraph plain-English summary of the bill and any concerns>
}

Rules:
- Extract ALL line items you can find
- For each line item, try to identify the CPT code if present
- Flag any charges that seem unusually high for the service
- Flag duplicate charges (same CPT code, same date)
- Flag potential upcoding (e.g., level 5 visit for what sounds routine)
- If a screening colonoscopy was billed as diagnostic, flag it
- Note if facility fees seem disproportionate
- redFlags should list specific, actionable concerns the patient should dispute
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
