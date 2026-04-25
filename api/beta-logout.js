// /api/beta-logout.js
//
// Destroys the current session and clears the cookie. Idempotent: a
// missing or already-expired cookie still returns 200.

import {
  readSessionCookie,
  destroySession,
  buildClearSessionCookie,
} from "./_beta-session.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = readSessionCookie(req);
  if (token) {
    try {
      await destroySession(token);
    } catch (e) { /* swallow */ }
  }

  res.setHeader("Set-Cookie", buildClearSessionCookie());

  if (req.method === "GET") {
    res.statusCode = 302;
    res.setHeader("Location", "/beta/index.html");
    return res.end();
  }
  return res.status(200).json({ success: true });
}
