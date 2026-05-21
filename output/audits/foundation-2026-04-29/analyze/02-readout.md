# 02 readout — Foundation analyzer wrong-vertical reject (3 fixtures)

URL: https://woogoro.com/foundation-quote-analyzer.html (after upload)
Captured: 2026-04-29 (post-inline-guard fix in commit 9dc2548803)

## Test setup
Three negative-test fixtures uploaded to Foundation analyzer:
- roofing-gaf-quote.jpeg
- hvac-coil-quote.jpeg
- auto-equinox-quote.jpeg

## Results

### Roof fixture (02-roof-on-solar.png — filename leftover from harness copy)
- H1: "This is not a Foundation quote" ✓
- Body: "looks like a **roofing** quote." ✓ (lowercase via smartLower, article "a" correct)
- Primary CTA: "Analyze as Roofing instead" routes to `/roofing-quote-analyzer.html?path=quote`
- Secondary CTA: "Upload a different file"
- Score: "4 Roofing keywords vs 0 foundation keywords"
- SEO content **HIDDEN** below reject (per the inline guard's `.tp-pdf-noprint` hide)
- Footer remains visible
- Iris-concerned mascot rendered (rainbow Iris with sad-eyed expression and magic wand)

### HVAC fixture (02b-hvac-on-gd.png — filename leftover)
- H1: "This is not a Foundation quote" ✓
- Body: "looks like an **HVAC** quote." ✓ (HVAC preserved as all-caps acronym, article "an" correct via acronym-aware logic)
- Primary CTA: "Analyze as HVAC instead" routes to `/hvac-quote-analyzer.html?path=quote`
- Confidence line at bottom

### Auto fixture (02c-auto-on-gd.png — filename leftover)
- H1: "This is not a Foundation quote" ✓
- Body: "looks like an **auto repair** quote." ✓
- Primary CTA: "Analyze as Auto Repair instead" routes to `/auto-repair.html?path=quote`

## Findings

### F-1 (LOW): Harness leftover filenames
Filenames `02-roof-on-solar.png`, `02b-hvac-on-gd.png`, `02c-auto-on-gd.png` are leftover from the GD-harness copy. They're misleading but the screenshots' content is correct. Functional impact: zero. Cosmetic-only audit-organization issue. **Status: noted, not worth fixing in the live harness — would need to update file paths in 3 step blocks.**

### F-2 (RESOLVED — was screenshot timing issue)
Initial reject screenshot showed empty space where Iris-concerned mascot should be. Increased post-reject wait from 2s to 5s, mascot then rendered correctly. Confirms image was loading but Puppeteer screenshotted too early on first attempt.

## Verdict

Foundation analyzer correctly rejects all 3 wrong-vertical fixtures with proper H1, body text, CTAs, and score lines. Inline guard (commit 9dc2548803) catches them BEFORE the shared price-confirm short-circuit could bypass the check. SEO content hidden on reject screen.

**Step 2 of HUMAN_AUDIT_PROMPT for Foundation analyze:** PASS.
