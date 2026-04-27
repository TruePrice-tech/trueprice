// /api/beta-burrow.js
//
// GET  -> returns the authenticated user's burrow state as JSON.
// POST -> not implemented in G1; receipt submission lives in its own
//         endpoint (built in Phase 2).
//
// Response shape:
//   {
//     authenticated: true,
//     beta: true | false,
//     user: { email, createdAt, ageVerified },
//     burrow: { collectedWoogoros: [], receiptWoogoros: [], streakDays, lastStreakDate },
//     balance: <int>,           // Woo Cash, source: wg:balance:{userId}
//     ledger: [ { ...recent entries... } ]
//   }
//
// Non-beta users still get authenticated:true so the burrow page can
// render a "you're on the waitlist" state instead of bouncing them.

import { resolveUserFromRequest } from "./_beta-session.js";
import { getBalance, listLedger } from "./_woogoros-ledger.js";
import { readCapStatus } from "./_woogoros-caps.js";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ctx = await resolveUserFromRequest(req);
  if (!ctx) {
    return res.status(401).json({ authenticated: false });
  }

  const { user } = ctx;

  let burrow = null;
  try {
    const raw = await redis.get(`wg:burrow:${user.userId}`);
    burrow = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
  } catch (e) {
    console.error("[beta-burrow] burrow read failed:", e && e.message);
  }

  let balance = 0;
  let ledger = [];
  let caps = { quote: { used: 0, cap: 5 }, receipt: { used: 0, cap: 15 } };
  try {
    balance = await getBalance(user.userId);
    ledger = await listLedger(user.userId, { limit: 25 });
    caps = await readCapStatus(user.userId);
  } catch (e) {
    console.error("[beta-burrow] ledger/caps read failed:", e && e.message);
  }

  // Recent orders: most-recent 5 from user's order list.
  let orders = [];
  try {
    const orderIds = await redis.lrange(`wg:user_orders:${user.userId}`, 0, 4);
    for (const id of (orderIds || [])) {
      const raw = await redis.get(`wg:order:${id}`);
      if (!raw) continue;
      const o = typeof raw === "string" ? JSON.parse(raw) : raw;
      // Don't leak shipping address back to UI; the user knows what they typed.
      orders.push({
        id: o.id,
        itemSlug: o.itemSlug,
        itemLabel: o.itemLabel,
        wooCost: o.wooCost,
        status: o.status,
        placedAt: o.placedAt,
        fulfilledAt: o.fulfilledAt,
        shippedAt: o.shippedAt,
        deliveredAt: o.deliveredAt,
        trackingNumber: o.trackingNumber,
      });
    }
  } catch (e) {
    console.error("[beta-burrow] orders read failed:", e && e.message);
  }

  return res.status(200).json({
    authenticated: true,
    beta: !!user.isBeta,
    canRedeem: !!user.canRedeem,
    user: {
      email: user.email,
      createdAt: user.createdAt,
      ageVerified: !!user.ageVerified,
    },
    burrow: burrow || {
      collectedWoogoros: [],
      receiptWoogoros: [],
      streakDays: 0,
      lastStreakDate: null,
    },
    balance,
    ledger,
    caps,
    orders,
  });
}
