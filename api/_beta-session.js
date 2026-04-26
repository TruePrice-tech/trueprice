// /api/_beta-session.js
//
// Shared helpers for the Woogoros beta shadow build.
//
// Responsibilities:
//   - Hash emails consistently (sha256 of lowercased + trimmed)
//   - Issue + verify magic-link tokens (single-use, 15 min TTL)
//   - Issue + verify session cookies (HttpOnly, 30 day TTL)
//   - Resolve req -> user record + beta gate check
//   - Provision new user records on first magic-link consumption
//
// All Redis keys are namespaced "wg:" (Woogoros) to keep separation
// from the existing "tp:" (legacy email capture) namespace and
// avoid any collision with legacy data.
//
// Beta gate is intentionally a single boolean on the user record so
// we can flip access on/off per-account without code changes. New
// users default to isBeta=false; an admin endpoint promotes them.

import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

const MAGIC_TTL_SECONDS = 15 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const SESSION_COOKIE_NAME = "wg_session";

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  if (email.length > 254) return false;
  return EMAIL_RE.test(email.trim());
}

export function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

export function hashEmail(email) {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function newUserId() {
  // Short, URL-safe, unambiguous. Collision risk negligible at our scale.
  return "u_" + crypto.randomBytes(9).toString("base64url");
}

export function nowMs() {
  return Date.now();
}

// -- User records ---------------------------------------------------------

export async function getUserById(userId) {
  if (!userId) return null;
  const raw = await redis.get(`wg:user:${userId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function getUserByEmail(email) {
  const eh = hashEmail(email);
  const userId = await redis.get(`wg:user_by_email:${eh}`);
  if (!userId) return null;
  return getUserById(userId);
}

export async function ensureUserRecord(email) {
  const eh = hashEmail(email);
  const existingId = await redis.get(`wg:user_by_email:${eh}`);
  if (existingId) {
    const existing = await getUserById(existingId);
    if (existing) return existing;
  }

  const user = {
    userId: newUserId(),
    email: normalizeEmail(email),
    emailHash: eh,
    isBeta: false,
    ageVerified: false,
    createdAt: nowMs(),
    lastSeen: nowMs(),
  };

  await redis.set(`wg:user:${user.userId}`, JSON.stringify(user));
  await redis.set(`wg:user_by_email:${eh}`, user.userId);
  await redis.sadd("wg:user_index", user.userId);

  // Initialize empty burrow on first sight so reads always succeed.
  // Balance is NOT stored here; `wg:balance:{userId}` is the counter
  // (INCRBY-able). Burrow blob holds the slow-changing collection state.
  await redis.set(`wg:burrow:${user.userId}`, JSON.stringify({
    userId: user.userId,
    collectedWoogoros: [],
    receiptWoogoros: [],
    streakDays: 0,
    lastStreakDate: null,
    createdAt: nowMs(),
    updatedAt: nowMs(),
  }));
  await redis.set(`wg:balance:${user.userId}`, 0);

  return user;
}

export async function updateUser(userId, patch) {
  const existing = await getUserById(userId);
  if (!existing) return null;
  const merged = { ...existing, ...patch, lastSeen: nowMs() };
  await redis.set(`wg:user:${userId}`, JSON.stringify(merged));
  return merged;
}

// -- Magic links ----------------------------------------------------------
//
// Token is opaque random bytes; lookup-only (not HMAC-signed) because the
// Redis row IS the source of truth and gets deleted on consumption. This
// means a leaked token in transit is single-use and expires in 15 min.

export async function issueMagicLink(email, opts = {}) {
  const token = randomHex(24); // 48 hex chars
  const payload = {
    email: normalizeEmail(email),
    ageVerified: !!opts.ageVerified,
    createdAt: nowMs(),
    ip: opts.ip || null,
  };
  await redis.set(`wg:magic:${token}`, JSON.stringify(payload), { ex: MAGIC_TTL_SECONDS });
  return { token, ttlSeconds: MAGIC_TTL_SECONDS };
}

export async function consumeMagicLink(token) {
  if (!token || !/^[0-9a-f]{48}$/.test(token)) return null;
  const raw = await redis.get(`wg:magic:${token}`);
  if (!raw) return null;
  // Single-use: delete before returning so a replay can't succeed.
  await redis.del(`wg:magic:${token}`);
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

// -- Sessions -------------------------------------------------------------

export async function createSession(userId) {
  const token = randomHex(32); // 64 hex chars
  const payload = {
    userId,
    createdAt: nowMs(),
    expiresAt: nowMs() + SESSION_TTL_SECONDS * 1000,
  };
  await redis.set(`wg:session:${token}`, JSON.stringify(payload), { ex: SESSION_TTL_SECONDS });
  return { token, ttlSeconds: SESSION_TTL_SECONDS };
}

export async function destroySession(token) {
  if (!token) return;
  await redis.del(`wg:session:${token}`);
}

export function readSessionCookie(req) {
  const raw = req.headers && req.headers.cookie;
  if (!raw) return null;
  const parts = raw.split(";");
  for (let i = 0; i < parts.length; i++) {
    const eq = parts[i].indexOf("=");
    if (eq < 0) continue;
    const k = parts[i].slice(0, eq).trim();
    if (k === SESSION_COOKIE_NAME) {
      const v = parts[i].slice(eq + 1).trim();
      return decodeURIComponent(v);
    }
  }
  return null;
}

export function buildSessionCookie(token, opts = {}) {
  const maxAge = opts.maxAge != null ? opts.maxAge : SESSION_TTL_SECONDS;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  // In production we are always behind https on woogoro.com.
  if (!opts.insecure) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearSessionCookie() {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
  ].join("; ");
}

export async function resolveUserFromRequest(req) {
  const token = readSessionCookie(req);
  if (!token) return null;
  const raw = await redis.get(`wg:session:${token}`);
  if (!raw) return null;
  const session = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!session || !session.userId) return null;
  if (session.expiresAt && session.expiresAt < nowMs()) return null;
  const user = await getUserById(session.userId);
  if (!user) return null;
  // Sliding "lastSeen" without a write storm: only touch every 6h.
  if (!user.lastSeen || (nowMs() - user.lastSeen) > 6 * 3600 * 1000) {
    await updateUser(user.userId, {});
  }
  return { user, sessionToken: token };
}

// Strict beta gate. Returns the user if allowed, else null.
// Callers decide how to respond (403 JSON vs 302 redirect).
export async function requireBetaUser(req) {
  const ctx = await resolveUserFromRequest(req);
  if (!ctx) return null;
  if (!ctx.user.isBeta) return null;
  return ctx;
}

// -- IP + rate limiting helpers ------------------------------------------

export function getIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    (req.headers["x-forwarded-for"] || "").split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    "unknown"
  );
}

export function todayUtc() {
  return new Date().toISOString().substring(0, 10);
}

export async function bumpDailyCounter(key, max, ttlSeconds) {
  try {
    const c = await redis.incr(key);
    if (c === 1) await redis.expire(key, ttlSeconds);
    return { ok: c <= max, count: c };
  } catch (e) {
    // Fail open: rate limit failure should not lock people out.
    return { ok: true, count: 0 };
  }
}

// -- Beta invite tokens (admin-issued) -----------------------------------

export async function issueBetaInvite() {
  const token = randomHex(8); // 16 hex chars; short enough to type if needed
  await redis.set(`wg:beta_invite:${token}`, JSON.stringify({
    createdAt: nowMs(),
    consumed: false,
  }), { ex: 30 * 24 * 60 * 60 });
  return token;
}

export async function consumeBetaInvite(token) {
  if (!token || !/^[0-9a-f]{16}$/.test(token)) return false;
  const raw = await redis.get(`wg:beta_invite:${token}`);
  if (!raw) return false;
  const inv = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (inv.consumed) return false;
  inv.consumed = true;
  inv.consumedAt = nowMs();
  await redis.set(`wg:beta_invite:${token}`, JSON.stringify(inv), { ex: 90 * 24 * 60 * 60 });
  return true;
}

export const constants = {
  MAGIC_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  SESSION_COOKIE_NAME,
};

// -- Burrow mutators (collect Woogoro, bump streak) -----------------------
//
// These read-modify-write the burrow JSON. Race-prone in the strict
// sense: two near-simultaneous submissions could clobber each other.
// At our scale (single user submitting one form at a time) this is
// acceptable. If we ever fan out submissions we'd switch to atomic
// Redis ops on individual fields.

export async function getBurrow(userId) {
  const raw = await redis.get(`wg:burrow:${userId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function collectWoogoro(userId, vertical) {
  const burrow = (await getBurrow(userId)) || {
    userId,
    collectedWoogoros: [],
    streakDays: 0,
    lastStreakDate: null,
    createdAt: nowMs(),
  };
  const list = burrow.collectedWoogoros || [];
  const alreadyHas = list.includes(vertical);
  if (!alreadyHas) list.push(vertical);
  burrow.collectedWoogoros = list;
  burrow.updatedAt = nowMs();
  await redis.set(`wg:burrow:${userId}`, JSON.stringify(burrow));
  return { burrow, newCollection: !alreadyHas };
}

// Receipt Woogoros are a separate class from the collectible vertical
// Woogoros: they are the redemption unit (cash-in for Woo Cash / merch /
// future gift cards). User can keep them or cash them in; once cashed
// in they are gone. Append-only at insertion time, mutated in place
// only when redeemed.
//
// Entry shape:
//   {
//     id: "rw_<random>",
//     tier: "bronze"|"silver"|"gold"|"platinum",
//     vertical: <string>,
//     submissionId: <string, backlink to wg:submission>,
//     declaredAmount: <number>,
//     wooAmount: <number, granted at issue>,
//     capturedAt: <ms>,
//     redeemed: false,
//     redeemedAt: null,
//     redeemedFor: null,        // e.g. "merch:tee_xxx" / "giftcard:home_depot_50"
//     redeemLedgerId: null,     // backlink to spend ledger entry
//   }

export async function addReceiptWoogoro(userId, fields) {
  const burrow = (await getBurrow(userId)) || {
    userId,
    collectedWoogoros: [],
    receiptWoogoros: [],
    streakDays: 0,
    lastStreakDate: null,
    createdAt: nowMs(),
  };
  if (!Array.isArray(burrow.receiptWoogoros)) burrow.receiptWoogoros = [];

  const entry = {
    id: "rw_" + crypto.randomBytes(9).toString("base64url"),
    tier: String(fields.tier || "bronze"),
    vertical: String(fields.vertical || ""),
    submissionId: String(fields.submissionId || ""),
    declaredAmount: Number(fields.declaredAmount) || 0,
    wooAmount: Number(fields.wooAmount) || 0,
    capturedAt: nowMs(),
    redeemed: false,
    redeemedAt: null,
    redeemedFor: null,
    redeemLedgerId: null,
  };
  burrow.receiptWoogoros.push(entry);
  burrow.updatedAt = nowMs();
  await redis.set(`wg:burrow:${userId}`, JSON.stringify(burrow));
  return { burrow, entry };
}

export async function markReceiptWoogoroRedeemed(userId, receiptWoogoroId, redeemedFor, redeemLedgerId) {
  const burrow = await getBurrow(userId);
  if (!burrow || !Array.isArray(burrow.receiptWoogoros)) {
    return { ok: false, reason: "no_burrow" };
  }
  const rw = burrow.receiptWoogoros.find((x) => x.id === receiptWoogoroId);
  if (!rw) return { ok: false, reason: "not_found" };
  if (rw.redeemed) return { ok: false, reason: "already_redeemed" };
  rw.redeemed = true;
  rw.redeemedAt = nowMs();
  rw.redeemedFor = String(redeemedFor || "");
  rw.redeemLedgerId = redeemLedgerId || null;
  burrow.updatedAt = nowMs();
  await redis.set(`wg:burrow:${userId}`, JSON.stringify(burrow));
  return { ok: true, entry: rw };
}

// Streak: increments when the user submits anything verified on a new
// UTC day. Drops to 1 if there was a gap of >1 day.
export async function bumpStreak(userId) {
  const burrow = (await getBurrow(userId)) || {
    userId,
    collectedWoogoros: [],
    streakDays: 0,
    lastStreakDate: null,
    createdAt: nowMs(),
  };
  const today = todayUtc();
  const last = burrow.lastStreakDate;

  let newStreak = burrow.streakDays || 0;
  if (last === today) {
    // Already counted today; no-op.
  } else {
    if (!last) {
      newStreak = 1;
    } else {
      // Compare dates as ms-since-epoch midnight.
      const lastMs = Date.parse(last + "T00:00:00Z");
      const todayMs = Date.parse(today + "T00:00:00Z");
      const dayGap = Math.round((todayMs - lastMs) / (24 * 3600 * 1000));
      if (dayGap === 1) newStreak = (newStreak || 0) + 1;
      else newStreak = 1; // gap reset
    }
    burrow.streakDays = newStreak;
    burrow.lastStreakDate = today;
    burrow.updatedAt = nowMs();
    await redis.set(`wg:burrow:${userId}`, JSON.stringify(burrow));
  }
  return { burrow, streakDays: burrow.streakDays };
}
