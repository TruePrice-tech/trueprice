# 03-results readout — Gutters compare wrong-vertical reject

URL: https://woogoro.com/compare-gutters-quotes.html (after compare attempt)
Captured: 2026-04-30 (post-fix in commits 1b38e8e575 + a259fb0e5e)

## What I see
- H1: "This is not a Gutter quote" — **singular**, brand-style consistent ✓
- Iris-concerned mascot rendered ✓ (5s wait sufficient for image load)
- Body: "looks like an **HVAC quote**." (CV-7 bold-tag wrap applies cross-vertical, in queue)
- Sub: "We could try to analyze it as a **gutter** quote anyway..." — **singular**, fix verified ✓
- CTAs: "Analyze as HVAC instead" + "Upload a different file"
- Confidence: "5 HVAC keywords vs 0 Gutter keywords" — singular, fix verified ✓
- SEO HIDDEN below ✓
- Footer visible ✓

## Findings

### GUT-CMP-1 (HIGH cosmetic) — RESOLVED
- **Status:** Fixed in commit a259fb0e5e (sub-line override added).

## Verdict
Step 2-3 PASS.
