// /api/beta-admin.js
//
// Admin operations for the Woogoros shadow build. Single endpoint with
// an `op` parameter so we don't have to register N functions in vercel.json.
//
// Auth: must include header `x-admin-token: <BETA_ADMIN_TOKEN>` matching
// the env var. Without that env var set the endpoint refuses everything.
//
// Operations (POST except where noted):
//   { op: "issue_invite" }
//       -> creates a beta invite token. Returns { token, url }.
//
//   { op: "approve", email: "..." }
//       -> flips isBeta=true on the user record (creating if needed).
//
//   { op: "revoke", email: "..." }
//       -> flips isBeta=false; existing sessions remain until expiry.
//
//   { op: "fetch_magic_link", email: "..." }
//       -> returns the most recent unconsumed magic link for that email,
//          for manual sending until an email provider is wired.
//
//   { op: "issue_woo", email: "...", amount: 500, source: "bonus:test" }
//       -> manual Woo grant for testing the ledger end-to-end.
//
//   { op: "user", email: "..." }   GET-style read, but we accept POST for consistency
//       -> dumps user record + balance + recent ledger.

import {
  isValidEmail,
  hashEmail,
  ensureUserRecord,
  updateUser,
  getUserByEmail,
  issueBetaInvite,
} from "./_beta-session.js";
import { issueWoo, getBalance, listLedger, listGlobalRecent } from "./_woogoros-ledger.js";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

function timingSafeEqualString(a, b) {
  try {
    const ab = Buffer.from(String(a || ""), "utf8");
    const bb = Buffer.from(String(b || ""), "utf8");
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const adminToken = process.env.BETA_ADMIN_TOKEN;
  if (!adminToken || adminToken.length < 16) {
    return res.status(503).json({ error: "Admin endpoint not configured." });
  }

  const presented = req.headers["x-admin-token"] || "";
  if (!timingSafeEqualString(presented, adminToken)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const op = String(body.op || "").trim();

  try {
    if (op === "issue_invite") {
      const token = await issueBetaInvite();
      return res.status(200).json({
        token,
        url: `https://woogoro.com/beta/login.html?invite=${token}`,
      });
    }

    if (op === "approve" || op === "revoke") {
      if (!isValidEmail(body.email)) return res.status(400).json({ error: "Bad email" });
      const user = await ensureUserRecord(body.email);
      const updated = await updateUser(user.userId, {
        isBeta: op === "approve",
        betaApprovedAt: op === "approve" ? Date.now() : null,
        betaSource: op === "approve" ? "admin" : null,
      });
      return res.status(200).json({ ok: true, user: updated });
    }

    if (op === "fetch_magic_link") {
      if (!isValidEmail(body.email)) return res.status(400).json({ error: "Bad email" });
      const eh = hashEmail(body.email);
      const raw = await redis.get(`wg:pending_magic:${eh}`);
      if (!raw) return res.status(404).json({ error: "No pending magic link." });
      const rec = typeof raw === "string" ? JSON.parse(raw) : raw;
      return res.status(200).json({
        url: `https://woogoro.com/api/beta-auth-verify?token=${rec.token}`,
        createdAt: rec.createdAt,
      });
    }

    if (op === "issue_woo") {
      if (!isValidEmail(body.email)) return res.status(400).json({ error: "Bad email" });
      const amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: "amount must be a positive integer" });
      }
      const source = String(body.source || "admin:manual_grant");
      const meta = body.meta || null;
      const user = await ensureUserRecord(body.email);
      const entry = await issueWoo({ userId: user.userId, amount, source, meta });
      const balance = await getBalance(user.userId);
      return res.status(200).json({ ok: true, entry, balance });
    }

    if (op === "user") {
      if (!isValidEmail(body.email)) return res.status(400).json({ error: "Bad email" });
      const user = await getUserByEmail(body.email);
      if (!user) return res.status(404).json({ error: "User not found" });
      const balance = await getBalance(user.userId);
      const ledger = await listLedger(user.userId, { limit: 50 });
      return res.status(200).json({ user, balance, ledger });
    }

    if (op === "global_ledger") {
      const limit = Math.min(parseInt(body.limit, 10) || 100, 500);
      const rows = await listGlobalRecent(limit);
      return res.status(200).json({ rows });
    }

    return res.status(400).json({ error: "Unknown op" });
  } catch (e) {
    console.error("[beta-admin] op failed:", op, e && e.message);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
