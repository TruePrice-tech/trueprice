// /api/_abuse-guard.js
//
// Shared abuse / cost-control module imported by every analyzer endpoint.
// Provides:
//
//   1. Global daily Claude call ceiling (cost circuit breaker)
//   2. Per-IP daily request ceiling (in addition to per-hour limit)
//   3. Image content hash deduplication cache
//   4. Suspicious pattern detection (missing UA, missing Origin, burst)
//   5. Temporary IP blocklist
//
// Usage in any endpoint:
//
//   import { runAbuseGuard, recordClaudeCall, lookupImageCache, storeImageCache }
//     from "./_abuse-guard.js";
//
//   const guard = await runAbuseGuard(req, { vertical: "moving", imageBytes });
//   if (!guard.ok) {
//     return res.status(guard.status).json({ error: guard.error });
//   }
//   if (guard.cachedResult) {
//     return res.status(200).json(guard.cachedResult);
//   }
//   // ... do the Claude call ...
//   await recordClaudeCall();
//   await storeImageCache(guard.imageHash, claudeResponse);

import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

// ============================================================
// CONFIG — tune these to balance abuse protection vs real users
// ============================================================

// Global daily ceiling on Claude API calls across the entire site.
// At ~$0.005/call this caps daily Claude spend at ~$25/day worst case.
// Real usage should be nowhere near this.
const GLOBAL_DAILY_CLAUDE_MAX = 5000;

// Per-IP daily request ceiling (across all analyzer endpoints).
// 60/hr already exists per endpoint; this adds a 24h ceiling. Set high
// enough to support shared CGNAT IPv4 (T-Mobile, Verizon route many
// real users behind one IP) but low enough to cap a patient attacker.
const IP_DAILY_MAX = 500;

// Burst detection: max requests from one IP in a 10-second window.
// Real users rarely hit 15 requests in 10 seconds even with retries.
const BURST_WINDOW_SEC = 10;
const BURST_MAX = 15;

// Auto-blocklist duration when an IP triggers a hard-block pattern.
// Kept short so a false positive recovers quickly.
const BLOCKLIST_TTL_SEC = 300; // 5 minutes

// Image hash cache: how long to remember a previous parse for the same image.
// Bumped 24h -> 30d on 2026-05-15: with ~zero real end-user traffic the cache
// is effectively a test-fixture cassette. 30d means repeat fixture runs
// across the typical QA cadence (weekly deep tests, follow-up verifications,
// nightly walks before they moved to weekly) don't re-bill Claude. Real-user
// risk if traffic returns: an unlucky parse stays cached longer; flush via
// `redis-cli DEL tp:imgcache:<hash>` or wipe the namespace.
const IMAGE_CACHE_TTL_SEC = 30 * 24 * 3600; // 30 days

// ============================================================
// Helpers
// ============================================================

function getIp(req) {
  // Prefer cf-connecting-ip when behind Cloudflare proxy. CF rewrites
  // x-forwarded-for to its own edge IPs, so reading XFF blindly when CF
  // is in front would block real users by IP-fingerprinting Cloudflare.
  return (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    "unknown"
  );
}

function todayUtc() {
  return new Date().toISOString().substring(0, 10);
}

function isSuspiciousRequest(req) {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const origin = req.headers["origin"] || "";

  // Default tooling user agents are blocked. Real browsers send specific UA strings.
  if (!ua) return "no_user_agent";
  if (ua === "node-fetch" || ua.startsWith("python-urllib") || ua === "curl/7" || ua.startsWith("curl/")) {
    return "scripted_user_agent";
  }
  if (ua.includes("python-requests") || ua.includes("axios/") || ua.includes("go-http-client")) {
    return "scripted_user_agent";
  }
  if (ua.includes("postman") || ua.includes("insomnia")) {
    return "api_tool";
  }

  // Real browsers always send Origin on POST. Server-side scrapers usually don't.
  if (req.method === "POST" && !origin) return "no_origin";

  return null;
}

async function isBlocklisted(ip) {
  if (!ip || ip === "unknown") return false;
  try {
    const flag = await redis.get(`tp:blocked_ip:${ip}`);
    return !!flag;
  } catch (e) {
    return false;
  }
}

async function blocklistIp(ip, reason) {
  if (!ip || ip === "unknown") return;
  try {
    await redis.set(`tp:blocked_ip:${ip}`, reason || "auto", {
      ex: BLOCKLIST_TTL_SEC,
    });
  } catch (e) {
    /* swallow */
  }
}

// ============================================================
// Main guard function
// ============================================================
//
// Returns one of:
//   { ok: true, imageHash: "..." }                    -- proceed normally
//   { ok: true, cachedResult: {...}, imageHash: "..." } -- cache hit, skip Claude
//   { ok: false, status: 429, error: "..." }          -- rate limit / cap hit
//   { ok: false, status: 403, error: "..." }          -- blocked
//   { ok: false, status: 503, error: "..." }          -- global capacity reached
//
export async function runAbuseGuard(req, opts = {}) {
  const ip = getIp(req);
  const vertical = opts.vertical || "unknown";
  const imageBytes = opts.imageBytes || null; // Buffer or string

  // 1. IP blocklist check
  if (await isBlocklisted(ip)) {
    return { ok: false, status: 403, error: "Your access is temporarily restricted. Try again in an hour." };
  }

  // 2. Suspicious request pattern check
  // Soft-block: return 403 with a retry message but DO NOT add to the
  // blocklist. Real users hitting this should fix their setup; bots
  // can't recover. Only hard-block on actual burst patterns (below).
  const suspicion = isSuspiciousRequest(req);
  if (suspicion) {
    return {
      ok: false,
      status: 403,
      error: "Request blocked. Please open woogoro.com directly in your browser to use this tool.",
    };
  }

  // 3. Burst detection (per IP)
  try {
    const burstKey = `tp:burst:${ip}`;
    const burstCount = await redis.incr(burstKey);
    if (burstCount === 1) {
      await redis.expire(burstKey, BURST_WINDOW_SEC);
    }
    if (burstCount > BURST_MAX) {
      await blocklistIp(ip, "burst");
      return { ok: false, status: 429, error: "Too many requests in a short window. Slow down and try again." };
    }
  } catch (e) {
    /* fail open on Redis errors */
  }

  // 4. Per-IP daily ceiling
  try {
    const dayKey = `tp:ip_daily:${ip}:${todayUtc()}`;
    const dayCount = await redis.incr(dayKey);
    if (dayCount === 1) {
      await redis.expire(dayKey, 26 * 3600);
    }
    if (dayCount > IP_DAILY_MAX) {
      return {
        ok: false,
        status: 429,
        error: "You've reached the daily analysis limit. Please try again tomorrow.",
      };
    }
  } catch (e) {
    /* fail open */
  }

  // 5. Global daily Claude ceiling (read only — record only on actual Claude call)
  try {
    const globalKey = `tp:claude_calls:${todayUtc()}`;
    const globalCount = Number((await redis.get(globalKey)) || 0);
    if (globalCount >= GLOBAL_DAILY_CLAUDE_MAX) {
      return {
        ok: false,
        status: 503,
        error: "We're at our daily analysis capacity. Please try again tomorrow. Free analysis resumes at midnight UTC.",
      };
    }
  } catch (e) {
    /* fail open */
  }

  // 6. Image hash dedup
  // Vertical+version namespace lets endpoints invalidate the cache when
  // they update their parser prompt by bumping the version suffix.
  let imageHash = null;
  const cacheNs = opts.cacheNamespace || vertical;
  if (imageBytes) {
    try {
      imageHash = crypto.createHash("sha256").update(imageBytes).digest("hex").substring(0, 24);
      const cacheKey = `tp:image_cache:${cacheNs}:${imageHash}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
        return { ok: true, imageHash, cachedResult: parsed, cacheNamespace: cacheNs };
      }
    } catch (e) {
      /* fall through */
    }
  }

  return { ok: true, imageHash, cacheNamespace: cacheNs };
}

// Call this AFTER a successful Claude API call to increment the global ceiling.
export async function recordClaudeCall() {
  try {
    const globalKey = `tp:claude_calls:${todayUtc()}`;
    const c = await redis.incr(globalKey);
    if (c === 1) {
      await redis.expire(globalKey, 26 * 3600);
    }
    return c;
  } catch (e) {
    return null;
  }
}

// Store a successful parse result in the image cache so duplicate uploads
// of the same image return instantly without paying for Claude.
// `cacheNs` is the namespace used in runAbuseGuard — pass the same value
// (defaults to vertical name).
//
// Prefer cacheResult(guard, result) below — that pulls cacheNamespace
// from the guard so the lookup string and the store string can never drift.
export async function storeImageCache(cacheNs, imageHash, result) {
  if (!imageHash || !result) return;
  try {
    const cacheKey = `tp:image_cache:${cacheNs}:${imageHash}`;
    await redis.set(cacheKey, JSON.stringify(result), { ex: IMAGE_CACHE_TTL_SEC });
  } catch (e) {
    /* swallow */
  }
}

// Safer wrapper: takes the _guard object returned by runAbuseGuard and pulls
// both imageHash and cacheNamespace from it, so the lookup ns and the store
// ns can NEVER drift apart. Drift was the silent bug class fixed in legal +
// medical + auto-repair + 16 other endpoints (legal dive 2026-05-03 L6).
// No-ops when imageHash is null (e.g. text-only request, or MCP bypass).
export async function cacheResult(guard, result) {
  if (!guard || !guard.imageHash || !result) return;
  return storeImageCache(guard.cacheNamespace, guard.imageHash, result);
}
