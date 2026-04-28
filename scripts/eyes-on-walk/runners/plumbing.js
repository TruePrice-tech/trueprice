const { defineRunner } = require("../lib/runner");

// Plumbing has the price-confirm step in the analyzer ("Yes, analyze this price").
// Estimate flow follows the standard #optX [data-val=Y] pattern.
module.exports = defineRunner({
  vertical: "plumbing",
  resultSelector: "#plumbApp, main",
  analyzerPriceConfirm: true,
  estimatePermutations: [
    {
      label: "leak-emergency",
      picks: {
        optService: "leak_repair",
        optScope: "moderate",
        optUrgency: "emergency",
      },
    },
    {
      label: "water-heater-replace",
      picks: {
        optService: "water_heater",
        optScope: "replace",
        optUrgency: "this_week",
      },
    },
  ],
});
