const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "hvac",
  resultSelector: "#hvacApp, main",
  estimatePermutations: [
    {
      label: "heat-pump-good",
      steps: [
        { type: "pick", container: "optSystem", val: "heat_pump" },
        { type: "pick", container: "optEff", val: "16" },
        { type: "manualSqft", value: "2000" },
        { type: "pick", container: "optDuct", val: "good" },
        { type: "pick", container: "optUrg", val: "this_season" },
      ],
    },
    {
      label: "ac-only-poor",
      steps: [
        { type: "pick", container: "optSystem", val: "ac_only" },
        { type: "pick", container: "optEff", val: "14" },
        { type: "manualSqft", value: "2000" },
        { type: "pick", container: "optDuct", val: "poor" },
        { type: "pick", container: "optUrg", val: "next_year" },
      ],
    },
  ],
});
