// Lightweight analytics endpoint — tracks page views + events in-memory
// Replace with Vercel KV for persistence across deploys

const pageViews = [];
const events = [];
const MAX_VIEWS = 50000;
const MAX_EVENTS = 10000;
const ADMIN_KEY = "tp_admin_2026";

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

  // GET: Dashboard data
  if (req.method === "GET") {
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
      recentEvents
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
