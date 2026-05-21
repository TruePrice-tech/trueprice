# 04-cta readout — Kitchen reject CTAs (Step 4 REDO at depth)

URL: https://woogoro.com/kitchen-quote-analyzer.html (origin)
Captured: 2026-04-30

## Roof CTA path (verified visually)
**Pre-CTA:** trust banner + path-tabs + H1 "This is not a Kitchen quote" + Iris-concerned + body "looks like a roofing quote" + score "4 Roofing keywords vs 0 kitchen keywords" + SEO hidden + footer.

**After click → roofing-quote-analyzer.html?path=quote (04-cta-roof-landed.png):**
- Trust banner restored ✓
- Header (Woogoros nav)
- Roofing Woogoro mascot (gray bear with hard-hat)
- H1: "Is your roofing quote fair?"
- Address form below subhead
- "Upload Your Roofing Quote" CTA card
- ZIP input + "Get my estimate" button
- Cross-vertical strip
- "What to look for in a roofing quote" — 8 spec cells (Total installed cost, Material, Underlayment type, Single-square unit-price, Flashing replacement, Permit, ...)
- "Red flags in a roofing quote" — bullets
- "Common hidden costs and change orders" + FAQ + Footer
- **User can immediately re-upload to the correct vertical's analyzer** ✓

## HVAC CTA path
**After click → hvac-quote-analyzer.html?path=quote (04-cta-hvac-landed.png):**
- HVAC Woogoro (orange-haired)
- H1: "Is your HVAC quote fair?"
- 8 spec cells: System type and tonnage, Brand/model numbers, SEER/SEER2 rating, Manual J load calculation, Refrigerant type, Warranty (manufacturer + labor), Air handler/coil match, Permit and inspection
- Red flags + Common hidden costs + FAQ + Footer
- ✓

## Auto CTA path
**After click → auto-repair.html?path=quote (04-cta-auto-landed.png):**
- Auto Repair Woogoro (red bear with wrench)
- H1: "Auto Repair Pricing" (different than other analyzers — this is the 3-tab hub structure, CV-5 noted)
- 3 tabs: "I Need an Estimate" / "I Have a Quote" / "Compare 2-3 Quotes"
- "Upload Your Quote" drag/drop zone (because path=quote activates "I Have a Quote" tab)
- "More auto repair tools" link + Disclaimer
- ✓ (functional but visually inconsistent with other vertical analyzers — already in CV queue as CV-5)

## Upload-different CTA path
**After click → kitchen-quote-analyzer.html (04-cta-upload-different.png):**
- Identical to 01-initial.png
- Trust banner ✓
- Maple Woogoro
- H1 "Is your kitchen remodel quote fair?"
- All sections restored (cross-vertical strip + spec table + red flags + FAQ)
- File input present ✓

## Verdict
Step 4 PASS at full depth. All 4 CTAs route correctly and land on functional pages. Every landed page has its trust banner intact (the #main scope fix was Kitchen-only — other landed pages already keep their banners since they don't go through reject-state logic).
