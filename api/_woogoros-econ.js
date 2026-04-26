// /api/_woogoros-econ.js
//
// Unit-economics event log. The launch plan locks in this rule:
//
//   "Track this from receipt #1. Cost per receipt redeemed ~50c
//    (card face + 3% aggregator fee). Must earn >50c per receipt in
//    alt-data licensing + premium tier + sponsored research combined,
//    or every receipt loses money."
//
// We log every event that has a cost or revenue impact into a single
// append-only Redis list. Admin can window-aggregate to see the running
// per-receipt P&L.
//
// Cost estimates are placeholders for G1 (no real cash-out yet);
// they get refined as actual rates come in (Printful invoice, Tremendous
// fees, USPS rates, etc). The SCHEMA is what matters early — getting
// the data collection started before we can't reconstruct it later.
//
// Event types:
//   receipt_minted     - receipt verified, Woogoro minted, woo LOCKED
//                        cost: 0  (locked but not yet realized)
//   cashin             - user converted Receipt Woogoro to spendable woo
//                        cost: (woo / 50000) * 5000 * 1.03 cents  (placeholder)
//                        i.e. assumes future redemption to $50 gift card
//                        with 3% Tremendous markup
//   redeem_merch       - user spent woo on a merch item
//                        cost: item.unitCostCents + shipping_estimate
//   redeem_giftcard    - (G4) user spent woo on a gift card
//                        cost: face_value_cents * 1.03  (Tremendous fee)
//   revenue_altdata    - (future) alt-data licensing $ landed
//   revenue_premium    - (future) premium tier subscription $ landed
//   revenue_sponsored  - (future) sponsored research $ landed
//
// Storage: single global stream wg:econ:events (LPUSH newest-first,
// capped at 100K). Each entry is a self-contained JSON blob so we can
// later move it into a real warehouse without lossy migration.

import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

const STREAM_KEY = "wg:econ:events";
const STREAM_CAP = 100000; // 100K events, ~10MB at ~100 bytes each

// Placeholder cost rates. Tune as real invoices come in.
// Assumption: avg redemption = $50 gift card via Tremendous at 3% markup.
// 50000 woo -> $50 -> 5000 cents -> 5150 cents with markup.
const CENTS_PER_WOO_CASHIN = 5150 / 50000; // = 0.103 cents per woo

function newEventId() {
  return "ev_" + crypto.randomBytes(9).toString("base64url");
}

async function appendEvent(event) {
  const enriched = {
    id: newEventId(),
    ts: Date.now(),
    ...event,
  };
  try {
    await redis.lpush(STREAM_KEY, JSON.stringify(enriched));
    await redis.ltrim(STREAM_KEY, 0, STREAM_CAP - 1);
  } catch (e) {
    // Econ tracking failure must NEVER break the user flow. Swallow.
    console.error("[econ] append failed:", e && e.message);
  }
  return enriched;
}

export async function logReceiptMinted({ userId, tier, woo, vertical, declaredAmount, submissionId, cappedByTrust }) {
  return appendEvent({
    type: "receipt_minted",
    userId, tier, woo, vertical,
    declaredAmount, submissionId, cappedByTrust: !!cappedByTrust,
    costCents: 0, // locked, not realized
    revenueCents: 0,
  });
}

export async function logCashIn({ userId, tier, woo, rwId, ledgerId, vertical }) {
  const costCents = Math.round(woo * CENTS_PER_WOO_CASHIN);
  return appendEvent({
    type: "cashin",
    userId, tier, woo, vertical,
    rwId, ledgerId,
    costCents, revenueCents: 0,
  });
}

export async function logRedeemMerch({ userId, woo, itemSlug, itemLabel, unitCostCents, shippingCents, orderId }) {
  const costCents = (Number(unitCostCents) || 0) + (Number(shippingCents) || 0);
  return appendEvent({
    type: "redeem_merch",
    userId, woo, itemSlug, itemLabel, orderId,
    costCents, revenueCents: 0,
  });
}

export async function logRedeemGiftcard({ userId, woo, brand, faceValueCents, orderId }) {
  const costCents = Math.round((Number(faceValueCents) || 0) * 1.03);
  return appendEvent({
    type: "redeem_giftcard",
    userId, woo, brand, faceValueCents, orderId,
    costCents, revenueCents: 0,
  });
}

export async function logRevenue({ kind, userId, amountCents, source }) {
  // kind in {altdata, premium, sponsored}
  if (!["altdata", "premium", "sponsored"].includes(kind)) {
    throw new Error("logRevenue: bad kind");
  }
  return appendEvent({
    type: "revenue_" + kind,
    userId: userId || null, // some revenue is non-user-attributable
    amountCents: Number(amountCents) || 0,
    source: source || null,
    costCents: 0,
    revenueCents: Number(amountCents) || 0,
  });
}

// Window aggregator: sum cost and revenue over the last N ms, group by
// type + tier + vertical. Used by admin dashboard.
export async function getEconWindow({ windowMs = 7 * 24 * 3600 * 1000 } = {}) {
  const cutoff = Date.now() - windowMs;
  const rows = await redis.lrange(STREAM_KEY, 0, STREAM_CAP - 1);
  let totalCost = 0, totalRev = 0, eventCount = 0;
  const byType = {};
  const byTier = {};
  const byVertical = {};
  const byDay = {};
  for (const r of (rows || [])) {
    const ev = typeof r === "string" ? JSON.parse(r) : r;
    if (!ev.ts || ev.ts < cutoff) continue;
    eventCount += 1;
    const c = Number(ev.costCents) || 0;
    const v = Number(ev.revenueCents) || 0;
    totalCost += c;
    totalRev += v;
    const t = ev.type || "unknown";
    byType[t] = byType[t] || { count: 0, cost: 0, rev: 0 };
    byType[t].count += 1; byType[t].cost += c; byType[t].rev += v;
    if (ev.tier) {
      byTier[ev.tier] = byTier[ev.tier] || { count: 0, cost: 0, rev: 0 };
      byTier[ev.tier].count += 1; byTier[ev.tier].cost += c; byTier[ev.tier].rev += v;
    }
    if (ev.vertical) {
      byVertical[ev.vertical] = byVertical[ev.vertical] || { count: 0, cost: 0, rev: 0 };
      byVertical[ev.vertical].count += 1; byVertical[ev.vertical].cost += c; byVertical[ev.vertical].rev += v;
    }
    const day = new Date(ev.ts).toISOString().slice(0, 10);
    byDay[day] = byDay[day] || { count: 0, cost: 0, rev: 0 };
    byDay[day].count += 1; byDay[day].cost += c; byDay[day].rev += v;
  }
  return {
    windowMs, eventCount,
    totalCostCents: totalCost,
    totalRevenueCents: totalRev,
    netCents: totalRev - totalCost,
    byType, byTier, byVertical, byDay,
  };
}

export async function listRecentEvents(limit = 100) {
  const rows = await redis.lrange(STREAM_KEY, 0, Math.min(limit, 1000) - 1);
  return (rows || []).map((r) => (typeof r === "string" ? JSON.parse(r) : r));
}
