# 02-empty-submit readout — GD estimate empty-address submit

URL: https://woogoro.com/garage-door-estimate.html (after empty submit)
Captured: 2026-04-29 ~21:13

## What I see

- Page advanced from landing into wizard "Step 1 of 3" without validation error.
- H1: "Garage Door Cost Estimator" (changed from landing's "How much will your garage door cost?")
- Subtitle: "Get a quick estimate"
- Step indicator: "Step 1 of 3" with 3 dots, first highlighted blue
- Question card: **"What type of garage door service do you need?"**
- 5 option buttons: Single Car Door, Double Car Door, Custom/Carriage, Opener Only, Spring Replacement
- Below wizard: cross-vertical strip + start of cost-by-type table

## Findings

### GD-EST-1 (LOW): Empty address advances without warning
- **Severity:** LOW (UX, not a defect)
- **Observed:** Clicking "Get Garage Door Estimate" on the landing without entering an address advances the user to the wizard with no warning.
- **Expected:** Either accept silently and use national-average pricing (current behavior), OR require address (with validation message), OR show non-blocking helper "Add address for local pricing".
- **Status:** **DEFERRED** — site-wide pattern across estimate pages. Not a blocker. Logged for cross-vertical UX pass.

## Verdict

The wizard mechanism works: skipping address advances to question 1 of 3. No data loss, no error. UX could be improved with an address-skipped helper, but functional.
