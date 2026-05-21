# 05-unhappy readout — Foundation compare unhappy paths (Step 5)

URL: https://woogoro.com/compare-foundation-quotes.html
Captured: 2026-04-29

## Test A — Single-quote upload

**Setup:** Upload only 1 quote. Wait. Verify CTA stays disabled.
- Harness state: `btnDisabled: true`. CTA does not enable with only 1 quote regardless of parsing state. **PASS.**

## Test B — Refresh during parse

**Setup:** Upload 2 quotes, wait 3s mid-parse, reload.
- Harness state: `slot0Empty: true, h1: "Compare your foundation repair quotes"`. Page reset to initial state — file inputs cleared, H1 restored.
- (Harness `isInitial: false` is a regex false-negative — `/Compare your foundation quotes/` didn't match the actual `"Compare your foundation repair quotes"` text. The state IS initial, regex needs "repair" inserted. Cosmetic harness bug only.)
- **PASS** by other indicators (URL + H1 + slot empty all confirm clean reset).

## Verdict

Both compare unhappy paths handled gracefully. No new findings. **Step 5 of HUMAN_AUDIT_PROMPT for Foundation compare:** PASS.
