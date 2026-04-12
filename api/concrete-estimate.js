import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";
import { runAbuseGuard, recordClaudeCall, storeImageCache } from "./_abuse-guard.js";
import { runOcr, ocrTextLooksGood } from "./_ocr.js";
import { enrichWithCalibration } from "./_flywheel-read.js";

const redis = Redis.fromEnv();

function buildAnonymizedRecord(vertical, parsed) {
  if (!parsed || !parsed.totalPrice) return null;
  return {
    v: vertical,
    ts: new Date().toISOString(),
    price: parsed.totalPrice,
    jobType: parsed.jobType || null,
    sqft: parsed.squareFootage || null,
    thickness: parsed.thickness || null,
    finish: parsed.finish || null,
    reinforcement: parsed.reinforcement || null,
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
    const key = `concrete_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[concrete-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
    const _guard = await runAbuseGuard(req, { vertical: "concrete", imageBytes: _imageBuf });
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
      text: `Analyze this concrete work quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "materialsTotal": <number or null - total materials cost>,
  "jobType": <"driveway" | "patio" | "sidewalk" | "slab" | "retaining_wall" | "steps" | "pool_deck" | "repair" | null>,
  "squareFootage": <number or null - total square footage>,
  "thickness": <number or null - concrete thickness in inches>,
  "finish": <"plain" | "stamped" | "colored" | "exposed_aggregate" | "broom" | "polished" | null>,
  "reinforcement": <"rebar" | "mesh" | "fiber" | "none" | null>,
  "psiRating": <number or null - concrete PSI strength (e.g. 3000, 4000)>,
  "basePrep": <boolean or null - gravel base / sub-base preparation included>,
  "formWork": <boolean or null - forming included>,
  "demolition": <boolean or null - old concrete removal included>,
  "sealerIncluded": <boolean or null - sealer application included>,
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
    "laborRate": <"yes" | "no" | "unclear" - labor rate clearly stated>,
    "partsItemized": <"yes" | "no" | "unclear" - materials listed individually>,
    "permit": <"yes" | "no" | "unclear" - permits included>,
    "warranty": <"yes" | "no" | "unclear" - warranty terms stated>,
    "cleanup": <"yes" | "no" | "unclear" - debris removal/cleanup>,
    "timeline": <"yes" | "no" | "unclear" - project schedule stated>,
    "thickness": <"yes" | "no" | "unclear" - concrete thickness specified>,
    "rebar": <"yes" | "no" | "unclear" - reinforcement included>,
    "gradePrep": <"yes" | "no" | "unclear" - grading/base prep included>,
    "sealer": <"yes" | "no" | "unclear" - sealer application included>,
    "curing": <"yes" | "no" | "unclear" - curing time / process discussed>,
    "drainage": <"yes" | "no" | "unclear" - drainage / slope grading addressed>
  },
  "warrantyProduct": <string or null - concrete/workmanship warranty>,
  "costPerSqFt": <number or null - total / square footage>,
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
- totalPrice: Use the grand total / bottom line, not sum of line items
- costPerSqFt: Calculate totalPrice / squareFootage if both available
- Mark scopeItems "yes" only if clearly present in the quote
- redFlags: Include if any of the following are detected:
  * No rebar or wire mesh for driveways (will crack under vehicle weight)
  * No base/sub-base preparation (gravel bed is critical for proper drainage and support)
  * No sealer mentioned (unsealed concrete degrades much faster, especially stamped)
  * Thickness less than 4 inches for driveways (standard minimum is 4")
  * No control joints / expansion joints discussed
  * PSI below 3500 for driveways (too weak for vehicle traffic)
  * No demolition plan for existing concrete replacement
  * No mention of curing time requirements
  * Price per sqft unusually high or low for the finish type
  * Any other suspicious or concerning items
- possibleUpsells: Flag stamped finish upgrade, colored concrete, exposed aggregate, radiant heating, decorative borders, extra sealer coats
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
      await storeImageCache("concrete", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'concrete-pricing.json'), 'utf-8'));

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;

      // Match job type + finish to commonJobs for expected range
      let expectedRange = null;
      const jobType = parsed.jobType || "patio";
      const finish = parsed.finish || "plain";
      const sqft = parsed.squareFootage || null;

      // Build job key from type and finish
      const jobKeyMap = {
        "driveway_plain": "driveway_plain",
        "driveway_stamped": "driveway_stamped",
        "driveway_colored": "driveway_stamped",
        "patio_plain": "patio_plain",
        "patio_stamped": "patio_stamped",
        "patio_colored": "patio_stamped",
        "sidewalk": "sidewalk",
        "slab": "slab_foundation",
        "retaining_wall": "retaining_wall"
      };
      const isStamped = finish === "stamped" || finish === "colored" || finish === "exposed_aggregate";
      let lookupKey = `${jobType}_${isStamped ? "stamped" : "plain"}`;
      let matchKey = jobKeyMap[lookupKey] || jobKeyMap[jobType] || "patio_plain";

      const jobData = pricingData.commonJobs?.[matchKey];
      if (jobData) {
        if (sqft && jobData.per_sqft) {
          expectedRange = {
            low: Math.round(jobData.per_sqft[0] * sqft * stateMult),
            high: Math.round(jobData.per_sqft[1] * sqft * stateMult)
          };
        } else if (sqft && jobData.per_sqft_face) {
          expectedRange = {
            low: Math.round(jobData.per_sqft_face[0] * sqft * stateMult),
            high: Math.round(jobData.per_sqft_face[1] * sqft * stateMult)
          };
        } else if (jobData.total) {
          expectedRange = {
            low: Math.round(jobData.total[0] * stateMult),
            high: Math.round(jobData.total[1] * stateMult)
          };
        }
      }

      // Cost per sqft
      if (parsed.totalPrice && sqft) {
        parsed.costPerSqFt = Math.round((parsed.totalPrice / sqft) * 100) / 100;
      }

      // Server-side red flag checks
      if (!parsed.redFlags) parsed.redFlags = [];

      if (jobType === "driveway" && (parsed.reinforcement === "none" || parsed.reinforcement === null)) {
        if (parsed.scopeItems?.rebar === "no" || parsed.scopeItems?.rebar === "unclear") {
          if (!parsed.redFlags.some(f => f.toLowerCase().includes("rebar") || f.toLowerCase().includes("reinforcement"))) {
            parsed.redFlags.push("No rebar or wire mesh included for driveway. Driveways bear vehicle weight and will crack without reinforcement. Rebar (#4 bar on 18\" centers) or 6x6 welded wire mesh is standard.");
          }
        }
      }

      if (parsed.scopeItems?.gradePrep === "no" || parsed.scopeItems?.gradePrep === "unclear") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("base") || f.toLowerCase().includes("grade"))) {
          parsed.redFlags.push("No base preparation or gravel sub-base mentioned. Pouring concrete on unprepared ground leads to settling, cracking, and drainage problems. A compacted gravel base (4-6 inches) is essential.");
        }
      }

      if (parsed.scopeItems?.sealer === "no" || parsed.scopeItems?.sealer === "unclear") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("sealer"))) {
          const sealerNote = isStamped
            ? "No sealer mentioned for stamped/decorative concrete. Stamped concrete MUST be sealed to protect the finish and color. Without sealer, the surface will fade and deteriorate rapidly."
            : "No sealer application mentioned. Sealing concrete extends its life significantly, especially in freeze-thaw climates. Recommended within 30 days of pour.";
          parsed.redFlags.push(sealerNote);
        }
      }

      if (jobType === "driveway" && parsed.thickness && parsed.thickness < 4) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("thickness"))) {
          parsed.redFlags.push(`Concrete thickness of ${parsed.thickness}" is below the 4" minimum for driveways. Vehicles will cause cracking and failure. Standard driveway thickness is 4-6 inches.`);
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
        jobType: jobType,
        finish: finish,
        squareFootage: sqft,
        expectedRange: expectedRange,
        costPerSqFt: parsed.costPerSqFt || null,
        scopeScore: scopeScore,
        scopeMax: scopeMax,
        scopeGrade: scopeMax > 0 ? (scopeScore / scopeMax >= 0.8 ? "A" : scopeScore / scopeMax >= 0.6 ? "B" : scopeScore / scopeMax >= 0.4 ? "C" : "D") : null,
        source: pricingData.metadata?.sources || "HomeAdvisor, Angi, concrete contractor surveys"
      };

    } catch (e) {
      console.log("[concrete-estimate] Pricing enrichment error:", e.message);
    }

    delete parsed.city;
    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || "";
    const _calState = parsed.stateCode || parsed.state || "";
    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "concrete" });

    if (req.headers["x-trueprice-test"] !== "1") captureAnonymizedData("concrete", parsed);
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

        const cityLc = String(_calCity)
          .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "_");
        const st = String(_calState).toUpperCase();
        const service = "concrete";
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
          if (cityLc) await bump(`cal:${cityLc}:${st}:concrete`);
          await bump(`cal:metro:${st}:concrete`);
        }
      }
    } catch (calErr) {
      console.log("[concrete-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("concrete-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
