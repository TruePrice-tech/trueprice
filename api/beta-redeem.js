// /api/beta-redeem.js
//
// GET   -> returns the public catalog (always allowed for beta users).
// POST  -> place a redemption order.
//
// POST body:
//   {
//     itemSlug: string,
//     options?: { size?: string, ... },   // matches catalog item.options
//     shipping: { fullName, line1, line2?, city, stateCode, postalCode }
//   }
//
// Flow on POST:
//   1. Resolve user (must be in beta).
//   2. Look up catalog item; verify it's available.
//   3. Validate options against item.options (if any).
//   4. Validate shipping address.
//   5. spendWoo() -- this throws INSUFFICIENT_FUNDS if balance < cost.
//   6. Persist order at wg:order:{id}, push to user list + global queue.
//   7. (Future) If PRINTFUL_API_KEY set, POST to Printful here.
//
// Refund policy: if step 7 fails, the spend is already on the ledger.
// Admin tooling can issue an opposite credit via op:issue_woo with
// source:"admin:refund_<orderId>" plus reject_order to mark it.

import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { requireBetaUser } from "./_beta-session.js";
import { spendWoo, getBalance } from "./_woogoros-ledger.js";
import { CATALOG, getItem, publicCatalog, validateShipping, normalizeShipping } from "./_woogoros-catalog.js";

const redis = Redis.fromEnv();

function newOrderId() {
  return "o_" + crypto.randomBytes(9).toString("base64url");
}

export const config = {
  api: { bodyParser: { sizeLimit: "100kb" } },
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const ctx = await requireBetaUser(req);
  if (!ctx) return res.status(401).json({ error: "Not authenticated or not in beta." });
  const { user } = ctx;

  if (req.method === "GET") {
    const balance = await getBalance(user.userId);
    return res.status(200).json({ catalog: publicCatalog(), balance });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const itemSlug = String(body.itemSlug || "").trim();
  const item = getItem(itemSlug);
  if (!item) return res.status(400).json({ error: "Unknown item." });
  if (!item.available) return res.status(400).json({ error: item.label + " is not available right now." });

  // Validate options against catalog spec.
  const selectedOptions = {};
  if (item.options) {
    for (const optKey of Object.keys(item.options)) {
      const allowed = item.options[optKey];
      const got = body.options ? String(body.options[optKey] || "").trim() : "";
      if (!allowed.includes(got)) {
        return res.status(400).json({ error: "Please pick a valid " + optKey + "." });
      }
      selectedOptions[optKey] = got;
    }
  }

  // Shipping (every current catalog item requires it; future digital items can skip).
  let shipping = null;
  if (item.requiresShipping) {
    const v = validateShipping(body.shipping || null);
    if (!v.ok) return res.status(400).json({ error: v.error });
    shipping = normalizeShipping(body.shipping);
  }

  const balance = await getBalance(user.userId);
  if (balance < item.wooCost) {
    return res.status(400).json({
      error: "Not enough Woo Cash. Need " + item.wooCost.toLocaleString() + ", have " + balance.toLocaleString() + ".",
      balance,
      required: item.wooCost,
    });
  }

  const orderId = newOrderId();
  const now = Date.now();

  // Spend FIRST so a partial-failure leaves the ledger consistent. If the
  // spend succeeds and order persistence fails, we have an unattached
  // ledger entry -- admin tooling can refund via op:issue_woo and inspect
  // wg:order:{id} (which won't exist).
  let entry;
  try {
    entry = await spendWoo({
      userId: user.userId,
      amount: item.wooCost,
      source: `redeem:${orderId}`,
      meta: { itemSlug, itemLabel: item.label, options: selectedOptions },
    });
  } catch (e) {
    if (e.code === "INSUFFICIENT_FUNDS") {
      return res.status(400).json({ error: "Not enough Woo Cash.", balance: e.balance, required: e.requested });
    }
    console.error("[beta-redeem] spendWoo failed:", e && e.message);
    return res.status(500).json({ error: "Server error during Woo deduction. Please try again." });
  }

  const order = {
    id: orderId,
    userId: user.userId,
    userEmail: user.email,
    itemSlug,
    itemLabel: item.label,
    options: selectedOptions,
    wooCost: item.wooCost,
    shipping,
    status: "placed",
    placedAt: now,
    fulfilledAt: null,
    shippedAt: null,
    deliveredAt: null,
    trackingNumber: null,
    ledgerEntryId: entry.id,
    fulfillment: { provider: process.env.PRINTFUL_API_KEY ? "printful_pending" : "manual" },
  };

  try {
    await redis.set(`wg:order:${orderId}`, JSON.stringify(order));
    await redis.lpush(`wg:user_orders:${user.userId}`, orderId);
    await redis.ltrim(`wg:user_orders:${user.userId}`, 0, 199);
    await redis.lpush("wg:order_queue", orderId);
    await redis.ltrim("wg:order_queue", 0, 999);
  } catch (e) {
    console.error("[beta-redeem] order persist failed:", e && e.message);
    // We've already spent the Woo. Surface the orderId so support can
    // reconcile by hand if needed.
    return res.status(500).json({
      error: "Order partially processed. Save this ID and contact support: " + orderId,
      orderId,
    });
  }

  // Future Printful integration would POST the order here. For now we
  // leave it queued for manual fulfillment.

  return res.status(200).json({
    success: true,
    orderId,
    itemLabel: item.label,
    wooCharged: item.wooCost,
    newBalance: balance - item.wooCost,
    estimatedShipDays: item.estimatedShipDays,
    status: order.status,
  });
}
