// /api/pricing-events-active
//
// Public read endpoint. Returns currently-active pricing events filtered by
// vertical (?vertical=hvac) and minimum severity (?minSeverity=2, default=2).
// Frontend banner JS calls this on every page load. No auth — read-only.
//
// Response shape:
//   { ok: true, events: [{ id, title, summary, severity, verticals, source, url, seenAt, validUntil }] }

import { Redis } from "@upstash/redis";
import { gate } from "./_usage-gate.js";

const redis = Redis.fromEnv();
const EVENT_PREFIX = "tp:price_event:";
const ACTIVE_KEY = "tp:price_event_active";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");

  const vertical = String(req.query.vertical || "").toLowerCase().trim();
  const minSeverity = Math.max(1, Math.min(3, Number(req.query.minSeverity) || 2));
  const limit = Math.max(1, Math.min(10, Number(req.query.limit) || 3));

  try {
    const ids = (await redis.smembers(ACTIVE_KEY)) || [];
    if (ids.length === 0) {
      if (await gate(req, res, 1)) return;
      return res.status(200).json({ ok: true, events: [] });
    }

    // Pre-scan for severity-3 active so we can bypass Tier 1 gating.
    let hasSev3 = false;
    const events = [];
    for (const id of ids) {
      const raw = await redis.get(EVENT_PREFIX + id);
      if (!raw) continue;
      const evt = typeof raw === "string" ? JSON.parse(raw) : raw;
      if ((Number(evt.severity) || 0) >= 3) hasSev3 = true;
      if ((Number(evt.severity) || 0) < minSeverity) continue;
      if (vertical) {
        const verts = Array.isArray(evt.verticals) ? evt.verticals : [];
        if (!verts.includes(vertical) && !verts.includes("any")) continue;
      }
      events.push(evt);
    }

    // Apply usage gate AFTER the sev3 pre-scan so a major-disruption banner
    // stays callable even at 99% throttle.
    if (await gate(req, res, 1, { bypass: hasSev3 })) return;

    // Sort: highest severity first, then most recent
    events.sort((a, b) => (Number(b.severity) - Number(a.severity)) ||
      ((Date.parse(b.seenAt) || 0) - (Date.parse(a.seenAt) || 0)));

    return res.status(200).json({ ok: true, events: events.slice(0, limit) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
