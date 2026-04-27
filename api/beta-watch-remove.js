// /api/beta-watch-remove — POST, beta-session-gated. Removes a saved watch
// from the calling user's account. Body: { id }.
// Tier 4 (account feature; never gated by usage throttle).

import { resolveUserFromRequest } from "./_beta-session.js";
import { removeWatch } from "./_watches.js";
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

  const result = await removeWatch(ctx.user.userId, body.id);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 400;
    return res.status(status).json({ error: result.reason });
  }
  return res.status(200).json({ ok: true, removed: result.removed });
}
