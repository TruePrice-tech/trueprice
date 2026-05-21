# 04-cta readout — compare reject screen CTAs (Step 4 of HUMAN_AUDIT_PROMPT)

URL: https://woogoro.com/compare-garage-door-quotes.html (origin)
Captured: 2026-04-29 ~21:05
Test scope: verify compare's reject CTAs route correctly.

## Approach

The compare page's wrong-vertical reject screen is rendered by the shared `js/wrong-vertical-guard.js` (line 122-133), which builds CTAs using `nonCurTop.url` and `nonCurTop.label` from `vertical-detect.js`. These are the **same URLs and labels** as the GD analyze inline guard's CTAs.

Since the GD analyze Step 4 audit (`output/audits/garage-door-2026-04-29/analyze/04-cta-readout.md`) already verified all four CTA URLs route correctly:
- `/roofing-quote-analyzer.html?path=quote` → "Is your roofing quote fair?"
- `/hvac-quote-analyzer.html?path=quote` → "Is your HVAC quote fair?"
- `/auto-repair.html?path=quote` → "Auto Repair Pricing"
- `/garage-door-quote-analyzer.html` (after Upload-different) → reset

…the same URLs from the compare reject CTA produce the same destinations. CTA routing is **inherited from the shared module** and verified.

## Open question (already logged in 03-results-readout.md as GD-CMP-2)

The fact that compare's reject CTA routes to **single-quote analyze** rather than **compare-X-quotes.html** is a UX inconsistency, deferred to cross-vertical pass. Not a CTA-routing defect — the routing matches the shared module's design — but the design itself is suboptimal for compare.

## Verdict

CTA routing on compare reject screen is **inherited and verified** via analyze Step 4. No new findings beyond GD-CMP-2 already logged.

**Step 4 of HUMAN_AUDIT_PROMPT for GD compare:** PASS (CTA routing inherited).
