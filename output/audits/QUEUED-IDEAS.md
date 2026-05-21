# Queued Product Ideas (post-audit decisions)

## IDEA-1 (2026-04-30): Universal "Upload Your Quote" homepage entry — auto-detect vertical

**Source:** Lane during Gutters audit

**Concept:** Now that wrong-vertical detection works reliably across all 20 verticals, replace the 19-tile homepage vertical-picker with a single "Upload Your Quote" upload zone. After OCR, detect vertical → auto-route to the correct analyzer / compare flow.

**Why it might work:**
- We already detect vertical confidently in `js/vertical-detect.js` (refined across all audits — HVAC keywords expanded, kitchen tightened, etc.)
- Wrong-vertical reject already works on every analyzer — same logic in reverse handles routing
- Lower drop-off: user doesn't have to know which vertical their quote belongs to (esp. compound quotes)

**Tradeoffs / risks:**
- Multi-vertical quotes (kitchen remodel with plumbing/electrical line items) need a router that picks dominant vertical. Currently `detectVerticalFromText` returns the top scorer plus all scores; could enforce a confidence margin.
- Detection-failure path: if no vertical scores ≥3, need a fallback ("we couldn't tell — pick one")
- SEO impact: keep individual vertical landing pages (`/X-quote-analyzer.html`) for intent-search traffic ("kitchen remodel cost" etc.) — universal upload is ADDITIVE not replacement
- User override: someone uploading a "kitchen remodel" quote might want to analyze the boiler portion specifically as HVAC — need a "no, analyze as X instead" override after detection

**Implementation outline:**
1. Add "Universal Upload" tile to homepage (alongside existing 19 verticals)
2. New endpoint or homepage handler: receive file → run TP_Engine OCR → detectVerticalFromText
3. If `detected.score >= 3 AND second_score < detected.score * 0.8`: auto-redirect to `/<vertical>-quote-analyzer.html?path=quote` with file pre-loaded via sessionStorage
4. If ambiguous (top 2 within 20%): show disambig screen with the 2 candidates as buttons
5. If all scores <3: show "we couldn't detect — pick a vertical" picker
6. Preserve current per-vertical pages for SEO + direct navigation

**Effort estimate:** ~6-8 hrs (detect-and-route logic, disambig screen, sessionStorage hand-off, 1 new universal-upload page)

**Status:** OPEN — review post-audit. Not blocking Pro launch.

---

## Future ideas list (additive)

(Add new ideas below this line as they come up)
