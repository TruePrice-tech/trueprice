// /api/_woogoros-verifier.js
//
// Pluggable verifier interface for Woogoros submissions.
//
//   verifyQuote({ text, declaredVertical, declaredAmount })
//     -> { pass, fields, vertical, reasons, trustScore }
//
//   verifyReceipt({ text, declaredVertical, declaredAmount, imageHash, hasImage })
//     -> { pass, fields, vertical, reasons, trustScore, requiresReview }
//
// Today (Phase 2) the receipt verifier is a rule-based stub. When the
// Theia receipt LoRA + fake detector ship (~May 10), the stub gets
// replaced with a Theia HTTP call -- the contract above stays the same
// so callers don't change.
//
// Trust score is 0..100. Receipts above 70 auto-grant. Below 70 marks
// the submission requiresReview=true so admin can approve manually.

import { checkDeclaredVertical } from "./_woogoros-vertical.js";

// -- Field extraction from receipt OCR text -------------------------------
//
// These regexes are deliberately forgiving. We trust the user's declared
// amount over what we can parse, and only use parsed fields for sanity.

// Money patterns. The inner alternation ORDER matters: comma-grouped
// numbers (e.g. "1,234.56") MUST be tried first so "2038.35" doesn't
// get truncated to "203" by a greedy \d{1,3} that doesn't require a
// comma. Subtle bug class: any receipt total >= $1000 without commas
// (which is most thermal-printer + OCR'd receipts) was previously
// being parsed as the leading 3 digits, breaking tax math + amount
// match. Fix: require the comma-form to actually contain a comma, then
// fall back to "any-digits + optional decimals".
const MONEY_NUM = "(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d{2})?|\\d+(?:\\.\\d{2})?)";
const MONEY_RE = new RegExp("\\$?\\s?(" + MONEY_NUM + ")\\b", "g");
// \b at start so "total" inside "subtotal" doesn't match. Word-boundary
// is between word/non-word chars; "subtotal" has no boundary between
// "sub" and "total", so \btotal correctly skips it.
const TOTAL_RE = new RegExp("\\b(?:total|amount due|balance due|grand total)\\b\\s*:?\\s*\\$?\\s?(" + MONEY_NUM + ")", "i");
const SUBTOTAL_RE = new RegExp("\\b(?:sub\\s*total|subtotal)\\b\\s*:?\\s*\\$?\\s?(" + MONEY_NUM + ")", "i");
const TAX_RE = new RegExp("\\b(?:sales\\s*tax|tax|vat)\\b\\s*:?\\s*\\$?\\s?(" + MONEY_NUM + ")", "i");
const DATE_RE = /\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2})\b/;

function parseMoney(s) {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/[,$\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDateLoose(s) {
  if (!s) return null;
  // Try Date.parse on a few normalizations.
  const tries = [s, s.replace(/\./g, "/").replace(/-/g, "/")];
  for (const t of tries) {
    const ms = Date.parse(t);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

export function extractReceiptFields(text) {
  const t = String(text || "");
  const totalMatch = t.match(TOTAL_RE);
  const subtotalMatch = t.match(SUBTOTAL_RE);
  const taxMatch = t.match(TAX_RE);
  const dateMatch = t.match(DATE_RE);

  const total = totalMatch ? parseMoney(totalMatch[1]) : null;
  const subtotal = subtotalMatch ? parseMoney(subtotalMatch[1]) : null;
  const tax = taxMatch ? parseMoney(taxMatch[1]) : null;
  const dateMs = dateMatch ? parseDateLoose(dateMatch[1]) : null;

  // Heuristic merchant: longest contiguous all-caps line in first 5 lines.
  const lines = t.split(/\r?\n/).slice(0, 8).map((l) => l.trim()).filter(Boolean);
  let merchant = null;
  for (const l of lines) {
    if (/^[A-Z0-9 &.\-']{4,40}$/.test(l) && /[A-Z]{3,}/.test(l)) {
      merchant = l;
      break;
    }
  }

  return { total, subtotal, tax, dateMs, merchant };
}

// Tax math sanity: subtotal + tax should match total within $1 OR 1.5%.
// Returns null if any field missing (we can't check). Returns
// { ok, expected, actual, delta } when checkable.
export function taxMathCheck({ subtotal, tax, total }) {
  if (subtotal == null || tax == null || total == null) return null;
  const expected = +(subtotal + tax).toFixed(2);
  const delta = Math.abs(expected - total);
  const tolerance = Math.max(1.0, total * 0.015);
  return { ok: delta <= tolerance, expected, actual: total, delta };
}

// -- Quote verification (text only) ---------------------------------------

export async function verifyQuote({ text, declaredVertical, declaredAmount }) {
  const reasons = [];
  let trust = 50;

  const trimmed = String(text || "").trim();
  if (trimmed.length < 80) {
    return {
      pass: false,
      fields: {},
      vertical: declaredVertical,
      reasons: ["text_too_short"],
      trustScore: 0,
    };
  }

  const verticalCheck = checkDeclaredVertical(trimmed, declaredVertical);
  if (!verticalCheck.ok) {
    reasons.push(verticalCheck.reason || "vertical_mismatch");
  } else {
    trust += Math.min(20, verticalCheck.score * 4);
  }

  const amount = Number(declaredAmount);
  if (!Number.isFinite(amount) || amount < 50 || amount > 1000000) {
    reasons.push("amount_out_of_range");
  } else {
    trust += 10;
    // Bonus: amount mentioned in text
    const moneyHits = (trimmed.match(MONEY_RE) || []).map(parseMoney).filter((n) => n != null);
    if (moneyHits.some((n) => Math.abs(n - amount) < Math.max(5, amount * 0.05))) {
      trust += 15;
    } else {
      reasons.push("amount_not_in_text");
    }
  }

  const pass = reasons.length === 0 || (reasons.length === 1 && reasons[0] === "amount_not_in_text");
  return {
    pass,
    fields: { declaredAmount: amount, verticalScore: verticalCheck.score },
    vertical: verticalCheck.ok ? declaredVertical : (verticalCheck.suggested || declaredVertical),
    reasons,
    trustScore: Math.max(0, Math.min(100, trust)),
  };
}

// -- Receipt verification (text + image hash) -----------------------------
//
// Stub: rule-based. Replace with Theia HTTP call when receipt LoRA ships.

export async function verifyReceipt({ text, declaredVertical, declaredAmount, imageHash, hasImage }) {
  const reasons = [];
  let trust = 40;

  const trimmed = String(text || "").trim();
  if (trimmed.length < 60) {
    return {
      pass: false,
      fields: {},
      vertical: declaredVertical,
      reasons: ["text_too_short"],
      trustScore: 0,
      requiresReview: false,
    };
  }
  if (!imageHash || !/^[0-9a-f]{64}$/.test(imageHash)) {
    return {
      pass: false,
      fields: {},
      vertical: declaredVertical,
      reasons: ["missing_image"],
      trustScore: 0,
      requiresReview: false,
    };
  }

  const fields = extractReceiptFields(trimmed);

  // Tax math sanity (when we can extract it)
  const tm = taxMathCheck(fields);
  if (tm != null) {
    if (tm.ok) trust += 15;
    else reasons.push("tax_math_mismatch");
  }

  // Date sanity: not future, not >3y old
  if (fields.dateMs) {
    const now = Date.now();
    if (fields.dateMs > now + 24 * 3600 * 1000) reasons.push("date_in_future");
    else if (fields.dateMs < now - 3 * 365 * 24 * 3600 * 1000) reasons.push("date_too_old");
    else trust += 10;
  } else {
    reasons.push("no_date_found");
  }

  // Amount sanity
  const amount = Number(declaredAmount);
  if (!Number.isFinite(amount) || amount < 5 || amount > 1000000) {
    reasons.push("amount_out_of_range");
  } else if (fields.total != null && Math.abs(fields.total - amount) > Math.max(2, amount * 0.05)) {
    reasons.push("amount_mismatch_total");
  } else if (fields.total != null) {
    trust += 20;
  }

  // Merchant present?
  if (fields.merchant) trust += 5;

  // Vertical declared check
  const verticalCheck = checkDeclaredVertical(trimmed, declaredVertical);
  if (!verticalCheck.ok) {
    reasons.push(verticalCheck.reason || "vertical_mismatch");
  } else {
    trust += Math.min(15, verticalCheck.score * 3);
  }

  // Image was attached at all? Required for receipts.
  if (!hasImage) reasons.push("no_image_attached");

  // Fatal reasons: things that mean we should NEVER auto-grant or even
  // queue for review without human eyes. "no_signal" + "vertical_mismatch"
  // both mean the receipt has no relationship to the declared vertical,
  // which is the loudest fraud/mistake signal we can detect cheaply.
  const fatal = reasons.filter((r) => [
    "date_in_future","amount_out_of_range","vertical_mismatch","no_signal",
    "no_image_attached","missing_image","amount_mismatch_total",
  ].includes(r));
  const pass = fatal.length === 0 && trust >= 70;
  const requiresReview = !pass && fatal.length === 0 && trust >= 40;

  return {
    pass,
    fields: {
      ...fields,
      declaredAmount: amount,
      verticalScore: verticalCheck.score,
      taxMath: tm,
    },
    vertical: verticalCheck.ok ? declaredVertical : (verticalCheck.suggested || declaredVertical),
    reasons,
    trustScore: Math.max(0, Math.min(100, trust)),
    requiresReview,
  };
}
