// /api/_pro-dev-grant.js
//
// DEV-ONLY endpoint for Puppeteer-driven testing of the Pro tier flow
// without going through Stripe Checkout (which actively fights headless
// browsers). Grants or revokes Pro for an arbitrary token.
//
// Gated by env var PRO_DEV_GRANT_TOKEN. If unset, this endpoint returns
// 404 — there is no way to invoke it. Set the env var to a long random
// string in Vercel when you want to enable dev testing; unset it to seal
// the endpoint.
//
// Usage:
//   POST /api/_pro-dev-grant
//   Headers: x-dev-grant-token: <PRO_DEV_GRANT_TOKEN>
//   Body:    { token: "<32-hex>", op: "grant" | "revoke" }
//
//   Response: { ok: true, op, state? } or { error: "..." }
//
// The "session_id" used for the grant is synthesized as `dev_<timestamp>`
// so it cannot collide with real Stripe session IDs (which start with `cs_`).

import { isValidProToken, grantPro, revokePro } from "./_pro.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const guardToken = process.env.PRO_DEV_GRANT_TOKEN;
  if (!guardToken) {
    // Endpoint is sealed: pretend it doesn't exist
    return res.status(404).json({ error: "not_found" });
  }

  const provided = req.headers["x-dev-grant-token"];
  if (provided !== guardToken) {
    return res.status(403).json({ error: "forbidden" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const body = req.body || {};
  const token = String(body.token || "");
  const op = String(body.op || "grant");

  if (!isValidProToken(token)) {
    return res.status(400).json({ error: "invalid_token" });
  }

  if (op === "grant") {
    const sessionId = "dev_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
    const result = await grantPro({ token, sessionId, purchasedAt: Date.now() });
    return res.status(200).json({ ok: true, op: "grant", sessionId, state: result.state });
  }

  if (op === "revoke") {
    // For revoke, body.sessionId is optional; if provided, revoke that
    // session. Otherwise we can't revoke without it (Pro state is keyed by
    // session ID for refund handling). For dev convenience, we also
    // support deleting the token's state directly.
    if (body.sessionId) {
      const result = await revokePro({ sessionId: String(body.sessionId), reason: "dev_revoke" });
      return res.status(200).json({ ok: true, op: "revoke", result });
    }
    // No sessionId: do a direct delete of the Pro state for the token.
    // This skips the session-mapping logic but is fine for dev cleanup.
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = Redis.fromEnv();
      await redis.del("tp:pro:" + token);
      return res.status(200).json({ ok: true, op: "revoke", method: "direct_delete" });
    } catch (e) {
      return res.status(500).json({ error: "redis_failed", detail: e.message });
    }
  }

  return res.status(400).json({ error: "unknown_op", op });
}
