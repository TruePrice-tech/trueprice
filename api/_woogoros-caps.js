// /api/_woogoros-caps.js
//
// Rolling weekly submission caps. Per Lane's spec: 5 quotes + 15 receipts
// per rolling 7 days per user. Implemented via a Redis sorted set keyed
// by submission timestamp -- accurate to the second, no bucket-boundary
// surprises.
//
// On each submission attempt we:
//   1. ZREMRANGEBYSCORE to drop entries older than 7 days
//   2. ZCARD to count current window
//   3. If under cap, ZADD the new submission's timestamp
//
// We use timestamp as both score AND member to avoid collisions with
// trivial probability (multiple submissions in same millisecond would
// collapse, so we suffix a 4-hex random tag).
//
// Returns { ok, used, cap, retryAfterMs? }.

import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const CAPS = {
  quote: { perWeek: 5, key: "wg:cap_q" },
  receipt: { perWeek: 15, key: "wg:cap_r" },
};

export async function checkAndConsumeCap(userId, kind) {
  const cap = CAPS[kind];
  if (!cap) throw new Error("checkAndConsumeCap: bad kind " + kind);

  const key = `${cap.key}:${userId}`;
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  await redis.zremrangebyscore(key, 0, cutoff);
  const used = await redis.zcard(key);

  if (used >= cap.perWeek) {
    // Find the oldest entry in the window so we can tell the user when
    // it'll roll off.
    const oldest = await redis.zrange(key, 0, 0, { withScores: true });
    let retryAfterMs = WINDOW_MS;
    if (Array.isArray(oldest) && oldest.length >= 2) {
      const oldestScore = Number(oldest[1]);
      if (Number.isFinite(oldestScore)) {
        retryAfterMs = Math.max(0, oldestScore + WINDOW_MS - now);
      }
    }
    return { ok: false, used, cap: cap.perWeek, retryAfterMs };
  }

  const member = `${now}:${crypto.randomBytes(2).toString("hex")}`;
  await redis.zadd(key, { score: now, member });
  // 14 day TTL on the key as a safety net so a dormant user's set doesn't
  // sit forever; window-pruning above keeps it logically correct anyway.
  await redis.expire(key, 14 * 24 * 60 * 60);

  return { ok: true, used: used + 1, cap: cap.perWeek };
}

export async function readCapStatus(userId) {
  const out = {};
  for (const [kind, cap] of Object.entries(CAPS)) {
    const key = `${cap.key}:${userId}`;
    const cutoff = Date.now() - WINDOW_MS;
    try {
      await redis.zremrangebyscore(key, 0, cutoff);
      out[kind] = { used: await redis.zcard(key), cap: cap.perWeek };
    } catch (e) {
      out[kind] = { used: 0, cap: cap.perWeek };
    }
  }
  return out;
}
