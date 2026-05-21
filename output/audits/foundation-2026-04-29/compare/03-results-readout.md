# 03-results readout — Foundation compare wrong-vertical reject

URL: https://woogoro.com/compare-foundation-quotes.html (after compare attempt)
Captured: 2026-04-29
Fixtures: roofing-gaf-quote.jpeg + hvac-coil-quote.jpeg (both wrong-vertical for Foundation)

## What I see

- Banner + header + path tabs unchanged.
- Reject card centered:
  - **H1:** "This is not a Foundation quote" (single-word title-case, brand-style consistent)
  - **Iris-concerned** mascot rendered correctly
  - Body: "looks like an **HVAC** quote." — HVAC preserved as all-caps, article "an" correct.
  - Sub-line: standard reject sub-text
  - **Primary CTA:** "Analyze as HVAC instead" → /hvac-quote-analyzer.html?path=quote
  - **Secondary CTA:** "Upload a different file"
  - Confidence: "Detection confidence: 5 HVAC keywords vs 0 Foundation keywords"
- **SEO content HIDDEN** below reject — fix from commit c617b5b72f working ✓
- Footer fully visible with all standard links.

## Note on detection

HVAC outscored roofing (5 HVAC keywords vs 0 foundation, with roofing also detected but lower-scoring than HVAC in combined OCR). CV-2 (only top-scoring shown) applies as cross-vertical, already queued.

## Verdict

Foundation compare correctly rejects when 2 wrong-vertical quotes uploaded. SEO hidden. CTA routes correctly. **PASS.**

CV-1 (compare reject CTA routes to single-quote analyzer) applies here too as cross-vertical, already queued.
