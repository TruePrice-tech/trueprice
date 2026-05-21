# 04-cta readout — Foundation reject screen CTAs (Step 4 of HUMAN_AUDIT_PROMPT)

URL: https://woogoro.com/foundation-quote-analyzer.html (origin)
Captured: 2026-04-29

## Results from harness (04-cta-results.json)

| Case | Reject seen | CTA found | CTA text | Landed URL | Landed H1 | URL match | H1 match |
|---|---|---|---|---|---|---|---|
| roof | yes | yes | "Analyze as Roofing instead" | /roofing-quote-analyzer.html?path=quote | "Is your roofing quote fair?" | ✓ | ✓ |
| hvac | yes | yes | "Analyze as HVAC instead" | /hvac-quote-analyzer.html?path=quote | "Is your HVAC quote fair?" | ✓ | ✓ |
| auto | yes | yes | "Analyze as Auto Repair instead" | /auto-repair.html?path=quote | "Auto Repair Pricing" | ✓ | ✓ |
| upload-different | yes | yes | "Upload a different file" | /foundation-quote-analyzer.html | "Is your foundation repair quote fair?" | n/a | ✓ |

## Verdict

All 4 CTAs route correctly. Same routing as GD analyze Step 4 (vertical-detect.js URLs are shared). CV-1 (compare reject CTA routes to single-quote analyze) applies here too as cross-vertical, already queued.

**Step 4 of HUMAN_AUDIT_PROMPT for Foundation analyze:** PASS.
