// /api/beta-watch-add — POST, beta-session-gated. Adds a saved watch to the
// calling user's account. Body: { vertical, city, state, threshold? }.
// Tier 4 (account feature; never gated by usage throttle).

import { resolveUserFromRequest } from "./_beta-session.js";
import { addWatch } from "./_watches.js";
import { track } from "./_usage-gate.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  await track();

  const ctx = await resolveUserFromRequest(req);
  if (!ctx) return res.status(401).json({ error: "Not signed in" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const result = await addWatch(ctx.user.userId, {
    vertical: body.vertical,
    city: body.city,
    state: body.state,
    threshold: body.threshold,
  });

  if (!result.ok) {
    return res.status(400).json({ error: result.reason, watch: result.watch || null });
  }
  return res.status(200).json({ ok: true, watch: result.watch });
}
