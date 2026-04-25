// /api/_woogoros-ledger.js
//
// Append-only Woo Cash ledger. Every issuance and spend goes through
// here. The ledger is the audit trail; the per-user balance counter
// (wg:balance:{userId}) is a denormalized cache for fast reads.
//
// Tamper evidence:
//   Each entry stores prevHash + hash. Hash is sha256 over the entry's
//   own canonical fields plus the previous entry's hash. Breaking the
//   chain is detectable by re-walking and comparing.
//
// Atomicity caveat:
//   Upstash Redis pipelines are not transactional in the multi-EXEC
//   sense. We accept a small race window: if a process dies between
//   the LPUSH and the INCRBY, the ledger may briefly disagree with
//   the counter. The ledger is the source of truth; an admin
//   reconciliation can recompute the counter from ledger sum.
//
// Usage:
//
//   import { issueWoo, spendWoo, getBalance, listLedger } from "./_woogoros-ledger.js";
//
//   await issueWoo({ userId, amount: 500, source: "receipt:abc123",
//                    meta: { vertical: "roofing" } });
//
//   await spendWoo({ userId, amount: 50000, source: "redeem:order_xyz",
//                    meta: { catalog: "home_depot_50" } });
//
// Sources by convention:
//   receipt:<id>    -> verified-receipt issuance
//   quote:<id>      -> verified-quote issuance
//   bonus:<reason>  -> manual / streak / admin grants
//   redeem:<id>     -> user-initiated spend
//   admin:<reason>  -> admin debit/credit (reconciliation, refunds)

import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

const ALLOWED_SOURCE_RE = /^(receipt|quote|bonus|redeem|admin):[A-Za-z0-9_\-:.]{1,80}$/;

function newEntryId() {
  return "lg_" + crypto.randomBytes(9).toString("base64url");
}

function canonicalize(entry) {
  // Stable key order for hashing. Do NOT include hash/prevHash.
  return JSON.stringify({
    id: entry.id,
    userId: entry.userId,
    type: entry.type,
    amount: entry.amount,
    source: entry.source,
    meta: entry.meta || null,
    ts: entry.ts,
  });
}

function computeHash(prevHash, entry) {
  return crypto
    .createHash("sha256")
    .update((prevHash || "GENESIS") + "\n" + canonicalize(entry))
    .digest("hex");
}

async function appendEntry(userId, type, amount, source, meta) {
  if (!userId) throw new Error("ledger: userId required");
  if (type !== "issue" && type !== "spend") throw new Error("ledger: bad type");
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("ledger: amount must be positive integer");
  if (!source || !ALLOWED_SOURCE_RE.test(source)) throw new Error("ledger: bad source format");

  const prevHash = (await redis.get(`wg:ledger_chain:${userId}`)) || null;

  const entry = {
    id: newEntryId(),
    userId,
    type,
    amount,
    source,
    meta: meta || null,
    ts: Date.now(),
    prevHash: prevHash || null,
  };
  entry.hash = computeHash(prevHash, entry);

  // Order matters: write the chain pointer LAST so a partial-failure
  // leaves us with an entry that simply isn't recognized as the head.
  // On the next append we'd re-read the (stale) chain pointer and the
  // newly-appended row would orphan, but the old chain remains valid.
  // A reconciliation tool can fix orphans by re-hashing the LIST head.
  await redis.lpush(`wg:ledger:${userId}`, JSON.stringify(entry));
  await redis.lpush("wg:ledger_global", JSON.stringify({
    userId, ts: entry.ts, type, amount, source, id: entry.id,
  }));
  // Keep the global list bounded so it never grows unboundedly.
  await redis.ltrim("wg:ledger_global", 0, 9999);

  await redis.set(`wg:ledger_chain:${userId}`, entry.hash);

  return entry;
}

export async function issueWoo({ userId, amount, source, meta }) {
  const entry = await appendEntry(userId, "issue", amount, source, meta);
  await redis.incrby(`wg:balance:${userId}`, amount);
  return entry;
}

export async function spendWoo({ userId, amount, source, meta }) {
  const current = await getBalance(userId);
  if (current < amount) {
    const err = new Error("Insufficient Woo balance");
    err.code = "INSUFFICIENT_FUNDS";
    err.balance = current;
    err.requested = amount;
    throw err;
  }
  const entry = await appendEntry(userId, "spend", amount, source, meta);
  await redis.decrby(`wg:balance:${userId}`, amount);
  return entry;
}

export async function getBalance(userId) {
  const v = await redis.get(`wg:balance:${userId}`);
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

export async function listLedger(userId, { limit = 50, offset = 0 } = {}) {
  const stop = offset + limit - 1;
  const rows = await redis.lrange(`wg:ledger:${userId}`, offset, stop);
  return (rows || []).map((r) => (typeof r === "string" ? JSON.parse(r) : r));
}

export async function recomputeBalanceFromLedger(userId) {
  // Walk the entire ledger and sum. Use only for reconciliation; it's O(n).
  const rows = await redis.lrange(`wg:ledger:${userId}`, 0, -1);
  let bal = 0;
  for (const r of (rows || [])) {
    const e = typeof r === "string" ? JSON.parse(r) : r;
    if (e.type === "issue") bal += e.amount;
    else if (e.type === "spend") bal -= e.amount;
  }
  return bal;
}

export async function verifyChain(userId) {
  // Re-walk and re-hash to detect tampering. LRANGE returns newest-first
  // because we LPUSH; reverse so genesis is first.
  const rows = await redis.lrange(`wg:ledger:${userId}`, 0, -1);
  const entries = (rows || []).map((r) => (typeof r === "string" ? JSON.parse(r) : r)).reverse();

  let prev = null;
  for (const e of entries) {
    if ((e.prevHash || null) !== (prev || null)) {
      return { ok: false, brokenAt: e.id, reason: "prevHash mismatch" };
    }
    const expected = computeHash(prev, e);
    if (expected !== e.hash) {
      return { ok: false, brokenAt: e.id, reason: "hash mismatch" };
    }
    prev = e.hash;
  }
  return { ok: true, length: entries.length, head: prev };
}

export async function listGlobalRecent(limit = 50) {
  const rows = await redis.lrange("wg:ledger_global", 0, limit - 1);
  return (rows || []).map((r) => (typeof r === "string" ? JSON.parse(r) : r));
}
