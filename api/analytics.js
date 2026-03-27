// Lightweight analytics endpoint — tracks page views + events in-memory
// Replace with Vercel KV for persistence across deploys

const pageViews = [];
const events = [];
const crawls = [];
const MAX_VIEWS = 50000;
const MAX_EVENTS = 10000;
const MAX_CRAWLS = 5000;
const ADMIN_KEY = "tp_admin_2026";

const BOT_PATTERNS = [
  { name: "Googlebot", pattern: /googlebot/i },
  { name: "Google-InspectionTool", pattern: /google-inspectiontool/i },
  { name: "Bingbot", pattern: /bingbot/i },
  { name: "Slurp (Yahoo)", pattern: /slurp/i },
  { name: "DuckDuckBot", pattern: /duckduckbot/i },
  { name: "Baiduspider", pattern: /baiduspider/i },
  { name: "YandexBot", pattern: /yandexbot/i },
  { name: "Sogou", pattern: /sogou/i },
  { name: "facebookexternalhit", pattern: /facebookexternalhit/i },
  { name: "Twitterbot", pattern: /twitterbot/i },
  { name: "LinkedInBot", pattern: /linkedinbot/i },
  { name: "WhatsApp", pattern: /whatsapp/i },
  { name: "Slackbot", pattern: /slackbot/i },
  { name: "Discordbot", pattern: /discordbot/i },
  { name: "AhrefsBot", pattern: /ahrefsbot/i },
  { name: "SemrushBot", pattern: /semrushbot/i },
  { name: "MJ12bot", pattern: /mj12bot/i },
  { name: "PetalBot", pattern: /petalbot/i },
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
        // Sanitize meta values
        const cleanMeta = {};
        for (const [k, v] of Object.entries(meta)) {
          cleanMeta[String(k).substring(0, 30)] = String(v).substring(0, 100);
        }

        events.push({
          event,
          meta: cleanMeta,
          path: String(data.path || "/").substring(0, 200),
          device,
          ipHash,
          ts: Date.now()
        });

        if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
      } else {
        const path = String(data.path || "/").substring(0, 200).trim();
        const referrer = String(data.referrer || "").substring(0, 500).trim();
        let refHost = "direct";
        try { if (referrer) refHost = new URL(referrer).hostname; } catch(e) {}

        pageViews.push({
          path,
          referrer: refHost,
          title: String(data.title || "").substring(0, 200).trim(),
          device,
          browser,
          ipHash,
          ts: Date.now()
        });

        if (pageViews.length > MAX_VIEWS) pageViews.splice(0, pageViews.length - MAX_VIEWS);
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: true });
    }
  }

  // GET: Tracking pixel (for bot detection) or dashboard data
  if (req.method === "GET") {
    // Pixel mode: returns 1x1 transparent GIF and logs the crawl
    if (req.query.pixel === "1") {
      const ua = req.headers["user-agent"] || "";
      const botName = detectBot(ua);
      const path = String(req.query.p || "/").substring(0, 200);

      if (botName) {
        crawls.push({
          bot: botName,
          path,
          ua: ua.substring(0, 200),
          ts: Date.now()
        });
        if (crawls.length > MAX_CRAWLS) crawls.splice(0, crawls.length - MAX_CRAWLS);
      }

      // Return 1x1 transparent GIF
      const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
      res.setHeader("Content-Type", "image/gif");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(gif);
    }

    // Public counter - no auth needed
    if (req.query.counter === "1") {
      const BASE_COUNT = 847;
      const analysisEvents = events.filter(ev =>
        ev.event === "analysis_completed" || ev.event === "estimate_completed" || ev.event === "quote_uploaded"
      ).length;
      return res.status(200).json({ count: BASE_COUNT + analysisEvents });
    }

    const key = req.query.key || "";
    if (key !== ADMIN_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const now = Date.now();
    const hour = 3600000;
    const day = 86400000;
    const range = req.query.range || "24h";
    const cutoff = range === "1h" ? now - hour
      : range === "7d" ? now - 7 * day
      : range === "30d" ? now - 30 * day
      : now - day;

    const filtered = pageViews.filter(pv => pv.ts >= cutoff);
    const filteredEvents = events.filter(ev => ev.ts >= cutoff);

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

    // Event stats
    const eventCounts = {};
    filteredEvents.forEach(ev => { eventCounts[ev.event] = (eventCounts[ev.event] || 0) + 1; });
    const topEvents = Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 20)
      .map(([event, count]) => ({ event, count }));

    // Recent events (last 50)
    const recentEvents = filteredEvents.slice(-50).reverse().map(ev => ({
      event: ev.event,
      meta: ev.meta,
      path: ev.path,
      device: ev.device,
      time: new Date(ev.ts).toISOString()
    }));

    // Crawl stats
    const filteredCrawls = crawls.filter(c => c.ts >= cutoff);
    const botCounts = {};
    filteredCrawls.forEach(c => { botCounts[c.bot] = (botCounts[c.bot] || 0) + 1; });
    const topBots = Object.entries(botCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([bot, count]) => ({ bot, count }));

    const recentCrawls = filteredCrawls.slice(-30).reverse().map(c => ({
      bot: c.bot,
      path: c.path,
      time: new Date(c.ts).toISOString()
    }));

    return res.status(200).json({
      range,
      totalViews,
      uniqueVisitors,
      totalStored: pageViews.length,
      topPages,
      topReferrers,
      directTraffic: directCount,
      devices,
      browsers,
      hourly,
      totalEvents: filteredEvents.length,
      topEvents,
      recentEvents,
      totalCrawls: filteredCrawls.length,
      topBots,
      recentCrawls
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
