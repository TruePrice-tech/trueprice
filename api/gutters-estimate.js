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
    gutterMaterial: parsed.gutterMaterial || null,
    style: parsed.style || null,
    linearFeet: parsed.linearFeet || null,
    gutterGuards: parsed.gutterGuards || null,
    state: parsed.stateCode || null,
    service: parsed.lineItems ? parsed.lineItems.length : 0
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
    const key = `gutters_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[gutters-estimate] Redis rate limit error, falling back to in-memory:", e.message);
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
    return res.status(429).json({ error: "Rate limit exceeded. Maximum 10 requests per hour. Please try again later." });
  }

    // Abuse guard: burst detect, IP daily cap, suspicious patterns,
    // image dedup, global Claude ceiling. Returns cached result if hit.
    const _imageBuf = (req.body && req.body.images && req.body.images[0])
      ? Buffer.from((req.body.images[0].split(",")[1] || ""), "base64")
      : null;
    const _guard = await runAbuseGuard(req, { vertical: "gutters", imageBytes: _imageBuf });
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
      text: `Analyze this gutter installation or replacement quote. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "materialsTotal": <number or null - total materials cost>,
  "gutterMaterial": <"aluminum" | "steel" | "copper" | "vinyl" | null>,
  "gutterSize": <"5_inch" | "6_inch" | null - gutter width>,
  "style": <"seamless" | "sectional" | null>,
  "linearFeet": <number or null - total linear feet of gutters>,
  "gutterGuards": <boolean or null - whether gutter guards are included>,
  "gutterGuardType": <string or null - type of gutter guard (micro-mesh, screen, foam, reverse curve)>,
  "downspoutCount": <number or null - number of downspouts>,
  "downspoutMaterial": <string or null - downspout material>,
  "stories": <number or null - number of stories on the home>,
  "brand": <string or null - gutter or guard brand>,
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
    "removal": <"yes" | "no" | "unclear" - old gutter removal>,
    "gutters": <"yes" | "no" | "unclear" - gutter installation>,
    "downspouts": <"yes" | "no" | "unclear" - downspouts>,
    "hangers": <"yes" | "no" | "unclear" - hidden hangers/brackets>,
    "endCaps": <"yes" | "no" | "unclear" - end caps and corners>,
    "outlets": <"yes" | "no" | "unclear" - outlets and connectors>,
    "splashBlocks": <"yes" | "no" | "unclear" - splash blocks or extensions>,
    "fasciaRepair": <"yes" | "no" | "unclear" - fascia board repair>,
    "gutterGuards": <"yes" | "no" | "unclear" - gutter guards/leaf protection>,
    "cleanup": <"yes" | "no" | "unclear" - cleanup and disposal>,
    "warranty": <"yes" | "no" | "unclear" - warranty (product + labor)>,
    "sealant": <"yes" | "no" | "unclear" - sealant at joints>
  },
  "warrantyProduct": <string or null - product warranty duration>,
  "warrantyLabor": <string or null - labor warranty duration>,
  "slopeAssessment": <boolean - whether proper slope/pitch assessment is mentioned>,
  "downspoutPlan": <boolean - whether downspout placement plan is included>,
  "roofSqFt": <number or null - roof square footage if mentioned>,
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
- totalPrice: Use the grand total / bottom line
- redFlags: Include if any of the following are detected:
  * No downspout plan or placement strategy (water needs somewhere to go)
  * No slope/pitch assessment mentioned (gutters must slope toward downspouts)
  * Inadequate gutter size for roof area (5" gutters on large or steep roofs need 6")
  * Too few downspouts for the linear footage (rule of thumb: 1 per 20-30 LF)
  * No fascia inspection before install (rotted fascia = failed install)
  * Sectional gutters quoted when seamless would be more appropriate
  * Vinyl gutters in freeze/thaw climates (they crack)
  * No sealant at joints and connections
  * No old gutter removal included (should not install over old)
  * Gutter guards with lifetime warranty but no labor warranty
  * Any other suspicious or concerning items
- possibleUpsells: Flag gutter guards, heated gutter cables, rain chains, decorative downspouts, underground drainage tie-in, gutter cleaning service contract
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
      await storeImageCache("gutters", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'gutters-pricing-model.json'), 'utf-8'));

      const gutterMaterial = parsed.gutterMaterial || null;
      const style = parsed.style || null;
      const gutterSize = parsed.gutterSize || null;
      const linearFeet = parsed.linearFeet || null;
      const stateCode = parsed.stateCode || null;

      // Map to pricing key
      let pricingKey = null;
      if (gutterMaterial === "aluminum" && gutterSize === "6_inch") {
        pricingKey = "aluminum_6inch";
      } else if (gutterMaterial === "aluminum") {
        pricingKey = "aluminum_seamless";
      } else if (gutterMaterial === "copper") {
        pricingKey = "copper";
      } else if (gutterMaterial === "steel") {
        pricingKey = "steel";
      } else if (gutterMaterial === "vinyl") {
        pricingKey = "vinyl";
      }

      const gutterPricing = pricingKey ? pricingData.basePricePerLinearFoot?.[pricingKey] : null;
      const guardPricing = pricingData.basePricePerLinearFoot?.gutter_guards || null;

      // Region multiplier
      const stateToRegion = {
        "AL":"south","AK":"west","AZ":"mountain","AR":"south","CA":"west","CO":"mountain",
        "CT":"northeast","DE":"northeast","FL":"southeast","GA":"southeast","HI":"west",
        "ID":"mountain","IL":"midwest","IN":"midwest","IA":"midwest","KS":"midwest",
        "KY":"southeast","LA":"south","ME":"northeast","MD":"northeast","MA":"northeast",
        "MI":"midwest","MN":"midwest","MS":"south","MO":"midwest","MT":"mountain",
        "NE":"midwest","NV":"mountain","NH":"northeast","NJ":"northeast","NM":"mountain",
        "NY":"northeast","NC":"southeast","ND":"midwest","OH":"midwest","OK":"south",
        "OR":"west","PA":"northeast","RI":"northeast","SC":"southeast","SD":"midwest",
        "TN":"southeast","TX":"south","UT":"mountain","VT":"northeast","VA":"southeast",
        "WA":"west","WV":"southeast","WI":"midwest","WY":"mountain","DC":"northeast"
      };
      const region = stateToRegion[stateCode] || "south";
      const regionMult = pricingData.laborMultiplierByRegion?.[region] || 1.0;

      let expectedRange = null;
      if (gutterPricing && linearFeet) {
        const roundTo = pricingData.roundTo || 25;
        let low = gutterPricing.low * linearFeet * regionMult;
        let high = gutterPricing.high * linearFeet * regionMult;

        // Add gutter guards if included
        if (parsed.gutterGuards && guardPricing) {
          low += guardPricing.low * linearFeet;
          high += guardPricing.high * linearFeet;
        }

        expectedRange = {
          low: Math.round(low / roundTo) * roundTo,
          high: Math.round(high / roundTo) * roundTo
        };
      }

      // Brand tier
      let brandTier = null;
      if (parsed.brand) {
        const brandLower = parsed.brand.toLowerCase();
        for (const [tier, brands] of Object.entries(pricingData.brands || {})) {
          if (brands.some(b => brandLower.includes(b.toLowerCase()))) {
            brandTier = tier;
            break;
          }
        }
      }

      // Server-side red flag checks
      if (!parsed.redFlags) parsed.redFlags = [];

      if (!parsed.downspoutPlan) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("downspout"))) {
          parsed.redFlags.push("No downspout placement plan included. Proper downspout placement is critical for water management and foundation protection.");
        }
      }

      if (!parsed.slopeAssessment) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("slope"))) {
          parsed.redFlags.push("No slope/pitch assessment mentioned. Gutters must slope 1/4 inch per 10 feet toward downspouts for proper drainage.");
        }
      }

      // Check downspout ratio
      if (linearFeet && parsed.downspoutCount) {
        const ratioLF = linearFeet / parsed.downspoutCount;
        if (ratioLF > 35) {
          if (!parsed.redFlags.some(f => f.toLowerCase().includes("few downspout"))) {
            parsed.redFlags.push(`Only ${parsed.downspoutCount} downspouts for ${linearFeet} LF of gutters (1 per ${Math.round(ratioLF)} LF). Recommended: 1 downspout per 20-30 linear feet to prevent overflow.`);
          }
        }
      }

      // Check gutter size vs roof area
      if (parsed.roofSqFt && parsed.roofSqFt > 1500 && gutterSize === "5_inch") {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("gutter size"))) {
          parsed.redFlags.push(`5-inch gutters may be inadequate for ${parsed.roofSqFt} sq ft roof area. Consider 6-inch gutters for larger roofs to handle heavy rainfall.`);
        }
      }

      // Vinyl in cold climates
      const coldStates = ["MN","WI","MI","ME","VT","NH","ND","SD","MT","WY","AK","NY","MA","CT","RI","PA","OH","IN","IL","IA","NE","CO"];
      if (gutterMaterial === "vinyl" && coldStates.includes(stateCode)) {
        if (!parsed.redFlags.some(f => f.toLowerCase().includes("vinyl"))) {
          parsed.redFlags.push("Vinyl gutters in a freeze/thaw climate. Vinyl becomes brittle in cold temperatures and is prone to cracking. Aluminum or steel recommended.");
        }
      }

      parsed.pricingContext = {
        state: stateCode,
        region: region,
        regionMultiplier: regionMult,
        gutterMaterial: gutterMaterial,
        gutterLabel: gutterPricing?.label || null,
        style: style,
        expectedRange: expectedRange,
        brandTier: brandTier,
        source: "HomeAdvisor, Angi, RSMeans gutter installation data"
      };

    } catch (e) {
      console.log("[gutters-estimate] Pricing enrichment error:", e.message);
    }

    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || "";
    const _calState = parsed.stateCode || parsed.state || "";
    delete parsed.city;
    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "gutters" });

    if (req.headers["x-woogoro-test"] !== "1") captureAnonymizedData("gutters", parsed);
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
        await guardedFlywheelBump(redis, "gutters", totalPrice, cityLc, st, { incRealQuote: !!_imageBuf });
      }
    } catch (calErr) {
      console.log("[gutters-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("gutters-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
