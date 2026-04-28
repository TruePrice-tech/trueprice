// Siding: per siding-estimate.html source. 4 steps - optSiding / optStories
// / optSqftPreset / optCondition.
const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "siding",
  resultSelector: "#sidApp, main",
  estimatePermutations: [
    {
      label: "vinyl-2story-2000sf-good",
      picks: {
        optSiding: "vinyl",
        optStories: "2",
        optSqftPreset: "2000",
        optCondition: "good",
      },
    },
    {
      label: "fiber-cement-2story-2500sf-fair",
      picks: {
        optSiding: "fiber_cement",
        optStories: "2",
        optSqftPreset: "2500",
        optCondition: "fair",
      },
    },
    {
      label: "wood-1story-1500sf-poor",
      picks: {
        optSiding: "wood",
        optStories: "1",
        optSqftPreset: "1500",
        optCondition: "poor",
      },
    },
  ],
});
