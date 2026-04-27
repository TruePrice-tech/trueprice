// Shared Resend send helper for transactional + marketing emails.
//
// Compliance shell wrapped around every send:
//   1. Postal address footer (CAN-SPAM § 5(a)(5)) — gated on WOOGORO_POSTAL_ADDRESS env var.
//      If the env var is not set, send() returns { ok: false, reason: "no_postal_address" }
//      and does NOT call Resend. Capture flows still succeed; sends quietly no-op.
//   2. One-click unsubscribe headers (RFC 8058, Gmail/Yahoo bulk-sender rule, Feb 2024):
//        List-Unsubscribe: <https://woogoro.com/api/email-unsubscribe?e=...&t=...>
//        List-Unsubscribe-Post: List-Unsubscribe=One-Click
//   3. Visible unsubscribe link in HTML footer.
//   4. Every send writes the suppression check before composing — callers should also
//      pre-check, but defense in depth.
//
// Why this lives in api/ alongside endpoints rather than a top-level lib/: Vercel
// serverless functions can only import from siblings without bundler config, and
// the existing _flywheel-guard.js + _beta-session.js follow the same convention.

import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

const SITE_ORIGIN = "https://woogoro.com";

export function signUnsubscribeToken(emailHash) {
  const secret =
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.WOOGORO_HMAC_SECRET ||
    "dev-secret-do-not-use-in-prod";
  return crypto.createHmac("sha256", secret).update(emailHash).digest("hex");
}

export function hashEmail(email) {
  return crypto
    .createHash("sha256")
    .update(String(email).toLowerCase().trim())
    .digest("hex");
}

export function unsubscribeUrl(emailHash) {
  const token = signUnsubscribeToken(emailHash);
  return `${SITE_ORIGIN}/api/email-unsubscribe?e=${emailHash}&t=${token}`;
}

function postalAddress() {
  return (process.env.WOOGORO_POSTAL_ADDRESS || "").trim();
}

function complianceFooter(emailHash) {
  const addr = postalAddress();
  const unsub = unsubscribeUrl(emailHash);
  const addrHtml = addr
    ? addr
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join("<br>")
    : "";
  return `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;font-family:sans-serif;line-height:1.6;">
    <p style="margin:0 0 8px;">You're getting this because you opted in to price updates at woogoro.com.</p>
    <p style="margin:0 0 8px;"><a href="${unsub}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a> &middot; <a href="${SITE_ORIGIN}/privacy.html" style="color:#64748b;text-decoration:underline;">Privacy</a></p>
    ${addrHtml ? `<p style="margin:0;color:#94a3b8;">Woogoro<br>${addrHtml}</p>` : ""}
  </div>`;
}

// Send one email through Resend with compliance shell applied.
// Required: { to, subject, html, emailHash }.
// Optional: { from, replyTo }.
//
// Returns { ok, reason, status, body } — never throws on Resend errors.
export async function sendEmail({ to, subject, html, emailHash, from, replyTo }) {
  if (!to || !subject || !html || !emailHash) {
    return { ok: false, reason: "missing_required_fields" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_api_key" };

  const addr = postalAddress();
  if (!addr) return { ok: false, reason: "no_postal_address" };

  // Re-check suppression at send time (caller may have a stale record).
  try {
    const suppressed = await redis.get(`tp:email_suppression:${emailHash}`);
    if (suppressed) return { ok: false, reason: "suppressed" };
  } catch (e) {
    // fail open — better to send than to lose a legitimate transactional email
  }

  const finalHtml = `${html}${complianceFooter(emailHash)}`;
  const unsub = unsubscribeUrl(emailHash);

  const body = {
    from: from || "Iris from Woogoro <hello@woogoro.com>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html: finalHtml,
    headers: {
      "List-Unsubscribe": `<${unsub}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
  if (replyTo) body.reply_to = replyTo;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) {
      return { ok: false, reason: `resend_${r.status}`, status: r.status, body: text };
    }
    return { ok: true, status: r.status, body: text };
  } catch (e) {
    return { ok: false, reason: "exception", error: e && e.message };
  }
}
