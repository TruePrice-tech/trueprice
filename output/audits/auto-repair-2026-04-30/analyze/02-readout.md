# 02 readout — Auto-repair wrong-vertical reject (3 fixtures)

## Roof fixture (04-precta-roof-rejected.png)
- H1: "This is not an Auto repair quote" — vowel-aware article ("an"), brand-style sentence-case
- Iris-concerned mascot
- Body: "looks like a roofing quote"
- CTAs: "Analyze as Roofing instead" + "Upload a different file"
- Score: "4 Roofing keywords vs ? Auto Repair keywords"

## HVAC fixture
- rejectSeen=true, CTA "Analyze as HVAC instead" routes correctly

## Auto fixture (auto-equinox-quote.jpeg)
- **rejectSeen=false** — CORRECT. Auto fixture matches the auto-repair vertical, page ACCEPTED it and proceeded to price-confirm screen showing "$586" detected price. This is happy-path behavior, not reject.
- Iris-happy mascot, "Yes, analyze this price" button shown.

## Verdict
Step 2 PASS. All 3 fixtures handled correctly:
- Wrong-vertical (roof, HVAC) → reject screens with proper routing.
- Same-vertical (auto) → accepted, price-confirm flow.
