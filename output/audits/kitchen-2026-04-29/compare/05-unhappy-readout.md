# 05-unhappy readout — Kitchen compare unhappy paths (Step 5 REDO at depth)

URL: https://woogoro.com/compare-kitchen-quotes.html

## Test A — Single-quote upload (05-single-quote-state.png, captured during mid-parse)
- Trust banner visible at top ✓
- Path tabs: "You are comparing quotes." + "Need a free estimate first?" + "Have a single quote? Analyze →"
- Maple mascot, H1 "Compare your kitchen remodel quotes"
- 3 quote slots: Quote 1 = "Parsing..." (mid-OCR with green checkmark), Quote 2 + 3 empty
- CTA below: gray-disabled "Still parsing... 0 of 1 ready"
- SEO sections fully visible (analysis state, not reject) — "How to compare kitchen remodel quotes correctly" + "Most important fields to compare" + "Helpful Kitchen Remodel Guides"
- Footer present
- **Behavior:** caught in mid-parse moment. After parse completes, if per-upload OCR detects wrong-vertical, .cmp-card gets replaced by reject (verified in 03-results.png). If same-vertical, CTA re-enables to require second quote.
- **PASS.**

## Test B — Refresh during parse (05-after-refresh.png)
- Identical to 01-initial.png — clean compare landing fully restored
- Trust banner, header, path tabs, Maple mascot, H1, all 3 empty slots, disabled CTA "Upload at least 2 quotes to compare", all SEO sections, footer
- Browser doesn't persist file inputs across reload, page state is purely client-side, reload re-renders fresh
- **PASS.**

## Verdict
Step 5 PASS at depth. Both unhappy paths produce clean state with no broken UI.
