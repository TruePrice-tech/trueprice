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
import { collectWoogoro, bumpStreak } from "./_beta-session.js";
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

    if (op === "review_queue") {
      const limit = Math.min(parseInt(body.limit, 10) || 50, 200);
      const ids = await redis.lrange("wg:review_queue", 0, limit - 1);
      const items = [];
      for (const id of (ids || [])) {
        const raw = await redis.get(`wg:submission:${id}`);
        if (!raw) continue;
        items.push(typeof raw === "string" ? JSON.parse(raw) : raw);
      }
      return res.status(200).json({ items });
    }

    if (op === "approve_submission") {
      const id = String(body.submissionId || "").trim();
      if (!/^[qr]_[A-Za-z0-9_-]{6,}$/.test(id)) {
        return res.status(400).json({ error: "Bad submissionId" });
      }
      const raw = await redis.get(`wg:submission:${id}`);
      if (!raw) return res.status(404).json({ error: "Submission not found" });
      const sub = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (sub.status === "verified") {
        return res.status(200).json({ ok: true, alreadyVerified: true, submission: sub });
      }
      const amount = sub.kind === "receipt" ? 500 : 100;
      const entry = await issueWoo({
        userId: sub.userId,
        amount,
        source: `${sub.kind}:${sub.id}`,
        meta: { vertical: sub.classifiedVertical, declaredAmount: sub.declaredAmount, adminApproved: true },
      });
      const collect = await collectWoogoro(sub.userId, sub.classifiedVertical);
      const streak = await bumpStreak(sub.userId);
      sub.status = "verified";
      sub.verifiedAt = Date.now();
      sub.verifiedBy = "admin";
      sub.ledgerEntryId = entry.id;
      await redis.set(`wg:submission:${id}`, JSON.stringify(sub));
      // Best-effort removal from review queue (LREM all matches).
      try { await redis.lrem("wg:review_queue", 0, id); } catch (e) { /* swallow */ }
      return res.status(200).json({
        ok: true,
        submission: sub,
        wooGranted: amount,
        newCollection: collect.newCollection,
        streakDays: streak.streakDays,
      });
    }

    if (op === "reject_submission") {
      const id = String(body.submissionId || "").trim();
      const reason = String(body.reason || "admin_rejected").slice(0, 80);
      if (!/^[qr]_[A-Za-z0-9_-]{6,}$/.test(id)) {
        return res.status(400).json({ error: "Bad submissionId" });
      }
      const raw = await redis.get(`wg:submission:${id}`);
      if (!raw) return res.status(404).json({ error: "Submission not found" });
      const sub = typeof raw === "string" ? JSON.parse(raw) : raw;
      sub.status = "rejected";
      sub.rejectedAt = Date.now();
      sub.rejectionReason = reason;
      await redis.set(`wg:submission:${id}`, JSON.stringify(sub));
      try { await redis.lrem("wg:review_queue", 0, id); } catch (e) { /* swallow */ }
      return res.status(200).json({ ok: true, submission: sub });
    }

    if (op === "order_queue") {
      const limit = Math.min(parseInt(body.limit, 10) || 50, 200);
      const ids = await redis.lrange("wg:order_queue", 0, limit - 1);
      const items = [];
      for (const id of (ids || [])) {
        const raw = await redis.get(`wg:order:${id}`);
        if (!raw) continue;
        items.push(typeof raw === "string" ? JSON.parse(raw) : raw);
      }
      return res.status(200).json({ items });
    }

    if (op === "update_order") {
      // Mark order fulfilled / shipped / delivered. Optional trackingNumber.
      const id = String(body.orderId || "").trim();
      const status = String(body.status || "").trim();
      if (!/^o_[A-Za-z0-9_-]{6,}$/.test(id)) {
        return res.status(400).json({ error: "Bad orderId" });
      }
      if (!["fulfilled","shipped","delivered","cancelled"].includes(status)) {
        return res.status(400).json({ error: "status must be fulfilled|shipped|delivered|cancelled" });
      }
      const raw = await redis.get(`wg:order:${id}`);
      if (!raw) return res.status(404).json({ error: "Order not found" });
      const order = typeof raw === "string" ? JSON.parse(raw) : raw;
      const tracking = body.trackingNumber ? String(body.trackingNumber).trim().slice(0, 80) : null;

      order.status = status;
      const now = Date.now();
      if (status === "fulfilled") order.fulfilledAt = now;
      if (status === "shipped")   { order.shippedAt = now; if (tracking) order.trackingNumber = tracking; }
      if (status === "delivered") order.deliveredAt = now;
      if (status === "cancelled") order.cancelledAt = now;
      await redis.set(`wg:order:${id}`, JSON.stringify(order));
      // Once delivered or cancelled, drop from active queue.
      if (status === "delivered" || status === "cancelled") {
        try { await redis.lrem("wg:order_queue", 0, id); } catch (e) { /* swallow */ }
      }
      return res.status(200).json({ ok: true, order });
    }

    return res.status(400).json({ error: "Unknown op" });
  } catch (e) {
    console.error("[beta-admin] op failed:", op, e && e.message);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
