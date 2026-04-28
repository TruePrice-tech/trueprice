const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "concrete",
  resultSelector: "#concApp, main",
  estimatePermutations: [
    {
      label: "patio-800sf-4in-nodemo",
      picks: {
        optProject: "concrete_patio",
        optSize: "800",
        optThick: "4",
        optDemo: "no",
      },
    },
    {
      label: "driveway-1200sf-6in-demo",
      picks: {
        optProject: "concrete_driveway",
        optSize: "1200",
        optThick: "6",
        optDemo: "yes",
      },
    },
  ],
});
