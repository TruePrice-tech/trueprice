// Analytics endpoint with Upstash Redis persistence
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const ADMIN_KEY = "tp_admin_2026";
const MAX_ENTRIES = 10000;

const BOT_PATTERNS = [
  { name: "Googlebot", pattern: /googlebot/i },
  { name: "Google-InspectionTool", pattern: /google-inspectiontool/i },
  { name: "Bingbot", pattern: /bingbot/i },
  { name: "Slurp (Yahoo)", pattern: /slurp/i },
  { name: "DuckDuckBot", pattern: /duckduckbot/i },
  { name: "Baiduspider", pattern: /baiduspider/i },
  { name: "YandexBot", pattern: /yandexbot/i },
  { name: "facebookexternalhit", pattern: /facebookexternalhit/i },
  { name: "Twitterbot", pattern: /twitterbot/i },
  { name: "LinkedInBot", pattern: /linkedinbot/i },
  { name: "AhrefsBot", pattern: /ahrefsbot/i },
  { name: "SemrushBot", pattern: /semrushbot/i },
  { name: "Applebot", pattern: /applebot/i },
  { name: "GPTBot", pattern: /gptbot/i },
  { name: "ClaudeBot", pattern: /claudebot|claude-web/i },
  { name: "Other Bot", pattern: /bot|crawler|spider|scraper/i }
];

function detectBot(ua) {
  if (!ua) return null;
  for (const bp of BOT_PATTERNS) {
    if (bp.pattern.test(ua)) return bp.name;
  }
  return null;
}

function getClientIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
         req.headers["x-real-ip"] || "unknown";
}

function parseUserAgent(ua) {
  ua = ua || "";
  let device = "desktop";
  if (/mobile|android|iphone|ipad/i.test(ua)) device = "mobile";
  else if (/tablet|ipad/i.test(ua)) device = "tablet";
  let browser = "other";
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = "chrome";
  else if (/firefox/i.test(ua)) browser = "firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "safari";
  else if (/edg/i.test(ua)) browser = "edge";
  return { device, browser };
}

function hashIP(ip) {
  return ip.split(".").map((o, i) => i < 2 ? o : "x").join(".");
}

function getGeo(req) {
  return {
    city: req.headers["x-vercel-ip-city"] ? decodeURIComponent(req.headers["x-vercel-ip-city"]) : null,
    region: req.headers["x-vercel-ip-country-region"] || null,
    country: req.headers["x-vercel-ip-country"] || null
  };
}

export default async function handler(req, res) {
  const allowedOrigin = "https://truepricehq.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // POST: Record page view or event
  if (req.method === "POST") {
    try {
      const data = req.body || {};
      const ua = req.headers["user-agent"] || "";
      const { device, browser } = parseUserAgent(ua);
      const ipHash = hashIP(getClientIP(req));
      const type = String(data.type || "pageview");

      if (type === "event") {
        const event = String(data.event || "").substring(0, 50).trim();
        if (!event) return res.status(200).json({ ok: true });
        const meta = data.meta || {};
        const cleanMeta = {};
        for (const [k, v] of Object.entries(meta)) {
          cleanMeta[String(k).substring(0, 30)] = String(v).substring(0, 100);
        }
        await redis.lpush("tp:events", JSON.stringify({
          event, meta: cleanMeta, path: String(data.path || "/").substring(0, 200),
          device, ipHash, ts: Date.now()
        }));
        await redis.ltrim("tp:events", 0, MAX_ENTRIES - 1);
      } else {
        const path = String(data.path || "/").substring(0, 200).trim();
        const referrer = String(data.referrer || "").substring(0, 500).trim();
        let refHost = "direct";
        try { if (referrer) refHost = new URL(referrer).hostname; } catch(e) {}
        const geo = getGeo(req);
        await redis.lpush("tp:pageviews", JSON.stringify({
          path, referrer: refHost, title: String(data.title || "").substring(0, 200).trim(),
          device, browser, ipHash, city: geo.city, region: geo.region, country: geo.country,
          ts: Date.now()
        }));
        await redis.ltrim("tp:pageviews", 0, MAX_ENTRIES - 1);
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("Analytics POST error:", e);
      return res.status(200).json({ ok: true });
    }
  }

  // GET
  if (req.method === "GET") {
    // Pixel: bot detection
    if (req.query.pixel === "1") {
      const ua = req.headers["user-agent"] || "";
      const botName = detectBot(ua);
      const path = String(req.query.p || "/").substring(0, 200);
      if (botName) {
        await redis.lpush("tp:crawls", JSON.stringify({
          bot: botName, path, ts: Date.now()
        })).catch(() => {});
        await redis.ltrim("tp:crawls", 0, 5000).catch(() => {});
      }
      const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
      res.setHeader("Content-Type", "image/gif");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(gif);
    }

    // Public counter
    if (req.query.counter === "1") {
      const BASE_COUNT = 847;
      try {
        const rawEvents = await redis.lrange("tp:events", 0, -1);
        const analysisCount = rawEvents.filter(e => {
          const ev = typeof e === "string" ? JSON.parse(e) : e;
          return ev.event === "analysis_completed" || ev.event === "estimate_completed" || ev.event === "quote_uploaded";
        }).length;
        return res.status(200).json({ count: BASE_COUNT + analysisCount });
      } catch (e) {
        return res.status(200).json({ count: BASE_COUNT });
      }
    }

    // Dashboard (auth required)
    const key = req.query.key || "";
    if (key !== ADMIN_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const now = Date.now();
      const hour = 3600000;
      const day = 86400000;
      const range = req.query.range || "24h";
      const cutoff = range === "1h" ? now - hour
        : range === "7d" ? now - 7 * day
        : range === "30d" ? now - 30 * day
        : now - day;

      // Fetch from Redis
      const rawViews = await redis.lrange("tp:pageviews", 0, MAX_ENTRIES - 1);
      const rawEvents = await redis.lrange("tp:events", 0, MAX_ENTRIES - 1);
      const rawCrawls = await redis.lrange("tp:crawls", 0, 5000);

      const allViews = rawViews.map(r => typeof r === "string" ? JSON.parse(r) : r);
      const allEvents = rawEvents.map(r => typeof r === "string" ? JSON.parse(r) : r);
      const allCrawls = rawCrawls.map(r => typeof r === "string" ? JSON.parse(r) : r);

      const filtered = allViews.filter(pv => pv.ts >= cutoff);
      const filteredEvents = allEvents.filter(ev => ev.ts >= cutoff);
      const filteredCrawls = allCrawls.filter(c => c.ts >= cutoff);

      // Page view stats
      const totalViews = filtered.length;
      const uniqueVisitors = new Set(filtered.map(pv => pv.ipHash)).size;

      const pageCounts = {};
      filtered.forEach(pv => { pageCounts[pv.path] = (pageCounts[pv.path] || 0) + 1; });
      const topPages = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 20)
        .map(([path, count]) => ({ path, count }));

      const refCounts = {};
      filtered.forEach(pv => {
        if (pv.referrer && pv.referrer !== "direct") refCounts[pv.referrer] = (refCounts[pv.referrer] || 0) + 1;
      });
      const topReferrers = Object.entries(refCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([source, count]) => ({ source, count }));
      const directCount = filtered.filter(pv => pv.referrer === "direct").length;

      const devices = {};
      filtered.forEach(pv => { devices[pv.device] = (devices[pv.device] || 0) + 1; });
      const browsers = {};
      filtered.forEach(pv => { browsers[pv.browser] = (browsers[pv.browser] || 0) + 1; });

      const hourly = {};
      filtered.forEach(pv => {
        const h = new Date(pv.ts).toISOString().substring(0, 13);
        hourly[h] = (hourly[h] || 0) + 1;
      });

      // Events
      const eventCounts = {};
      filteredEvents.forEach(ev => { eventCounts[ev.event] = (eventCounts[ev.event] || 0) + 1; });
      const topEvents = Object.entries(eventCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 20)
        .map(([event, count]) => ({ event, count }));

      const recentEvents = filteredEvents.slice(0, 50).map(ev => ({
        event: ev.event, meta: ev.meta, path: ev.path,
        device: ev.device, time: new Date(ev.ts).toISOString()
      }));

      // Geo
      const cityCounts = {};
      const regionCounts = {};
      filtered.forEach(pv => {
        if (pv.city && pv.region) {
          const loc = pv.city + ", " + pv.region;
          cityCounts[loc] = (cityCounts[loc] || 0) + 1;
        }
        if (pv.region) regionCounts[pv.region] = (regionCounts[pv.region] || 0) + 1;
      });
      const topCities = Object.entries(cityCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([city, count]) => ({ city, count }));
      const topRegions = Object.entries(regionCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([region, count]) => ({ region, count }));

      // Funnel
      const funnelSteps = [
        "funnel_visit_analyzer", "funnel_confirm_address", "funnel_upload_quote",
        "funnel_start_estimator", "funnel_analysis_complete", "funnel_estimator_complete"
      ];
      const funnel = funnelSteps.map(step => ({
        step: step.replace("funnel_", "").replace(/_/g, " "),
        count: filteredEvents.filter(ev => ev.event === step).length
      }));

      // Crawls
      const botCounts = {};
      filteredCrawls.forEach(c => { botCounts[c.bot] = (botCounts[c.bot] || 0) + 1; });
      const topBots = Object.entries(botCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([bot, count]) => ({ bot, count }));
      const recentCrawls = filteredCrawls.slice(0, 30).map(c => ({
        bot: c.bot, path: c.path, time: new Date(c.ts).toISOString()
      }));

      return res.status(200).json({
        range, totalViews, uniqueVisitors, totalStored: allViews.length,
        topPages, topReferrers, directTraffic: directCount,
        devices, browsers, hourly,
        totalEvents: filteredEvents.length, topEvents, recentEvents,
        funnel, topCities, topRegions,
        totalCrawls: filteredCrawls.length, topBots, recentCrawls
      });
    } catch (e) {
      console.error("Analytics GET error:", e);
      return res.status(500).json({ error: "Failed to load analytics" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
