// /api/pro-status.js
//
// GET ?token=<32-hex>  -> { isPro: bool, expiresAt: number|null, daysRemaining: number|null }
//
// Used by analyzer pages to decide whether to render Pro features inline
// and whether to show or hide the Pro upsell. Lightweight Redis read.
//
// Errors:
//   400 invalid_token  - token missing or malformed (still returns isPro:false)
//
// Cache headers: no-store. Pro state changes on purchase/refund and clients
// should never hold a stale answer.

import { isValidProToken, getProState } from "./_pro.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = String((req.query && req.query.token) || "");
  if (!isValidProToken(token)) {
    return res.status(400).json({ isPro: false, expiresAt: null, daysRemaining: null, error: "invalid_token" });
  }

  const state = await getProState(token);
  if (!state) {
    return res.status(200).json({ isPro: false, expiresAt: null, daysRemaining: null });
  }

  const msRemaining = state.expiresAt - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 3600 * 1000)));
  return res.status(200).json({
    isPro: true,
    expiresAt: state.expiresAt,
    daysRemaining,
  });
}
