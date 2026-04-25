// /api/beta-interest.js
//
// Public-facing beta-interest signup. Distinct from /api/email-signup
// (that's the price-change alert list). This list is the closed-beta
// waitlist for the receipt-to-Woo product.
//
// POST { email, ageOk, source? }
//
// Behavior:
//   - Validates email + 18+ checkbox (gating same as login).
//   - Checks suppression (prior unsubscribe).
//   - Stores at wg:interest:{emailHash} with timestamp + source + ip.
//   - Indexed in wg:interest_index for admin enumeration.
//   - Daily counter wg:interest_daily:{YYYY-MM-DD} for the dashboard.
//   - Fail-open on Redis errors (UI shouldn't break for capture).
//
// Note: this does NOT auto-create a user record or grant beta access.
// It's a marketing list. Admin manually invites in batches via
// op:issue_invite + op:approve through beta-admin.

import { Redis } from "@upstash/redis";
import {
  isValidEmail,
  normalizeEmail,
  hashEmail,
  getIp,
  todayUtc,
  bumpDailyCounter,
} from "./_beta-session.js";

const redis = Redis.fromEnv();

const IP_DAILY_MAX = 5;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const emailRaw = String(body.email || "").trim();
  const ageOk = body.ageOk === true;
  const source = String(body.source || "homepage").slice(0, 40);

  if (!isValidEmail(emailRaw)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (!ageOk) {
    return res.status(400).json({ error: "Please confirm you are 18 or older." });
  }

  const ip = getIp(req);
  const ipGate = await bumpDailyCounter(`wg:rate:interest_ip:${ip}:${todayUtc()}`, IP_DAILY_MAX, 26 * 3600);
  if (!ipGate.ok) {
    return res.status(429).json({ error: "Too many signups from your network today." });
  }

  const email = normalizeEmail(emailRaw);
  const eh = hashEmail(email);

  // Honor existing unsubscribe suppression so a prior unsubscribed user
  // doesn't get re-added to the marketing list.
  try {
    const suppressed = await redis.get(`tp:email_suppression:${eh}`);
    if (suppressed) return res.status(200).json({ success: true, suppressed: true });
  } catch (e) { /* fall through */ }

  const now = Date.now();
  try {
    const existing = await redis.get(`wg:interest:${eh}`);
    let record;
    if (existing) {
      record = typeof existing === "string" ? JSON.parse(existing) : existing;
      record.lastSignup = now;
      record.signupCount = (record.signupCount || 1) + 1;
      // Track sources they've come from
      if (record.sources && !record.sources.includes(source)) record.sources.push(source);
      else if (!record.sources) record.sources = [source];
    } else {
      record = {
        email,
        firstSignup: now,
        lastSignup: now,
        signupCount: 1,
        sources: [source],
        ip,
      };
    }
    await redis.set(`wg:interest:${eh}`, JSON.stringify(record));
    await redis.sadd("wg:interest_index", eh);
  } catch (e) {
    console.error("[beta-interest] persist failed:", e && e.message);
    // Don't 500 -- a UX-blocking failure is worse than a missed capture.
    return res.status(200).json({ success: true, queued: false });
  }

  try {
    const k = `wg:interest_daily:${todayUtc()}`;
    const c = await redis.incr(k);
    if (c === 1) await redis.expire(k, 100 * 24 * 3600);
  } catch (e) { /* swallow */ }

  return res.status(200).json({ success: true });
}
