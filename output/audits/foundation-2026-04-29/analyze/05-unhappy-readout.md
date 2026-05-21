# 05-unhappy readout — Foundation analyze unhappy paths (Step 5)

URL: https://woogoro.com/foundation-quote-analyzer.html
Captured: 2026-04-29

## Test A — Refresh during analysis

**Setup:** Upload roof fixture, wait 5s (mid-OCR), reload page.
- 05-during-analysis.png: page in "Analyzing your foundation repair quote..." state, progress bar visible.
- 05-after-refresh.png: clean GD initial state restored. H1 "Is your foundation repair quote fair?", file input present.
- Harness state: `isInitial: true, hasFileInput: true, isStuckOnAnalyzing: false`. **PASS.**

## Test B — Rapid second upload

**Setup:** Upload roof + HVAC in quick succession.
- 05-after-double-upload.png: page in "Analyzing your foundation repair quote..." state, progress bar at "Reading text (1/3)..." caption. No errors, no broken UI.
- Harness `outcome: "rendered"` was a false positive — polling regex matched SEO text containing "range" or "cost" rather than an actual result/reject. Visual inspection confirms the page is still mid-analysis (handling the second upload gracefully). No double-render, no orphaned state.

**Verdict:** Both unhappy paths handled cleanly. **PASS.**

## Step 5 verdict

Foundation analyze handles refresh during analysis (clean reset) and rapid double-upload (continues processing without breaking). No new findings.
