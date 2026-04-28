const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "moving",
  resultSelector: "#moveApp, #mvApp, main",
  estimatePermutations: [
    {
      label: "local-3br-noassist",
      picks: {
        optMoveType: "local",
        optHomeSize: "3br",
        optAssist: "diy_truck",
        optDistance: "local",
      },
    },
    {
      label: "longdistance-3br-fullservice",
      picks: {
        optMoveType: "long_distance",
        optHomeSize: "3br",
        optAssist: "full_service",
        optDistance: "long_distance",
      },
    },
  ],
});
