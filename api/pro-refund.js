// /api/pro-refund.js
//
// POST { token } -> self-service refund for a Pro purchase, if eligible.
//
// Eligibility (see api/_pro.js getRefundEligibility):
//   - 1-hour cooling-off window: always eligible regardless of view state
//   - Within 7 days AND firstViewedAt is null: eligible
//   - Otherwise: not eligible (UI should fall back to "email hello@woogoro.com")
//
// On eligible request:
//   1. Look up the Pro state -> sessionId
//   2. Resolve sessionId -> Stripe payment_intent
//   3. Call stripe.refunds.create({ payment_intent }) for the full amount
//   4. Stripe fires charge.refunded webhook which calls revokePro automatically
//
// Returns 200 always (never 5xx for security — UI distinguishes via .ok and .reason).
//
// Reasons returned:
//   "refunded"           - Stripe refund created successfully (revoke happens via webhook)
//   "already_refunded"   - state.refunded was already true
//   "already_viewed"     - past cooling-off and firstViewedAt is set
//   "window_expired"     - past 7 days
//   "cooling_off" / "unviewed_in_window" - eligible (returned only on success path)
//   "no_active_pro"      - no live Pro state for this token
//   "invalid_token"      - token failed format check
//   "stripe_error"       - Stripe API call failed
//
// Status check after refund: clients should re-poll /api/pro-status which will
// return isPro:false once the webhook has run (typically within a few seconds).

import { Redis } from "@upstash/redis";
import {
  isValidProToken,
  getProState,
  getRefundEligibility,
  getStripe,
  PRO_KEY_PREFIX,
} from "./_pro.js";

const redis = Redis.fromEnv();

function parseRedisJson(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const token = body && body.token;

  if (!isValidProToken(token)) {
    return res.status(200).json({ ok: false, reason: "invalid_token" });
  }

  // Read raw state (not getProState — we need refunded/firstViewedAt fields)
  let state;
  try {
    const raw = await redis.get(PRO_KEY_PREFIX + token);
    state = parseRedisJson(raw);
  } catch (e) {
    console.error("[pro-refund] redis read failed:", e && e.message);
    return res.status(200).json({ ok: false, reason: "redis_error" });
  }

  if (!state) {
    return res.status(200).json({ ok: false, reason: "no_active_pro" });
  }
  if (state.refunded) {
    return res.status(200).json({ ok: false, reason: "already_refunded" });
  }

  const eligibility = getRefundEligibility(state);
  if (!eligibility.eligible) {
    return res.status(200).json({ ok: false, reason: eligibility.reason });
  }

  // Eligible. Resolve sessionId -> payment_intent and create the refund.
  let stripe;
  try {
    stripe = await getStripe();
  } catch (e) {
    console.error("[pro-refund] stripe init failed:", e && e.message);
    return res.status(200).json({ ok: false, reason: "stripe_not_configured" });
  }

  let paymentIntentId = null;
  try {
    const session = await stripe.checkout.sessions.retrieve(state.sessionId);
    paymentIntentId = session && session.payment_intent;
  } catch (e) {
    console.error("[pro-refund] session retrieve failed:", e && e.message);
    return res.status(200).json({ ok: false, reason: "stripe_error", detail: "session_retrieve" });
  }

  if (!paymentIntentId) {
    return res.status(200).json({ ok: false, reason: "stripe_error", detail: "no_payment_intent" });
  }

  try {
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
      metadata: {
        token,
        eligibility_reason: eligibility.reason,
      },
    });
  } catch (e) {
    console.error("[pro-refund] refund create failed:", e && e.message);
    return res.status(200).json({ ok: false, reason: "stripe_error", detail: e.message });
  }

  // Pro will be revoked when the charge.refunded webhook fires (api/pro-webhook.js).
  // We don't pre-revoke here to keep refund -> revoke as a single source of truth.
  return res.status(200).json({ ok: true, reason: "refunded" });
}
