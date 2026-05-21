# 01-initial readout — GD analyze landing

URL: https://woogoro.com/garage-door-quote-analyzer.html
Captured: 2026-04-29 19:15

## What I see (top to bottom)

- **Site banner:** thin green-tinted banner across top: "Free 30-second / No phone / No signup / We never sell or share your data"
- **Header:** Woogoros wordmark + logo (gray Woogoro in baseball cap, left). Right side: "Methodology" link only — **About and Contact missing** (logged as H-1).
- **Path tabs:** Two tab strips below header — "You are analyzing a quote" highlighted, plus "Need a few estimates first?" and "Multiple quotes? Compare" cross-links.
- **Hero:**
  - Mascot: Iris in hard-hat (small Woogoro illustration). Renders cleanly, white-bg-multiplied.
  - H1: "Is your garage door quote fair?"
  - Subhead: "Upload your contractor quote (we'll show the price..." (truncated in fullPage scaled view, but reads coherently)
  - Helper line: "Or use our garage door cost guide to find a fair price"
  - Primary CTA: blue "Analyze a quote" button.
  - Below CTA: green strip "Got a quote? Click to upload" — drop zone.
- **Cross-vertical strip:** "Analyze quotes for other services" — row of 19 vertical chips/tabs (Roofing, HVAC, Plumbing, etc.). Difficult to read at scaled-down resolution but layout is intact.
- **Spec table:** "What to look for in a garage door quote" with 8 categories in a 4-column grid: Door size and type, Material, Insulation R-value, Panel style and brand, Springs, Opener brand and specs, Tracks and hardware, Removal of old door, Warranty terms.
- **Red flags section:** "Red flags in a garage door quote" — 7-8 bullets in pink/red pill cards (extension springs instead of torsion, unitemized line on attached garage, no opener included, cheapest cycle-count spring, reusing old tracks, no insulation or just "insulated", no warranty on labor/install).
- **Hidden costs section:** "Common hidden costs and change orders" with 5-6 bullets (track repair or replacement, new weather stripping, wall disconnect for garage interior access, remote key fobs, wifi add-on, battery backup, electrical outlet relocation).
- **FAQ:** "Frequently asked questions about garage door quotes" with 5 collapsed Q&A rows (How much does a new GD cost installed? What should be in a legit GD quote? What are red flags? Torsion vs extension springs? Should my GD match home siding?).
- **Footer:** 4-column nav (Get a price, Browse, Top trades, About). "Methodology", "Accessibility", "Privacy", "Terms" reachable from footer About column.

## Visual flags

- Header is sparse (no About/Contact in primary nav) — H-1 deferred.
- Iris-in-hard-hat renders correctly with multiply-blend; no halo or white box.
- All sections have consistent typography and spacing.
- No overflow, no broken layouts at 1280px width.
- No placeholder text, no $undefined, no NaN visible anywhere.
- Cross-vertical strip is dense but functional.

## Interactive inventory (from 01-initial.json)

15+ visible interactive elements: file input, "Analyze a quote" button, methodology link, ~19 cross-vertical chips, cost-guide link, 5 FAQ accordions, footer link cluster.

## Verdict

Initial state is clean. No bugs found at Step 1. Iris mascot, H1 copy, CTA all render correctly. Header gap (H-1) is site-wide cosmetic, not a blocker.
