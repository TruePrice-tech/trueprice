// /api/beta-auth-request.js
//
// POST { email, ageOk, inviteToken? }
//
// Issues a magic link for the given email. Caller must affirm 18+
// (ageOk:true) and, optionally, supply a beta invite token. Invite
// tokens are NOT required to receive a link -- they auto-promote
// the user to isBeta:true on consumption. Without one the user is
// created in a non-beta state and waits on manual approval.
//
// Send infrastructure note (G1):
//   No email provider is wired yet. The link is written into Redis
//   so an admin endpoint can retrieve it manually for the first beta
//   testers. When BETA_DEV_RETURN_MAGIC_LINK=true the link is also
//   echoed in the response (useful for local dev only). Never set
//   that env var in production.

import {
  isValidEmail,
  normalizeEmail,
  hashEmail,
  ensureUserRecord,
  updateUser,
  issueMagicLink,
  consumeBetaInvite,
  getIp,
  todayUtc,
  bumpDailyCounter,
} from "./_beta-session.js";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const IP_DAILY_MAX = 10;
const EMAIL_DAILY_MAX = 5;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://woogoro.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const emailRaw = String(body.email || "").trim();
  const ageOk = body.ageOk === true;
  const inviteTokenRaw = body.inviteToken ? String(body.inviteToken).trim().toLowerCase() : null;

  if (!isValidEmail(emailRaw)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (!ageOk) {
    return res.status(400).json({ error: "You must confirm you are 18 or older." });
  }

  const ip = getIp(req);
  const ipGate = await bumpDailyCounter(`wg:rate:auth_ip:${ip}:${todayUtc()}`, IP_DAILY_MAX, 26 * 3600);
  if (!ipGate.ok) {
    return res.status(429).json({ error: "Too many login requests from your network today." });
  }

  const email = normalizeEmail(emailRaw);
  const eh = hashEmail(email);
  const emailGate = await bumpDailyCounter(`wg:rate:auth_email:${eh}:${todayUtc()}`, EMAIL_DAILY_MAX, 26 * 3600);
  if (!emailGate.ok) {
    return res.status(429).json({ error: "Too many login requests for this email today." });
  }

  let user;
  try {
    user = await ensureUserRecord(email);
  } catch (e) {
    console.error("[beta-auth-request] ensureUser failed:", e && e.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }

  // Persist age verification on the user record. Once true, stays true.
  if (!user.ageVerified) {
    user = await updateUser(user.userId, { ageVerified: true });
  }

  // Optional invite consumption -> promote to beta.
  let inviteConsumed = false;
  if (inviteTokenRaw) {
    inviteConsumed = await consumeBetaInvite(inviteTokenRaw);
    if (inviteConsumed && !user.isBeta) {
      user = await updateUser(user.userId, { isBeta: true, betaApprovedAt: Date.now(), betaSource: "invite" });
    }
  }

  let magic;
  try {
    magic = await issueMagicLink(email, { ageVerified: true, ip });
  } catch (e) {
    console.error("[beta-auth-request] issueMagicLink failed:", e && e.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }

  // Stash the most recent magic link for this email so admin can fetch
  // it before email send is wired up. Overwrites prior pending link for
  // the same email (which is what we want -- a re-request invalidates
  // earlier pending links by replacing the displayed one).
  await redis.set(
    `wg:pending_magic:${eh}`,
    JSON.stringify({ token: magic.token, email, createdAt: Date.now() }),
    { ex: magic.ttlSeconds }
  );

  const verifyUrl = `https://woogoro.com/api/beta-auth-verify?token=${magic.token}`;

  const response = { success: true, expiresInSeconds: magic.ttlSeconds, betaApproved: !!user.isBeta };
  if (process.env.BETA_DEV_RETURN_MAGIC_LINK === "true") {
    response.devMagicLink = verifyUrl;
  }
  return res.status(200).json(response);
}
