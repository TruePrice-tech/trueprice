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
// SAFER uses <TH class="querylabelbkg">label:</TH> followed by
// <TD class="queryfield">value</TD>. We anchor on the queryfield class
// so we don't accidentally grab form inputs or nav cells.
function parseSnapshot(html) {
  // Bail early if SAFER returned a "no record" page (which still has TDs)
  if (/Record Not Found|No records matching|No data is available|RECORD INACTIVE/i.test(html) && !/queryfield/i.test(html)) {
    return null;
  }
  // The raw page must have at least one queryfield to be a real snapshot
  if (!/queryfield/i.test(html)) return null;

  const out = {};
  function clean(s) {
    if (!s) return null;
    return s.replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
  }
  function grab(label) {
    // Match: label text in a TH, then the next TD with class="queryfield"
    const escLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escLabel + "[\\s\\S]{0,300}?<TD[^>]*class=\"queryfield\"[^>]*>([\\s\\S]*?)</TD>", "i");
    const m = html.match(re);
    if (!m) return null;
    const v = clean(m[1]);
    return v && v !== "-" ? v : null;
  }

  out.legalName = grab("Legal Name:");
  out.dbaName = grab("DBA Name:");
  out.dotNumber = grab("USDOT Number:");
  // SAFER labels these as "USDOT Status:" and "Operating Authority Status:" — both useful
  out.status = grab("USDOT Status:");
  let auth = grab("Operating Authority Status:");
  // SAFER appends "For Licensing and Insurance details click here." — strip it
  if (auth) auth = auth.replace(/\s*For Licensing and Insurance.*$/i, "").trim();
  out.authorityStatus = auth;
  out.outOfService = grab("Out of Service Date:");
  out.entityType = grab("Entity Type:");
  out.mcMxNumber = grab("MC/MX/FF Number") || grab("MC/MX/FF Number(s):");
  out.address = grab("Physical Address:");
  out.power = grab("Power Units:");
  out.drivers = grab("Drivers:");

  // Filter empty/null FIRST so the "found" check is honest
  for (const k of Object.keys(out)) {
    if (out[k] == null || out[k] === "") delete out[k];
  }

  // Need at least a legal name + DOT number to consider this a real result
  if (!out.legalName || !out.dotNumber) return null;

  // SAFER USDOT status is "ACTIVE" / "INACTIVE", and Operating Authority is
  // "AUTHORIZED FOR Property" / "NOT AUTHORIZED" / etc. We treat the carrier
  // as allowed if EITHER says they can operate AND there's no OOS date.
  const usdotOk = /\bACTIVE\b/i.test(out.status || "");
  const authorityOk = /AUTHORIZED|OPERATING/i.test(out.authorityStatus || "");
  const oos = out.outOfService && !/^None$/i.test(out.outOfService);
  out.allowed = (usdotOk || authorityOk) && !oos;

  return out;
}

async function fetchByDot(dotNumber) {
  const url = "https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=" + encodeURIComponent(dotNumber);
  const r = await fetch(url, {
    headers: {
      "User-Agent": "WoogoroUSDOTLookup/1.0 (+https://woogoro.com)",
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
      "User-Agent": "WoogoroUSDOTLookup/1.0 (+https://woogoro.com)",
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
    headers: { "User-Agent": "WoogoroUSDOTLookup/1.0", "Accept": "text/html" }
  });
  if (!r2.ok) return null;
  return parseSnapshot(await r2.text());
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
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

  // Cache by canonical key (versioned so bad parses can be invalidated by bumping)
  const PARSER_VERSION = "v3";
  const cacheKey = "usdot:" + PARSER_VERSION + ":" + (dotNumber || ("name:" + name.toLowerCase().replace(/\s+/g, "_")));
  const skipCache = body.nocache === true;
  if (!skipCache) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json({ ok: true, cached: true, ...(typeof cached === "string" ? JSON.parse(cached) : cached) });
      }
    } catch (e) { /* fall through */ }
  }

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
