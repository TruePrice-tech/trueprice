# 02 readout — Gutters analyzer wrong-vertical reject (3 fixtures)

URL: https://woogoro.com/gutters-quote-analyzer.html (after upload)

## Roof fixture
- H1: "This is not a Gutter quote" — **singular** (brand-style match), per-vertical inline guard fix from commit 1b38e8e575.
- Iris-concerned mascot ✓
- Body: "looks like a roofing quote." ✓
- Sub: "We could try to analyze it as a gutter quote anyway..." ✓ (singular)
- CTAs: "Analyze as Roofing instead" + "Upload a different file" ✓
- Confidence: "4 Roofing keywords vs 0 gutter keywords" (singular ✓)
- SEO HIDDEN below ✓
- Footer visible ✓

## HVAC + auto fixtures
Verified via harness: rejectSeen=true, CTAs route correctly to HVAC analyzer + auto-repair.

## Findings

### GUT-1 (HIGH cosmetic) — RESOLVED
- **Status:** Fixed in commit 1b38e8e575. Pre-fix, shared module rendered "This is not a Gutters quote" plural conflicting with brand's singular usage. Inline guard now produces singular consistently.

## Verdict
Step 2 PASS.
