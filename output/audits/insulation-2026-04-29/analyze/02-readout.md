# 02 readout — Insulation analyzer wrong-vertical reject (3 fixtures)

URL: https://woogoro.com/insulation-quote-analyzer.html (after upload)
Captured: 2026-04-29 (post-fix in commit 68aba7c835)

## Visual results

### Roof (04-precta-roof-rejected.png)
- H1: "This is not **an** Insulation quote" — article "an" correct (Insulation starts with vowel "I"). Inline guard's article logic working.
- Iris-concerned mascot rendered.
- Body: "looks like a **roofing** quote." (lowercase via smartLower, article "a" correct)
- Sub-line: "We could try to analyze it as an insulation quote anyway, but the result would be unreliable. We would rather refuse than give you a confident answer based on the wrong inputs."
- CTAs: "Analyze as Roofing instead" → /roofing-quote-analyzer.html?path=quote ; "Upload a different file"
- Confidence: "4 Roofing keywords vs 0 insulation keywords"
- SEO hidden ✓
- Footer visible

### HVAC + Auto fixtures (verified via harness)
- HVAC: rejectSeen=true, CTA "Analyze as HVAC instead" routes to hvac analyzer ✓
- Auto: rejectSeen=true, CTA "Analyze as Auto Repair instead" routes to auto-repair ✓

## Verdict

Insulation analyzer correctly rejects all 3 wrong-vertical fixtures. **Step 2 PASS.**
