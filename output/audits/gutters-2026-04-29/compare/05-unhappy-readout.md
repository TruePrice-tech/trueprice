# 05-unhappy readout — Gutters compare unhappy paths (Step 5)

## Test A — Single-quote (roof fixture)
- Per-upload OCR fired: H1 "This is not a Gutter quote" rendered immediately. Same per-upload reject behavior as other compare pages. **PASS.**

## Test B — Refresh during parse
- slot0Empty=true, h1 "Compare your gutter quotes", URL correct. (`isInitial: false` is regex false-negative — harness regex tuned for plural "gutters" but H1 uses singular "gutter".) Page IS reset cleanly. **PASS.**

## Verdict
Step 5 PASS.
