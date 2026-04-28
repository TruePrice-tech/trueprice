const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "fencing",
  resultSelector: "#fenceApp, main",
  estimatePermutations: [
    { label: "cedar-priv", picks: { optType: "cedar", optLength: "200", optHeight: "6", optGate: "yes", optTerrain: "flat", optDemo: "yes" } },
    { label: "wood-priv", picks: { optType: "wood_privacy", optLength: "150", optHeight: "6", optGate: "no", optTerrain: "flat", optDemo: "no" } },
    { label: "chain-link", picks: { optType: "chain_link", optLength: "100", optHeight: "4", optGate: "no", optTerrain: "flat", optDemo: "no" } },
  ],
});
