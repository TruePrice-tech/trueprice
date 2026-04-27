// /api/email-signup.js
//
// Opt-in email capture for price-change alerts. No sends wired yet —
// endpoint only accumulates a consent-recorded audience for future use.
//
// Consent record stored per CAN-SPAM + state privacy law requirements:
//   - email, city, state, service (what they opted in for)
//   - subscribedAt timestamp + opt-in IP (proof of affirmative act)
//   - unsubscribed flag + unsubscribe timestamp
//
// Suppression check is permanent: an unsubscribed email that re-signs up
// is silently no-op'd (returns success) unless they explicitly re-opt-in
// via a flow that clears suppression, which we do not offer yet.

import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { sendEmail } from "./_email-send.js";
import { welcomeTemplate } from "./_email-templates.js";

const redis = Redis.fromEnv();

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const IP_DAILY_MAX = 5;
const MAX_INTERESTS = 10;

function getIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    "unknown"
  );
}

function todayUtc() {
  return new Date().toISOString().substring(0, 10);
}

function hashEmail(email) {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

function signUnsubscribeToken(emailHash) {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.WOOGORO_HMAC_SECRET || "dev-secret-do-not-use-in-prod";
  return crypto.createHmac("sha256", secret).update(emailHash).digest("hex");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    const emailRaw = String(body.email || "").trim();
    const email = emailRaw.toLowerCase();
    const city = String(body.city || "").trim().slice(0, 60);
    const stateCode = String(body.stateCode || "").trim().toUpperCase().slice(0, 2);
    const service = String(body.service || "").trim().toLowerCase().slice(0, 40);
    const source = String(body.source || "result_page").trim().slice(0, 40);

    if (!email || email.length > 254 || !EMAIL_RE.test(emailRaw)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (!service) {
      return res.status(400).json({ error: "Missing service." });
    }

    const ip = getIp(req);

    try {
      const dayKey = `tp:email_signup_ip:${ip}:${todayUtc()}`;
      const dayCount = await redis.incr(dayKey);
      if (dayCount === 1) await redis.expire(dayKey, 26 * 3600);
      if (dayCount > IP_DAILY_MAX) {
        return res.status(429).json({ error: "Too many signups from your network today. Try again tomorrow." });
      }
    } catch (e) { /* fail open */ }

    const emailHash = hashEmail(email);

    try {
      const suppressed = await redis.get(`tp:email_suppression:${emailHash}`);
      if (suppressed) {
        return res.status(200).json({ success: true, suppressed: true });
      }
    } catch (e) { /* fall through */ }

    const now = Date.now();
    const interest = { city, stateCode, service, source, subscribedAt: now, ip };

    let record;
    let isFirstSignup = false;
    try {
      const existing = await redis.get(`tp:email:${emailHash}`);
      isFirstSignup = !existing;
      record = existing
        ? (typeof existing === "string" ? JSON.parse(existing) : existing)
        : { email, interests: [], unsubscribed: false, createdAt: now };

      const dupe = (record.interests || []).find(
        (i) => i.service === service && i.city === city && i.stateCode === stateCode
      );
      if (dupe) {
        dupe.subscribedAt = now;
      } else {
        record.interests = record.interests || [];
        record.interests.push(interest);
        if (record.interests.length > MAX_INTERESTS) {
          record.interests = record.interests.slice(-MAX_INTERESTS);
        }
      }
      record.lastUpdated = now;

      await redis.set(`tp:email:${emailHash}`, JSON.stringify(record));
      await redis.sadd("tp:email_index", emailHash);
    } catch (e) {
      console.error("[email-signup] redis write error:", e && e.message);
      return res.status(500).json({ error: "Server error. Please try again." });
    }

    try {
      const dailyKey = `tp:email_signups_daily:${todayUtc()}`;
      const c = await redis.incr(dailyKey);
      if (c === 1) await redis.expire(dailyKey, 100 * 24 * 3600);
    } catch (e) { /* swallow */ }

    // Welcome email — only on first-ever signup for this address.
    // Best-effort: a send failure must not fail the signup.
    if (isFirstSignup) {
      try {
        const tpl = welcomeTemplate({ city, stateCode, service });
        const result = await sendEmail({
          to: email,
          subject: tpl.subject,
          html: tpl.html,
          emailHash,
          replyTo: "hello@woogoro.com",
          // Saved-watch account creation. § 7702(17)(C) administrative notice
          // about an account / ongoing relationship — transactional.
          purpose: "transactional",
        });
        if (!result.ok) {
          console.log(`[email-signup] welcome skipped (${result.reason}) for ${emailHash.slice(0, 8)}…`);
        }
      } catch (e) {
        console.error("[email-signup] welcome send threw:", e && e.message);
      }
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("[email-signup] handler error:", e && e.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}
