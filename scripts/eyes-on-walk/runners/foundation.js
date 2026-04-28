// Foundation: per foundation-estimate.html source. 3 steps - optRepairType /
// optHomeAge / optSeverity.
const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "foundation",
  resultSelector: "#foundApp, main",
  estimatePermutations: [
    {
      label: "pier-1960-1989-moderate",
      picks: {
        optRepairType: "pier_installation",
        optHomeAge: "1960_1989",
        optSeverity: "moderate",
      },
    },
    {
      label: "crack-pre-1960-major",
      picks: {
        optRepairType: "crack_repair",
        optHomeAge: "pre_1960",
        optSeverity: "major",
      },
    },
    {
      label: "drainage-1990-plus-minor",
      picks: {
        optRepairType: "drainage_correction",
        optHomeAge: "1990_plus",
        optSeverity: "minor",
      },
    },
    {
      label: "wall-stab-1960-1989-extensive",
      picks: {
        optRepairType: "wall_stabilization",
        optHomeAge: "1960_1989",
        optSeverity: "extensive",
      },
    },
  ],
});
