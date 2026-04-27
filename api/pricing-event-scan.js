// /api/pricing-event-scan
//
// Daily cron that watches free RSS / JSON feeds for material shortages,
// energy disruptions, supply-chain news, and weather events that move
// pricing. New items are classified by Claude Haiku into:
//   - verticals affected
//   - severity 1-3 (1 = informational, 3 = major disruption)
//   - one-line summary
//
// Positive classifications land in Redis at:
//   - tp:price_event:<id>          full record, 90-day TTL
//   - tp:price_event_active        set of currently-active event ids (no TTL,
//     pruned on each run by removing expired members)
//   - tp:price_event_seen:<url>    dedupe marker, 30-day TTL
//
// Severity-3 events trigger an immediate email to hello@woogoro.com.
// Frontend reads tp:price_event_active to render pricing-event banners on
// matching vertical pages (see js/pricing-event-banner.js).
//
// Cron schedule: 0 11 * * * (11:00 UTC daily, before drift checks).

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const EVENT_PREFIX = "tp:price_event:";
const ACTIVE_KEY = "tp:price_event_active";
const SEEN_PREFIX = "tp:price_event_seen:";
const EVENT_TTL = 90 * 24 * 60 * 60;
const SEEN_TTL = 30 * 24 * 60 * 60;
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;  // events older than 30d drop from active set

// Free, no-key feeds. Order = priority (first feeds processed first if budget shrinks).
const FEEDS = [
  { name: "BLS",    url: "https://www.bls.gov/feed/news_release.rss" },
  { name: "EIA",    url: "https://www.eia.gov/rss/todayinenergy.xml" },
  { name: "NOAA",   url: "https://www.spc.noaa.gov/products/spcwwrss.xml" },
  { name: "FedRes", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
];

const VERTICAL_TAXONOMY = [
  "hvac", "plumbing", "roofing", "electrical", "solar", "windows", "siding",
  "painting", "garage-doors", "fencing", "concrete", "landscaping",
  "foundation", "insulation", "gutters", "kitchen", "moving", "auto-repair",
  "medical", "legal", "any",
];

const MAX_ITEMS_PER_FEED = 8;
const TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Woogoro/1.0 (pricing-event-scan)" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

// Minimal RSS / Atom item extractor. Pulls <item> or <entry> blocks then
// extracts title, link, and pubDate via regex. Good enough for the four
// well-formed feeds above; do not point at hand-rolled junk RSS.
function parseFeed(xml) {
  const items = [];
  const itemRe = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[2];
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
    let link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || "";
    if (!link) {
      const linkAttr = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (linkAttr) link = linkAttr[1];
    }
    const date = (block.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || "";
    const desc = (block.match(/<(description|summary|content)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || "";
    items.push({
      title: stripCdata(title).trim(),
      link: stripCdata(link).trim(),
      date: stripCdata(date).trim(),
      summary: stripHtml(stripCdata(desc)).trim().slice(0, 600),
    });
  }
  return items;
}
function stripCdata(s) { return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"); }
function stripHtml(s)  { return String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); }

async function classifyWithClaude(items) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_api_key", classifications: [] };

  const system = `You classify news items for a US home-services pricing platform. For each item, decide if it describes a current or imminent disruption to US construction materials, home-services labor, energy prices, vehicle/auto parts, or weather damaging US property at scale. Respond ONLY with strict JSON: an array of objects, one per input item, in input order. Each object MUST have: id (echo input id), relevant (boolean), severity (1-3, omit if relevant=false), verticals (subset of [${VERTICAL_TAXONOMY.join(",")}], use "any" if economy-wide), summary (one sentence, omit if relevant=false), validUntil (ISO date guess when this stops mattering, omit if relevant=false). Severity 3 = major disruption (war, hurricane impact, named-shortage). Severity 2 = noteworthy regional event. Severity 1 = mild signal. Be conservative — false positives create banner noise.`;

  const user = JSON.stringify(items.map((it, i) => ({
    id: i,
    title: it.title,
    summary: it.summary,
    source: it.source,
    date: it.date,
  })));

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) return { ok: false, reason: "anthropic_" + r.status, classifications: [] };
  const data = await r.json();
  const text = (data.content?.[0]?.text || "").trim();
  // Salvage a JSON array even if the model wrapped output in prose
  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart === -1 || arrEnd === -1) return { ok: false, reason: "no_array", classifications: [] };
  let classifications;
  try {
    classifications = JSON.parse(text.slice(arrStart, arrEnd + 1));
  } catch (e) {
    return { ok: false, reason: "parse_error", classifications: [] };
  }
  return { ok: true, classifications };
}

function makeId(url) {
  // Stable short id from URL — last path segment + 8-char hash of full URL
  const tail = url.replace(/[^a-z0-9]/gi, "-").slice(-40);
  let h = 0;
  for (let i = 0; i < url.length; i++) h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  return tail + "-" + Math.abs(h).toString(36).slice(0, 8);
}

async function pruneActive() {
  const ids = (await redis.smembers(ACTIVE_KEY)) || [];
  const now = Date.now();
  const expired = [];
  for (const id of ids) {
    const evt = await redis.get(EVENT_PREFIX + id);
    if (!evt) {
      expired.push(id);
      continue;
    }
    const parsed = typeof evt === "string" ? JSON.parse(evt) : evt;
    const validUntilMs = parsed.validUntil ? Date.parse(parsed.validUntil) : null;
    const seenMs = Date.parse(parsed.seenAt || "") || 0;
    const ageOk = (now - seenMs) < ACTIVE_WINDOW_MS;
    const validOk = validUntilMs ? validUntilMs > now : true;
    if (!ageOk || !validOk) expired.push(id);
  }
  if (expired.length > 0) await redis.srem(ACTIVE_KEY, ...expired);
  return { kept: ids.length - expired.length, expired: expired.length };
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) return res.status(503).json({ error: "CRON_SECRET not configured" });
  if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized" });

  const today = new Date().toISOString().substring(0, 10);
  const fresh = [];
  const fetchErrors = [];

  // Step 1: pull feeds, dedupe vs seen-cache
  for (const feed of FEEDS) {
    let xml;
    try {
      xml = await fetchWithTimeout(feed.url);
    } catch (e) {
      fetchErrors.push({ feed: feed.name, error: e.message });
      continue;
    }
    const items = parseFeed(xml).slice(0, MAX_ITEMS_PER_FEED);
    for (const it of items) {
      if (!it.link || !it.title) continue;
      const seenKey = SEEN_PREFIX + it.link;
      const seen = await redis.get(seenKey);
      if (seen) continue;
      // Mark seen now so reruns within the day don't double-classify
      await redis.set(seenKey, today, { ex: SEEN_TTL });
      fresh.push({ ...it, source: feed.name });
    }
  }

  // Step 2: classify all fresh items in one Claude call (cheap + atomic)
  let classifyResult = { ok: true, classifications: [] };
  if (fresh.length > 0) {
    classifyResult = await classifyWithClaude(fresh);
  }

  // Step 3: persist relevant events, push to active set
  const stored = [];
  const severeEvents = [];
  if (classifyResult.ok) {
    for (const c of classifyResult.classifications) {
      const item = fresh[c.id];
      if (!item || !c.relevant) continue;
      const id = makeId(item.link);
      const record = {
        id,
        title: item.title,
        url: item.link,
        source: item.source,
        publishedDate: item.date,
        seenAt: new Date().toISOString(),
        severity: Number(c.severity) || 1,
        verticals: Array.isArray(c.verticals) ? c.verticals : ["any"],
        summary: String(c.summary || "").slice(0, 280),
        validUntil: c.validUntil || null,
      };
      await redis.set(EVENT_PREFIX + id, JSON.stringify(record), { ex: EVENT_TTL });
      await redis.sadd(ACTIVE_KEY, id);
      stored.push(record);
      if (record.severity >= 3) severeEvents.push(record);
    }
  }

  // Step 4: prune expired entries from active set
  const pruneStats = await pruneActive();

  // Step 5: alert on severe events
  let emailStatus = "no_severe";
  if (severeEvents.length > 0) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const rows = severeEvents.map((e) => `<tr>
        <td style="padding:8px 12px 8px 0;font-size:13px;font-weight:600;">${e.title}</td>
        <td style="padding:8px 12px 8px 0;font-size:11px;color:#475569;">${e.source}</td>
        <td style="padding:8px 12px 8px 0;font-size:11px;font-family:monospace;">${e.verticals.join(", ")}</td>
      </tr>
      <tr><td colspan="3" style="padding:0 0 12px;font-size:12px;color:#64748b;">${e.summary} <a href="${e.url}">link</a></td></tr>`).join("");
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Woogoro Events <noreply@woogoro.com>",
            to: ["hello@woogoro.com"],
            subject: `[Woogoro] ${severeEvents.length} severity-3 pricing event${severeEvents.length === 1 ? "" : "s"} — ${today}`,
            html: `<div style="font-family:sans-serif;max-width:760px;padding:20px;">
              <h2 style="color:#b91c1c;margin:0 0 8px;">Severity-3 pricing events — ${today}</h2>
              <p style="color:#475569;font-size:14px;margin:0 0 16px;">Major disruption signals detected. Active banner is live on affected vertical pages.</p>
              <table style="font-size:13px;border-collapse:collapse;width:100%;">${rows}</table>
            </div>`,
          }),
        });
        emailStatus = r.ok ? "sent" : ("resend_error_" + r.status);
      } catch (e) {
        emailStatus = "exception:" + e.message;
      }
    } else {
      emailStatus = "no_api_key";
    }
  }

  await redis.set("tp:cron_run:pricing-event-scan", new Date().toISOString());

  return res.status(200).json({
    ok: true,
    date: today,
    feedsFetched: FEEDS.length - fetchErrors.length,
    fetchErrors,
    fresh: fresh.length,
    classified: classifyResult.classifications.length,
    classifyOk: classifyResult.ok,
    classifyError: classifyResult.ok ? null : classifyResult.reason,
    stored: stored.length,
    severe: severeEvents.length,
    pruneStats,
    emailStatus,
    storedDetails: stored.slice(0, 10),
  });
}
