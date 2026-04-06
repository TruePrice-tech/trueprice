// ============================================================================
// TruePrice Flywheel Feedback API
// ============================================================================
// The flywheel works like this:
//   1. Users submit bills/quotes to our analyzers (medical, moving, etc.)
//   2. Each analysis stores an anonymized record to Redis (tp:pricing_data)
//   3. This API reads those records back and computes aggregates
//   4. Aggregates are displayed to users as "what others paid" benchmarks
//   5. More users = more data = better benchmarks = more users
//
// No PII is ever stored or returned. All data is aggregate-only.
// ============================================================================

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_SEC = 3600;
const CACHE_TTL_SEC = 3600; // 1 hour

const ALLOWED_ORIGIN = "https://truepricehq.com";

// --- Rate limiting (Redis-backed with in-memory fallback) ---

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
    const key = `insights_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    console.log("[pricing-insights] Redis rate limit error, falling back to in-memory:", e.message);
    return checkMemoryRateLimit(ip);
  }
}

// --- Helpers ---

function median(sorted) {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function topN(map, n) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ code: key, count }));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// --- Fetch and filter records from Redis ---

async function fetchRecords(vertical, state) {
  // Pull up to 50K records (the full list). In practice lrange returns strings.
  const raw = await redis.lrange("tp:pricing_data", 0, 49999);
  const records = [];
  for (const entry of raw) {
    try {
      const rec = typeof entry === "string" ? JSON.parse(entry) : entry;
      if (rec.v !== vertical) continue;
      if (state && rec.state !== state) continue;
      records.push(rec);
    } catch (_) {
      // skip malformed entries
    }
  }
  return records;
}

// --- Aggregate insights ---

function computeAggregateInsights(records, vertical) {
  if (!records.length) return null;

  const totalBilledValues = records.map(r => r.totalBilled).filter(v => typeof v === "number").sort((a, b) => a - b);
  const patientOwesValues = records.map(r => r.patientOwes).filter(v => typeof v === "number");
  const redFlagValues = records.map(r => r.redFlagCount).filter(v => typeof v === "number");

  // Facility type breakdown
  const facilityBreakdown = {};
  for (const r of records) {
    if (r.facilityType) {
      facilityBreakdown[r.facilityType] = (facilityBreakdown[r.facilityType] || 0) + 1;
    }
  }

  // Top CPT codes (medical vertical)
  const cptCounts = {};
  if (vertical === "medical") {
    for (const r of records) {
      if (Array.isArray(r.cptCodes)) {
        for (const code of r.cptCodes) {
          cptCounts[code] = (cptCounts[code] || 0) + 1;
        }
      }
    }
  }

  return {
    totalQuotes: records.length,
    avgTotalBilled: round2(totalBilledValues.reduce((s, v) => s + v, 0) / (totalBilledValues.length || 1)),
    medianTotalBilled: round2(median(totalBilledValues)),
    avgPatientOwes: round2(patientOwesValues.reduce((s, v) => s + v, 0) / (patientOwesValues.length || 1)),
    avgRedFlagCount: round2(redFlagValues.reduce((s, v) => s + v, 0) / (redFlagValues.length || 1)),
    facilityTypeBreakdown: facilityBreakdown,
    ...(vertical === "medical" ? { topCptCodes: topN(cptCounts, 15) } : {})
  };
}

// --- CPT-specific insights ---

function computeCptInsights(records, cpt) {
  // Filter to records that contain the target CPT code
  const matching = records.filter(r => Array.isArray(r.cptCodes) && r.cptCodes.includes(cpt));
  if (!matching.length) return null;

  const totalBilledValues = matching.map(r => r.totalBilled).filter(v => typeof v === "number");
  const avgCharged = totalBilledValues.reduce((s, v) => s + v, 0) / (totalBilledValues.length || 1);

  // Average ratio to insurance paid (rough proxy for Medicare ratio)
  const ratios = matching
    .filter(r => typeof r.insurancePaid === "number" && r.insurancePaid > 0)
    .map(r => r.totalBilled / r.insurancePaid);
  const avgRatioToInsurance = ratios.length
    ? round2(ratios.reduce((s, v) => s + v, 0) / ratios.length)
    : null;

  return {
    cptCode: cpt,
    timesSeen: matching.length,
    avgTotalBilled: round2(avgCharged),
    avgBilledToInsuranceRatio: avgRatioToInsurance
  };
}

// --- Cache layer ---

function cacheKey(vertical, state, cpt) {
  return `tp:insights_cache:${vertical}:${state || "all"}:${cpt || "agg"}`;
}

async function getCached(key) {
  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    return typeof cached === "string" ? JSON.parse(cached) : cached;
  } catch (_) {
    return null;
  }
}

async function setCache(key, data) {
  try {
    await redis.set(key, JSON.stringify(data), { ex: CACHE_TTL_SEC });
  } catch (_) {
    // non-critical
  }
}

// --- CORS headers ---

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  if (origin === ALLOWED_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
  }
  return headers;
}

// --- Main handler ---

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const cors = corsHeaders(origin);
  for (const [k, v] of Object.entries(cors)) {
    res.setHeader(k, v);
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limit
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.headers["x-real-ip"]
    || req.socket?.remoteAddress
    || "unknown";

  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return res.status(429).json({ error: "Rate limit exceeded. Max 30 requests per hour." });
  }

  // Parse params
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const vertical = url.searchParams.get("vertical");
  const state = url.searchParams.get("state") || null;
  const cpt = url.searchParams.get("cpt") || null;

  if (!vertical) {
    return res.status(400).json({ error: "Missing required parameter: vertical" });
  }

  const validVerticals = ["medical", "moving", "auto", "legal", "home"];
  if (!validVerticals.includes(vertical)) {
    return res.status(400).json({ error: `Invalid vertical. Must be one of: ${validVerticals.join(", ")}` });
  }

  if (state && !/^[A-Z]{2}$/.test(state)) {
    return res.status(400).json({ error: "State must be a 2-letter uppercase code (e.g. NC)" });
  }

  // Check cache first
  const ck = cacheKey(vertical, state, cpt);
  const cached = await getCached(ck);
  if (cached) {
    return res.status(200).json({ ...cached, cached: true });
  }

  try {
    const records = await fetchRecords(vertical, state);

    let result;

    if (cpt) {
      // CPT-specific insights
      const insights = computeCptInsights(records, cpt);
      if (!insights) {
        return res.status(200).json({
          vertical,
          state: state || "all",
          cptCode: cpt,
          message: "No data available for this CPT code and filter combination yet.",
          totalQuotes: 0
        });
      }
      result = { vertical, state: state || "all", ...insights };
    } else {
      // Aggregate insights
      const insights = computeAggregateInsights(records, vertical);
      if (!insights) {
        return res.status(200).json({
          vertical,
          state: state || "all",
          message: "No data available for this filter combination yet.",
          totalQuotes: 0
        });
      }
      result = { vertical, state: state || "all", ...insights };
    }

    // Cache for 1 hour
    await setCache(ck, result);

    return res.status(200).json(result);
  } catch (e) {
    console.error("[pricing-insights] Error:", e);
    return res.status(500).json({ error: "Failed to compute insights. Try again shortly." });
  }
}
