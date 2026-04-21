// /api/email-unsubscribe.js
//
// One-click unsubscribe. Verifies HMAC-signed token so a random actor
// can't enumerate and unsubscribe arbitrary hashes.
//
// Flow:
//   POST /api/email-unsubscribe?e=<emailHash>&t=<token>
//   or
//   GET  /api/email-unsubscribe?e=<emailHash>&t=<token>   (for one-click clients)
//
// emailHash: hex sha256 of lowercased email (same as stored key)
// token:     HMAC-SHA256(emailHash, secret)
//
// On success: marks record unsubscribed + writes permanent suppression entry.
// Suppression persists even if the primary record is later deleted.

import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

function signUnsubscribeToken(emailHash) {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.WOOGORO_HMAC_SECRET || "dev-secret-do-not-use-in-prod";
  return crypto.createHmac("sha256", secret).update(emailHash).digest("hex");
}

function timingSafeEqualHex(a, b) {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const src = req.method === "GET" ? (req.query || {}) : (
    typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || req.query || {})
  );

  const emailHash = String(src.e || "").trim().toLowerCase();
  const token = String(src.t || "").trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(emailHash) || !/^[0-9a-f]{64}$/.test(token)) {
    return res.status(400).json({ error: "Invalid unsubscribe link." });
  }

  const expected = signUnsubscribeToken(emailHash);
  if (!timingSafeEqualHex(token, expected)) {
    return res.status(400).json({ error: "Invalid unsubscribe link." });
  }

  try {
    await redis.set(`tp:email_suppression:${emailHash}`, String(Date.now()));

    const existing = await redis.get(`tp:email:${emailHash}`);
    if (existing) {
      const record = typeof existing === "string" ? JSON.parse(existing) : existing;
      record.unsubscribed = true;
      record.unsubscribedAt = Date.now();
      await redis.set(`tp:email:${emailHash}`, JSON.stringify(record));
    }
  } catch (e) {
    console.error("[email-unsubscribe] redis error:", e && e.message);
    return res.status(500).json({ error: "Server error. Email privacy@woogoro.com to unsubscribe manually." });
  }

  return res.status(200).json({ success: true, unsubscribed: true });
}
