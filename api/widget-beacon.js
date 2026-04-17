// Widget impression beacon. Records each load of the embeddable pricing
// widget so we can see which sites are embedding, in what cities, and for
// which verticals. No PII collected — only the embedding site's host,
// the city/state/service the widget loaded for, and a timestamp.
//
// Wire: navigator.sendBeacon('https://woogoro.com/api/widget-beacon', body)
// fires from widget/tp-widget.js after a successful render.

import { Redis } from "@upstash/redis";

let redis;
try { redis = Redis.fromEnv(); } catch (_) { redis = null; }

const MAX_LIST_LEN = 50000;
const VALID_SERVICES = new Set([
  "roofing", "hvac", "plumbing", "electrical", "windows", "siding",
  "painting", "solar", "garage-doors", "fencing", "concrete", "landscaping",
  "foundation", "kitchen", "insulation", "gutters", "auto-repair",
  "medical", "legal", "moving"
]);

function safeStr(v, max) {
  if (typeof v !== "string") return "";
  return v.substring(0, max).replace(/[^\w\-\.\: ]/g, "").trim();
}

function hostFromOrigin(origin) {
  if (!origin || typeof origin !== "string") return "";
  try {
    const u = new URL(origin);
    return u.hostname.toLowerCase().substring(0, 253);
  } catch (_) {
    return "";
  }
}

export default async function handler(req, res) {
  // Wildcard CORS — widget loads on third-party domains
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!redis) return res.status(204).end();

  try {
    let data = req.body;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (_) { data = {}; }
    }
    data = data || {};

    const service = safeStr(data.service, 30).toLowerCase();
    if (!VALID_SERVICES.has(service)) return res.status(204).end();

    const city = safeStr(data.city, 100).toLowerCase();
    const state = safeStr(data.state, 5).toUpperCase();
    const referer = req.headers.referer || req.headers.origin || "";
    const host = hostFromOrigin(referer);

    const entry = {
      host,
      city,
      state,
      service,
      ts: Date.now()
    };

    // Append to bounded list (newest first)
    await redis.lpush("tp:widget_impressions", JSON.stringify(entry));
    await redis.ltrim("tp:widget_impressions", 0, MAX_LIST_LEN - 1);

    // Lightweight per-host counter for fast lookups
    if (host) {
      await redis.hincrby("tp:widget_hosts", host, 1);
    }

    return res.status(204).end();
  } catch (_) {
    return res.status(204).end();
  }
}
