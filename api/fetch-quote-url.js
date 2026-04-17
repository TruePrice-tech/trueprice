// /api/fetch-quote-url
//
// Shared endpoint that takes a public URL (a moving quote portal page, a car
// listing, a solar quote, etc.), fetches it server-side, sanitizes the HTML,
// and returns plain text + extracted structured data ready to feed into the
// existing analyzer pipelines (which expect a `text` field).
//
// Used by:
//   - moving-quote-analyzer.html (HireAHelper, U-Haul, Bellhop, etc.)
//   - future: auto purchase analyzer (Cars.com, Autotrader, CarGurus)
//   - future: solar analyzer (EnergySage, SolarReviews)
//
// Why server-side fetch (not client fetch):
//   - CORS would block client-side fetches to most third-party sites
//   - Lets us add a polite User-Agent and rate-limit per IP
//   - Avoids leaking user IP to the third-party site
//
// Returns:
//   { ok: true, text: "...", title: "...", host: "...", length: 12345 }
//   or { ok: false, error: "..." }

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_SEC = 3600;
const MAX_RESPONSE_BYTES = 2_000_000; // 2 MB ceiling, anything bigger is junk
const FETCH_TIMEOUT_MS = 12_000;

// Hosts we are willing to fetch. Whitelist (not blocklist) so we never get
// abused as an open proxy. Wildcards via suffix match.
const ALLOWED_HOST_SUFFIXES = [
  // Moving
  "hireahelper.com", "movinghelp.com", "uhaul.com", "bellhop.com",
  "moveline.com", "smartmoving.com", "move4u.com", "updater.com",
  "pods.com", "penske.com", "budgettruck.com", "atlasvanlines.com",
  "northamerican.com", "alliedvanlines.com", "mayflower.com",
  "twomenandatruck.com", "collegehunkshaulingjunk.com",
  // Auto purchase (for the next phase)
  "cars.com", "autotrader.com", "cargurus.com", "carvana.com", "vroom.com",
  "truecar.com", "edmunds.com", "kbb.com", "carmax.com",
  // Solar
  "energysage.com", "solarreviews.com", "sunrun.com", "sunpower.com",
  // Medical (good faith estimates)
  "mychart.com", "epic.com",
  // Generic quote portals
  "docusign.com", "docusign.net", "hellosign.com", "pandadoc.com",
];

function isAllowedHost(host) {
  const h = (host || "").toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(s => h === s || h.endsWith("." + s));
}

async function checkRateLimit(ip) {
  try {
    const key = `fetch_url_rate:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
    return count <= RATE_LIMIT_MAX;
  } catch (e) {
    return true; // fail open if Redis is down
  }
}

// Strip script/style tags, collapse whitespace. We are not trying to render
// the page — we want every visible character on the page concatenated as text
// so the analyzer's regex + Claude can find prices and line items.
function htmlToText(html) {
  let s = String(html || "");
  // Drop scripts/styles entirely
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // Convert <br>, <p>, <div>, <tr>, <li> to newlines so structure survives
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|tr|li|h[1-6]|section|article)>/gi, "\n");
  // Strip all remaining tags
  s = s.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  s = s.replace(/&nbsp;/gi, " ");
  s = s.replace(/&amp;/gi, "&");
  s = s.replace(/&lt;/gi, "<");
  s = s.replace(/&gt;/gi, ">");
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/&#39;/gi, "'");
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  // Collapse whitespace
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n[ \t]+/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function extractTitle(html) {
  const m = String(html || "").match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim().substring(0, 200) : "";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.headers["x-real-ip"] || "unknown";
  if (!(await checkRateLimit(ip))) {
    return res.status(429).json({ ok: false, error: "Rate limit exceeded. Try again in an hour." });
  }

  const body = req.body || {};
  const rawUrl = String(body.url || "").trim();
  if (!rawUrl) {
    return res.status(400).json({ ok: false, error: "Missing url" });
  }

  // Parse and validate
  let parsed;
  try {
    parsed = new URL(rawUrl.startsWith("http") ? rawUrl : "https://" + rawUrl);
  } catch (e) {
    return res.status(400).json({ ok: false, error: "Invalid URL format" });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return res.status(400).json({ ok: false, error: "Only http(s) URLs allowed" });
  }

  if (!isAllowedHost(parsed.hostname)) {
    return res.status(400).json({
      ok: false,
      error: "We don't yet support quotes from " + parsed.hostname + ". Try uploading a PDF instead, or contact hello@woogoro.com to request this site."
    });
  }

  // Block private/internal ranges (defense in depth — though we already have a host whitelist)
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.startsWith("127.") || host.startsWith("10.")
      || host.startsWith("192.168.") || host.endsWith(".internal")
      || host.endsWith(".local")) {
    return res.status(400).json({ ok: false, error: "Internal hosts not allowed" });
  }

  // Fetch with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(parsed.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "WoogoroQuoteFetcher/1.0 (+https://woogoro.com/contact)",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (e) {
    clearTimeout(timeout);
    return res.status(502).json({
      ok: false,
      error: e.name === "AbortError" ? "Fetch timed out after 12 seconds" : "Could not fetch URL: " + (e.message || "unknown error")
    });
  }
  clearTimeout(timeout);

  if (!response.ok) {
    return res.status(502).json({
      ok: false,
      error: "Source returned HTTP " + response.status
    });
  }

  // Read with size cap
  let html;
  try {
    const buf = await response.arrayBuffer();
    if (buf.byteLength > MAX_RESPONSE_BYTES) {
      return res.status(413).json({ ok: false, error: "Response too large (>2MB)" });
    }
    html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } catch (e) {
    return res.status(502).json({ ok: false, error: "Could not read response body" });
  }

  const title = extractTitle(html);
  const text = htmlToText(html);

  if (!text || text.length < 50) {
    return res.status(422).json({
      ok: false,
      error: "We couldn't extract any readable content from that page. The site may require login or use heavy JavaScript. Try uploading a PDF screenshot instead."
    });
  }

  // Cap text size to keep downstream Claude calls cheap
  const cappedText = text.substring(0, 30_000);

  return res.status(200).json({
    ok: true,
    url: parsed.toString(),
    host: parsed.hostname,
    title,
    length: cappedText.length,
    text: cappedText,
  });
}
