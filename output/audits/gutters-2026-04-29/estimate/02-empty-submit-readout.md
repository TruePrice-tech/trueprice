# 02-empty-submit readout

After empty submit on Gutters estimate landing, the page does NOT advance — `headline: "How much will your gutter project cost?"` unchanged, no stepMarker. The Gutters btnEstimate handler at line 687 doesn't gate on validation; it sets state.step = "estimator" and calls render(). The harness's button-find regex was the issue (didn't match singular "Get Gutter Estimate") — that was a harness bug, fixed.

## Verdict
Step 2 PASS (after harness regex fix).
