# 02c-auto readout — Auto fixture rejected by GD analyzer

URL: https://woogoro.com/garage-door-quote-analyzer.html (after upload)
Captured: 2026-04-29 19:59 (post-3d1d134f25 inline guard fix)
Fixture: test/receipt/ocr-cache/fixtures/auto-equinox-quote.jpeg

## What I see (top to bottom)

- **Banner + header + path tabs:** unchanged from initial state — same site banner, Woogoros logo, "Methodology" link, "You are analyzing a quote" tab highlighted, cross-link to Compare path visible.
- **Reject card** (centered, pink/red border on `bg #fef2f2`):
  - **H1:** "This is not a Garage Door quote" — **TITLE CASE CORRECT**. Red color (#991b1b).
  - **Iris-concerned** mascot (center, ~120px). Renders cleanly with multiply blend on the pink card.
  - Body line: "The document you uploaded looks like an **auto repair** quote." — body label is lowercase per smartLower function, article "an" correct because next word starts with vowel "a".
  - Sub-line: "We could try to analyze it as a garage door quote anyway, but the result would be unreliable. We would rather inform you than give a confident answer based on the wrong inputs."
  - **Primary CTA (red):** "Analyze as Auto Repair instead" — proper title case label.
  - **Secondary CTA (outline):** "Upload a different file"
  - Detection confidence line at bottom of card: "Detection confidence: 7 Auto Repair keywords vs 0 garage door keywords"
- **Below the reject card:** the SEO content STILL renders ("Analyze quotes for other services" cross-link strip + "What to look for" spec table + "Red flags" + "Hidden costs" + FAQ + Footer). This is GD-2, deferred site-wide.
- **Footer:** unchanged.

## Numbers / labels checked

- "7 Auto Repair keywords vs 0 garage door keywords" — score line numeric and contextual. Correct: auto-equinox-quote.jpeg has model name (Equinox), automotive terms, vehicle parts. No garage-door-specific terms.
- Article "an" correct — "auto" starts with vowel.
- Body label "auto repair" — lowercase per smartLower (no all-caps acronyms in label).
- CTA label "Analyze as Auto Repair instead" — preserves original title-case label "Auto Repair" because it's the display label, not the body label.

## Visual flags

- Reject screen renders cleanly. No placeholder, no $undefined, no broken styles.
- Iris-concerned image loaded successfully.
- Reject card and SEO content stack vertically — GD-2 visible (SEO below reject).
- All CTAs have proper hover-affordance styling.

## Verdict

GD analyze correctly rejects auto-repair fixture with proper H1 capitalization, correct article ("an"), correct body label case ("auto repair"), proper CTA labels, and accurate keyword score (7 vs 0). No new findings. Confirms GD-3 fix is working for at least one of the three reject-trigger fixtures.

Pending re-shoot of roof and HVAC cases to confirm same correctness across all three trigger fixtures.
