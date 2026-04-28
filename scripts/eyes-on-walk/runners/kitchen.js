// Kitchen: per kitchen-estimate.html source. 5 steps - optTier / optSize /
// optCabinet / optCounter / optAppliance. optSize values are array indices
// (0=small, 1=average, 2=large, 3=expansive) per KIT_PRICING.kitchenSizes.
const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "kitchen",
  resultSelector: "#kitApp, main",
  estimatePermutations: [
    {
      label: "midrange-average-semicustom-quartz",
      picks: {
        optTier: "midrange",
        optSize: "1",
        optCabinet: "semicustom",
        optCounter: "quartz",
        optAppliance: "midrange",
      },
    },
    {
      label: "minor-small-stock-laminate-existing",
      picks: {
        optTier: "minor",
        optSize: "0",
        optCabinet: "stock",
        optCounter: "laminate",
        optAppliance: "existing",
      },
    },
    {
      label: "major-expansive-custom-marble-premium",
      picks: {
        optTier: "major",
        optSize: "3",
        optCabinet: "custom",
        optCounter: "marble",
        optAppliance: "premium",
      },
    },
  ],
});
