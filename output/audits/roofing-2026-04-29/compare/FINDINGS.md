# Roofing Compare — Audit Findings (2026-04-29)

URL: https://woogoro.com/compare-roofing-quotes.html
Fixtures: roofing-gaf-quote.jpeg ($16,765.79 actual), roofing-scope-doc.png ($14,800 actual), auto-equinox-quote.jpeg ($585.70 — negative)

## Severity legend
- **BLOCKER** — paying users get a confidently-wrong answer
- **HIGH** — visible defect or trust hit on the happy path
- **MED** — UX rough edge but the path completes
- **LOW** — copy / polish

## Findings

### C1. Compare page accepts mixed-vertical uploads with no warning — BLOCKER (queued)
- Severity: BLOCKER
- URL: /compare-roofing-quotes.html
- Action: upload `auto-equinox-quote.jpeg` (auto, $585.70) as Quote 1, `roofing-gaf-quote.jpeg` (roofing, $16,766) as Quote 2
- Observed: both fixtures parse successfully ("Contractor 1: $585", "Contractor 2: $16,766"). Compare button enables. Comparison would proceed without any warning.
- Expected: a wrong-vertical hard-reject screen, equivalent to the analyzers
- Status: this is the queued gap from `feedback_vertical_functionality_sacred.md` open gap #16. Memory says "Compare pages don't have wrong-vertical hard-reject (analyzer-only protection right now)". Lane explicitly lower-priority because it requires uploading 2-3 wrong files.
- Recommendation: add the same `tpEnforceVerticalMatch` guard call after each per-quote OCR completes. Cheap fix using existing guard library.

### C2. Malarkey scope-doc fixture price extracted as $811 (actual $14,800) — BLOCKER
- Severity: BLOCKER (1841% wrong)
- URL: /compare-roofing-quotes.html (and /roofing-quote-analyzer.html — confirmed parser-wide)
- Action: upload `roofing-scope-doc.png` (Malarkey Vista, $14,800.00 stated total)
- Observed: Quote total parsed as $811. Comparison sentence reads "Contractor 1 is $15,954.79 (1967%) more than Contractor 2."
- Root cause: Tesseract OCR severely degrades on this PNG — only 826 chars of text extracted, none containing "$14,800" or any clean dollar amount. The `$811` is fabricated by the parser from OCR noise. (Per `project_ocr_architecture_decision.md`, no AI fallback runs.)
- Why fixing this is bigger: the underlying issue is OCR quality. Patches: better Tesseract preprocessing, or a confidence threshold that REFUSES to produce a price when no clearly-formatted dollar amount is detected, OR a Vision API fallback for low-quality scans (current arch decision is no-fallback to keep costs flat).
- Quick mitigation: have parser refuse to produce a price unless a `$X,XXX` style match was found in the OCR. Falls back to "Couldn't read this quote, please type total manually."
- Status: not fixed in this audit. Documented for follow-up.

### C3. GAF Material Type rendered as "Metal" (actual: architectural asphalt shingles) — HIGH
- Severity: HIGH
- URL: /compare-roofing-quotes.html (results page)
- Action: upload roofing-gaf-quote.jpeg as Quote 1
- Observed: Material Type column shows "Metal"
- Expected: "Architectural asphalt" or similar (GAF Timberline HDZ Cool Roof Shingles is unambiguously architectural composition)
- Investigation: local `detectRoofMaterial` regex correctly returns "Architectural asphalt" when tested against the GAF OCR text directly. The compare path uses `engineResult.material` first, which appears to come from the parser/API. So the bug is upstream — either `detectMaterial` in `analyzer-parser.js` is returning "metal" despite its own anti-false-positive guards, OR the Claude API parse-quote endpoint is returning "metal".
- Status: not fixed in this audit. Needs upstream investigation.

### C4. Scope checklist marks too many items as "Unclear" — HIGH (queued: compare scoring rebalance)
- Severity: HIGH
- URL: /compare-roofing-quotes.html (results page)
- Action: upload roofing-gaf-quote.jpeg + roofing-scope-doc.png and run comparison
- Observed: both quotes get "2/12 confirmed" on the Transparency Checklist. Only Disposal + Permit (GAF) and Decking + Permit (Malarkey) are marked ✓.
- Expected: GAF should also confirm Drip edge (Edge Metal Trim), Ridge cap (High Rise Caps). Malarkey should confirm Tear-off (1 layer removal), Underlayment (Malarkey Synthetic), Ice & water shield (Malarkey perimeter), Flashing (valley + perimeter + pipe + skylight), Drip edge, Ridge vent, Cleanup. Both should be ~5-9/12 confirmed.
- Note: this is partially a Tesseract OCR issue (Malarkey OCR is garbage), and partially a regex coverage issue.
- Status: queued in `project_compare_scoring_rebalance_queued.md` (~6-8hr work).

### C5. Result-page CTAs verified working
- Severity: PASS
- "Upload different quotes" link → returns to upload state
- Sub-nav "Want a free estimate first?" → routes to estimator (verified on analyze audit)
- Sub-nav "Have a single quote? Analyze →" → routes to analyzer (verified on analyze audit)
- "Save as PDF" / "Share link" / "Back to Roofing" / "Home" buttons present and visible
- Pro upsell renders correctly with "Unlock Pro for $19" + "See an example Pro report"

### C6. "Got a real quote?" anonymous quote-share form present
- Status: NOT TESTED (form is the new flywheel input being built in parallel session — out of scope for this audit)

### C7. Score numerator confusion — MED
- Severity: MED
- URL: /compare-roofing-quotes.html (results page)
- Observed: "Contractor 1" and "Contractor 2" each get a score number (18 and 22), but the unit/scale isn't explained on the page. User sees "Contractor 1: 18, Contractor 2: 22" with red bars but doesn't know if higher is better, what the max is, what the score measures.
- Expected: either label the score (e.g. "Trust score: 18 / 30") or remove the bare number.
- Status: minor polish, queued.

## Summary

- **Compare page UI shell**: clean, sub-nav correct, mascot correct, copy correct, CTAs all working
- **Compare scoring/parser**: has BLOCKER-level issues (#C1, #C2) on certain fixtures that paying users WILL encounter. Both stem from broader infrastructure work (wrong-vertical guard on compare; OCR quality / parser confidence threshold). Fixing them properly is bigger than this audit's session.
- **What's defect-free**: the page itself, the upload flow, the CTAs, the verdict scaffold
- **What's NOT defect-free**: the actual comparison output when fixtures stress the parser (Malarkey OCR, GAF material misread)

Recommendation to Lane: add wrong-vertical guard to compare today (cheap), defer the parser-confidence-threshold and material-extraction bugs to a focused parser session.
