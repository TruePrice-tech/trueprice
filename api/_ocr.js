// /api/_ocr.js
//
// Shared server-side OCR helper. Frontline text extraction for every
// analyzer endpoint that processes uploaded images, so Claude is only
// used as a structured-extraction backup instead of the primary parser.
//
// Cost impact: cuts Claude per-request from ~$0.005 (vision call) to
// ~$0.0005 (text-only call) when OCR succeeds. ~90% reduction.
//
// OCR provider: OCR.space free tier (25,000 calls/month, no credit card
// required). We previously had a Google Vision fallback but the account
// is permanently unavailable, so OCR.space is the only OCR layer.
//
// Usage in any analyzer endpoint:
//   import { runOcr, ocrTextLooksGood } from "./_ocr.js";
//
//   const ocrResult = await runOcr(base64Image, mediaType);
//   if (ocrResult && ocrTextLooksGood(ocrResult.text)) {
//     // OCR succeeded — send TEXT only to Claude (cheap path)
//     content.push({ type: "text", text: prompt + "\n\nOCR TEXT:\n" + ocrResult.text });
//   } else {
//     // OCR failed or text is poor — fall back to Claude vision (expensive)
//     content.push({ type: "image", source: { type: "base64", media_type: mime, data: cleanBase64 } });
//     content.push({ type: "text", text: prompt });
//   }

const OCR_SPACE_FALLBACK_KEY = "K84200508188957"; // public free-tier key from /api/ocr-vision.js

export async function runOcr(base64, mediaType) {
  if (!base64) return null;

  // Strip data URL prefix if present
  const cleanBase64 = base64.startsWith("data:")
    ? base64.replace(/^data:[^;]+;base64,/, "")
    : base64;
  const mime = mediaType || "image/png";

  // OCR.space (frontline, free)
  try {
    const formBody = new URLSearchParams();
    formBody.append("base64Image", `data:${mime};base64,${cleanBase64}`);
    formBody.append("language", "eng");
    formBody.append("isOverlayRequired", "false");
    formBody.append("OCREngine", "2");
    formBody.append("isTable", "true");
    formBody.append("scale", "true");

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: process.env.OCR_SPACE_API_KEY || OCR_SPACE_FALLBACK_KEY },
      body: formBody
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.IsErroredOnProcessing && data.ParsedResults && data.ParsedResults.length > 0) {
        const text = data.ParsedResults.map(r => r.ParsedText || "").join("\n");
        if (text.length > 30) {
          return { text, source: "ocr_space", confidence: "medium" };
        }
      }
    }
  } catch (e) {
    console.warn("[_ocr] OCR.space failed:", e.message);
  }

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
