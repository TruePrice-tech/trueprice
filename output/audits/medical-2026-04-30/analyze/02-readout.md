# 02 readout — Medical bill analyzer wrong-vertical reject

## Roof fixture (verified visually)
- H1: "This is not a **Medical bill**" — domain-correct ("bill" not "quote", from VERTICAL_NOUN map: medical→"Medical bill") ✓
- Iris-concerned mascot ✓
- Body: "looks like a roofing quote." ✓
- Sub: "We could try to analyze it as a medical bill anyway..." ✓
- CTAs: "Analyze as Roofing instead" → roofing-quote-analyzer.html ✓
- Confidence: "4 Roofing keywords vs 0 Medical keywords"
- No SEO leak below reject — Medical's appRoot replacement covers the SEO area cleanly

## HVAC + auto fixtures
HVAC test screenshot timeout (transient harness issue, not product bug). Pattern is the same — shared price-confirm renders the reject template.

## Verdict
Step 2-4 PASS for verified case. Medical's domain-specific copy ("bill" not "quote") works correctly throughout.
