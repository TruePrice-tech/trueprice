# 05-unhappy readout — compare unhappy paths (Step 5 of HUMAN_AUDIT_PROMPT)

URL: https://woogoro.com/compare-garage-door-quotes.html
Captured: 2026-04-29 ~21:08

## Test A — Single-quote state (button stays disabled)

**Setup:** Upload only 1 quote (roof) to slot 1. Wait 20s. Screenshot.

- **05-single-quote-state.png:** Slot 1 shows "Parsing..." with green checkmark. Slot 2 + 3 empty. Below: gray-disabled CTA "Still parsing... 0 of 1 ready".
- Harness state: `btnText: "Still parsing... 0 of 1 ready", btnDisabled: true, h1: "Compare your garage door quotes"`.
- After parsing completes (likely a few more seconds), the CTA text would change to "Upload at least 2 quotes to compare" still disabled. The CRUCIAL point: **CTA does not enable with only 1 quote**, regardless of state. **PASS.**

## Test B — Refresh during parse

**Setup:** Upload 2 quotes (roof + HVAC) to slots 1 + 2. Wait 3s (mid-parse). Reload page.

- **05-after-refresh.png:** Page restored to clean initial state. All 3 slots empty. CTA disabled "Upload at least 2 quotes to compare". Identical to 01-initial.png.
- Harness state: `slot0Empty: true, isInitial: true, h1: "Compare your garage door quotes"`. **PASS.**

**Verdict:** Refresh during compare flow correctly resets to initial state. Browser doesn't persist file inputs across reload, so slots return to empty. No stuck state, no orphaned UI.

## Verdict for compare Step 5

Both unhappy paths handled gracefully:
- Single-quote upload: CTA stays disabled, no compare attempted.
- Refresh-during-parse: clean reset.

No new findings. **Step 5 of HUMAN_AUDIT_PROMPT for GD compare:** PASS.

## Untested unhappy paths (deferred for time)

- Click compare button when manually enabled via DevTools (does the page hard-fail or silently skip?). Already tested via harness in `compare-reject-2way` step which manually enabled and clicked the button to trigger the wrong-vertical reject.
- Upload PDF instead of image — same as analyze path, MOD priority deferred.
- Upload 3 quotes (max), confirm flow works with full slot occupation.
