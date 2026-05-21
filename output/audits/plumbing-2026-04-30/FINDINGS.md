# Plumbing — Audit Findings (2026-04-30 / REDO)

Vertical: Plumbing
Audit method: HUMAN_AUDIT_PROMPT.md (roofing-depth, 6 steps × 3 paths)
Auditor: Claude (Opus 4.7)
Status: **CLOSED at depth (REDO)** — re-tested live post-fix

## REDO summary
Original Plumbing audit had only 01-initial + 02-roof captured. REDO ran
fresh harness through analyze (3 fixtures) + compare path and caught two
CV-6 bugs.

REDO caught (both fixed in commit `bb3ce055af`):
- **PLM-CV-6a (HIGH UX, FIXED):** plumbing-quote-analyzer.html inline
  guard at line 832-845 replaced #plumbApp with reject UI but did not
  hide SEO sections at lines 193 + 218 (cross-vertical strip + spec
  table + red flags + hidden costs + FAQ) on every wrong-vertical
  reject. Now hides `#main .tp-pdf-noprint` inline (preserves trust
  banner outside main per CV-8 fix pattern).
- **PLM-CV-6b (HIGH UX, FIXED):** compare-plumbing-quotes.html line 467
  fired `tpEnforceVerticalMatch` but did not hide SEO. Same MED-CMP-1
  pattern. Added `tp-pdf-noprint` class to SEO wrapper + `#main`-scoped
  hide call.

REDO confirmed (already correct):
- Article + smartLower already implemented in inline guard (lines
  829-831): vowel-aware article + acronym-preserving smartLower.
- Trust banner outside main, no global hide selector → stays visible.

## Live re-test post-fix (4 captures)

| Path / Fixture | H1 | Body | Trust banner | SEO hidden |
|---|---|---|---|---|
| analyze/roof | "This is not a Plumbing quote" ✓ | "looks like a roofing quote" ✓ | visible ✓ | 3 of 3 hidden ✓ |
| analyze/HVAC | same ✓ | "looks like an HVAC quote" (article + caps) ✓ | visible ✓ | 3 of 3 hidden ✓ |
| analyze/auto | same ✓ | "looks like an auto repair quote" (article + smartLower) ✓ | visible ✓ | 3 of 3 hidden ✓ |
| compare/roof | same ✓ | "looks like a roofing quote" ✓ | visible ✓ | 3 of 3 hidden ✓ |

Fresh captures: `analyze/redo-04-precta-{roof,hvac,auto}-rejected.png`,
`compare/redo-{01-initial,03-results,05-after-refresh}.png`,
`redo-states.json`.

## Verdict

**Plumbing vertical defect-free at depth.** Both CV-6 bugs caught and
fixed and re-tested clean live.

**Closed. Moving to next vertical.**
