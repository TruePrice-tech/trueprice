const { defineRunner } = require("../lib/runner");

// Garage door: optService picks branch the rest of the flow. opener_only and
// spring_replacement skip material/opener picks.
module.exports = defineRunner({
  vertical: "garage-door",
  resultSelector: "#gdApp, main",
  estimatePermutations: [
    {
      label: "single-door-steel",
      picks: {
        optService: "single_door",
        optMaterial: "steel",
        optOpener: "include_opener",
      },
    },
    {
      label: "double-door-carriage",
      picks: {
        optService: "double_door",
        optMaterial: "carriage",
        optOpener: "include_opener",
      },
    },
    {
      label: "spring-replacement",
      picks: {
        optService: "spring_replacement",
      },
    },
    {
      label: "opener-only",
      picks: {
        optService: "opener_only",
      },
    },
  ],
});
