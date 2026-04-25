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
//     burrow: { collectedWoogoros: [], streakDays, lastStreakDate },
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

  return res.status(200).json({
    authenticated: true,
    beta: !!user.isBeta,
    user: {
      email: user.email,
      createdAt: user.createdAt,
      ageVerified: !!user.ageVerified,
    },
    burrow: burrow || {
      collectedWoogoros: [],
      streakDays: 0,
      lastStreakDate: null,
    },
    balance,
    ledger,
    caps,
  });
}
