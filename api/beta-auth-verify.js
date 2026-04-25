// /api/beta-auth-verify.js
//
// GET ?token=<48 hex>
//
// Consumes a magic link, creates a session, sets the wg_session cookie
// and 302-redirects to /beta/burrow.html. On any failure redirects back
// to /beta/login.html?err=<reason>.
//
// Single-use: the underlying token is deleted by consumeMagicLink so a
// shared/reused link will fail with err=expired on the second click.

import {
  consumeMagicLink,
  ensureUserRecord,
  updateUser,
  createSession,
  buildSessionCookie,
  getIp,
  todayUtc,
  bumpDailyCounter,
} from "./_beta-session.js";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

function redirectErr(res, reason) {
  const url = `/beta/login.html?err=${encodeURIComponent(reason)}`;
  res.statusCode = 302;
  res.setHeader("Location", url);
  return res.end();
}

function redirectOk(res) {
  res.statusCode = 302;
  res.setHeader("Location", "/beta/burrow.html");
  return res.end();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = String((req.query && req.query.token) || "").trim().toLowerCase();
  if (!/^[0-9a-f]{48}$/.test(token)) {
    return redirectErr(res, "bad_link");
  }

  // Light per-IP throttle to discourage token guessing. Magic tokens are
  // 24 random bytes (192 bits) so guessing is computationally infeasible
  // already, but we don't want anyone to even try.
  const ip = getIp(req);
  const ipGate = await bumpDailyCounter(`wg:rate:verify_ip:${ip}:${todayUtc()}`, 60, 26 * 3600);
  if (!ipGate.ok) {
    return redirectErr(res, "rate_limited");
  }

  let payload;
  try {
    payload = await consumeMagicLink(token);
  } catch (e) {
    console.error("[beta-auth-verify] consume failed:", e && e.message);
    return redirectErr(res, "server_error");
  }
  if (!payload || !payload.email) {
    return redirectErr(res, "expired");
  }

  let user;
  try {
    user = await ensureUserRecord(payload.email);
    if (payload.ageVerified && !user.ageVerified) {
      user = await updateUser(user.userId, { ageVerified: true });
    }
  } catch (e) {
    console.error("[beta-auth-verify] ensureUser failed:", e && e.message);
    return redirectErr(res, "server_error");
  }

  let session;
  try {
    session = await createSession(user.userId);
  } catch (e) {
    console.error("[beta-auth-verify] createSession failed:", e && e.message);
    return redirectErr(res, "server_error");
  }

  // Clear the pending magic-link cache for this email; we just consumed it.
  try {
    await redis.del(`wg:pending_magic:${user.emailHash}`);
  } catch (e) { /* swallow */ }

  res.setHeader("Set-Cookie", buildSessionCookie(session.token));

  // Non-beta users still get a session (so the flow feels finished), but
  // /beta/burrow.html will detect the missing flag and route them to a
  // "waitlisted" state.
  return redirectOk(res);
}
