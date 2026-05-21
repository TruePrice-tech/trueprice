# 05-unhappy readout — Gutters analyze unhappy paths (Step 5)

## Test A — Refresh during analysis
- Page reset cleanly. H1 "Is your gutter quote fair?", file input present, isInitial=true. **PASS.**

## Test B — Rapid double upload
- Final state: reject screen rendered ("This is not a Gutter quote", body "looks like a roofing quote"). Harness `outcome: timeout` because it polled for the wrong regex but visual confirms reject IS shown. **PASS.**

## Verdict
Step 5 PASS.
