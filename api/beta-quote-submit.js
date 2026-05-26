// /api/beta-quote-submit.js
//
// POST {
//   text: <OCR'd quote text>,
//   declaredVertical: <one of VERTICALS>,
//   declaredAmount: <number>,
//   stateCode?: <2-char>,
//   contractor?: <string>,
//   sourceUrl?: <string, where the quote came from>
// }
//
// Requires beta session. On pass: writes quote record, grants
// 100 Woo + the vertical's Woogoro, bumps streak, increments
// flywheel counters.
//
// Quote = lower trust than receipt (no proof of purchase). 100 Woo.

import { Redis } from "@upstash/redis";
import crypto from "crypto";
import {
  requireBetaUser,
  collectWoogoro,
  bumpStreak,
} from "./_beta-session.js";
import { issueWoo } from "./_woogoros-ledger.js";
import { validateQuoteInput } from "./_quote-input-guard.js";
import { verifyQuote } from "./_woogoros-verifier.js";
import { checkAndConsumeCap } from "./_woogoros-caps.js";
import { VERTICALS } from "./_woogoros-vertical.js";

const redis = Redis.fromEnv();

const QUOTE_WOO_AMOUNT = 100;

function newSubmissionId(prefix) {
  return prefix + "_" + crypto.randomBytes(9).toString("base64url");
}

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ctx = await requireBetaUser(req);
  if (!ctx) return res.status(401).json({ error: "Not authenticated or not in beta." });
  const { user } = ctx;

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const text = String(body.text || "").trim();
  const declaredVertical = String(body.declaredVertical || "").trim();
  const declaredAmount = Number(body.declaredAmount);
  const stateCode = (String(body.stateCode || "") || "").toUpperCase().slice(0, 2);
  const contractor = String(body.contractor || "").trim().slice(0, 80) || null;
  const sourceUrl = String(body.sourceUrl || "").trim().slice(0, 400) || null;

  if (!text || text.length < 80 || text.length > 50000) {
    return res.status(400).json({ error: "Quote text is missing or out of expected length range." });
  }
  if (!VERTICALS.includes(declaredVertical)) {
    return res.status(400).json({ error: "Please pick a valid vertical." });
  }
  if (!Number.isFinite(declaredAmount) || declaredAmount < 50 || declaredAmount > 1000000) {
    return res.status(400).json({ error: "Amount must be between $50 and $1,000,000." });
  }

  // Cap check FIRST so a failed verification doesn't pre-burn a slot.
  // We only consume the slot after verification passes.
  // (We still rate-limit on user via a peek, then consume on success.)

  let verification;
  try {
    verification = await verifyQuote({ text, declaredVertical, declaredAmount });
  } catch (e) {
    console.error("[beta-quote-submit] verifyQuote failed:", e && e.message);
    return res.status(500).json({ error: "Verification failed. Please try again." });
  }

  if (!verification.pass) {
    return res.status(200).json({
      success: false,
      pass: false,
      reasons: verification.reasons,
      trustScore: verification.trustScore,
      message: "We couldn't verify this quote automatically. Try a clearer screenshot or matching the amount you typed to what's printed on the quote.",
    });
  }

  const cap = await checkAndConsumeCap(user.userId, "quote");
  if (!cap.ok) {
    return res.status(200).json({
      success: false,
      pass: true,
      reasons: ["weekly_cap_reached"],
      message: `You've used all ${cap.cap} quote submissions this week. Try again later.`,
      retryAfterMs: cap.retryAfterMs,
    });
  }

  const submissionId = newSubmissionId("q");
  const now = Date.now();
  const record = {
    id: submissionId,
    kind: "quote",
    userId: user.userId,
    declaredVertical,
    classifiedVertical: verification.vertical,
    declaredAmount,
    stateCode: stateCode || null,
    contractor,
    sourceUrl,
    textLength: text.length,
    trustScore: verification.trustScore,
    submittedAt: now,
    status: "verified",
  };

  try {
    await redis.set(`wg:submission:${submissionId}`, JSON.stringify(record));
    await redis.lpush(`wg:user_submissions:${user.userId}`, submissionId);
    await redis.ltrim(`wg:user_submissions:${user.userId}`, 0, 999);
  } catch (e) {
    console.error("[beta-quote-submit] persist failed:", e && e.message);
    // Continue: ledger + Woogoro grant matter more than the record blob.
  }

  let entry;
  try {
    entry = await issueWoo({
      userId: user.userId,
      amount: QUOTE_WOO_AMOUNT,
      source: `quote:${submissionId}`,
      meta: { vertical: verification.vertical, declaredAmount },
    });
  } catch (e) {
    console.error("[beta-quote-submit] issueWoo failed:", e && e.message);
    return res.status(500).json({ error: "Server error after verification. Contact support." });
  }

  const collect = await collectWoogoro(user.userId, verification.vertical);
  const streak = await bumpStreak(user.userId);

  // Flywheel feed: write to the existing tp:* aggregates so user-attributed
  // submissions also feed the public pricing-data lake. Best-effort.
  try {
    await redis.lpush("tp:pricing_data", JSON.stringify({
      v: verification.vertical,
      ts: new Date(now).toISOString(),
      price: declaredAmount,
      state: stateCode || null,
      jobType: null,
      brand: null,
      scope: null,
      src: "user_attributed",
    }));
    await redis.ltrim("tp:pricing_data", 0, 49999);
    await redis.incr("tp:total_quotes");
    // Gated by _quote-input-guard since 2026-05-26 drift incident — see
    // api/_quote-input-guard.js for rationale. Bad inputs silently drop
    // from the cal:* bump (full submission still recorded above).
    if (stateCode) {
      const guard = validateQuoteInput({
        state: stateCode,
        vertical: verification.vertical,
        price: declaredAmount,
      });
      if (!guard.ok) {
        console.warn("[beta-quote-submit] cal:* bump skipped:", guard.reasons.join(","), "vertical=", verification.vertical, "state=", stateCode);
      } else {
        const k = `cal:metro:${stateCode}:${verification.vertical}`;
        const ex = await redis.get(k) || { quotes: 0, weightedSum: 0, totalWeight: 0, avgPrice: 0, lastUpdated: 0 };
        const e = typeof ex === "string" ? JSON.parse(ex) : ex;
        const weight = 0.5; // user-attributed gets higher weight than anonymous
        e.quotes += 1;
        e.weightedSum += declaredAmount * weight;
        e.totalWeight += weight;
        e.avgPrice = Math.round(e.weightedSum / e.totalWeight);
        e.lastUpdated = now;
        await redis.set(k, JSON.stringify(e));
      }
    }
  } catch (e) { /* swallow */ }

  return res.status(200).json({
    success: true,
    pass: true,
    submissionId,
    vertical: verification.vertical,
    wooEarned: QUOTE_WOO_AMOUNT,
    newCollection: collect.newCollection,
    streakDays: streak.streakDays,
    capUsed: cap.used,
    capLimit: cap.cap,
    ledgerEntryId: entry.id,
  });
}
