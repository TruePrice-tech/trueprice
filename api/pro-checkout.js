// /api/pro-checkout.js
//
// POST -> creates a Stripe Checkout Session for the $19 one-time Pro Report.
//         Client passes its anonymous Pro token; we attach it as session
//         metadata so the webhook can grant Pro access on payment success.
//
// Request body (JSON):
//   { token: "<32-hex>", successUrl?: "<absolute>", cancelUrl?: "<absolute>" }
//
// Response (200):
//   { url: "<stripe-hosted-checkout-url>", sessionId: "cs_..." }
//
// Errors:
//   400 invalid_token         - token missing or malformed
//   400 invalid_url           - success/cancel url failed validation
//   500 stripe_not_configured - env vars missing
//   502 stripe_error          - Stripe rejected the create call

import { isValidProToken, getStripe } from "./_pro.js";

const ALLOWED_HOSTS = new Set([
  "woogoro.com",
  "www.woogoro.com",
]);

function isAllowedRedirect(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.has(u.hostname);
  } catch (e) {
    return false;
  }
}

function deriveBaseUrl(req) {
  if (process.env.PRO_PUBLIC_BASE_URL) return process.env.PRO_PUBLIC_BASE_URL;
  const origin = req.headers["origin"];
  if (origin && isAllowedRedirect(origin)) return origin;
  return "https://woogoro.com";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const token = String(body.token || "");
  if (!isValidProToken(token)) {
    return res.status(400).json({ error: "invalid_token" });
  }

  const base = deriveBaseUrl(req);
  const successUrl = body.successUrl && isAllowedRedirect(body.successUrl)
    ? body.successUrl
    : `${base}/pro-success.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = body.cancelUrl && isAllowedRedirect(body.cancelUrl)
    ? body.cancelUrl
    : `${base}/pro-cancel.html`;

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return res.status(500).json({ error: "stripe_not_configured", detail: "STRIPE_PRO_PRICE_ID missing" });
  }

  let stripe;
  try {
    stripe = await getStripe();
  } catch (e) {
    return res.status(500).json({ error: "stripe_not_configured", detail: e.message });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { token, productSlug: "pro_report_v1" },
      payment_intent_data: {
        metadata: { token, productSlug: "pro_report_v1" },
        description: "Woogoro Pro Report - 30 days of Pro access across all verticals",
      },
      // Stripe sends the customer the receipt email automatically when one
      // is supplied; let Stripe collect it on the hosted page.
      // billing_address_collection: 'auto' is the default.
      // Allow promo codes off for launch — we don't have any and they signal
      // weakness to first-impression buyers.
      allow_promotion_codes: false,
    });
  } catch (e) {
    console.error("[pro-checkout] stripe error:", e && e.message);
    return res.status(502).json({ error: "stripe_error", detail: e.message });
  }

  return res.status(200).json({ url: session.url, sessionId: session.id });
}
