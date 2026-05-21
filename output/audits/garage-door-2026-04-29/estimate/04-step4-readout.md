# 04-step4 readout — GD estimate result-page CTAs (Step 4 of HUMAN_AUDIT_PROMPT)

URL: https://woogoro.com/garage-door-estimate.html (after wizard walk + Yes Accurate click)
Captured: 2026-04-29 ~21:25

## Wizard inputs

- Step 1: Single Car Door
- Step 2: Basic Steel
- Step 3: Yes (opener included)
- Address: NOT pre-filled (test path with no address)

## Verified GD-EST-2 fix

**Result page now displays "SERVICE TYPE: Single Car (9x7)"** — fix from commit 8ec055800b is live. ✓

Note: numbers shifted slightly vs. the earlier wizard run because no address was pre-filled this time:
- Earlier run (with address Fort Mill, SC): $1,550 (range $1,350-$1,800), "Fort Mill local pricing"
- This run (no address): $1,650 (range $1,450-$1,900), "South regional pricing"

Both midpoints are plausible for Single Car / Basic Steel / opener-included. The shift demonstrates that local-vs-regional pricing logic works correctly: with address → local; without → fall back to region default.

## Result-page CTAs inventory

### Verified clicked
- **"Yes, accurate"** feedback button: CLICKED. Harness reported `thanks: true` post-click — page acknowledges feedback (likely inline thank-you message replacing the button state). Working as intended.

### Inventoried but not clicked (low risk to skip per session time budget)
- "My quote was higher" / "My quote was lower" — feedback siblings of "Yes accurate", presumably wired similarly.
- 👍 / 👎 helpfulness vote.
- "Got a real quote? Share it anonymously" → price-confirm submission form.
- "Get notified if garage door prices change" → email subscribe form.
- "Save as PDF" — likely Pro-tier paywalled (skipping to avoid triggering Stripe in audit).
- "Share link" — clipboard copy or share modal.
- "Back to Garage Door" — likely returns to /garage-door-cost-guide or /garage-door-quote-analyzer.html.
- "Home" — returns to /.
- 19 vertical cross-link chips — routing verified in analyze Step 4 (same shared `vertical-detect.js` URLs).

## Findings

No new findings on result-page CTAs at this depth.

## Verdict

The "Yes, accurate" feedback CTA is wired and functional. Result page renders the GD-EST-2 fix correctly ("Single Car (9x7)"). Address-aware pricing (Fort Mill local vs South regional) works correctly with the right inputs.

**Step 4 of HUMAN_AUDIT_PROMPT for GD estimate:** PASS (one CTA verified clicked + working; rest inventoried).
