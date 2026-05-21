# 03-results readout — GD compare wrong-vertical reject

URL: https://woogoro.com/compare-garage-door-quotes.html (after compare attempt)
Captured: 2026-04-29 ~21:02
Fixtures: roofing-gaf-quote.jpeg + hvac-coil-quote.jpeg (both wrong-vertical for GD compare)

## What I see (top to bottom)

- **Banner + header + path tabs:** unchanged
- **Reject card** (centered, pink/red border):
  - **H1:** "This is not a Garage door quote" — **SENTENCE CASE CORRECT** (matches brand-style across the 18 other verticals).
  - **Iris-concerned** mascot, ~120px, multiply-blended cleanly.
  - Body: "The document you uploaded looks like an **HVAC** quote." — HVAC preserved as all-caps acronym, article "an" correct via acronym-aware article logic. Note: the reject only flagged ONE detected vertical (HVAC, the higher-scoring one), even though both slots had wrong-vertical content (roof + HVAC). The detected-vertical winner was HVAC because its keyword score in the combined OCR text was higher than roofing's.
  - Sub: "We could try to analyze it as a garage door quote anyway, but the result would be unreliable. We would rather refuse than give you a confident answer based on the wrong inputs."
  - **Primary CTA:** "Analyze as HVAC instead" — routes to /hvac-quote-analyzer.html?path=quote
  - **Secondary CTA:** "Upload a different file"
  - Confidence line below: small score breakdown
- **Below reject card:** SEO content visible (GD-2 deferred site-wide).

## Numbers / labels checked

- H1 sentence-case "Garage door" — CORRECT brand-style.
- Body "an HVAC quote" — acronym preserved, article correct.
- CTA "Analyze as HVAC instead" — display label preserves the title-cased acronym "HVAC".
- Detection logic correctly fired even though the roof + HVAC fixtures are both wrong-vertical inputs. The combined OCR scored HVAC higher than roofing (likely because of the expanded HVAC keyword regex from commit 012ae8ff16).

## Findings noted

### GD-CMP-2 (MOD): Compare reject CTA routes to analyze, not compare
- **Severity:** MOD (UX inconsistency — user wanted to compare and is sent to single-quote analyze flow)
- **Observed:** When uploading wrong-vertical quotes to /compare-garage-door-quotes.html, the reject screen's primary CTA "Analyze as HVAC instead" routes to `/hvac-quote-analyzer.html?path=quote` (single-quote analyzer), NOT `/compare-hvac-quotes.html` (compare on the correct vertical).
- **Expected:** If user uploaded 2-3 quotes intending to compare them, redirect them to the correct vertical's compare flow, not the analyze flow.
- **Status:** **DEFERRED** — this is in the shared `wrong-vertical-guard.js` (line 130) which builds the CTA URL from `vertical-detect.js`'s `url` field. To fix, vertical-detect.js would need to expose both `analyzeUrl` and `compareUrl`, OR the compare pages need to override the redirect target. **Site-wide cross-vertical issue, not GD-specific.** Logged for post-individual-audit cross-vertical pass.
- **Caveat:** The current behavior is functional — user CAN re-upload to single-quote analyzer instead of compare. They just have to switch context. Not a blocker.

### GD-CMP-3 (LOW): Only one of N wrong-vertical detections is shown
- **Severity:** LOW (non-actionable for user, transparency issue)
- **Observed:** When 2 wrong-vertical quotes uploaded (roof + HVAC), reject screen only mentions the higher-scoring one (HVAC). User isn't told that the OTHER quote is also wrong-vertical, just a different one.
- **Expected:** Could be acceptable as-is (showing the dominant signal), or could enumerate ("Quote 1 looks like a roofing quote. Quote 2 looks like an HVAC quote.").
- **Status:** **DEFERRED** — site-wide. Logged for cross-vertical pass.

## Verdict

GD compare wrong-vertical hard-reject **WORKS correctly**. H1 sentence-case matches brand-style. Body label and article correct. CTA routes to a valid (if not ideal) destination. Two LOW/MOD UX notes deferred to cross-vertical pass.

**Step 2 + Step 3 of HUMAN_AUDIT_PROMPT for GD compare:** PASS (with two non-blocker UX notes).

## Pending for compare path

- Step 4: click the Analyze-as-HVAC-instead CTA + Upload-a-different-file CTA, verify routing.
- Step 5: unhappy paths (refresh during compare, click compare with only 1 quote, etc.).
- Happy path: would require 2+ real GD quote fixtures (none exist). Same gap as analyze.
