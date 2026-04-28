// TODO: selectors not yet verified. Onboarding via the same steps as
// runners/kitchen.js. Analyze + compare paths walk in the meantime.
const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "siding",
  resultSelector: "#sidApp, main",
  estimatePermutations: [],
});
