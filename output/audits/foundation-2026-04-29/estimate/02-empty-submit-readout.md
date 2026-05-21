# 02-empty-submit readout — Foundation estimate empty-address submit

URL: https://woogoro.com/foundation-estimate.html (after empty submit)
Captured: 2026-04-29

## What I see

- Page advanced from landing to wizard "Step 1 of 3"
- H1: "Foundation Repair Estimator" (changed from landing's "How much will your foundation repair project cost?")
- Subtitle: "Get a quick estimate"
- Step indicator: 1 of 3 (3 dots, first highlighted)
- Question card: **"What type of foundation repair do you need?"**
- 5 options: Pier Installation, Slabjacking/Mudjacking, Wall Stabilization, Drainage Correction, Crack Repair
- Below wizard: cross-vertical strip + cost-by-issue table

## Note

Behavior matches GD estimate: empty address advances to wizard. With my GD-EST-1-equivalent helper text addition (commit ed094acca9), the user is informed that address is optional. UX is now consistent.

(Harness reported `hasError: true` — false positive matching "required" text in the SEO spec table about permits. Page behavior is correct: no validation error, just advances to wizard.)

## Verdict

Step 2 of HUMAN_AUDIT_PROMPT for Foundation estimate empty-submit: PASS.
