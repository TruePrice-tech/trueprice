# Solar — Audit Findings (2026-04-30 / REDO)

Status: **CLOSED at depth (REDO)** — re-tested live post-fix

## Fixes (commit `e0ee92801b`)
Same pattern as Electrical:
- **SOL-CV-6a:** solar-quote-analyzer.html added inline guard before
  renderPriceConfirmation (#main-scoped SEO-hide preserves trust banner)
- **SOL-CV-6b:** compare-solar-quotes.html added .tp-pdf-noprint class +
  #main-scoped SEO-hide after tpEnforceVerticalMatch returns true

## Live re-test (post-fix, 1st run with deploy-poll)
| Path | H1 | Body | Trust | SEO hidden |
|---|---|---|---|---|
| analyze/roof | "This is not a Solar quote" ✓ | "looks like a roofing quote" ✓ | ✓ | 3/3 ✓ |
| analyze/HVAC | same ✓ | "looks like an HVAC quote" ✓ | ✓ | 3/3 ✓ |
| analyze/auto | same ✓ | "looks like an auto repair quote" ✓ | ✓ | 3/3 ✓ |
| compare/roof | same ✓ | "looks like a roofing quote" ✓ | ✓ | 3/3 ✓ |

Coverage gaps (deferred): 01-initial, 04-cta-landed × 4, 05-unhappy ×
3, estimate path. Same gaps as Electrical+Plumbing.

**Closed.**
