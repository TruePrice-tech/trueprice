// Lightweight analytics endpoint — tracks page views in-memory
// Replace with Vercel KV for persistence across deploys

const pageViews = [];
const MAX_EVENTS = 50000;
const ADMIN_KEY = "tp_admin_2026"; // Simple auth for dashboard

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

export default async function handler(req, res) {
  const allowedOrigin = "https://truepricehq.com";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  // POST: Record a page view
  if (req.method === "POST") {
    try {
      const data = req.body || {};
      const path = String(data.path || "/").substring(0, 200).trim();
      const referrer = String(data.referrer || "").substring(0, 500).trim();
      const title = String(data.title || "").substring(0, 200).trim();
      const ua = req.headers["user-agent"] || "";
      const { device, browser } = parseUserAgent(ua);
      const ip = getClientIP(req);

      // Hash IP for privacy (don't store raw IPs)
      const ipHash = ip.split(".").map((o, i) => i < 2 ? o : "x").join(".");

      pageViews.push({
        path,
        referrer: referrer ? new URL(referrer).hostname : "direct",
        title,
        device,
        browser,
        ipHash,
        ts: Date.now()
      });

      if (pageViews.length > MAX_EVENTS) {
        pageViews.splice(0, pageViews.length - MAX_EVENTS);
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: true });
    }
  }

  // GET: Dashboard data (requires admin key)
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

    // Total views
    const totalViews = filtered.length;

    // Unique visitors (by ipHash)
    const uniqueIPs = new Set(filtered.map(pv => pv.ipHash));
    const uniqueVisitors = uniqueIPs.size;

    // Top pages
    const pageCounts = {};
    filtered.forEach(pv => {
      pageCounts[pv.path] = (pageCounts[pv.path] || 0) + 1;
    });
    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([path, count]) => ({ path, count }));

    // Top referrers
    const refCounts = {};
    filtered.forEach(pv => {
      if (pv.referrer && pv.referrer !== "direct") {
        refCounts[pv.referrer] = (refCounts[pv.referrer] || 0) + 1;
      }
    });
    const topReferrers = Object.entries(refCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([source, count]) => ({ source, count }));
    const directCount = filtered.filter(pv => pv.referrer === "direct").length;

    // Devices
    const devices = {};
    filtered.forEach(pv => {
      devices[pv.device] = (devices[pv.device] || 0) + 1;
    });

    // Browsers
    const browsers = {};
    filtered.forEach(pv => {
      browsers[pv.browser] = (browsers[pv.browser] || 0) + 1;
    });

    // Views per hour (last 24h)
    const hourly = {};
    filtered.forEach(pv => {
      const h = new Date(pv.ts).toISOString().substring(0, 13);
      hourly[h] = (hourly[h] || 0) + 1;
    });

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
      hourly
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
