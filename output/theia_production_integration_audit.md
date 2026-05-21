# Theia Production Integration Audit

Date: 2026-05-03
Scope: TrueP application (`c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice`)
Method: read-only grep + file reads across `api/`, `js/`, `package.json`.

## Bottom line up front

**Theia is not wired into any production user-facing path in TrueP.** Zero source files in `api/` or `js/` import Theia, call a Theia HTTP endpoint, load a Theia ONNX model, or invoke `theia.read` / `trocr` / `lite_fp32`. Every reference to "Theia" in the TrueP codebase is a TODO comment in receipt-related files (`api/beta-receipt-submit.js`, `api/_woogoros-verifier.js`, `api/_woogoros-vertical.js`, `js/result-footer.js`) describing an integration that was supposed to ship "~May 10" alongside a receipt LoRA + fake detector. Lane just confirmed receipts are on hold and may never happen — which means the *only planned* hook for Theia in TrueP is parked indefinitely.

The actual production OCR stack in TrueP is:

1. **Client-side Tesseract.js** in the browser (`js/analyzer-ocr.js` line 143, `js/analyzer-engine.js` line 174). This is the canonical primary OCR layer.
2. **PDF.js** native text extraction for PDFs (`js/analyzer-ocr.js` line 217–311, `js/analyzer-engine.js` line 214–225).
3. **Claude Haiku 4.5 vision** as the fallback when Tesseract text is sparse / low-quality (`api/parse-quote.js` line 139–154 and the same pattern in 19 other `api/<vertical>-estimate.js` files).
4. **`api/_ocr.js` `runOcr()` is a no-op stub** that intentionally returns `null` (line 24–30) so the existing `text → ocrTextLooksGood → fallback to image+Claude` path fires unchanged. The OCR.space + Google Vision server-side fallback was deliberately removed.
5. **`api/ocr-vision.js`** still exists and would call Google Cloud Vision then OCR.space. It is not imported by any of the 20 vertical estimate APIs or `parse-quote.js`. It looks dead in the upload-quote pipeline. (Possibly used by a beta admin path; not load-bearing.)

## 1. Where Theia is actually called in TrueP

**Result: nowhere in production code.**

Theia mentions across the entire codebase, with file:line evidence:

- `api/beta-receipt-submit.js:29-31` — comment: "When the Theia receipt LoRA + fake detector ship (~May 10), this file will gain an additional Theia HTTP call before verifyReceipt; the function contract stays the same."
- `api/_woogoros-verifier.js:12-14` — comment: "When the Theia receipt LoRA + fake detector ship (~May 10), the stub gets replaced with a Theia HTTP call -- the contract above stays the same."
- `api/_woogoros-verifier.js:147` — comment: "Stub: rule-based. Replace with Theia HTTP call when receipt LoRA ships."
- `api/_woogoros-vertical.js:16-17` — comment: "Theia's receipt LoRA will replace this for receipts; quote text stays here."
- `js/result-footer.js:189` — comment in receipt-scan CTA gate: "until Tesseract OCR accuracy on real receipts is benchmarked … or Theia's receipt LoRA replaces Tesseract (~mid-May 2026)."

All five mentions are **comments only**, all describe a deferred receipt path, none describe quote-upload integration. There is no `theia.X(...)` call site, no `import theia ...`, no `from theia import ...`, no `fetch('https://theia...')`, no model file load.

`package.json` lists three OCR-adjacent deps (`paddleocr`, `ppu-paddle-ocr`, `client-side-ocr`) and `onnxruntime-node` — but grep against `api/` and `js/` finds zero `import` / `require` for any of them. They are dead dependencies, leftover from earlier OCR experiments (Apr 2026 OCR architecture flip-flops). They install on Vercel and inflate the function bundle but do not run.

## 2. Upload → analysis pipeline (the canonical path)

For a quote upload, the flow is consistently the same across all 20 verticals. The pipeline:

1. User selects a file in the browser. `js/analyzer-ocr.js` → `extractTextFromUploadedFile(file)` (line 592):
   - PDF: `pdfjs.getTextContent` first, OCR fallback only if text is "weak" (line 510–589).
   - Image: Tesseract.js multi-pass: 3 preprocessing modes × 6 region crops × 2 PSM modes (line 612–700). All client-side. Tesseract version is bundled via `loadVendorLibs()`.
2. The browser POSTs `{ text, images, vertical }` to `/api/<vertical>-estimate.js` (e.g. `parse-quote.js`, `painting-estimate.js`, `medical-bill-estimate.js`).
3. Server checks `text.length < 100`. If too short and an image is present, calls `runOcr()` from `api/_ocr.js` — which is a **no-op stub returning `null`** (line 24–30, comment block lines 1–22 explicitly says "server-side OCR is no longer performed").
4. Server runs `ocrTextLooksGood(text)` (`_ocr.js:36-56`): requires text length ≥ 200, ≥ 1 dollar amount, ≥ 30 alphabetic words ≥ 3 chars, garbage ratio < 0.15.
5. **If text passes the heuristic → text-only Claude Haiku 4.5 call (no image, ~10× cheaper).** If not → image is attached to the Claude call, **Claude vision parses the picture directly**.
6. Claude prompt is verbose, vertical-specific (per-vertical system prompts, e.g. `medical-bill-estimate.js:175-265` runs ~90 lines of medical-billing rules). It is the bulk of the analysis.
7. JSON parsed from Claude's response, enriched with city/state pricing multipliers from local data, then returned.

## 3. What % of the pipeline is actually OCR?

Loosely:

- **OCR contribution to user-visible output is structural, not semantic.** When `ocrTextLooksGood(text) === true`, the entire output (price, scope, contractor, warranty, line items, red flags, summary) is generated by **Claude Haiku 4.5 reasoning over OCR text + a 2-8K-character vertical-specific prompt**. OCR is the input substrate.
- When OCR fails the heuristic (sparse text, blurry photo, dark background, handwritten), the system **drops OCR entirely** and sends the raw image to Claude vision. Claude's own image-understanding does the OCR. In this branch, Theia/Tesseract contribute *nothing* — they were a wasted CPU pass.
- Form fields the user types (vertical selection, optional state code, optional roof-size) seed the Claude prompt and routing logic, but volume-wise the user-typed text is small (~5–50 chars) vs OCR text (200–8000 chars sent to Claude).

**Estimate of inputs by token volume going into Claude on a typical quote upload (text branch):**

- OCR text: ~70-90% of prompt input tokens.
- Vertical-specific system prompt + JSON schema spec: ~10-25%.
- User form fields: <1%.

**But:** Claude has been engineered to be tolerant of OCR garbage. The price-extraction safeguards in `js/analyzer-engine.js:438-443` actively *reject* parser outputs that look like OCR-confusion artifacts (O→0, I→1 mistakes producing fake totals, kWh values, model years parsed as prices). In multiple deep-dive memos (HVAC, kitchen, electrical, medical) the engine explicitly uses Claude as the price-of-record; the regex parser is a guard, not the source of truth. So even when Tesseract garbles characters, Claude generally rights the ship — and when Tesseract fails outright, Claude vision picks up the slack.

**Concrete: a single character of OCR error rarely changes the Claude output.** What changes the output is OCR completely failing (text < 200 chars or no `$` extracted), at which point the system falls through to Claude vision and OCR contributes zero anyway.

## 4. User-visible impact of an OCR error

- Single-character or word-level OCR error → Claude usually produces the correct price/scope anyway. Most failure-mode bugs in the deep-dive memos are *prompt* bugs or *regex defense* bugs, not OCR-accuracy bugs. The few cases where OCR drives a known-fail (e.g. solar f7 Hanwha brand detection, electrical f9 handwritten, medical f6 ER CPT 99283↔99285 drift) are noted as "OCR-bound" and tolerated as known fails.
- Severe OCR corruption → `ocrTextLooksGood()` returns false → image goes to Claude vision → Claude reads it directly. User sees an answer.
- Both OCR and Claude vision fail → Claude returns null fields → frontend shows "Could not parse" and prompts the user to enter values manually (`js/analyzer-ocr.js:825-833`).

There is no path in TrueP where a single Theia character read determines a price. The architecture *intentionally* does not let OCR be load-bearing because Tesseract is known to be lossy.

## 5. Latency and cost: where the budget actually goes

- Tesseract.js runs in the browser. **It does not consume any Vercel function execution time.** Vercel function budget concerns are entirely about Claude latency + abuse-guard Redis ops. A Tesseract→Theia swap on the *client side* would not free up Vercel budget.
- Claude Haiku 4.5 input cost is ~$0.001/bill (memory note `medical-bill-estimate.js:43-45`). Per-request cost is dominated by Claude tokens, not OCR.
- `api/ocr-vision.js` would call Google Cloud Vision (paid, $1.50/1000 images for first 1000/mo free) and OCR.space (free with capped key) — but is not wired into the quote pipeline. No paid OCR API is in the live upload path.
- Could TrueP just use Claude vision and skip the OCR step entirely? **Yes, structurally.** The fallback branch already does. The reason TrueP runs Tesseract first is the explicit comment in `parse-quote.js:119-122`: *"OCR-FIRST PIPELINE: when caller sends image without OCR text, run server-side OCR.space first. If text is good, drop the image from the Claude call (10x cheaper)."* OCR exists as a **cost-reduction proxy**, not as an accuracy enabler. Removing it would 10x the Claude bill but not measurably degrade user output.

## 6. Strategic answer: is Theia load-bearing for TrueP?

**No. Theia is a science project relative to TrueP's user-facing product.**

Evidence:

- Theia has zero call sites in TrueP's 20 vertical analyzers, in the 3 analysis paths (estimate / compare / analyze), in the parse-quote pipeline, or in the analyzer-engine. The Theia name appears only in five comment blocks promising integration "later" — and all five are tied to the **receipt** path, which Lane just placed on indefinite hold.
- The user-facing OCR layer is Tesseract.js (browser) + PDF.js (browser). Server-side OCR is a no-op stub. Cost optimization keeps it as the first pass; **accuracy is delivered by Claude Haiku 4.5** (text reasoning) or Claude vision (image fallback), not by OCR fidelity.
- The only place where 95%+ handwriting accuracy would matter to TrueP today is handwritten quotes. That is a tail-of-tail use case (a few fixtures across electrical f9, solar f7, medical messy-Mayo), and the architecture currently delegates those to Claude vision — which already handles them on par with what a tuned Theia checkpoint could realistically deliver in the near term.
- Theia Phase 5 (IAM/GNHK/Bentham handwriting accuracy) optimizes for an academic mix that does not match TrueP's input distribution: contractor quotes are typed PDFs / printed forms / phone photos of typed forms, ~95% machine-printed text. The marginal accuracy gain on academic handwriting datasets does not translate to user-visible impact on TrueP because those fixtures aren't typical user inputs.
- Even on the receipt path (now on hold), Theia's planned role is **a fake/tamper detector + structured field extractor for thermal-printer receipts**, not a general handwriting recognizer. Phase 5 IAM/GNHK/Bentham work doesn't directly serve that mission either.

If Theia exists to be sold as a standalone OCR product (per `project_theia_ocr.md` and `project_theia_pivot_plan.md` — "standalone from-scratch OCR engine to sell to third parties, beat Google"), that is a distinct strategic bet from "make TrueP better." Phases 5/6/7 are load-bearing for **the third-party Theia product**, not for the TrueP user experience.

## What this means for Phase 5

- If the goal is "improve TrueP user-facing accuracy or reduce TrueP cost," Phase 5 is wasted effort. The leverage points are: (a) better Claude prompts in the 20 vertical estimate APIs, (b) the kind of fixture-truth deep-dives Lane has been running, (c) potentially swapping Tesseract for a faster client-side OCR for cost-branch hits — but even that is a low-ROI change.
- If the goal is "ship Theia as a standalone product," Phase 5 is on-path — but TrueP usage is not a forcing function for it. TrueP can survive indefinitely on Tesseract + Claude.
- Receipt-path integration was the one realistic forcing function inside TrueP. With receipts on hold per Lane's note, no near-term TrueP integration depends on Theia.

## Files referenced

- `c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\api\_ocr.js` — no-op stub for server-side OCR
- `c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\api\ocr-vision.js` — Google Vision + OCR.space, NOT wired into quote pipeline
- `c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\api\parse-quote.js` — roofing pipeline, canonical example
- `c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\api\medical-bill-estimate.js` — medical pipeline
- `c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\api\painting-estimate.js`, `windows-estimate.js`, `auto-repair-estimate.js`, etc. — same shape across all 20 verticals
- `c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\api\beta-receipt-submit.js`, `api\_woogoros-verifier.js`, `api\_woogoros-vertical.js` — only files that mention Theia (comments only, receipt path)
- `c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\js\analyzer-ocr.js` — browser Tesseract.js orchestrator
- `c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\js\analyzer-engine.js` — shared TP_Engine, regex defenses, AI backup
- `c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\js\result-footer.js` line 189 — Theia comment in receipt-scan CTA gate
- `c:\Users\lanea\OneDrive\Desktop\TrueP Misc\trueprice\package.json` — `onnxruntime-node`, `paddleocr`, `ppu-paddle-ocr`, `client-side-ocr` listed but never imported (dead deps)
