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
    windowType: parsed.windowType || null,
    material: parsed.material || null,
    count: parsed.windowCount || null,
    energyStar: parsed.energyStarRated || null,
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
    const key = `windows_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[windows-estimate] Redis rate limit error, falling back to in-memory:", e.message);
    return checkMemoryRateLimit(ip);
  }
}

export default async function handler(req, res) {
  const allowedOrigin = "https://truepricehq.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // GET: lightweight ZIP -> {state, region, climate zone, multiplier}
  // lookup so the new estimate page can resolve city-level pricing
  // without paying for a Claude call. The estimate page consumes this
  // shape: { state, city, multiplier, zone, region, rebates }.
  if (req.method === "GET") {
    try {
      const zip = String(req.query?.zip || "").replace(/[^0-9]/g, "").substring(0, 5);
      if (!zip || zip.length !== 5) return res.status(400).json({ error: "zip required (5 digits)" });
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "windows-pricing.json"), "utf-8"));
      // Cheap ZIP -> state via 3-digit prefix bucket. Good enough for
      // multiplier resolution; not a substitute for a real geocoder.
      const ZIP3_TO_STATE = {
        "0":"MA","1":"NY","2":"VA","3":"FL","4":"OH","5":"TX","6":"IL","7":"TX","8":"CO","9":"CA"
      };
      // crude but reliable first-digit bucket as a fallback when full mapping is absent
      let state = ZIP3_TO_STATE[zip[0]] || null;
      // Region multiplier lookup
      let region = null, multiplier = 1.0;
      if (state && pricingData.regionMultipliers) {
        for (const [name, info] of Object.entries(pricingData.regionMultipliers)) {
          if (info && Array.isArray(info.states) && info.states.includes(state)) {
            region = name;
            multiplier = info.multiplier || 1.0;
            break;
          }
        }
      }
      if (state && pricingData.stateMultipliers && pricingData.stateMultipliers[state]) {
        multiplier = pricingData.stateMultipliers[state];
      }
      // Climate zone lookup
      let zone = null;
      if (state && pricingData.climateZones) {
        for (const [zname, zinfo] of Object.entries(pricingData.climateZones)) {
          if (zinfo && Array.isArray(zinfo.states) && zinfo.states.includes(state)) {
            zone = zname;
            break;
          }
        }
      }
      // Rebate eligibility
      const rebates = (pricingData.utilityRebates || []).filter(r =>
        r && r.active2026 !== false && Array.isArray(r.states) && state && r.states.includes(state)
      );
      return res.status(200).json({
        zip, state, region, multiplier, zone, rebates,
        ira: pricingData.iraCredit || null,
        energyStarTargets: zone && pricingData.energyStarTargets ? pricingData.energyStarTargets[zone] : null
      });
    } catch (e) {
      console.error("[windows-estimate GET]", e.message);
      return res.status(500).json({ error: "Lookup failed" });
    }
  }

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
    const _guard = await runAbuseGuard(req, { vertical: "windows", imageBytes: _imageBuf, cacheNamespace: "windows:v2-deepdive" });
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
      text: `Analyze this window replacement quote. Extract the following information and return ONLY valid JSON (no markdown, no explanation outside the JSON object):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null - total labor cost>,
  "materialsTotal": <number or null - total materials/window cost>,
  "perWindowPrice": <number or null - total divided by window count if both known>,
  "windowType": <"double_hung" | "casement" | "sliding" | "bay" | "bow" | "picture" | "awning" | "hopper" | "mixed" | null>,
  "material": <"vinyl" | "fiberglass" | "wood_clad" | "aluminum" | "composite" | null>,
  "windowCount": <number or null - how many windows>,
  "installMethod": <"pocket" | "full_frame" | "new_construction" | null - pocket means insert into existing frame, full_frame means complete tear-out and reframe>,
  "brand": <string or null - exact brand name like "Andersen" "Pella" "Marvin" "Renewal by Andersen" "Window World" "Champion" "Milgard" "Simonton" "Jeld-Wen" "ProVia" "Soft-Lite" "Alside" "Atrium">,
  "brandLine": <string or null - product line like "100 Series" "250" "Lifestyle" "Tuscany" "5500">,
  "brandTier": <"value" | "mid" | "premium" | "luxury" | null - infer from brand+line>,
  "energyStarRated": <boolean or null - ENERGY STAR certified>,
  "energyStarMostEfficient": <boolean or null - ENERGY STAR Most Efficient tier - note: 25C federal credit EXPIRED Dec 31 2025; this tier still matters for state utility rebates>,
  "uFactor": <number or null - U-factor if listed (lower is better, e.g. 0.20)>,
  "shgc": <number or null - Solar Heat Gain Coefficient if listed>,
  "glassPackage": <"single_pane" | "double_pane" | "triple_pane" | null>,
  "lowE": <boolean or null - Low-E coating included>,
  "argonFill": <boolean or null - argon gas fill mentioned>,
  "manufacturerPin": <string or null - was required for 25C credit through 2025; now historical only since credit expired Dec 31 2025>,
  "city": <string or null - city from the quote>,
  "stateCode": <string or null - 2-letter state code>,
  "depositPercent": <number or null - deposit % required up front>,
  "warrantyTransferable": <boolean or null - is warranty transferable to next owner>,
  "warrantyTransferLimit": <number or null - max number of transfers (1 = once only, which is a red flag)>,
  "lineItems": [
    {
      "description": <string - line item description>,
      "laborCost": <number or null>,
      "materialCost": <number or null>,
      "lineTotal": <number or null>
    }
  ],
  "scopeItems": {
    "windowSpec": <"yes" | "no" | "unclear" - exact brand/model/line specified, NOT just "premium vinyl">,
    "uFactorListed": <"yes" | "no" | "unclear" - U-factor explicitly stated>,
    "shgcListed": <"yes" | "no" | "unclear" - SHGC explicitly stated>,
    "energyStar": <"yes" | "no" | "unclear" - ENERGY STAR rating noted>,
    "installMethod": <"yes" | "no" | "unclear" - pocket vs full-frame explicitly stated>,
    "permit": <"yes" | "no" | "unclear" - permit fee included or noted>,
    "disposal": <"yes" | "no" | "unclear" - old window haul-off included>,
    "capping": <"yes" | "no" | "unclear" - exterior aluminum capping included>,
    "trimWrap": <"yes" | "no" | "unclear" - interior trim restoration included>,
    "warranty": <"yes" | "no" | "unclear" - warranty terms stated in writing>,
    "warrantyTransferable": <"yes" | "no" | "unclear">,
    "laborWarranty": <"yes" | "no" | "unclear" - labor covered, not just glass/parts>,
    "timeline": <"yes" | "no" | "unclear" - project schedule stated>,
    "writtenScope": <"yes" | "no" | "unclear" - all scope items in writing on the quote>
  },
  "warrantyFrame": <string or null - frame warranty duration>,
  "warrantyGlass": <string or null - glass warranty duration>,
  "warrantyLabor": <string or null - labor warranty duration>,
  "possibleUpsells": [<string - potential upsell items found in line items>],
  "redFlags": [<string - concerning items found, see RED FLAG CATALOG below>],
  "redFlagDetails": [
    {
      "name": <string - red flag short name from catalog below>,
      "severity": <"critical" | "high" | "medium">,
      "evidence": <string - the exact phrase from the quote that triggered it>,
      "explanation": <string - one sentence why this is a problem>
    }
  ],
  "summary": <string - 2 to 4 sentence plain-English verdict that ALWAYS references the actual price and explains WHY it's fair, high, or low. Compare against typical ranges for the brand tier, frame, and region. Never just say "above average" - say "above average for vinyl in this region, likely because the quote includes Renewal by Andersen which carries a premium markup">
}

CRITICAL EXTRACTION RULES:
- ALWAYS extract dollar amounts. If you see ANY numbers that look like prices, extract them. A rough estimate is better than null.
- If you cannot find an explicit total, SUM the individual line item amounts.
- perWindowPrice: compute totalPrice / windowCount when both are known. This is the single most useful comparison number.
- brandTier rules: Window World, Atrium, Alside Sheffield, Jeld-Wen Builders Vinyl = "value". Simonton, Milgard Style/Trinsic/Tuscany, Pella 250/350, Andersen 100, Alside Mezzo = "mid". Marvin Essential/Elevate, Pella Lifestyle, Andersen 200/400, ProVia, Soft-Lite Imperial, Milgard Ultra = "premium". Andersen A-Series, Pella Reserve/Architect, Marvin Signature, Renewal by Andersen = "luxury".
- energyStarMostEfficient: this was the federal 25C tax credit qualifying tier. The 25C credit EXPIRED Dec 31, 2025 - it is no longer available for 2026 installs. The tier still matters for state/utility rebate eligibility. Only mark true if explicitly stated.
- installMethod: look for "pocket" / "insert" / "retrofit" (= pocket) vs "full frame" / "new construction" / "tear-out" / "complete reframe" (= full_frame). Full-frame is +40 to +100% more.
- Never return null for a price field if there are dollar amounts visible anywhere in the document.

RED FLAG CATALOG (scan for these specific patterns and add a redFlagDetails entry with the exact evidence quote):

CRITICAL severity:
- "today_only_pressure": phrases like "today only" "valid today" "expires tonight" "if you sign now" "good only if signed today" "drop down to" "manager-approved discount" — high-pressure sales tactic, never real urgency
- "deferred_interest_balloon": "no interest for 24 months" / "interest accrues from day one" / promotional financing with retroactive interest
- "lifetime_voids_on_maintenance": warranty fine print like "voids if not cleaned annually" / "voids if painted" / "void if any modification"
- "warranty_one_transfer": "transferable once" / "one transfer only" / "limited to original owner plus one transfer" — second owner gets nothing
- "missing_window_spec": no brand name, no model number, just "premium vinyl" or "high quality windows" — buyer cannot verify what they're getting
- "missing_u_factor": quote does not list U-factor or SHGC anywhere — these are federally required label values

HIGH severity:
- "free_install_inversion": "free installation when you buy 5 windows" / "$0 install" — windows are marked up to cover labor, total often higher
- "subcontractor_handoff": company will assign install to a different crew or partner — quality control gap
- "surprise_disposal_fee": disposal listed as a separate or "additional" fee, not in base price
- "permit_excluded": "permit not included" / "permit fees by owner"
- "excessive_deposit": deposit > 33% of total before any work
- "vague_timeline": "we'll get to you in a few weeks" / "schedule TBD" — no committed start date
- "unwritten_scope": verbal promises mentioned but not on the quote sheet
- "out_of_state_company": address out of state with no local presence, or door-to-door
- "not_energy_star": no ENERGY STAR mention for windows installed in 2026
- "single_pane_quoted": quote includes any single-pane windows
- "brand_premium_markup": Renewal by Andersen, Champion, or known premium-markup brands quoted at 2x+ the equivalent installer price for similar specs

MEDIUM severity:
- "missing_install_method": doesn't specify pocket vs full-frame replacement
- "missing_capping": exterior trim capping not mentioned (especially for vinyl over wood)
- "no_low_e": no Low-E coating mentioned for any window
- "no_argon_fill": no gas fill mentioned (modest energy impact)
- "no_labor_warranty": warranty covers parts/glass only, not labor

For each red flag found, populate redFlagDetails with the name, severity, the exact evidence phrase from the quote, and a one-sentence explanation. If a red flag from the catalog above is NOT found, do not include it.

- redFlags: ALWAYS identify at least one concern. Even good quotes usually have something to flag.
- summary: 2 to 4 sentences. Reference the actual price, the brand tier you identified, and the most important takeaway.
- Return ONLY the JSON object, nothing else.`
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
      await storeImageCache("windows:v2-deepdive", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'windows-pricing.json'), 'utf-8'));

      const stateCode = parsed.stateCode || null;
      const stateMult = pricingData.stateMultipliers?.[stateCode] || 1.0;

      // Match window type to commonJobs for expected range
      let expectedRange = null;
      const material = parsed.material || "vinyl";
      const windowType = parsed.windowType || "double_hung";
      const count = parsed.windowCount || 1;

      // Try to match a specific job key
      const jobKeyMap = {
        "vinyl": "vinyl_double_hung",
        "fiberglass": "fiberglass_window",
        "wood": "wood_window",
        "bay": "bay_window"
      };
      let matchKey = jobKeyMap[material] || jobKeyMap[windowType] || "vinyl_double_hung";
      if (windowType === "bay" || windowType === "bow") matchKey = "bay_window";

      // Check for whole-house pricing
      if (count >= 15) {
        matchKey = "whole_house_20";
      } else if (count >= 8) {
        matchKey = "whole_house_10";
      }

      const jobData = pricingData.commonJobs?.[matchKey];
      if (jobData && jobData.total) {
        if (jobData.per_unit && count > 1) {
          expectedRange = {
            low: Math.round(jobData.total[0] * count * stateMult),
            high: Math.round(jobData.total[1] * count * stateMult)
          };
        } else {
          expectedRange = {
            low: Math.round(jobData.total[0] * stateMult),
            high: Math.round(jobData.total[1] * stateMult)
          };
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

      // Compute scope score from scopeCheckItems
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
        windowType: windowType,
        material: material,
        windowCount: count,
        expectedRange: expectedRange,
        scopeScore: scopeScore,
        scopeMax: scopeMax,
        scopeGrade: scopeMax > 0 ? (scopeScore / scopeMax >= 0.8 ? "A" : scopeScore / scopeMax >= 0.6 ? "B" : scopeScore / scopeMax >= 0.4 ? "C" : "D") : null,
        source: pricingData.metadata?.sources || "HomeAdvisor, Angi, window manufacturer data"
      };

    } catch (e) {
      console.log("[windows-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII before returning
    delete parsed.city;

    if (req.headers["x-trueprice-test"] !== "1") captureAnonymizedData("windows", parsed);
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
        const service = "windows";
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
          if (cityLc) await bump(`cal:${cityLc}:${st}:windows`);
          await bump(`cal:metro:${st}:windows`);
        }
      }
    } catch (calErr) {
      console.log("[windows-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("windows-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
