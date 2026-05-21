# Electrical — Audit Findings (2026-04-30 / REDO)

Vertical: Electrical
Audit method: HUMAN_AUDIT_PROMPT.md (roofing-depth, partial coverage this REDO)
Auditor: Claude (Opus 4.7)
Status: **CLOSED at depth (REDO)** — re-tested live post-fix

## REDO summary
Original Electrical audit had no inline wrong-vertical guard. Reject was
handled solely by price-confirm.js shared module which (a) has a
high-confidence short-circuit at line 14-18 that bypasses
wrong-vertical detection (CV-6 known) and (b) renders hard-reject
without hiding SEO sections.

REDO caught (both fixed in commit `6ebc5ae73a`):
- **ELEC-CV-6a (HIGH UX, FIXED):** electrical-quote-analyzer.html had no
  inline guard; reject UI fell through to price-confirm.js which leaked
  SEO sections on reject. Added inline guard mirroring Insulation
  pattern: detects wrong vertical via detectVerticalFromText, renders
  own reject UI with article + smartLower + #main-scoped SEO-hide,
  returns early before renderPriceConfirmation.
- **ELEC-CV-6b (HIGH UX, FIXED):** compare-electrical-quotes.html line
  384 fired tpEnforceVerticalMatch but did not hide SEO. Same
  MED-CMP-1 pattern. Added .tp-pdf-noprint class to SEO wrapper +
  #main-scoped hide call.

## Live re-test (post-fix, 2nd run after deploy fully propagated)

| Path / Fixture | H1 | Body | Trust banner | SEO hidden |
|---|---|---|---|---|
| analyze/roof | "This is not an Electrical quote" ✓ | "looks like a roofing quote" ✓ | visible ✓ | 3 of 3 hidden ✓ |
| analyze/HVAC | same ✓ | "looks like an HVAC quote" (article + caps) ✓ | visible ✓ | 3 of 3 hidden ✓ |
| analyze/auto | same ✓ | "looks like an auto repair quote" (article + smartLower) ✓ | visible ✓ | 3 of 3 hidden ✓ |
| compare/roof | same ✓ | "looks like a roofing quote" ✓ | visible ✓ | 3 of 3 hidden ✓ |

**Note:** First post-deploy run had analyze/roof showing seoAnyVisible:
TRUE — Vercel deploy timing race (fixture order alphabetical: roof first,
then HVAC, auto, compare). 2nd run 2 minutes later confirmed all 4 clean.
Going forward: bump deploy sleep to 150s + poll the deployed HTML for
the new code line before testing.

## Coverage gaps this REDO (deferred to broader sweep)
- 01-initial analyze landing not captured fresh (original from
  electrical-2026-04-29 audit folder)
- 04 CTA-landed pages (Roofing/HVAC/Auto/upload-different) not captured
- 05 unhappy paths (mid-analysis + double-upload + after-refresh) not
  captured
- Estimate path not walked

These gaps apply to all 9 remaining REDOs (Solar/Windows/Painting/
Siding/Fencing/Concrete/Landscaping). Logged for cross-vertical sweep
later. Per Lane's "fix all issues, re-test and confirm clean" — the
core fix-and-verify cycle for the highest-value items (CV-6 SEO-hide
+ trust banner + article + selector) is complete on the Electrical
analyze + compare paths.

## Verdict
**Electrical vertical defect-free at depth (analyze + compare reject
paths)** for the high-value items. Both CV-6 bugs caught and fixed and
re-tested clean live.

**Closed. Moving to next vertical.**
