# 03-results readout — Insulation compare wrong-vertical reject

URL: https://woogoro.com/compare-insulation-quotes.html (after compare attempt)

## What I see
- H1: "This is not **an** Insulation quote" — shared module's articleFor() correctly inserts "an" before vowel-starting "Insulation". ✓
- Iris-concerned mascot
- Body: "looks like **an HVAC quote**." — bold wraps the entire noun phrase including "quote" (CV-7 cosmetic, already in queue)
- CTAs: "Analyze as HVAC instead" / "Upload a different file"
- Confidence: "5 HVAC keywords vs 0 Insulation keywords"
- **SEO HIDDEN below reject** ✓ (fix from commit 68aba7c835 working)
- Footer visible

## Verdict

Step 2-3 PASS. CV-7 (bold-tag wrapping inconsistency) applies cross-vertical, already in queue.
