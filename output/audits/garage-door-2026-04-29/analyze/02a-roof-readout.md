# 02a-roof readout — Roofing fixture rejected by GD analyzer

URL: https://woogoro.com/garage-door-quote-analyzer.html (after upload)
Captured: 2026-04-29 ~20:35 (post-fix, via diag-ocr-t30.png)
Fixture: test/receipt/ocr-cache/fixtures/roofing-gaf-quote.jpeg

## What I see (top to bottom)

- **Banner + header + path tabs:** unchanged from initial state
- **Reject card** (centered, pink/red border):
  - **H1:** "This is not a Garage Door quote" — TITLE CASE CORRECT, red color
  - **Iris-concerned** mascot center, ~120px, multiply-blended cleanly
  - Body: "The document you uploaded looks like a **roofing** quote." — body label lowercase, article "a" correct (consonant-start)
  - Sub: "We could try to analyze it as a garage door quote anyway, but the result would be unreliable. We would rather refuse than give you a confident answer based on the wrong inputs."
  - **Primary CTA:** red "Analyze as Roofing instead"
  - **Secondary CTA:** outline "Upload a different file"
  - Confidence line: "Detection confidence: 4 Roofing keywords vs 0 garage door keywords"
- **Below reject card:** SEO content visible (GD-2 site-wide deferred)
- **Footer:** unchanged

## Numbers / labels checked

- "4 Roofing keywords vs 0 garage door keywords" — accurate. roofing-gaf-quote.jpeg contains GAF, shingle, ridge vent, drip edge, etc. No garage-door-specific terms.
- Article "a" correct — "roofing" starts with consonant.
- Body label "roofing" lowercase per smartLower.
- CTA label "Analyze as Roofing instead" preserves display title case.

## Visual flags

None. Reject screen renders cleanly. All elements present, no placeholders, no $undefined, no broken styles.

## Verdict

GD analyze correctly rejects roofing fixture. No new findings. With 02c-auto already verified, that's 2 of 3 wrong-vertical fixtures confirmed working. HVAC pending (Step 4 re-run currently in progress).

## Note on harness bug discovered during this audit

Earlier Step 4 runs (with `setCacheEnabled(false)` in the Puppeteer harness) caused production OCR to hang at "Reading text from image..." indefinitely. Tesseract.js WASM worker loading apparently relies on browser caching. Removing the cache-disable line fixed it — 30s after upload, the reject screen rendered correctly. **This is a HARNESS bug, not a production bug.** Production analyzer is healthy.
