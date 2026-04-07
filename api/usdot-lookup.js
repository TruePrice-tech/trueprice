// /api/usdot-lookup
//
// Server-side proxy for the FMCSA SAFER carrier lookup. Used by the moving
// quote analyzer to verify that a mover named in a user-uploaded quote is
// actually a licensed carrier in the federal database.
//
// FMCSA's public Mobile API (api.fmcsa.dot.gov) requires a webKey but the
// SAFER public site doesn't — we scrape the public HTML when no key is
// available. To keep things simple in v1, we use the SAFER company snapshot
// search page, which returns plain HTML.
//
// Inputs:
//   { name: "ABC Movers" }   -- search by company name (best effort)
//   { dotNumber: "1234567" } -- search by exact USDOT number
//
// Output:
//   { ok: true, found: true, dotNumber, legalName, dbaName, status, allowed, ... }
//   { ok: true, found: false }
//   { ok: false, error: "..." }

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const CACHE_TTL = 7 * 24 * 60 * 60; // 1 week
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 3600;

async function checkRateLimit(ip) {
  try {
    const key = `usdot_rate:${ip}`;
    const c = await redis.incr(key);
    if (c === 1) await redis.expire(key, RATE_LIMIT_WINDOW);
    return c <= RATE_LIMIT_MAX;
  } catch (e) {
    return true;
  }
}

// Parse the SAFER company snapshot HTML for the fields we care about.
// SAFER's snapshot page has a recognizable table structure.
function parseSnapshot(html) {
  const out = {};
  function grab(label) {
    const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?<TD[^>]*>([\\s\\S]*?)</TD>", "i");
    const m = html.match(re);
    if (!m) return null;
    return m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
  }
  out.legalName = grab("Legal Name:");
  out.dbaName = grab("DBA Name:");
  out.dotNumber = grab("USDOT Number:");
  out.status = grab("Operating Status:");
  out.outOfService = grab("Out of Service Date:");
  out.entityType = grab("Entity Type:");
  out.mcMxNumber = grab("MC/MX/FF Number");
  out.address = grab("Physical Address:");
  out.power = grab("Power Units:");
  out.drivers = grab("Drivers:");
  // Operating authority indicators
  const isCarrier = /OPERATING/i.test(out.status || "");
  out.allowed = isCarrier && !out.outOfService;
  // Filter empty/null
  for (const k of Object.keys(out)) {
    if (out[k] == null || out[k] === "" || out[k] === "-") delete out[k];
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function fetchByDot(dotNumber) {
  const url = "https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=" + encodeURIComponent(dotNumber);
  const r = await fetch(url, {
    headers: {
      "User-Agent": "TruePriceUSDOTLookup/1.0 (+https://truepricehq.com)",
      "Accept": "text/html"
    }
  });
  if (!r.ok) return null;
  const html = await r.text();
  return parseSnapshot(html);
}

async function fetchByName(name) {
  const url = "https://safer.fmcsa.dot.gov/keywordx.asp?searchstring=" + encodeURIComponent("*" + name + "*") + "&SEARCHTYPE=";
  const r = await fetch(url, {
    headers: {
      "User-Agent": "TruePriceUSDOTLookup/1.0 (+https://truepricehq.com)",
      "Accept": "text/html"
    }
  });
  if (!r.ok) return null;
  const html = await r.text();
  // Find the first carrier link in the search results — it points to a snapshot URL
  const m = html.match(/<a[^>]*href="([^"]*query_type=queryCarrierSnapshot[^"]+)"/i);
  if (!m) return null;
  const snapshotUrl = m[1].startsWith("http") ? m[1] : "https://safer.fmcsa.dot.gov/" + m[1];
  const r2 = await fetch(snapshotUrl, {
    headers: { "User-Agent": "TruePriceUSDOTLookup/1.0", "Accept": "text/html" }
  });
  if (!r2.ok) return null;
  return parseSnapshot(await r2.text());
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://truepricehq.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  if (!(await checkRateLimit(ip))) {
    return res.status(429).json({ ok: false, error: "Rate limit exceeded" });
  }

  const body = req.body || {};
  const dotNumber = String(body.dotNumber || "").replace(/[^0-9]/g, "").substring(0, 10);
  const name = String(body.name || "").trim().substring(0, 80);

  if (!dotNumber && !name) {
    return res.status(400).json({ ok: false, error: "Provide dotNumber or name" });
  }

  // Cache by canonical key
  const cacheKey = "usdot:" + (dotNumber || ("name:" + name.toLowerCase().replace(/\s+/g, "_")));
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({ ok: true, cached: true, ...(typeof cached === "string" ? JSON.parse(cached) : cached) });
    }
  } catch (e) { /* fall through */ }

  let snapshot = null;
  try {
    if (dotNumber) {
      snapshot = await fetchByDot(dotNumber);
    } else {
      snapshot = await fetchByName(name);
    }
  } catch (e) {
    return res.status(502).json({ ok: false, error: "FMCSA SAFER lookup failed: " + (e.message || "unknown") });
  }

  const result = snapshot
    ? { found: true, ...snapshot }
    : { found: false };

  try {
    await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });
  } catch (e) { /* cache errors are fine */ }

  return res.status(200).json({ ok: true, ...result });
}
