// Painting: per painting-estimate.html source. 4 steps - optProject /
// optBrandTier / optQuality / optCondition.
const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "painting",
  resultSelector: "#paintApp, main",
  estimatePermutations: [
    {
      label: "interior-standard-good",
      picks: {
        optProject: "interior",
        optBrandTier: "standard",
        optQuality: "standard",
        optCondition: "good",
      },
    },
    {
      label: "exterior-premium-fair",
      picks: {
        optProject: "exterior",
        optBrandTier: "premium",
        optQuality: "premium",
        optCondition: "fair",
      },
    },
    {
      label: "cabinets-premium-good",
      picks: {
        optProject: "cabinets",
        optBrandTier: "premium",
        optQuality: "premium",
        optCondition: "good",
      },
    },
  ],
});
