// Analytics endpoint with Upstash Redis persistence
// NOTE: The "url.parse() behavior is not standardized" deprecation warning in
// Vercel logs comes from @upstash/redis internals, not from this file. Our code
// already uses the WHATWG URL API (new URL()). The warning will resolve when
// Upstash updates their package. No action needed here.
import { Redis } from "@upstash/redis";
import { gate, track } from "./_usage-gate.js";

const redis = Redis.fromEnv();
// TODO: Set ANALYTICS_ADMIN_KEY in Vercel env vars to a strong random value (32+ chars)
const ADMIN_KEY = process.env.ANALYTICS_ADMIN_KEY || "tp_admin_2026";
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
  { name: "Headless Chrome", pattern: /headlesschrome/i },
  { name: "PhantomJS", pattern: /phantomjs/i },
  { name: "Puppeteer", pattern: /puppeteer/i },
  { name: "Playwright", pattern: /playwright/i },
  { name: "Selenium", pattern: /selenium/i },
  { name: "Python Requests", pattern: /python-requests|python-urllib|aiohttp/i },
  { name: "Go HTTP", pattern: /go-http-client/i },
  { name: "Java HTTP", pattern: /java\/|apache-httpclient/i },
  { name: "curl", pattern: /^curl\//i },
  { name: "wget", pattern: /^wget\//i },
  { name: "Node Fetch", pattern: /node-fetch|undici/i },
  { name: "Axios", pattern: /^axios\//i },
  { name: "MJ12bot", pattern: /mj12bot/i },
  { name: "DotBot", pattern: /dotbot/i },
  { name: "BLEXBot", pattern: /blexbot/i },
  { name: "PetalBot", pattern: /petalbot/i },
  { name: "DataForSeoBot", pattern: /dataforseobot/i },
  { name: "Bytespider", pattern: /bytespider/i },
  { name: "CCBot", pattern: /ccbot/i },
  { name: "Sogou", pattern: /sogou/i },
  { name: "ZoominfoBot", pattern: /zoominfobot/i },
  { name: "Screaming Frog", pattern: /screaming frog/i },
  { name: "UptimeRobot", pattern: /uptimerobot/i },
  { name: "Pingdom", pattern: /pingdom/i },
  { name: "StatusCake", pattern: /statuscake/i },
  { name: "Other Bot", pattern: /bot|crawler|spider|scraper/i }
];

// Known data center cities (Vercel geo headers) - traffic from these is likely automated
const DATA_CENTER_CITIES = new Set([
  "ashburn", "boardman", "council bluffs", "san jose", "santa clara",
  "the dalles", "dublin", "frankfurt", "mumbai", "singapore",
  "sao paulo", "sydney", "tokyo", "seoul", "montreal",
  "north virginia", "oregon", "ohio", "provo", "phoenix",
  // Netherlands data centers
  "naaldwijk", "meppel",
  // Cloud provider data center towns (not major metros)
  "hillsboro", "quincy", "lenoir", "lithia springs",
  "manassas", "sterling", "reston", "herndon", "chantilly",
  // Equinix NY metro colo (NY4/NY5/NY6) and Hetzner DE
  "secaucus", "falkenstein"
]);

// Track request volume per IP to detect bots from real cities
const ipHitCounts = new Map();
const IP_HIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const IP_HIT_BOT_THRESHOLD = 15; // 15+ pageviews/hour = likely bot

function isHighVolumeIp(ipHash) {
  const now = Date.now();
  let hits = ipHitCounts.get(ipHash) || [];
  hits = hits.filter(t => now - t < IP_HIT_WINDOW_MS);
  hits.push(now);
  ipHitCounts.set(ipHash, hits);
  return hits.length >= IP_HIT_BOT_THRESHOLD;
}

function isDataCenterCity(city) {
  if (!city) return false;
  return DATA_CENTER_CITIES.has(city.toLowerCase());
}

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
  const allowedOrigin = "https://woogoro.com";
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

      if (type === "email_signup") {
        await track();  // Tier 4: count but never gate
        const email = String(data.email || "").trim().toLowerCase().substring(0, 254);
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRe.test(email)) {
          return res.status(400).json({ ok: false, error: "Invalid email address" });
        }
        const geo = getGeo(req);
        await redis.lpush("tp:subscribers", JSON.stringify({
          email, device, city: geo.city, region: geo.region,
          ipHash, ts: Date.now()
        }));
        await redis.ltrim("tp:subscribers", 0, 5000);
        return res.status(200).json({ ok: true });
      }

      if (type === "feedback") {
        if (await gate(req, res, 3)) return;
        // Accept both shapes: {type, rating, comment, path} (legacy)
        // and {type, data:{rating, comment, email, path}} (new modal)
        const fb = (data.data && typeof data.data === "object") ? data.data : data;
        const rating = String(fb.rating || "").substring(0, 10);
        const comment = String(fb.comment || "").substring(0, 500).trim();
        const page = String(fb.path || "/").substring(0, 200);
        const replyTo = String(fb.email || "").substring(0, 100).trim();
        const geo = getGeo(req);
        await redis.lpush("tp:feedback", JSON.stringify({
          rating, comment, page, device, city: geo.city, region: geo.region,
          replyTo, ipHash, ts: Date.now()
        }));
        await redis.ltrim("tp:feedback", 0, 1000);

        // Forward to hello@woogoro.com via Resend if there's actual content
        let emailStatus = "skipped_empty";
        if (comment.length > 0) {
          // Daily email throttle: cap forwarded emails at 200/day to prevent
          // a feedback flood from blowing the Resend free tier or your inbox.
          // Stored in Redis as long as comment exists; the comment itself
          // still gets persisted to tp:feedback for the dashboard.
          const dayKey = `tp:feedback_emails:${new Date().toISOString().substring(0, 10)}`;
          let emailCount = 0;
          try {
            emailCount = await redis.incr(dayKey);
            if (emailCount === 1) await redis.expire(dayKey, 26 * 3600);
          } catch (e) { /* fail open */ }
          if (emailCount > 200) {
            emailStatus = "throttled_daily_cap";
            console.log(`[feedback] daily email cap hit (${emailCount}/200) — comment stored, email skipped`);
            return res.status(200).json({ ok: true, emailStatus });
          }
          const resendKey = process.env.RESEND_API_KEY;
          if (resendKey) {
            try {
              const body = {
                from: "Woogoro Feedback <noreply@woogoro.com>",
                to: ["hello@woogoro.com"],
                subject: `[Woogoro Feedback] ${rating || "comment"} on ${page}`,
                html: `<div style="font-family:sans-serif;max-width:560px;padding:20px;">
                  <h2 style="color:#1e293b;margin:0 0 12px;">New Woogoro Feedback</h2>
                  <table style="font-size:14px;color:#475569;border-collapse:collapse;width:100%;">
                    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Page</td><td style="padding:6px 0;"><a href="https://woogoro.com${page}">${page}</a></td></tr>
                    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Rating</td><td style="padding:6px 0;">${rating || "(none)"}</td></tr>
                    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Reply-to</td><td style="padding:6px 0;">${replyTo || "(none provided)"}</td></tr>
                    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Device</td><td style="padding:6px 0;">${device}</td></tr>
                    <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Location</td><td style="padding:6px 0;">${geo.city || ""} ${geo.region || ""}</td></tr>
                  </table>
                  <div style="margin-top:18px;padding:14px 18px;background:#f8fafc;border-left:3px solid #1d4ed8;border-radius:6px;color:#1e293b;white-space:pre-wrap;">${comment.replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))}</div>
                </div>`
              };
              if (replyTo && /.+@.+\..+/.test(replyTo)) body.reply_to = replyTo;
              const r = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${resendKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
              });
              if (r.ok) {
                emailStatus = "sent";
              } else {
                const errText = await r.text();
                emailStatus = "resend_error_" + r.status;
                console.error("[feedback] resend error:", r.status, errText);
              }
            } catch(e) {
              emailStatus = "exception";
              console.error("[feedback] email forward failed:", e.message);
            }
          } else {
            emailStatus = "no_api_key";
            console.log("[feedback] no RESEND_API_KEY set - email not sent");
          }
        }

        return res.status(200).json({ ok: true, emailStatus });
      }

      if (type === "404") {
        if (await gate(req, res, 1)) return;
        // 404 capture for the weekly discovery cron. Same hard guards as
        // js_error: bot filter, per-IP rate limit, daily global cap.
        const botName = detectBot(ua);
        if (botName) return res.status(200).json({ ok: true, skipped: "bot" });

        const todayStr = new Date().toISOString().substring(0, 10);
        const dayKey = `tp:404_count:${todayStr}`;
        let dailyCount = 0;
        try {
          dailyCount = await redis.incr(dayKey);
          if (dailyCount === 1) await redis.expire(dayKey, 26 * 3600);
        } catch (e) { /* fail open */ }
        if (dailyCount > 2000) return res.status(200).json({ ok: true, skipped: "daily_cap" });

        const hourBucket = Math.floor(Date.now() / 3600000);
        const ipRateKey = `tp:404_rate:${ipHash}:${hourBucket}`;
        let ipCount = 0;
        try {
          ipCount = await redis.incr(ipRateKey);
          if (ipCount === 1) await redis.expire(ipRateKey, 3700);
        } catch (e) { /* fail open */ }
        if (ipCount > 20) return res.status(200).json({ ok: true, skipped: "ip_rate" });

        const attempted = String(data.attempted || "").substring(0, 240);
        const referrer = String(data.referrer || "").substring(0, 240);
        const matchedVertical = data.matchedVertical ? String(data.matchedVertical).substring(0, 30) : null;
        const matchConfidence = Number(data.matchConfidence) || 0;
        const gapType = data.gapType ? String(data.gapType).substring(0, 60) : null;

        const geo = getGeo(req);
        await redis.lpush("tp:404_log", JSON.stringify({
          attempted, referrer, matchedVertical, matchConfidence, gapType,
          ipHash, device, browser, city: geo.city, region: geo.region, country: geo.country,
          ts: Date.now()
        }));
        await redis.ltrim("tp:404_log", 0, 4999);

        return res.status(200).json({ ok: true });
      }

      if (type === "js_error") {
        if (await gate(req, res, 1)) return;
        // Real-user error capture with 3 hard guards on Vercel cost:
        //   1. Daily global cap (5000 errors stored/day)
        //   2. Per-IP rate limit (10 errors/hour)
        //   3. Bot UA filter (drop, don't store)
        // Worst-case spend: ~0.75 GB-hr/month vs 1000 GB-hr Pro budget.
        const botName = detectBot(ua);
        if (botName) return res.status(200).json({ ok: true, skipped: "bot" });

        const todayStr = new Date().toISOString().substring(0, 10);
        const dayKey = `tp:js_error_count:${todayStr}`;
        let dailyCount = 0;
        try {
          dailyCount = await redis.incr(dayKey);
          if (dailyCount === 1) await redis.expire(dayKey, 26 * 3600);
        } catch (e) { /* fail open */ }
        if (dailyCount > 5000) return res.status(200).json({ ok: true, skipped: "daily_cap" });

        const hourBucket = Math.floor(Date.now() / 3600000);
        const ipRateKey = `tp:js_error_rate:${ipHash}:${hourBucket}`;
        let ipCount = 0;
        try {
          ipCount = await redis.incr(ipRateKey);
          if (ipCount === 1) await redis.expire(ipRateKey, 3700);
        } catch (e) { /* fail open */ }
        if (ipCount > 10) return res.status(200).json({ ok: true, skipped: "ip_rate" });

        const message = String(data.message || "").substring(0, 240);
        const source  = String(data.source || "").substring(0, 200);
        const lineno  = Number(data.lineno) || 0;
        const colno   = Number(data.colno) || 0;
        const stack   = String(data.stack || "").substring(0, 1000);
        const path    = String(data.path || "/").substring(0, 200);
        const errTitle = String(data.title || "").substring(0, 120);

        // Short stable hash for dedupe (no crypto import needed)
        const hashSource = message + "|" + source + ":" + lineno;
        let h = 5381;
        for (let i = 0; i < hashSource.length; i++) h = ((h << 5) + h + hashSource.charCodeAt(i)) | 0;
        const errHash = "e" + Math.abs(h).toString(36);

        const geo = getGeo(req);
        await redis.lpush("tp:js_errors", JSON.stringify({
          message, source, lineno, colno, stack, path, title: errTitle,
          ipHash, device, browser, city: geo.city, region: geo.region, country: geo.country,
          hash: errHash, ts: Date.now()
        }));
        await redis.ltrim("tp:js_errors", 0, 4999);

        // First-sighting email (7-day seen TTL, with daily email cap)
        let emailStatus = "not_new";
        let isNew = false;
        try {
          const seenKey = `tp:js_error_seen:${errHash}`;
          const setRes = await redis.set(seenKey, todayStr, { nx: true, ex: 7 * 24 * 3600 });
          isNew = setRes === "OK" || setRes === true;
        } catch (e) { /* fail open */ }

        if (isNew) {
          const emailDayKey = `tp:js_error_emails:${todayStr}`;
          let emailCount = 0;
          try {
            emailCount = await redis.incr(emailDayKey);
            if (emailCount === 1) await redis.expire(emailDayKey, 26 * 3600);
          } catch (e) { /* fail open */ }

          if (emailCount > 20) {
            emailStatus = "daily_email_cap";
          } else {
            const resendKey = process.env.RESEND_API_KEY;
            if (resendKey) {
              try {
                const escape = (s) => String(s).replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
                const r = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    from: "Woogoro Errors <noreply@woogoro.com>",
                    to: ["hello@woogoro.com"],
                    subject: `[Woogoro] New JS error: ${message.substring(0, 80)}`,
                    html: `<div style="font-family:sans-serif;max-width:760px;padding:20px;">
                      <h2 style="color:#b91c1c;margin:0 0 8px;">New JS error caught from a real user</h2>
                      <p style="color:#475569;font-size:13px;margin:0 0 16px;">First time this signature has been seen in 7 days. Subsequent occurrences are deduped silently.</p>
                      <table style="font-size:13px;color:#1e293b;border-collapse:collapse;width:100%;">
                        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Message</td><td style="padding:6px 0;font-family:monospace;">${escape(message)}</td></tr>
                        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Source</td><td style="padding:6px 0;font-family:monospace;font-size:12px;">${escape(source)}:${lineno}:${colno}</td></tr>
                        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Page</td><td style="padding:6px 0;"><a href="https://woogoro.com${escape(path)}">${escape(path)}</a></td></tr>
                        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Device</td><td style="padding:6px 0;">${device} / ${browser}</td></tr>
                        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Location</td><td style="padding:6px 0;">${escape(geo.city || "")} ${escape(geo.region || "")} ${escape(geo.country || "")}</td></tr>
                      </table>
                      ${stack ? `<pre style="margin-top:14px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:11px;overflow:auto;max-height:280px;white-space:pre-wrap;">${escape(stack)}</pre>` : ""}
                      <p style="color:#64748b;font-size:11px;margin-top:14px;">Hash: ${errHash} · Daily error volume: ${dailyCount}/5000 · IP-hour: ${ipCount}/10 · Email day: ${emailCount}/20</p>
                    </div>`
                  })
                });
                emailStatus = r.ok ? "sent" : ("resend_error_" + r.status);
              } catch (e) {
                emailStatus = "exception";
                console.error("[js_error] email failed:", e.message);
              }
            } else {
              emailStatus = "no_api_key";
            }
          }
        }

        return res.status(200).json({ ok: true, isNew, emailStatus });
      }

      if (type === "event") {
        if (await gate(req, res, 1)) return;
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
        if (await gate(req, res, 1)) return;
        const ua = req.headers["user-agent"] || "";
        const botName = detectBot(ua);
        const path = String(data.path || "/").substring(0, 200).trim();
        const geo = getGeo(req);
        const dcCity = isDataCenterCity(geo.city);

        const highVolume = isHighVolumeIp(ipHash);

        if (botName || dcCity || highVolume) {
          // Route to crawls instead of pageviews
          await redis.lpush("tp:crawls", JSON.stringify({
            bot: botName || (dcCity ? "DC:" + (geo.city || "unknown") : "HV:" + ipHash),
            path, ts: Date.now()
          })).catch(() => {});
          await redis.ltrim("tp:crawls", 0, 5000).catch(() => {});
        } else {
          const referrer = String(data.referrer || "").substring(0, 500).trim();
          let refHost = "direct";
          try { if (referrer) refHost = new URL(referrer).hostname; } catch(e) {}
          await redis.lpush("tp:pageviews", JSON.stringify({
            path, referrer: refHost, title: String(data.title || "").substring(0, 200).trim(),
            device, browser, ipHash, city: geo.city, region: geo.region, country: geo.country,
            ts: Date.now()
          }));
          await redis.ltrim("tp:pageviews", 0, MAX_ENTRIES - 1);
        }
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
      if (await gate(req, res, 1)) return;
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

    // Public counter - total real quotes across all sources and verticals
    if (req.query.counter === "1") {
      await track();  // Tier 4: count but never gate (homepage hero number)
      try {
        // tp:total_quotes is incremented by the calibration API on every quote POST
        const totalQuotes = (await redis.get("tp:total_quotes")) || 0;

        // Also count analysis events from the analyzer UI (user-submitted quotes)
        const rawEvents = await redis.lrange("tp:events", 0, -1);
        const analysisCount = rawEvents.filter(e => {
          const ev = typeof e === "string" ? JSON.parse(e) : e;
          return ev.event === "analysis_completed" || ev.event === "estimate_completed" || ev.event === "quote_uploaded";
        }).length;

        return res.status(200).json({ count: Number(totalQuotes) + analysisCount });
      } catch (e) {
        return res.status(200).json({ count: 0 });
      }
    }

    // Admin: set the global quote counter directly
    if (req.query.initCounter === "1") {
      const adminKey = req.query.key || "";
      if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: "Unauthorized" });
      try {
        // value=N writes the counter to N (incl. 0 for reset). Omit value=
        // to read the current count without writing. Pre-fix the gate was
        // setValue > 0, which silently dropped value=0 to a read — the
        // counter-honest reset memo's curl was a no-op for that reason.
        const hasValue = req.query.value !== undefined && req.query.value !== "";
        if (hasValue) {
          const setValue = parseInt(req.query.value, 10);
          if (!Number.isFinite(setValue) || setValue < 0) {
            return res.status(400).json({ error: "value must be a non-negative integer" });
          }
          await redis.set("tp:total_quotes", setValue);
          return res.status(200).json({ ok: true, totalQuotes: setValue });
        }
        const current = (await redis.get("tp:total_quotes")) || 0;
        return res.status(200).json({ ok: true, totalQuotes: Number(current) });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // Admin: peek at recent raw pageviews (for identifying a specific visitor).
    if (req.query.recentPageviews) {
      const adminKey = req.query.key || "";
      if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: "Unauthorized" });
      try {
        const n = Math.min(parseInt(req.query.recentPageviews) || 20, 200);
        const raw = await redis.lrange("tp:pageviews", 0, n - 1);
        const match = String(req.query.pathMatch || "").toLowerCase();
        const rows = raw.map(r => typeof r === "string" ? JSON.parse(r) : r)
          .filter(pv => !match || (pv.path || "").toLowerCase().includes(match))
          .map(pv => ({
            ts: pv.ts, time: new Date(pv.ts).toISOString(),
            path: pv.path, ipHash: pv.ipHash,
            city: pv.city, region: pv.region, country: pv.country,
            device: pv.device, browser: pv.browser, referrer: pv.referrer
          }));
        return res.status(200).json({ ok: true, count: rows.length, rows });
      } catch (e) {
        return res.status(500).json({ error: "peek failed", message: e && e.message });
      }
    }

    // Admin: purge pageviews by city (comma-separated, case-insensitive).
    // One-off cleanup after tightening the DATA_CENTER_CITIES list.
    if (req.query.purgeCities) {
      const adminKey = req.query.key || "";
      if (adminKey !== ADMIN_KEY) return res.status(403).json({ error: "Unauthorized" });
      try {
        const targets = new Set(
          String(req.query.purgeCities).split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
        );
        const raw = await redis.lrange("tp:pageviews", 0, -1);
        const before = raw.length;
        const kept = [];
        let removed = 0;
        const removedSamples = [];
        for (const r of raw) {
          const obj = typeof r === "string" ? JSON.parse(r) : r;
          const city = (obj.city || "").toLowerCase();
          if (targets.has(city)) {
            removed++;
            if (removedSamples.length < 5) removedSamples.push({ city: obj.city, path: obj.path, ts: obj.ts });
          } else {
            kept.push(typeof r === "string" ? r : JSON.stringify(obj));
          }
        }
        if (removed === 0) {
          return res.status(200).json({ ok: true, before, removed: 0, after: before, note: "no matching cities found" });
        }
        await redis.del("tp:pageviews");
        // lrange returned newest→oldest; rpush in that order preserves index 0 = newest (matches lpush writer semantics)
        const CHUNK = 500;
        for (let i = 0; i < kept.length; i += CHUNK) {
          await redis.rpush("tp:pageviews", ...kept.slice(i, i + CHUNK));
        }
        return res.status(200).json({ ok: true, before, removed, after: kept.length, targets: [...targets], removedSamples });
      } catch (e) {
        return res.status(500).json({ error: "purge failed", message: e && e.message });
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
      const rawFeedback = await redis.lrange("tp:feedback", 0, 100);
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

      // Daily unique visitors (for trend + average)
      const dailyUniqueMap = {};
      filtered.forEach(pv => {
        const d = new Date(pv.ts).toISOString().substring(0, 10);
        if (!dailyUniqueMap[d]) dailyUniqueMap[d] = new Set();
        dailyUniqueMap[d].add(pv.ipHash);
      });
      const dailyUniques = Object.entries(dailyUniqueMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, set]) => ({ date, uniques: set.size }));
      const rangeDays = range === "1h" ? (1 / 24)
        : range === "24h" ? 1
        : range === "7d" ? 7
        : range === "30d" ? 30 : 1;
      const avgVisitorsPerDay = rangeDays > 0
        ? Math.round((dailyUniques.reduce((s, d) => s + d.uniques, 0) / rangeDays) * 10) / 10
        : 0;

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
        device: ev.device, time: (() => { const n = Number(ev.ts); return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null; })()
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

      // Feedback
      const allFeedback = rawFeedback.map(r => typeof r === "string" ? JSON.parse(r) : r);
      const safeIso = (ts) => {
        const n = Number(ts);
        if (!Number.isFinite(n) || n <= 0) return null;
        try { return new Date(n).toISOString(); } catch { return null; }
      };
      const recentFeedback = allFeedback.slice(0, 50).map(f => ({
        rating: f.rating, comment: f.comment, page: f.page,
        city: f.city, region: f.region, device: f.device,
        time: safeIso(f.ts)
      }));
      const feedbackYes = allFeedback.filter(f => f.rating === "yes").length;
      const feedbackNo = allFeedback.filter(f => f.rating === "no").length;

      // Total quotes across all sources (calibration + analysis events)
      let totalQuotesAllSources = 0;
      try {
        const tq = (await redis.get("tp:total_quotes")) || 0;
        const userAnalyses = allEvents.filter(ev =>
          ev.event === "analysis_completed" || ev.event === "estimate_completed" || ev.event === "quote_uploaded"
        ).length;
        totalQuotesAllSources = Number(tq) + userAnalyses;
      } catch(e2) {}

      return res.status(200).json({
        range, totalViews, uniqueVisitors, avgVisitorsPerDay, dailyUniques, totalStored: allViews.length,
        topPages, topReferrers, directTraffic: directCount,
        devices, browsers, hourly,
        totalEvents: filteredEvents.length, topEvents, recentEvents,
        funnel, topCities, topRegions,
        totalCrawls: filteredCrawls.length, topBots, recentCrawls,
        feedbackYes, feedbackNo, totalFeedback: allFeedback.length, recentFeedback,
        totalQuotesAllSources
      });
    } catch (e) {
      console.error("Analytics GET error:", e);
      return res.status(500).json({ error: "Failed to load analytics" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
