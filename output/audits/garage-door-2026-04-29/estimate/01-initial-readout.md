# 01-initial readout — GD estimate landing

URL: https://woogoro.com/garage-door-estimate.html
Captured: 2026-04-29 ~21:10

## What I see (top to bottom)

- **Banner + header:** unchanged. (H-1 still applies — no About/Contact in nav.)
- **Path tabs:** "You're getting an estimate" highlighted + cross-links "Already have a quote? Analyze →" + "Multiple quotes? Compare →".
- **Hero:**
  - GD-Woogoro mascot (gray bear in baseball cap, holding/wearing miniature garage doors).
  - H1: "How much will your garage door cost?"
  - Subtitle: "Cost data refreshed monthly. We work in 30 sec, no team calls or staff time."
- **Address input:** single text field with placeholder "Start typing your address..."
- **Primary CTA:** blue "Get Garage Door Estimate" button.
- **Below CTA:** small helper line about how the estimate works.
- **Cross-vertical strip:** "Analyze quotes for other services" — 19 vertical chips.
- **"Garage door cost by type (2026)"** — large data table with columns: Door type, Door price, Total, Hours, Labor, Description. ~8 rows (Steel single layer, Steel insulated, Aluminum + glass, Wood composite, Wood, Carriage hood-style, ...). Specific dollar values per row.
- **"Cost of single vs double-car garage door"** — paragraph explaining cost differences.
- **"Cost of garage door opener"** — paragraph about opener pricing tiers.
- **"Garage door spring repair cost"** — paragraph about spring replacement costs.
- **"Garage door cost factors"** — 4-column grid:
  - Door size
  - Material (steel vs wood vs composite)
  - Hardware + tracks
  - Smart system features
- **"Garage door cost by city"** — grid of city links (multiple metros).
- **"Frequently asked questions about garage door cost"** — 5+ collapsed Q&A rows.
- **Footer:** standard.

## Visual flags

- Mascot renders cleanly.
- Address input is a single-field auto-complete (presumably typeahead-driven). Need to verify in Step 2.
- Primary CTA "Get Garage Door Estimate" — proper title-case button label.
- Cost-by-type table renders cleanly with $ values.
- City grid renders cleanly (~12-15 cities visible).

## Questions for Step 2 walk

- Does address autocomplete fire on real US addresses?
- Does the wizard advance after CTA click? What are the wizard steps?
- What numbers does the final estimate produce, and are they sensible relative to the cost table on this page?

## Verdict

Estimate landing is clean. Rich content (cost table, factors, city grid, FAQ) renders correctly.
