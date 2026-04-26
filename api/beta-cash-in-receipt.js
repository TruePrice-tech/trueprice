// /api/beta-cash-in-receipt.js
//
// POST { receiptWoogoroId }
//
// Converts a kept Receipt Woogoro into spendable Woo Cash. The locked
// wooAmount on the Receipt Woogoro is what gets credited; we never
// re-derive it from the tier table at cash-in time. This protects
// users from a future tier-table change retroactively shrinking what
// they earned.
//
// Idempotent on already-redeemed Woogoros: returns a 409-like error
// instead of double-crediting.
//
// G1 response includes an `animationCue` field so the frontend can
// trigger the placeholder coin-burst. The full vaudeville hook
// animation ships at G4 alongside Tremendous gift cards.

import {
  requireBetaUser,
  getBurrow,
  markReceiptWoogoroRedeemed,
} from "./_beta-session.js";
import { issueWoo, getBalance } from "./_woogoros-ledger.js";
import { logCashIn } from "./_woogoros-econ.js";

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

  const receiptWoogoroId = String(body.receiptWoogoroId || "").trim();
  if (!/^rw_[A-Za-z0-9_\-]{6,40}$/.test(receiptWoogoroId)) {
    return res.status(400).json({ error: "Bad receiptWoogoroId." });
  }

  const burrow = await getBurrow(user.userId);
  if (!burrow || !Array.isArray(burrow.receiptWoogoros)) {
    return res.status(404).json({ error: "Receipt Woogoro not found." });
  }
  const rw = burrow.receiptWoogoros.find((x) => x.id === receiptWoogoroId);
  if (!rw) return res.status(404).json({ error: "Receipt Woogoro not found." });
  if (rw.redeemed) {
    return res.status(409).json({
      error: "This Receipt Woogoro has already been cashed in.",
      alreadyRedeemed: true,
    });
  }

  const amount = Number(rw.wooAmount);
  if (!Number.isInteger(amount) || amount <= 0) {
    // Defensive: a malformed entry shouldn't be cashable.
    return res.status(500).json({ error: "Receipt Woogoro has no valid wooAmount." });
  }

  // Issue the locked Woo to balance + ledger.
  let entry;
  try {
    entry = await issueWoo({
      userId: user.userId,
      amount,
      source: `receipt:${rw.submissionId}`,
      meta: {
        cashedInFrom: receiptWoogoroId,
        tier: rw.tier,
        vertical: rw.vertical,
        declaredAmount: rw.declaredAmount,
      },
    });
  } catch (e) {
    console.error("[beta-cash-in-receipt] issueWoo failed:", e && e.message);
    return res.status(500).json({ error: "Could not credit Woo. Try again in a moment." });
  }

  // Mark redeemed AFTER the credit succeeded. If this write fails the
  // user got their Woo (good) and the Woogoro stays "unredeemed" in
  // burrow blob (bad — could be cashed twice). The ledger source field
  // ("receipt:<submissionId>") doubles as a dedup signal: an admin
  // tool can detect duplicate cash-ins by counting issue entries with
  // identical source+cashedInFrom and reverse them.
  let redeemRes;
  try {
    redeemRes = await markReceiptWoogoroRedeemed(
      user.userId,
      receiptWoogoroId,
      `cash_in:${entry.id}`,
      entry.id,
    );
  } catch (e) {
    console.error("[beta-cash-in-receipt] markRedeemed failed:", e && e.message);
    redeemRes = { ok: false };
  }

  let newBalance = 0;
  try { newBalance = await getBalance(user.userId); } catch (e) { /* swallow */ }

  // Econ tracking: cash-in crystallizes the projected cost. Placeholder
  // cents-per-woo rate lives in _woogoros-econ.js; tune as Tremendous +
  // Printful invoices come in.
  logCashIn({
    userId: user.userId,
    tier: rw.tier,
    woo: amount,
    rwId: receiptWoogoroId,
    ledgerId: entry.id,
    vertical: rw.vertical,
  }).catch(() => {});

  return res.status(200).json({
    success: true,
    receiptWoogoroId,
    tier: rw.tier,
    wooCredited: amount,
    newBalance,
    ledgerEntryId: entry.id,
    redeemPersisted: !!(redeemRes && redeemRes.ok),
    animationCue: `cash_in_${rw.tier}`, // frontend hook for tier-graded animation
  });
}
