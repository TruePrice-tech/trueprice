// /api/_pro.js
//
// Shared helpers for the Pro tier ($19 one-time, 30-day site-wide access).
//
// Pro is granted via an anonymous browser token (managed client-side in
// localStorage; passed by the client to checkout / webhook / status
// endpoints). No email or account is required, preserving the
// "no email, no signup" promise for the paid path.
//
// Redis schema (all keys "tp:pro:" namespaced):
//   tp:pro:{token}                  -> JSON { expiresAt, sessionId, purchasedAt, firstViewedAt?, refunded? }
//                                      TTL set to expiration so expired records auto-clean.
//                                      firstViewedAt is set the first time js/pro-tier.js renders
//                                      Pro sections into a real analyzer report (not the success page).
//                                      Used as the "value consumed" signal for self-service refund eligibility.
//   tp:pro_session:{stripeSessionId} -> token  (reverse lookup for refund handling)
//   tp:pro_event:{stripeEventId}    -> "1"   (idempotency marker, 7 day TTL)
//
// Self-service refund policy:
//   - Eligible if firstViewedAt is null AND purchasedAt < 7 days ago (no Pro content viewed yet).
//   - Eligible if purchasedAt < 1 hour ago (cooling-off, even if viewed).
//   - Outside both windows: must email hello@woogoro.com for case-by-case review.
//
// Required env vars (see Vercel project settings):
//   STRIPE_SECRET_KEY        - sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET    - whsec_... from Stripe dashboard webhook config
//   STRIPE_PRO_PRICE_ID      - price_... for the $19 one-time Pro Report product
//
// Optional env vars:
//   PRO_TIER_DAYS            - default 30
//   PRO_PUBLIC_BASE_URL      - default derived from request Origin

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const PRO_TOKEN_RE = /^[a-f0-9]{32}$/i;
export const PRO_TIER_DAYS = Number(process.env.PRO_TIER_DAYS || 30);
export const PRO_KEY_PREFIX = "tp:pro:";
export const PRO_SESSION_PREFIX = "tp:pro_session:";
export const PRO_EVENT_PREFIX = "tp:pro_event:";
export const WEBHOOK_EVENT_TTL_SEC = 7 * 24 * 3600;

export function isValidProToken(token) {
  return typeof token === "string" && PRO_TOKEN_RE.test(token);
}

function nowMs() {
  return Date.now();
}

// Parse a Redis JSON value that might come back as a string or already-parsed object.
function parseRedisJson(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return raw;
}

// Read the current Pro state for a token. Returns null if no Pro purchase
// or if Pro has expired or been refunded.
export async function getProState(token) {
  if (!isValidProToken(token)) return null;
  try {
    const raw = await redis.get(PRO_KEY_PREFIX + token);
    const state = parseRedisJson(raw);
    if (!state) return null;
    if (state.refunded) return null;
    if (typeof state.expiresAt !== "number" || state.expiresAt <= nowMs()) return null;
    return state;
  } catch (e) {
    console.error("[_pro getProState] redis read failed:", e && e.message);
    return null;
  }
}

// Grant Pro access to a token for PRO_TIER_DAYS days from now.
// Idempotent: re-granting via the same Stripe session is a no-op (returns
// the existing state) so webhook retries can't double-extend access.
export async function grantPro({ token, sessionId, purchasedAt }) {
  if (!isValidProToken(token)) {
    throw new Error("invalid_token");
  }
  if (!sessionId || typeof sessionId !== "string") {
    throw new Error("missing_session_id");
  }

  const existingRaw = await redis.get(PRO_KEY_PREFIX + token);
  const existing = parseRedisJson(existingRaw);
  if (existing && existing.sessionId === sessionId && !existing.refunded) {
    // Already granted for this Stripe session. Idempotent return.
    return { state: existing, granted: false };
  }

  const purchased = Number(purchasedAt) || nowMs();
  const expiresAt = purchased + PRO_TIER_DAYS * 24 * 3600 * 1000;
  const state = { expiresAt, sessionId, purchasedAt: purchased };

  // TTL one day longer than expiry so the key is still queryable just-after
  // expiration for support / debugging without leaking access.
  const ttlSec = Math.ceil((expiresAt - nowMs()) / 1000) + 24 * 3600;

  await redis.set(PRO_KEY_PREFIX + token, JSON.stringify(state), { ex: ttlSec });
  await redis.set(PRO_SESSION_PREFIX + sessionId, token, { ex: ttlSec });

  return { state, granted: true };
}

// Revoke Pro access for a Stripe session (used by refund / dispute webhooks).
// We mark refunded:true rather than deleting so the record remains queryable
// for support. Status endpoint treats refunded as expired.
export async function revokePro({ sessionId, reason }) {
  if (!sessionId) return { revoked: false, reason: "no_session" };
  const token = await redis.get(PRO_SESSION_PREFIX + sessionId);
  if (!token || typeof token !== "string") {
    return { revoked: false, reason: "no_token_for_session" };
  }
  const raw = await redis.get(PRO_KEY_PREFIX + token);
  const state = parseRedisJson(raw);
  if (!state) return { revoked: false, reason: "no_state" };

  const updated = { ...state, refunded: true, refundReason: reason || "unspecified", refundedAt: nowMs() };
  // Keep the same TTL window as before by setting a 7-day TTL for support.
  await redis.set(PRO_KEY_PREFIX + token, JSON.stringify(updated), { ex: 7 * 24 * 3600 });
  return { revoked: true, token };
}

// Window definitions for self-service refund eligibility.
export const COOLING_OFF_MS = 60 * 60 * 1000;             // 1 hour
export const REFUND_WINDOW_IF_UNVIEWED_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Mark the first time a token has rendered Pro content into a real analyzer
// report (the "value consumed" signal). Idempotent: only writes if firstViewedAt
// is currently null. Returns { marked: true } on first call, { marked: false }
// on subsequent calls.
export async function markFirstView(token) {
  if (!isValidProToken(token)) return { marked: false, reason: "invalid_token" };
  const raw = await redis.get(PRO_KEY_PREFIX + token);
  const state = parseRedisJson(raw);
  if (!state || state.refunded) return { marked: false, reason: "no_active_pro" };
  if (state.firstViewedAt) return { marked: false, reason: "already_viewed" };

  const updated = { ...state, firstViewedAt: nowMs() };
  const ttlSec = Math.max(60, Math.ceil((state.expiresAt - nowMs()) / 1000) + 24 * 3600);
  await redis.set(PRO_KEY_PREFIX + token, JSON.stringify(updated), { ex: ttlSec });
  return { marked: true };
}

// Determine whether a Pro state is eligible for self-service refund.
// Returns { eligible: bool, reason: string }. Reasons are stable strings that
// the UI uses to decide what to show.
export function getRefundEligibility(state) {
  if (!state) return { eligible: false, reason: "no_active_pro" };
  if (state.refunded) return { eligible: false, reason: "already_refunded" };
  const purchasedAt = Number(state.purchasedAt) || 0;
  const ageMs = nowMs() - purchasedAt;
  if (ageMs < 0) return { eligible: false, reason: "future_purchase" };
  if (ageMs <= COOLING_OFF_MS) return { eligible: true, reason: "cooling_off" };
  if (state.firstViewedAt) return { eligible: false, reason: "already_viewed" };
  if (ageMs <= REFUND_WINDOW_IF_UNVIEWED_MS) return { eligible: true, reason: "unviewed_in_window" };
  return { eligible: false, reason: "window_expired" };
}

// Read-only check whether a Stripe event_id has already been processed.
// Used at the top of the webhook handler to short-circuit retries. We only
// mark events seen AFTER successful processing (markEventSeen) so retries
// after a transient failure get re-processed.
export async function isEventSeen(eventId) {
  if (!eventId) return false;
  try {
    const v = await redis.get(PRO_EVENT_PREFIX + eventId);
    return !!v;
  } catch (e) {
    // Fail open: a Redis read error should not block the webhook. Process
    // the event normally; idempotent ops in grantPro/revokePro keep us safe.
    return false;
  }
}

// Mark a Stripe event_id as processed so retries short-circuit. Call this
// AFTER successful processing only — calling it before risks losing the
// retry opportunity if processing fails.
export async function markEventSeen(eventId) {
  if (!eventId) return;
  try {
    await redis.set(PRO_EVENT_PREFIX + eventId, "1", { ex: WEBHOOK_EVENT_TTL_SEC });
  } catch (e) {
    console.error("[_pro markEventSeen] redis failed:", e && e.message);
    // Swallow: a missed mark just means the next Stripe retry re-processes
    // (which is safe because grantPro/revokePro are idempotent on sessionId).
  }
}

// Lazy Stripe SDK loader. The 'stripe' package is heavy; only import it in
// endpoints that need it (checkout, webhook). The status endpoint doesn't.
export async function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  const StripeMod = await import("stripe");
  const Stripe = StripeMod.default || StripeMod;
  return new Stripe(secret, { apiVersion: "2024-10-28.acacia" });
}
