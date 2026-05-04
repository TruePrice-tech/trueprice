// /api/pro-webhook.js
//
// Stripe webhook receiver. Verifies the signature against
// STRIPE_WEBHOOK_SECRET, then handles:
//
//   checkout.session.completed       -> grant Pro for the token in metadata
//   charge.refunded / refund.created -> revoke Pro for the originating session
//   charge.dispute.created           -> revoke Pro (chargeback)
//
// Stripe requires the raw request body for signature verification, so this
// handler disables Vercel's automatic body parser and reads the raw bytes
// itself.
//
// Idempotency: each Stripe event_id is marked seen on first successful
// processing. Subsequent retries for the same event are acknowledged
// (200 OK) without re-running the side effect.

import { grantPro, revokePro, isEventSeen, markEventSeen, getStripe, isValidProToken } from "./_pro.js";
import { sendEmail, hashEmail } from "./_email-send.js";
import { proConfirmationTemplate } from "./_email-templates.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getTokenFromEvent(event) {
  const obj = event && event.data && event.data.object;
  if (!obj) return null;
  const meta = obj.metadata || (obj.payment_intent && obj.payment_intent.metadata) || {};
  return meta.token || null;
}

function getSessionIdFromEvent(event) {
  const obj = event && event.data && event.data.object;
  if (!obj) return null;
  if (event.type === "checkout.session.completed") {
    return obj.id || null;
  }
  // For charge / refund / dispute events, we need to map back to the
  // checkout session. The checkout.session.id is not directly on the charge,
  // but we stored it via the SESSION_PREFIX -> token mapping at grant time,
  // so revokePro looks the token up by sessionId. We try a few candidates:
  return obj.checkout_session || obj.session_id || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[pro-webhook] STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "webhook_not_configured" });
  }

  let stripe;
  try {
    stripe = await getStripe();
  } catch (e) {
    return res.status(500).json({ error: "stripe_not_configured", detail: e.message });
  }

  let raw;
  try {
    raw = await readRawBody(req);
  } catch (e) {
    return res.status(400).json({ error: "body_read_failed", detail: e.message });
  }

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("[pro-webhook] signature verification failed:", err && err.message);
    return res.status(400).json({ error: "signature_verification_failed", detail: err.message });
  }

  // Idempotency strategy: rely on session-level idempotency in grantPro and
  // revokePro (both are no-ops on duplicate session IDs). markEventSeen is
  // called AFTER successful processing as a perf optimization to short-circuit
  // Stripe retries (which can re-fire the same event up to 3 days). If
  // processing fails before we mark, the retry processes again — idempotent
  // ops keep the result consistent.
  if (await isEventSeen(event.id)) {
    return res.status(200).json({ ok: true, deduped: true });
  }

  let result;
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const token = getTokenFromEvent(event);
        if (!isValidProToken(token)) {
          console.error("[pro-webhook] checkout.session.completed missing/invalid token", session.id);
          await markEventSeen(event.id);
          return res.status(200).json({ ok: true, skipped: "no_token" });
        }
        // Only grant on actually-paid sessions. Stripe sends this event for
        // both payment-mode (instant) and async-payment-mode (delayed)
        // checkouts; we only consider it paid when payment_status === 'paid'.
        if (session.payment_status !== "paid") {
          await markEventSeen(event.id);
          return res.status(200).json({ ok: true, skipped: "not_paid", payment_status: session.payment_status });
        }
        const grant = await grantPro({
          token,
          sessionId: session.id,
          purchasedAt: (session.created ? session.created * 1000 : Date.now()),
        });

        // Send a branded confirmation email. Stripe Checkout collects the
        // customer email on its hosted page; it lands on session.customer_details.email.
        // We only send on a *new* grant (idempotent: webhook retries for the
        // same session won't double-email). Failure is logged but non-fatal —
        // the grant has already happened and we don't want Stripe to retry
        // the whole webhook over an email send blip.
        if (grant.granted) {
          const buyerEmail = session.customer_details && session.customer_details.email;
          if (buyerEmail) {
            try {
              const tpl = proConfirmationTemplate({ expiresAtMs: grant.state.expiresAt });
              const r = await sendEmail({
                to: buyerEmail,
                subject: tpl.subject,
                html: tpl.html,
                emailHash: hashEmail(buyerEmail),
                purpose: "transactional",
              });
              if (!r || !r.ok) {
                console.error("[pro-webhook] confirmation email failed:", r && r.reason, r && r.body);
              }
            } catch (e) {
              console.error("[pro-webhook] confirmation email exception:", e && e.message);
            }
          } else {
            console.error("[pro-webhook] no customer_details.email on session", session.id);
          }
        }

        result = { ok: true, granted: grant.granted };
        break;
      }

      case "charge.refunded":
      case "refund.created":
      case "charge.dispute.created": {
        // These events come on a charge object, not a checkout session.
        // Stripe attaches the original payment_intent on the charge; we map
        // payment_intent -> checkout session via Stripe's API, then revoke.
        const obj = event.data.object;
        const paymentIntentId = obj.payment_intent || (obj.charge && obj.charge.payment_intent);
        if (!paymentIntentId) {
          await markEventSeen(event.id);
          return res.status(200).json({ ok: true, skipped: "no_payment_intent" });
        }
        // Look up the checkout session that created this payment intent.
        let sessionId = null;
        try {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntentId,
            limit: 1,
          });
          if (sessions && sessions.data && sessions.data[0]) {
            sessionId = sessions.data[0].id;
          }
        } catch (e) {
          console.error("[pro-webhook] sessions.list failed:", e && e.message);
        }
        if (!sessionId) {
          await markEventSeen(event.id);
          return res.status(200).json({ ok: true, skipped: "no_session_for_pi" });
        }
        const revoke = await revokePro({ sessionId, reason: event.type });
        result = { ok: true, revoked: revoke.revoked };
        break;
      }

      default:
        // Unhandled event type — Stripe will keep sending it; ack-200 to avoid retries.
        await markEventSeen(event.id);
        return res.status(200).json({ ok: true, ignored: event.type });
    }
  } catch (e) {
    console.error("[pro-webhook] handler error:", e && e.message);
    // Don't mark seen on failure: let Stripe retry and idempotent ops re-converge.
    return res.status(500).json({ error: "handler_error", detail: e.message });
  }

  // Success: mark the event seen so future Stripe retries short-circuit.
  await markEventSeen(event.id);
  return res.status(200).json(result);
}
