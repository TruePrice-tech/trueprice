# Landscaping — Audit Findings (2026-04-30 / REDO)

Status: **CLOSED at depth (REDO)** — re-tested live post-fix `dfe41f6738`. 6 of 6 captures verified visually as a human top-to-bottom.

## Fixes
- **LAND-CV-6:** Added inline guard before renderPriceConfirmation in landscaping-quote-analyzer.html (#main-scoped SEO-hide preserves trust banner)
- **LAND-CV-6b:** Added .tp-pdf-noprint class to compare-landscaping SEO wrapper + #main-scoped hide call after tpEnforceVerticalMatch returns true

## Live re-test (post-deploy, harness + visual depth verification)
| Path | H1 | Body | Trust | SEO hidden | Visual top-to-bottom |
|---|---|---|---|---|---|
| analyze/roof | "This is not a Landscaping quote" ✓ | "looks like a roofing quote" ✓ | ✓ | 3/3 ✓ | PASS |
| analyze/HVAC | same ✓ | "looks like an HVAC quote" ✓ | ✓ | 3/3 ✓ | PASS |
| analyze/auto | same ✓ | "looks like an auto repair quote" ✓ | ✓ | 3/3 ✓ | PASS |
| compare/01-initial | n/a | n/a | ✓ | green leafy mascot/H1/3-slots/SEO/footer | PASS |
| compare/03-results | "This is not a Landscaping quote" ✓ | "looks like a **roofing quote**" (CV-7) ✓ | ✓ | 3/3 ✓ | PASS |
| compare/05-after-refresh | n/a | n/a | ✓ | identical to 01-initial | PASS |

## Open finding (cosmetic, not a CV-6 regression)
**LAND-COSMETIC-1:** Landscaping path-tabs banner at line 179 of landscaping-quote-analyzer.html does NOT have `.tp-pdf-noprint` class, while Solar/Window/Painting/Siding/Fencing/Concrete/Plumbing/Electrical analyzers DO have it. Visible difference: on Landscaping reject, the path-tabs banner ("You are analyzing a quote..." + Want a free estimate first?... + Multiple quotes? Compare...") stays visible above the reject card. On other analyzer rejects it's hidden. Insulation has the same inconsistency.

User impact: minimal — gives user extra navigation options on reject (not harmful). Logged for post-audit cosmetic sweep, NOT fixed this REDO to honor "cannot risk breaking clean verticals" directive (Insulation is already verified clean post-fix).
