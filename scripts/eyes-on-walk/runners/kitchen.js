// TODO: selectors not yet verified. No prior <vertical>-walk.js exists for
// kitchen. Onboarding steps:
//   1. Manually walk kitchen-estimate.html and note option container IDs +
//      data-val values for each step.
//   2. Confirm the result-page app id (likely #kitApp or similar).
//   3. Replace the placeholder permutations below with real ones.
//   4. Smoke test: node scripts/eyes-on-walk/run.js kitchen
//
// Until then this runner is registered but estimatePermutations is empty so
// only analyze + compare paths walk -- which still catches plenty (mascot
// brand violations, undefined / NaN, missing CTAs on result pages).
const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "kitchen",
  resultSelector: "#kitApp, main",
  estimatePermutations: [],
});
