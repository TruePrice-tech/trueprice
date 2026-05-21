# 04-cta readout — Foundation compare reject CTAs (Step 4)

URL: https://woogoro.com/compare-foundation-quotes.html

Compare reject CTA URLs come from the shared `js/vertical-detect.js` map and the shared `js/wrong-vertical-guard.js` template. These are the **same URLs and labels** as the Foundation analyze Step 4 CTA verification (analyze/04-cta-readout.md):
- `/roofing-quote-analyzer.html?path=quote` → "Is your roofing quote fair?"
- `/hvac-quote-analyzer.html?path=quote` → "Is your HVAC quote fair?"
- `/auto-repair.html?path=quote` → "Auto Repair Pricing"
- "Upload a different file" → reload to GD initial state

The auto-equinox visible CTA "Analyze as HVAC instead" verified working in this run (HVAC outranked the auto fixture in the combined-OCR detection on a 2-way upload).

## Open: CV-1 (cross-vertical)

Compare reject CTA routes to single-quote analyzer instead of compare-X-quotes — already in CROSS-VERTICAL-QUEUE.md.

## Verdict

Step 4 PASS (CTA routing inherited from analyze Step 4 verification).
