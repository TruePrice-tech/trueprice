# Concrete — Audit Findings (2026-04-30 / REDO)

Status: **CLOSED at depth (REDO)** — re-tested live post-fix `620dc847ca`. 6 of 6 captures verified visually as a human top-to-bottom.

## Fix
- **CONC-CV-6:** Added inline guard before renderPriceConfirmation in concrete-quote-analyzer.html (#main-scoped SEO-hide preserves trust banner)
- **CONC-CV-6b:** Added .tp-pdf-noprint class to compare-concrete SEO wrapper + #main-scoped hide call after tpEnforceVerticalMatch returns true

## Live re-test (post-deploy, harness + visual depth verification)
| Path | H1 | Body | Trust | SEO hidden | Visual top-to-bottom |
|---|---|---|---|---|---|
| analyze/roof | "This is not a Concrete quote" ✓ | "looks like a roofing quote" ✓ | ✓ | 3/3 ✓ | PASS |
| analyze/HVAC | same ✓ | "looks like an HVAC quote" ✓ | ✓ | 3/3 ✓ | PASS |
| analyze/auto | same ✓ | "looks like an auto repair quote" ✓ | ✓ | 3/3 ✓ | PASS |
| compare/01-initial | n/a | n/a | ✓ | mascot/H1/3-slots/SEO/footer | PASS |
| compare/03-results | "This is not a Concrete quote" ✓ | "looks like a **roofing quote**" (CV-7) ✓ | ✓ | 3/3 ✓ | PASS |
| compare/05-after-refresh | n/a | n/a | ✓ | identical to 01-initial | PASS |
