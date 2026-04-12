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
    squareFootage: parsed.squareFootage || null,
    materialType: parsed.materialType || null,
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
    const key = `landscaping_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[landscaping-estimate] Redis rate limit error, falling back to in-memory:", e.message);
    return checkMemoryRateLimit(ip);
  }
}

export default async function handler(req, res) {
  const allowedOrigin = "https://truepricehq.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // GET: lightweight ZIP -> {state, region, multiplier, hardinessZone, drought rebates,
  // smart controller rebates, tree rebates, licensing, permits}. Lets the estimate
  // page resolve climate and incentive context without paying for a Claude call.
  if (req.method === "GET") {
    try {
      const zip = String(req.query?.zip || "").replace(/[^0-9]/g, "").substring(0, 5);
      if (!zip || zip.length !== 5) return res.status(400).json({ error: "zip required (5 digits)" });
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "landscaping-pricing.json"), "utf-8"));
      // Cheap ZIP1 -> state bucket fallback; upstream geocoder can override.
      const ZIP1_TO_STATE = { "0":"MA","1":"NY","2":"VA","3":"FL","4":"OH","5":"TX","6":"IL","7":"TX","8":"CO","9":"CA" };
      const state = ZIP1_TO_STATE[zip[0]] || null;
      let region = null, multiplier = 1.0;
      if (state && pricingData.regionMultipliers) {
        for (const [name, info] of Object.entries(pricingData.regionMultipliers)) {
          if (info && Array.isArray(info.states) && info.states.includes(state)) {
            region = name; multiplier = info.multiplier || 1.0; break;
          }
        }
      }
      if (state && pricingData.stateMultipliers && pricingData.stateMultipliers[state]) {
        multiplier = pricingData.stateMultipliers[state];
      }
      let hardinessZone = null;
      if (state && pricingData.hardinessZones) {
        for (const [zname, zinfo] of Object.entries(pricingData.hardinessZones)) {
          if (zinfo && Array.isArray(zinfo.states) && zinfo.states.includes(state)) {
            hardinessZone = { zone: zname, tempRangeF: zinfo.tempRangeF, notes: zinfo.notes };
            break;
          }
        }
      }
      const filterByState = (arr) => (arr || []).filter(r => r && r.active2026 !== false && Array.isArray(r.states) && state && r.states.includes(state));
      return res.status(200).json({
        zip, state, region, multiplier, hardinessZone,
        droughtRebates: filterByState(pricingData.droughtRebates),
        smartControllerRebates: filterByState(pricingData.sprinklerSmartControllerRebates),
        treeRebates: filterByState(pricingData.treePlantingRebates),
        licensing: (state && pricingData.stateLicensing) ? (pricingData.stateLicensing[state] || null) : null,
        permitTriggers: pricingData.permitTriggers || []
      });
    } catch (e) {
      console.error("[landscaping-estimate GET]", e.message);
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
    const _guard = await runAbuseGuard(req, { vertical: "landscaping", imageBytes: _imageBuf, cacheNamespace: "landscaping:v2-deepdive" });
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
      text: `Analyze this landscaping quote or estimate. Extract the following information and return ONLY valid JSON (no markdown, no explanation):

${text ? "EXTRACTED TEXT FROM QUOTE:\n" + text.substring(0, 8000) + "\n\n" : ""}

Return this exact JSON structure:
{
  "totalPrice": <number or null - the total quoted price>,
  "laborTotal": <number or null>,
  "materialsTotal": <number or null>,
  "jobType": <"sod" | "pavers" | "retaining_wall" | "irrigation" | "tree_removal" | "tree_pruning" | "planting" | "mulch" | "lighting" | "grading" | "landscape_design" | "french_drain" | "mixed" | null>,
  "subScope": <string or null - more specific sub-scope e.g. "bermuda sod", "belgard paver patio", "6-zone sprinkler", "2.5 inch caliper oak">,
  "squareFootage": <number or null - area in square feet>,
  "linearFeet": <number or null - linear feet for walls/drains>,
  "irrigationZones": <number or null - count of sprinkler zones>,
  "treeCount": <number or null - number of trees involved>,
  "treeCalipers": <string or null - list of trunk calipers like "2.5 inch, 3 inch">,
  "hardscapeMaterial": <"belgard"|"techo-bloc"|"pavestone"|"unilock"|"stamped_concrete"|"natural_stone"|"boulder"|null>,
  "hardscapeArea": <number or null - sq ft of hardscape>,
  "retainingWallHeightFt": <number or null - if a retaining wall, the specified height in feet>,
  "drainageType": <"french_drain"|"dry_well"|"dry_creek_bed"|"swale"|"none"|null>,
  "plantWarrantyMonths": <number or null - plant warranty duration>,
  "controllerBrand": <string or null - irrigation controller brand (Rachio, Hunter Hydrawise, Rain Bird ESP)>,
  "backflowPreventer": <boolean or null - backflow RPZ/PVB mentioned>,
  "rainSensor": <boolean or null - rain sensor or smart controller>,
  "licenseNumber": <string or null - CSLB/TCEQ/LCB/etc contractor license number listed on quote>,
  "isaCertified": <boolean or null - ISA Certified Arborist mentioned>,
  "depositPercent": <number or null - deposit % required>,
  "materialType": <string or null - primary material>,
  "brand": <string or null>,
  "city": <string or null>,
  "stateCode": <string or null - 2-letter state code>,
  "lineItems": [
    { "description": <string>, "laborCost": <number or null>, "materialCost": <number or null>, "lineTotal": <number or null> }
  ],
  "scopeItems": {
    "writtenScope":      <"yes"|"no"|"unclear">,
    "soilPrep":          <"yes"|"no"|"unclear" - till depth, amendment, starter fert for sod/planting>,
    "baseSpec":          <"yes"|"no"|"unclear" - base depth in inches, compaction for hardscape>,
    "edgeRestraint":     <"yes"|"no"|"unclear" - paver edge restraint + geotextile>,
    "drainagePlan":      <"yes"|"no"|"unclear" - slope away from house / drain>,
    "zoneCount":         <"yes"|"no"|"unclear" - zone count + head layout>,
    "backflow":          <"yes"|"no"|"unclear" - backflow preventer>,
    "rainSensor":        <"yes"|"no"|"unclear" - rain sensor / smart controller>,
    "winterization":     <"yes"|"no"|"unclear" - winterization plan>,
    "plantList":         <"yes"|"no"|"unclear" - species + sizes listed>,
    "plantWarranty":     <"yes"|"no"|"unclear" - plant warranty terms>,
    "isaCertified":      <"yes"|"no"|"unclear" - ISA Certified Arborist on tree work>,
    "licenseNumber":     <"yes"|"no"|"unclear" - state license number on quote>,
    "insuranceCOI":      <"yes"|"no"|"unclear" - COI available>,
    "depositReasonable": <"yes"|"no"|"unclear" - deposit <=33%>,
    "permitsAddressed":  <"yes"|"no"|"unclear">,
    "timeline":          <"yes"|"no"|"unclear" - committed start + end dates>
  },
  "gradingAssessment": <boolean>,
  "drainagePlan": <boolean>,
  "possibleUpsells": [<string>],
  "redFlags": [<string>],
  "redFlagDetails": [
    { "name": <string>, "severity": <"critical"|"high"|"medium">, "evidence": <string>, "explanation": <string> }
  ],
  "summary": <string - 2-4 sentence verdict that ALWAYS references the actual price and explains WHY it's fair, high, or low vs typical 2026 ranges for that sub-scope and region>
}

CRITICAL EXTRACTION RULES:
- ALWAYS extract dollar amounts. Never return null if any numbers appear on the quote.
- If no explicit total, SUM the line items.
- jobType: pick the best match; use "mixed" if multiple major scopes.
- For irrigation, always attempt to extract irrigationZones (zone count).
- For retaining walls, extract retainingWallHeightFt when possible.
- For pavers, recognize Belgard, Techo-Bloc, Pavestone, Unilock, Cambridge, and "stamped concrete" as brand signals.

RED FLAG CATALOG - scan for each of these 20 patterns and add an entry to redFlagDetails with name, severity, exact evidence phrase, and one-sentence explanation:

CRITICAL severity:
- "tree_topping": any mention of "topping", "hat-racking", "round over", "heading back" on a live tree (exclude "topsoil"/"top dressing") — ANSI A300 prohibited, arboricultural malpractice
- "retaining_wall_over4_no_engineering": retaining wall height >=4 ft with no stamped engineering, geogrid, or permit mentioned

HIGH severity:
- "door_to_door_pitch": "working in the neighborhood", "leftover material", "today only", "storm special"
- "climbing_spikes_on_pruning": spikes/spurs/gaffs mentioned on a pruning job (not removal)
- "no_isa_no_insurance_for_tree_work": tree work with no ISA cert, no COI, no policy number
- "cash_only_or_large_deposit": "cash only", "cash discount", or deposit >33%
- "no_written_scope_no_cap": the word "estimate" with no "not to exceed", "fixed price", or line items
- "sod_missing_prep_and_watering": sod quoted with no tilling, soil amendment, starter fert, or watering schedule
- "sprinkler_missing_zones_backflow_sensor": irrigation quoted with no zone count, backflow preventer, or rain sensor
- "hardscape_missing_base_geotextile_edge": paver/patio/driveway with no base depth, geotextile, edge restraint, or slope
- "unlicensed_pesticide_application": pesticide/herbicide/pre-emergent/Roundup/grub control mentioned with no applicator license #
- "sod_install_during_drought": sod install in CA/AZ/NV/CO/UT/NM/TX with no drought/restriction/waiver/native/xeriscape language
- "uninsured_subcontracted_tree_work": tree work subcontracted with no COI naming homeowner
- "prepay_for_materials": "pay for plants/sod/pavers before we order"
- "unrealistically_low_bid": if multiple peer bids known, flag any >25% below median

MEDIUM severity:
- "plant_warranty_fine_print": "no plant warranty" or voids on "any pest/drought/mulch"
- "free_design_ip_grab": "design remains property of [contractor], may not use with other"
- "no_permit_in_protected_district": tree removal or wall/patio with no permit/HOA language in tree-ordinance cities
- "cold_climate_no_winterization": irrigation in a cold state (MN/WI/MI/IA/IL/IN/OH/PA/NY/NJ/CT/MA/RI/NH/VT/ME/ND/SD/MT/WY/CO/UT/ID) with no winterization/blow-out plan
- "vague_licensed_and_insured": "licensed and insured" language with no actual license or policy number

For each red flag found, populate redFlagDetails with name, severity, the exact evidence phrase from the quote, and a one-sentence explanation. Only include flags actually found in the quote.

- summary: always reference the actual price, sub-scope, and 2026 range. Example good summary: "The $8,400 6-zone sprinkler quote in TX works out to ~$1,400/zone which lands at the top of the mid range — justified because the quote includes a Rain Bird ESP-TM2 smart controller and RPZ backflow. Missing: TCEQ Licensed Irrigator # is not shown on the quote; verify it before signing." Never just say "above average" — explain WHY.

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
      await storeImageCache("landscaping", _guard.imageHash, { success: true, source: "claude-haiku", data: parsed });
    }

    } catch (e) {
      console.error("Failed to parse Claude response:", aiText);
      return res.status(502).json({ error: "Could not parse AI response", raw: aiText });
    }

    // --- Server-side enrichment from pricing data ---
    try {
      const pricingData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'landscaping-pricing.json'), 'utf-8'));

      const jobType = parsed.jobType || null;
      const subScope = parsed.subScope || null;
      const sqft = parsed.squareFootage || null;
      const stateCode = parsed.stateCode || null;
      const stateMult = (stateCode && pricingData.stateMultipliers?.[stateCode]) || 1.0;

      // Resolve region for display
      let region = null;
      if (stateCode && pricingData.regionMultipliers) {
        for (const [name, info] of Object.entries(pricingData.regionMultipliers)) {
          if (info && Array.isArray(info.states) && info.states.includes(stateCode)) { region = name; break; }
        }
      }

      // Map jobType / subScope to a representative commonJobs key
      const jobKeyMap = {
        "sod": "sod_fescue_per_sqft",
        "pavers": "paver_patio_midgrade",
        "retaining_wall": "retaining_wall_under3",
        "irrigation": "sprinkler_zone_mid",
        "french_drain": "french_drain_exterior",
        "tree_removal": "tree_large",
        "landscape_design": "design_package_full",
        "grading": "drainage_swale"
      };
      const matchKey = jobKeyMap[jobType] || null;
      const job = matchKey ? pricingData.commonJobs?.[matchKey] : null;

      let expectedRange = null;
      if (job) {
        const unit = job.unit;
        const qty =
          unit === "per_sqft"        ? (sqft || 0) :
          unit === "per_lf"          ? (parsed.linearFeet || 0) :
          unit === "per_zone"        ? (parsed.irrigationZones || 0) :
          unit === "per_tree"        ? (parsed.treeCount || 0) :
          unit === "per_sqft_face"   ? (parsed.hardscapeArea || 0) :
          unit === "flat"            ? 1 :
          unit === "per_hour"        ? 0 : 0;
        if (qty > 0) {
          expectedRange = {
            low: Math.round(job.low * qty * stateMult),
            mid: Math.round(job.mid * qty * stateMult),
            high: Math.round(job.high * qty * stateMult)
          };
        } else if (unit === "flat") {
          expectedRange = {
            low: Math.round(job.low * stateMult),
            mid: Math.round(job.mid * stateMult),
            high: Math.round(job.high * stateMult)
          };
        }
      }

      // Scope score
      let scopeScore = 0, scopeMax = 0;
      if (pricingData.scopeCheckItems && parsed.scopeItems) {
        for (const item of pricingData.scopeCheckItems) {
          scopeMax += item.weight;
          if (parsed.scopeItems[item.key] === "yes") scopeScore += item.weight;
        }
      }

      // Server-side red flag backstop for common gaps Claude may miss
      if (!parsed.redFlags) parsed.redFlags = [];
      const pushFlag = (msg) => {
        if (!parsed.redFlags.some(f => String(f).toLowerCase().includes(msg.slice(0,20).toLowerCase()))) {
          parsed.redFlags.push(msg);
        }
      };
      if ((jobType === "pavers" || jobType === "retaining_wall") && !parsed.drainagePlan) {
        pushFlag("No drainage plan for hardscape. ICPI Tech Spec 2 requires slope away from structures; missing drainage is a leading cause of paver failure.");
      }
      if ((jobType === "sod" || jobType === "pavers" || jobType === "grading") && !parsed.gradingAssessment) {
        pushFlag("No grading or slope assessment. Improper grading causes water pooling, paver settlement, and sod failure.");
      }
      // Drought-zone sod flag
      const droughtStates = ["CA","AZ","NV","CO","UT","NM","TX"];
      if (jobType === "sod" && droughtStates.includes(stateCode)) {
        pushFlag(`Sod install in a drought-prone state (${stateCode}). Verify local watering restrictions and check cash-for-grass rebates before proceeding.`);
      }
      // Licensing missing for regulated states
      const regulatedLicense = pricingData.stateLicensing?.[stateCode];
      if (regulatedLicense && parsed.scopeItems?.licenseNumber !== "yes") {
        pushFlag(`In ${stateCode} the contractor must show a ${regulatedLicense.license}. Verify the license number on the quote before signing.`);
      }

      parsed.pricingContext = {
        state: stateCode,
        region: region,
        stateMultiplier: stateMult,
        jobType: jobType,
        subScope: subScope,
        jobLabel: job?.label || null,
        expectedRange: expectedRange,
        scopeScore: scopeScore,
        scopeMax: scopeMax,
        scopeGrade: scopeMax > 0 ? (scopeScore / scopeMax >= 0.8 ? "A" : scopeScore / scopeMax >= 0.6 ? "B" : scopeScore / scopeMax >= 0.4 ? "C" : "D") : null,
        source: pricingData.metadata?.sources || "competitor-research landscaping"
      };

    } catch (e) {
      console.log("[landscaping-estimate] Pricing enrichment error:", e.message);
    }

    // Strip PII
    delete parsed.city;

    // FLYWHEEL READ: blend real-world calibration data into the model estimate
    const _calCity = parsed.city || parsed.cityName || "";
    const _calState = parsed.stateCode || parsed.state || "";
    await enrichWithCalibration(redis, parsed, { city: _calCity, state: _calState, service: "landscaping" });

    if (req.headers["x-trueprice-test"] !== "1") captureAnonymizedData("landscaping", parsed);
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
        const service = "landscaping";
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
          if (cityLc) await bump(`cal:${cityLc}:${st}:landscaping`);
          await bump(`cal:metro:${st}:landscaping`);
        }
      }
    } catch (calErr) {
      console.log("[landscaping-estimate] flywheel bridge error:", calErr.message);
    }
    return res.status(200).json({
      success: true,
      source: "claude-haiku",
      data: parsed
    });

  } catch (error) {
    console.error("landscaping-estimate error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
