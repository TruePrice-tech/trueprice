const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "solar",
  resultSelector: "#solarApp, main",
  estimatePermutations: [
    {
      label: "medium-mid-enphase",
      picks: {
        optSize: "medium",
        optTier: "mid",
        optInverter: "microinverter",
        optBattery: "none",
        optRoof: "good",
        optUrg: "this_year",
      },
    },
    {
      label: "large-premium-battery",
      picks: {
        optSize: "large",
        optTier: "premium",
        optInverter: "microinverter",
        optBattery: "powerwall",
        optRoof: "good",
        optUrg: "this_year",
      },
    },
  ],
});
