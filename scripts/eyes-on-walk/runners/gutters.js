const { defineRunner } = require("../lib/runner");

// Gutters uses class-based options (.gut-option) and a numeric input for linear feet.
module.exports = defineRunner({
  vertical: "gutters",
  resultSelector: "#gutApp, main",
  estimatePermutations: [
    {
      label: "alum-180lf-2story-noguards",
      steps: [
        { type: "pickClass", cls: "gut-option", val: "aluminum" },
        { type: "numericInput", selector: ".gut-lf-input, input[type='number']", value: "180" },
        { type: "pickClass", cls: "gut-option", val: "2" },
        { type: "pickClass", cls: "gut-option", val: "no" },
      ],
    },
    {
      label: "copper-120lf-1story-guards",
      steps: [
        { type: "pickClass", cls: "gut-option", val: "copper" },
        { type: "numericInput", selector: ".gut-lf-input, input[type='number']", value: "120" },
        { type: "pickClass", cls: "gut-option", val: "1" },
        { type: "pickClass", cls: "gut-option", val: "yes" },
      ],
    },
  ],
});
