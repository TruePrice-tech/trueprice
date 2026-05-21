# 05-unhappy readout — Foundation estimate unhappy path (Step 5)

URL: https://woogoro.com/foundation-estimate.html
Captured: 2026-04-29

## Test — Refresh mid-wizard

**Setup:** Click CTA on landing → wizard step 1 renders → click first option (advances to step 2) → reload page.

- 05-mid-wizard.png: wizard at Step 2 captured
- 05-after-refresh.png: clean initial state restored
- Harness state: `isInitial: true, isWizard: false, h1: "How much will your foundation repair project cost?"`. **PASS.**

## Verdict

Refresh mid-wizard correctly resets to clean initial state. **Step 5 PASS.**
