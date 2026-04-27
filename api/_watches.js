// /api/_watches.js
//
// Saved-watch storage helpers. A "watch" is an account-level record of a
// (city, state, vertical, threshold) tuple the user explicitly created. It's
// the carrier that lets every subscriber email qualify as transactional under
// CAN-SPAM § 7702(17)(C) — see feedback_email_transactional_framing memory.
//
// Redis keys (all "wg:" namespace, separate from legacy "tp:"):
//   wg:watches:{userId}                 JSON array of watches owned by user
//   wg:watch_idx:{state}:{vertical}     SET of userIds with at least one watch
//                                       on that (state, vertical) pair —
//                                       enables fast cron fan-out without
//                                       scanning every user
//   wg:watch_send:{userId}:{watchId}    7-day TTL marker. Existence means
//                                       a notification has already been sent
//                                       for this watch in the last 7 days;
//                                       trigger logic skips it.
//
// Watch object shape:
//   { id, vertical, city, state, threshold, addedAt }
//   - id: 8-char random hex
//   - vertical: lowercase slug ("hvac", "plumbing", etc.)
//   - city: display string ("Charlotte")
//   - state: 2-char uppercase ("NC")
//   - threshold: number in (0, 1) — fractional drift to trigger (default 0.05)
//   - addedAt: ms epoch

import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

const MAX_WATCHES_PER_USER = 20;
const SEND_RATE_LIMIT_SECONDS = 7 * 24 * 60 * 60;

// Canonical vertical list — must match match-engine + estimate API surface.
// Adding a vertical here without adding it to match-engine + cal:* aggregates
// will cause watches to silently never trigger.
export const SUPPORTED_VERTICALS = new Set([
  "hvac", "plumbing", "roofing", "electrical", "solar", "windows", "siding",
  "painting", "garage-doors", "fencing", "concrete", "landscaping",
  "foundation", "insulation", "gutters", "kitchen", "moving", "auto-repair",
  "medical", "legal",
]);

const STATE_RE = /^[A-Z]{2}$/;
const CITY_RE = /^[A-Za-z][A-Za-z .'\-]{1,60}$/;
const ID_RE = /^[a-f0-9]{8}$/;

export function newWatchId() {
  return crypto.randomBytes(4).toString("hex");
}

export function validateInput({ vertical, city, state, threshold }) {
  if (!vertical || !SUPPORTED_VERTICALS.has(String(vertical).toLowerCase())) {
    return { ok: false, reason: "invalid_vertical" };
  }
  const cityClean = String(city || "").trim();
  if (!CITY_RE.test(cityClean)) return { ok: false, reason: "invalid_city" };
  const stateClean = String(state || "").trim().toUpperCase();
  if (!STATE_RE.test(stateClean)) return { ok: false, reason: "invalid_state" };
  let thresholdClean = Number(threshold);
  if (!Number.isFinite(thresholdClean)) thresholdClean = 0.05;
  if (thresholdClean < 0.03 || thresholdClean > 0.5) {
    return { ok: false, reason: "invalid_threshold" };
  }
  return {
    ok: true,
    normalized: {
      vertical: String(vertical).toLowerCase(),
      city: cityClean,
      state: stateClean,
      threshold: Math.round(thresholdClean * 100) / 100,
    },
  };
}

export async function listWatches(userId) {
  if (!userId) return [];
  const raw = await redis.get(`wg:watches:${userId}`);
  if (!raw) return [];
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return Array.isArray(parsed) ? parsed : [];
}

export async function addWatch(userId, input) {
  const v = validateInput(input);
  if (!v.ok) return { ok: false, reason: v.reason };

  const current = await listWatches(userId);
  if (current.length >= MAX_WATCHES_PER_USER) {
    return { ok: false, reason: "too_many_watches" };
  }

  // Dedupe by (vertical, state, city)
  const dupKey = (w) => `${w.vertical}|${w.state}|${w.city.toLowerCase()}`;
  const existing = current.find((w) => dupKey(w) === dupKey(v.normalized));
  if (existing) return { ok: false, reason: "duplicate_watch", watch: existing };

  const watch = {
    id: newWatchId(),
    ...v.normalized,
    addedAt: Date.now(),
  };
  const updated = current.concat([watch]);
  await redis.set(`wg:watches:${userId}`, JSON.stringify(updated));
  await redis.sadd(`wg:watch_idx:${watch.state}:${watch.vertical}`, userId);
  return { ok: true, watch };
}

export async function removeWatch(userId, watchId) {
  if (!ID_RE.test(String(watchId || ""))) return { ok: false, reason: "invalid_id" };
  const current = await listWatches(userId);
  const target = current.find((w) => w.id === watchId);
  if (!target) return { ok: false, reason: "not_found" };

  const remaining = current.filter((w) => w.id !== watchId);
  await redis.set(`wg:watches:${userId}`, JSON.stringify(remaining));

  // Remove from reverse index only if user has no other watches on the same
  // (state, vertical) pair.
  const stillCovers = remaining.some(
    (w) => w.state === target.state && w.vertical === target.vertical
  );
  if (!stillCovers) {
    await redis.srem(`wg:watch_idx:${target.state}:${target.vertical}`, userId);
  }

  // Best-effort: clear the rate-limit marker for this watch so the user can
  // re-add and immediately get a notification if applicable.
  await redis.del(`wg:watch_send:${userId}:${watchId}`).catch(() => {});

  return { ok: true, removed: target };
}

// Used by the drift-trigger cron to find users with matching watches.
export async function findUsersForVerticalState(state, vertical) {
  const ids = await redis.smembers(`wg:watch_idx:${state}:${vertical}`);
  return Array.isArray(ids) ? ids : [];
}

// Returns true if a send is allowed (no recent send marker) and atomically
// claims the 7-day window. Skip-on-false is the intended use.
export async function claimSendSlot(userId, watchId) {
  const key = `wg:watch_send:${userId}:${watchId}`;
  // SETNX with TTL: returns null if key already existed (skip), "OK" if claimed.
  const res = await redis.set(key, String(Date.now()), {
    nx: true,
    ex: SEND_RATE_LIMIT_SECONDS,
  });
  return res === "OK" || res === true;
}

export { MAX_WATCHES_PER_USER, SEND_RATE_LIMIT_SECONDS };
