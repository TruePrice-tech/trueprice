// Shared Resend send helper for transactional + commercial emails.
//
// Compliance shell wrapped around every send:
//   1. Postal address footer (CAN-SPAM § 5(a)(5)) — required for COMMERCIAL sends only.
//      Transactional sends (purpose: "transactional") are exempt under § 7702(17) and
//      skip the postal requirement entirely. For commercial sends, gated on
//      WOOGORO_POSTAL_ADDRESS env var; if unset, send() returns
//      { ok: false, reason: "no_postal_address" } and does NOT call Resend.
//   2. One-click unsubscribe headers (RFC 8058, Gmail/Yahoo bulk-sender rule, Feb 2024):
//        List-Unsubscribe: <https://woogoro.com/api/email-unsubscribe?e=...&t=...>
//        List-Unsubscribe-Post: List-Unsubscribe=One-Click
//      Always set, even for transactional, because bulk-sender filters apply
//      regardless of CAN-SPAM classification.
//   3. Visible unsubscribe / preferences link in HTML footer.
//   4. Every send writes the suppression check before composing — callers should also
//      pre-check, but defense in depth.
//
// Caller convention:
//   - Pass `purpose: "transactional"` for account-state messages (magic links,
//     receipt confirms, balance changes, saved-watch notifications, redemption
//     confirms, account lifecycle). These are § 7702(17) transactional and DO NOT
//     require a postal address.
//   - Omit `purpose` (or pass anything else) for commercial sends (newsletters,
//     promotional content). These require a valid WOOGORO_POSTAL_ADDRESS env var.
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
  // Refuse to mint tokens with the literal dev secret in production —
  // unsubscribe tokens signed with a known-public secret are forgeable
  // and would let anyone unsubscribe arbitrary recipients. Dev/local
  // and test runs still get the fallback so they don't need env wiring.
  if (secret === "dev-secret-do-not-use-in-prod" && process.env.NODE_ENV === "production") {
    throw new Error("EMAIL_UNSUBSCRIBE_SECRET (or WOOGORO_HMAC_SECRET) must be set in production");
  }
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

function complianceFooter(emailHash, isTransactional) {
  const unsub = unsubscribeUrl(emailHash);

  if (isTransactional) {
    // Transactional footer: § 7702(17) account-state notifications. No postal
    // address required. Manage-preferences link kept as good practice and to
    // satisfy bulk-sender filter expectations.
    return `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;font-family:sans-serif;line-height:1.6;">
      <p style="margin:0 0 8px;">You're receiving this because of activity on your Woogoro account.</p>
      <p style="margin:0;"><a href="${unsub}" style="color:#64748b;text-decoration:underline;">Manage email preferences</a> &middot; <a href="${SITE_ORIGIN}/privacy.html" style="color:#64748b;text-decoration:underline;">Privacy</a></p>
    </div>`;
  }

  // Commercial footer: CAN-SPAM § 5(a)(5) requires a valid physical postal address.
  const addr = postalAddress();
  // Vercel's env editor flattens newlines to spaces. Insert breaks before
  // street-style tokens so single-line input still renders as a 2-3 line block.
  let addrHtml = "";
  if (addr) {
    const lines = addr.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length > 1) {
      addrHtml = lines.map(escapeHtml).join("<br>");
    } else {
      // Heuristic split: "Woogoro LLC, 17064 Laurelmont Court, Fort Mill, SC 29707"
      // or the same string with spaces. Break on commas first.
      const flat = lines[0];
      const parts = flat.includes(",")
        ? flat.split(",").map((s) => s.trim()).filter(Boolean)
        : [flat];
      addrHtml = parts.map(escapeHtml).join("<br>");
    }
  }
  return `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;font-family:sans-serif;line-height:1.6;">
    <p style="margin:0 0 8px;">You're getting this because you opted in to updates at woogoro.com.</p>
    <p style="margin:0 0 8px;"><a href="${unsub}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a> &middot; <a href="${SITE_ORIGIN}/privacy.html" style="color:#64748b;text-decoration:underline;">Privacy</a></p>
    ${addrHtml ? `<p style="margin:0;color:#94a3b8;">${addrHtml}</p>` : ""}
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// Send one email through Resend with compliance shell applied.
// Required: { to, subject, html, emailHash }.
// Optional: { from, replyTo, purpose }.
//   purpose: "transactional" — § 7702(17) account-state message; postal address NOT required.
//   purpose: anything else (or unset) — commercial message; postal address required.
//
// Returns { ok, reason, status, body } — never throws on Resend errors.
export async function sendEmail({ to, subject, html, emailHash, from, replyTo, purpose }) {
  if (!to || !subject || !html || !emailHash) {
    return { ok: false, reason: "missing_required_fields" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_api_key" };

  const isTransactional = purpose === "transactional";
  const addr = postalAddress();
  if (!isTransactional && !addr) return { ok: false, reason: "no_postal_address" };

  // Re-check suppression at send time (caller may have a stale record).
  try {
    const suppressed = await redis.get(`tp:email_suppression:${emailHash}`);
    if (suppressed) return { ok: false, reason: "suppressed" };
  } catch (e) {
    // fail open — better to send than to lose a legitimate transactional email
  }

  const finalHtml = `${html}${complianceFooter(emailHash, isTransactional)}`;
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
