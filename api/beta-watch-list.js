// /api/beta-watch-list — GET, beta-session-gated. Returns the calling user's
// saved watches. Tier 4 (account feature; never gated by usage throttle).

import { resolveUserFromRequest } from "./_beta-session.js";
import { listWatches } from "./_watches.js";
import { track } from "./_usage-gate.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await track();

  const ctx = await resolveUserFromRequest(req);
  if (!ctx) return res.status(401).json({ error: "Not signed in" });

  const watches = await listWatches(ctx.user.userId);
  return res.status(200).json({ ok: true, watches });
}
