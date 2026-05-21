# 01-initial readout — GD compare landing

URL: https://woogoro.com/compare-garage-door-quotes.html
Captured: 2026-04-29 ~20:55

## What I see (top to bottom)

- **Banner:** "✓ Free 30-second / No phone / No signup / We never sell or share your data"
- **Header:** Woogoros logo + "Methodology". (H-1: still no About/Contact in primary nav.)
- **Path tabs:** "You are comparing quotes" highlighted + "Need a free estimate first?" + "Have a single quote? Analyze →" cross-links.
- **Hero:**
  - Mascot: GD-Woogoro illustration holding/wearing miniature garage doors. Renders cleanly.
  - H1: "Compare your garage door quotes"
  - Subtitle: "Upload 2 or 3 garage door quotes and we'll show you which is the best deal for the door style, opener, and warranty."
- **Upload row:**
  - Three quote cards in a row: **Quote 1** | **Quote 2** | **Quote 3**, each with `0 files in evaluation` placeholder text.
  - Quote 1 and Quote 2 appear required; Quote 3 is "Optional".
  - Below the row: **disabled gray CTA** "Upload at least 2 quotes to compare".
- **Below CTA:** "How to compare garage door quotes correctly" — 3-paragraph explanation about door style, spring type, hardware, warranty separations.
- **"Most important fields to compare"** — 9-bullet list:
  1. Door size
  2. Material (steel/wood/composite)
  3. Insulation R-value
  4. Spring type (torsion vs extension)
  5. Opener brand & horsepower
  6. Smart connectivity
  7. Hardware & track replacement
  8. Door warranty
  9. Spring warranty
  10. Opener warranty
  11. Old door haul-off
- **"Helpful Garage Door Guides"** — 2 link bullets:
  - "Garage Door quote analyzer" → /garage-door-quote-analyzer.html
  - "Garage Door cost guide" → /garage-door-cost-guide
- **Footer:** standard 4-column nav.

## Visual flags

- CTA correctly disabled when no quotes uploaded — good UX.
- 3 upload cards laid out cleanly side-by-side at 1280px.
- Mascot renders correctly with multiply blend.
- No placeholders, no $undefined, no broken styles.
- Helpful Guides link copy uses inconsistent capitalization: "Garage Door quote analyzer" (mixed) — could be "Garage Door Quote Analyzer" or "Garage door quote analyzer". Logged as **GD-CMP-1 (LOW)**.

## Findings noted

- **GD-CMP-1 (LOW, cosmetic):** Helpful Guides link copy has mixed-case "Garage Door quote analyzer" (capital "G", "D" but lowercase "quote analyzer"). Likely should be either full title-case ("Garage Door Quote Analyzer") or sentence-case ("Garage door quote analyzer"). Inconsistent with site brand-style.

## Verdict

Compare landing is functionally clean. Disabled-CTA-until-2-quotes UX is correct. One LOW cosmetic.
