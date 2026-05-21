# 02b-hvac readout — HVAC fixture rejected by GD analyzer

URL: https://woogoro.com/garage-door-quote-analyzer.html (after upload)
Captured: 2026-04-29 ~20:45 (post-fix, via 04-precta-hvac-rejected.png)
Fixture: test/receipt/ocr-cache/fixtures/hvac-coil-quote.jpeg

## What I see (top to bottom)

- **Banner + header + path tabs:** unchanged
- **Reject card:**
  - **H1:** "This is not a Garage Door quote" — TITLE CASE CORRECT
  - **Iris-concerned** mascot
  - Body: "The document you uploaded looks like an **HVAC** quote." — "HVAC" preserved in all-caps by smartLower (acronym token), article "an" correct via acronym-aware article logic
  - Sub-line: "We could try to analyze it as a garage door quote anyway, but the result would be unreliable. We would rather refuse than give you a confident answer based on the wrong inputs."
  - **Primary CTA:** "Analyze as HVAC instead"
  - **Secondary CTA:** "Upload a different file"
  - Confidence line at bottom
- **Below reject card:** SEO content visible (GD-2 deferred)

## Numbers / labels checked

- Body label "HVAC" preserved as all-caps — smartLower correctly identified `/^[A-Z]{2,}$/` token and didn't lowercase it. CORRECT.
- Article "an" — correct because acronym-aware article check matched `/^HVAC\b/`. CORRECT.
- CTA label "Analyze as HVAC instead" — preserves display label. CORRECT.

## Visual flags

None. Iris mascot, copy, CTAs, score line all clean.

## Verdict

This was the BLOCKER fixture (GD-3). With the inline guard at line 869 + HVAC keyword expansion (012ae8ff16), HVAC quotes are now correctly rejected by the GD analyzer. **GD-3 BLOCKER closed and verified.**

The HVAC label rendering correctly as all-caps "HVAC" with article "an" proves the acronym-aware logic works end-to-end.
