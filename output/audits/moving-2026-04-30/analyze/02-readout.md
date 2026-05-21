# 02 readout — Moving wrong-vertical reject (3 fixtures)

All 3 wrong-vertical fixtures rejected correctly:
- roof: H1 "This is not a Moving quote", body "looks like a roofing quote", CTAs route to roofing analyzer ✓
- hvac: rejected, CTA routes to /hvac-quote-analyzer.html?path=quote ✓
- auto: rejected, CTA routes to /auto-repair.html?path=quote ✓
- upload-different: returns to Moving landing ✓

SEO sections HIDE on reject post-fix (commit f23a0d1d1c using setTimeout+detect tpHardRejectStartOver pattern).

**Step 2-4 PASS.**
