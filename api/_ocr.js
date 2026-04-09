// /api/_ocr.js
//
// Shared server-side OCR shim.
//
// IMPORTANT: As of the Tesseract-first migration, the canonical OCR layer
// is **client-side Tesseract.js** running in the user's browser. The
// frontend extracts text BEFORE calling any /api/X-estimate endpoint and
// sends `{ text, images }` in the POST body.
//
// This file used to call OCR.space (a free third-party OCR service) as a
// server-side fallback when the client text was sparse. That added a
// privacy concern (image leaving the user's device through a third party)
// and a redundant OCR layer that didn't meaningfully improve accuracy
// over Claude vision.
//
// Architecture is now: Tesseract first → Claude vision fallback (sequential).
// runOcr() is kept as a no-op stub so existing imports don't break, and so
// every endpoint's `if (!text || text < threshold) → image to Claude vision`
// fallback path remains intact.
//
// Removing OCR.space entirely keeps user images on Tesseract (browser) +
// Claude vision (Anthropic) only — no third-party OCR vendor in the loop.

export async function runOcr(/* base64, mediaType */) {
  // No-op: server-side OCR is no longer performed. Tesseract on the client
  // is the only OCR layer; Claude vision is the only fallback. Returning
  // null here causes the caller's existing image-to-Claude-vision fallback
  // path to fire, which is the desired behavior.
  return null;
}

// Heuristic: does this OCR text look "good enough" to skip Claude vision?
// Goal: detect documents that have enough structured text (prices, labels)
// that Claude can parse from text alone, vs documents that are blurry,
// rotated, hand-written, or otherwise need vision.
export function ocrTextLooksGood(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();

  // Need a minimum length — anything less is probably a partial extraction
  if (t.length < 200) return false;

  // Need at least one dollar amount — quotes/bills always have prices
  const hasDollar = /\$\s?[\d,]+(?:\.\d{2})?/.test(t);
  if (!hasDollar) return false;

  // Need a meaningful word count (not just numbers and punctuation)
  const words = t.split(/\s+/).filter(w => /[a-z]{3,}/i.test(w));
  if (words.length < 30) return false;

  // Reject if too much garbage (excessive non-printable or repeated chars)
  const garbageRatio = (t.match(/[^\w\s$.,()/\-:;'"&%@#]/g) || []).length / t.length;
  if (garbageRatio > 0.15) return false;

  return true;
}
