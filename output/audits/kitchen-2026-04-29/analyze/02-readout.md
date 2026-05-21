# 02 readout — Kitchen analyzer wrong-vertical reject (3 fixtures, REDO at depth)

URL: https://woogoro.com/kitchen-quote-analyzer.html
Captured: 2026-04-30 (post commit `7b013630dc` #main scope fix)

## Roof fixture (02-roof-on-solar.png) — read top-to-bottom
- **Trust banner visible at top:** "✓ Free · No email · No phone · No signup · We never sell or share your data" — green-tinted gradient. Restored after #main scoping fix.
- Header: Woogoros logo + Guides + Methodology nav
- Path-tab strip: "You are analyzing a quote." + "Want a free estimate first? →" + "Multiple quotes? Compare →"
- H1 (red, large, centered): **"This is not a Kitchen quote"** — single-word title-case from inline guard
- Reject card (pink bg, dark-red border):
  - **Iris-concerned mascot** — rainbow-fluffy with sad eyes + magic wand, 120x120px
  - Body: "The document you uploaded looks like a **roofing** quote." — lowercase "roofing" via smartLower, article "a" correct
  - Sub: "We could try to analyze it as a kitchen quote anyway, but the result would be unreliable. We would rather refuse than give you a confident answer based on the wrong inputs."
  - Primary CTA (red bg): "Analyze as Roofing instead"
  - Secondary CTA (outline): "Upload a different file"
  - Confidence (small gray): "Detection confidence: 4 Roofing keywords vs 0 kitchen keywords"
- Empty space below reject (SEO sections inside #main correctly hidden)
- Footer: standard 4-col nav

## HVAC fixture (02b-hvac-on-gd.png)
- All elements rendered identically except:
- Body: "looks like an **HVAC** quote." (HVAC preserved as all-caps via smartLower, article "an" via acronym-aware logic)
- Primary CTA: "Analyze as HVAC instead"
- Confidence: "5 HVAC keywords vs 0 kitchen keywords"
- Trust banner visible ✓

## Auto fixture (02c-auto-on-gd.png)
- Body: "looks like an **auto repair** quote." (lowercase via smartLower, "an" article for vowel-onset "auto")
- Primary CTA: "Analyze as Auto Repair instead"
- Confidence: "7 Auto Repair keywords vs 0 kitchen keywords"
- Trust banner visible ✓

## Findings caught by REDO at depth

### KIT-CV-8 (RESOLVED)
- **Status:** Fixed in commit `7b013630dc`. Pre-fix: blanket `.tp-pdf-noprint` query selector also caught the body-level trust banner, hiding it on every reject screen — exactly when users most need privacy reassurance ("am I on a legit site?"). Post-fix: scoped to `#main .tp-pdf-noprint` so trust banner stays visible while in-main SEO sections still hide.
- This is also queued as CV-8 in CROSS-VERTICAL-QUEUE.md affecting GD/Foundation/Insulation/Gutters and 7 compare pages — to be applied during their respective REDO at depth.

## Verdict
Step 2 PASS at full depth. All 3 wrong-vertical fixtures correctly rejected. Trust banner preserved on reject. Inline guard's brand-style H1, smartLower body label, acronym-aware article all working.
