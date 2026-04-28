const { defineRunner } = require("../lib/runner");

// Electrical analyzer has price-confirm. Estimate flow per electrical-walk.js.
module.exports = defineRunner({
  vertical: "electrical",
  resultSelector: "#elecApp, main",
  analyzerPriceConfirm: true,
  estimatePermutations: [
    {
      label: "panel-upgrade-200a",
      picks: {
        optService: "panel_upgrade",
        optAmps: "200",
        optAge: "older",
      },
    },
    {
      label: "ev-charger",
      picks: {
        optService: "ev_charger",
        optLevel: "level_2",
      },
    },
    {
      label: "generator",
      picks: {
        optService: "generator",
        optSize: "whole_home",
      },
    },
  ],
});
