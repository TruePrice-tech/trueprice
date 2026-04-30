// /api/pro-firstview.js
//
// POST { token } -> idempotently marks the first time this Pro token rendered
// Pro content into a real analyzer report. Used as the "value consumed" signal
// for self-service refund eligibility (see api/pro-refund.js + api/_pro.js).
//
// Called as a fire-and-forget beacon from js/pro-tier.js's injectIntoReport()
// when isPro=true. The beacon should be fired ONCE per page that actually
// renders Pro sections (not the success page, which doesn't render them).
//
// Errors:
//   400 invalid_token  - token missing or malformed
//
// Always 200 with { marked: bool, reason } so beacons never block the user.
// Reasons:
//   "first_view"      - first call for this token, firstViewedAt was set
//   "already_viewed"  - firstViewedAt already set
//   "no_active_pro"   - token has no active Pro state
//   "invalid_token"   - token failed format check

import { isValidProToken, markFirstView } from "./_pro.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const token = body && body.token;

  if (!isValidProToken(token)) {
    return res.status(400).json({ marked: false, reason: "invalid_token" });
  }

  try {
    const result = await markFirstView(token);
    return res.status(200).json({
      marked: result.marked,
      reason: result.marked ? "first_view" : (result.reason || "unknown"),
    });
  } catch (e) {
    console.error("[pro-firstview] failed:", e && e.message);
    return res.status(200).json({ marked: false, reason: "error" });
  }
}
