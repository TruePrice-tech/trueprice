// /api/beta-receipt-submit.js
//
// POST {
//   text: <client-side OCR'd text>,
//   imageBase64: <base64 of the original image, no data: prefix>,
//   imageHash: <sha256 hex of original image bytes, used for dedup>,
//   declaredVertical: <one of VERTICALS>,
//   declaredAmount: <number>,
//   stateCode?: <2-char>,
//   merchant?: <string>
// }
//
// Requires beta session. On verification pass: a tiered Receipt Woogoro
// is minted with a locked-in Woo amount + the collectible vertical
// Woogoro joins the burrow + streak bumps. The locked Woo is NOT
// credited to spendable balance until the user cashes the Receipt
// Woogoro in via /api/beta-cash-in-receipt. This makes the cash-in
// animation narratively coherent (the Woogoro IS the locked Woo)
// and gives "Keep vs Cash In" a real trade-off.
//
// On partial trust: stored as needs-review (no Woogoro and no Woo
// until admin approves via beta-admin op:approve_submission).
//
// The image bytes are SHA-256 hashed and discarded after processing.
// We store the hash for dedup ("you already submitted this receipt")
// but never persist the raw image. This is intentional for privacy
// and to keep us out of the data-retention game until counsel reviews.
//
// When the Theia receipt LoRA + fake detector ship (~May 10), this file
// will gain an additional Theia HTTP call before verifyReceipt; the
// function contract stays the same.

import { Redis } from "@upstash/redis";
import crypto from "crypto";
import {
  requireBetaUser,
  collectWoogoro,
  bumpStreak,
  addReceiptWoogoro,
} from "./_beta-session.js";
import { verifyReceipt } from "./_woogoros-verifier.js";
import { checkAndConsumeCap } from "./_woogoros-caps.js";
import { VERTICALS } from "./_woogoros-vertical.js";
import { assignReceiptTier } from "./_receipt-woogoro-tiers.js";

const redis = Redis.fromEnv();

function newSubmissionId(prefix) {
  return prefix + "_" + crypto.randomBytes(9).toString("base64url");
}

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
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
  const imageBase64 = body.imageBase64 ? String(body.imageBase64) : null;
  const clientImageHash = body.imageHash ? String(body.imageHash).toLowerCase().trim() : null;
  const stateCode = (String(body.stateCode || "") || "").toUpperCase().slice(0, 2);
  const declaredMerchant = String(body.merchant || "").trim().slice(0, 80) || null;

  if (!VERTICALS.includes(declaredVertical)) {
    return res.status(400).json({ error: "Please pick a valid vertical." });
  }
  if (!Number.isFinite(declaredAmount) || declaredAmount < 5 || declaredAmount > 1000000) {
    return res.status(400).json({ error: "Amount must be between $5 and $1,000,000." });
  }
  if (!imageBase64 || imageBase64.length < 1000) {
    return res.status(400).json({ error: "A receipt image is required." });
  }

  // Verify the client-supplied image hash against the bytes we received,
  // then drop the bytes immediately. This makes the hash trustworthy
  // for dedup AND lets us refuse mismatches (a tampered client can't
  // pretend a different image was uploaded).
  let imageHash;
  try {
    const buf = Buffer.from(imageBase64, "base64");
    if (buf.length < 500 || buf.length > 12 * 1024 * 1024) {
      return res.status(400).json({ error: "Image is too small or too large." });
    }
    imageHash = crypto.createHash("sha256").update(buf).digest("hex");
  } catch (e) {
    return res.status(400).json({ error: "Image is not valid base64." });
  }
  if (clientImageHash && clientImageHash !== imageHash) {
    return res.status(400).json({ error: "Image hash mismatch (image was modified in transit)." });
  }

  // Dedup: same image submitted before by anyone? (Server-side anti-fraud.)
  let dedupHit = null;
  try {
    dedupHit = await redis.get(`wg:receipt_hash:${imageHash}`);
  } catch (e) { /* swallow */ }
  if (dedupHit) {
    return res.status(200).json({
      success: false,
      pass: false,
      reasons: ["duplicate_receipt"],
      message: "This exact receipt image has already been submitted.",
    });
  }

  let verification;
  try {
    verification = await verifyReceipt({
      text,
      declaredVertical,
      declaredAmount,
      imageHash,
      hasImage: true,
    });
  } catch (e) {
    console.error("[beta-receipt-submit] verifyReceipt failed:", e && e.message);
    return res.status(500).json({ error: "Verification failed. Please try again." });
  }

  // Reserve the image hash regardless of pass/fail, so a rejected receipt
  // can't simply be retried with the same image.
  try {
    await redis.set(`wg:receipt_hash:${imageHash}`, JSON.stringify({
      userId: user.userId, ts: Date.now(), pass: verification.pass,
    }), { ex: 365 * 24 * 60 * 60 });
  } catch (e) { /* swallow */ }

  if (!verification.pass && !verification.requiresReview) {
    return res.status(200).json({
      success: false,
      pass: false,
      reasons: verification.reasons,
      trustScore: verification.trustScore,
      fields: verification.fields || null,
      message: "We couldn't verify this receipt. Try a clearer photo, make sure the total and date are visible, or use a different vertical.",
    });
  }

  if (verification.requiresReview && !verification.pass) {
    // Hold for manual approval. No Woo grant yet.
    const submissionId = newSubmissionId("r");
    const now = Date.now();
    const record = {
      id: submissionId,
      kind: "receipt",
      userId: user.userId,
      declaredVertical,
      classifiedVertical: verification.vertical,
      declaredAmount,
      stateCode: stateCode || null,
      merchant: declaredMerchant || (verification.fields && verification.fields.merchant) || null,
      imageHash,
      trustScore: verification.trustScore,
      submittedAt: now,
      status: "needs_review",
      reasons: verification.reasons,
      fields: verification.fields || null,
    };
    try {
      await redis.set(`wg:submission:${submissionId}`, JSON.stringify(record));
      await redis.lpush(`wg:user_submissions:${user.userId}`, submissionId);
      await redis.ltrim(`wg:user_submissions:${user.userId}`, 0, 999);
      await redis.lpush("wg:review_queue", submissionId);
      await redis.ltrim("wg:review_queue", 0, 999);
    } catch (e) {
      console.error("[beta-receipt-submit] persist (review) failed:", e && e.message);
    }

    return res.status(200).json({
      success: true,
      pass: false,
      requiresReview: true,
      submissionId,
      trustScore: verification.trustScore,
      reasons: verification.reasons,
      message: "Submitted for review. We'll grant your Woogoro and Woo Cash once an admin approves it.",
    });
  }

  // Pass path: consume cap, persist, grant Woo + Woogoro, bump streak.
  const cap = await checkAndConsumeCap(user.userId, "receipt");
  if (!cap.ok) {
    return res.status(200).json({
      success: false,
      pass: true,
      reasons: ["weekly_cap_reached"],
      message: `You've used all ${cap.cap} receipt submissions this week. Try again later.`,
      retryAfterMs: cap.retryAfterMs,
    });
  }

  const submissionId = newSubmissionId("r");
  const now = Date.now();
  const record = {
    id: submissionId,
    kind: "receipt",
    userId: user.userId,
    declaredVertical,
    classifiedVertical: verification.vertical,
    declaredAmount,
    stateCode: stateCode || null,
    merchant: declaredMerchant || (verification.fields && verification.fields.merchant) || null,
    imageHash,
    trustScore: verification.trustScore,
    submittedAt: now,
    status: "verified",
    fields: verification.fields || null,
  };

  try {
    await redis.set(`wg:submission:${submissionId}`, JSON.stringify(record));
    await redis.lpush(`wg:user_submissions:${user.userId}`, submissionId);
    await redis.ltrim(`wg:user_submissions:${user.userId}`, 0, 999);
  } catch (e) {
    console.error("[beta-receipt-submit] persist failed:", e && e.message);
  }

  // Tier the receipt by $ size + trust. wooAmount scales with tier so
  // big receipts (where the alt-data is most valuable) earn more. Note:
  // wooAmount is locked into the Receipt Woogoro at this moment but
  // not credited to spendable balance. Cash-in via the dedicated
  // endpoint is what credits Woo + writes the ledger entry.
  const tierAssignment = assignReceiptTier({
    declaredAmount,
    trustScore: verification.trustScore,
  });

  let receiptWoogoro = null;
  try {
    const rw = await addReceiptWoogoro(user.userId, {
      tier: tierAssignment.tier,
      vertical: verification.vertical,
      submissionId,
      declaredAmount,
      wooAmount: tierAssignment.wooAmount,
    });
    receiptWoogoro = rw.entry;
  } catch (e) {
    console.error("[beta-receipt-submit] addReceiptWoogoro failed:", e && e.message);
    return res.status(500).json({ error: "Server error after verification. Contact support." });
  }

  const collect = await collectWoogoro(user.userId, verification.vertical);
  const streak = await bumpStreak(user.userId);

  return res.status(200).json({
    success: true,
    pass: true,
    submissionId,
    vertical: verification.vertical,
    wooEarnable: tierAssignment.wooAmount,
    tier: tierAssignment.tier,
    tierDisplay: tierAssignment.displayName,
    cappedByTrust: tierAssignment.cappedByTrust,
    receiptWoogoroId: receiptWoogoro ? receiptWoogoro.id : null,
    newCollection: collect.newCollection,
    streakDays: streak.streakDays,
    capUsed: cap.used,
    capLimit: cap.cap,
    trustScore: verification.trustScore,
    fields: verification.fields || null,
  });
}
