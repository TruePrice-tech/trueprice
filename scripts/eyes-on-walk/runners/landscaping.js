const { defineRunner } = require("../lib/runner");

// Landscaping has a numericInput step for size between project type and quality.
module.exports = defineRunner({
  vertical: "landscaping",
  resultSelector: "#landApp, main",
  estimatePermutations: [
    {
      label: "paver-patio-400sf-mid",
      steps: [
        { type: "pick", container: "optProject", val: "paver_patio" },
        { type: "numericInput", selector: "#sizeInput", value: "400", nextSelector: "#sizeNext" },
        { type: "pick", container: "optQualityTier", val: "mid" },
        { type: "pick", container: "optComplexity", val: "moderate" },
      ],
    },
    {
      label: "sod-1200sf-budget",
      steps: [
        { type: "pick", container: "optProject", val: "sod_installation" },
        { type: "numericInput", selector: "#sizeInput", value: "1200", nextSelector: "#sizeNext" },
        { type: "pick", container: "optQualityTier", val: "budget" },
        { type: "pick", container: "optComplexity", val: "easy" },
      ],
    },
    {
      label: "irrigation-3000sf-mid",
      steps: [
        { type: "pick", container: "optProject", val: "irrigation_system" },
        { type: "numericInput", selector: "#sizeInput", value: "3000", nextSelector: "#sizeNext" },
        { type: "pick", container: "optQualityTier", val: "mid" },
        { type: "pick", container: "optComplexity", val: "moderate" },
      ],
    },
  ],
});
