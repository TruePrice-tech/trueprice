const { defineRunner } = require("../lib/runner");

// Moving: per scripts/moving-walk.js. Estimate has optMoveType / optHomeSize /
// optDistance (skipped for same_building) / optPacking / optSpecial. Analyzer
// uses #fileInput + #tpConfirmPriceBtn price-confirm. Result selectors: estimate
// renders to #moveApp, analyzer to #mvApp -- selector list covers both.
module.exports = defineRunner({
  vertical: "moving",
  resultSelector: "#moveApp, #mvApp, main",
  fileInputSelector: "#fileInput",
  analyzerPriceConfirm: true,
  confirmButtonSelector: "#tpConfirmPriceBtn",
  estimatePermutations: [
    {
      label: "local-2br-nopack",
      picks: {
        optMoveType: "local",
        optHomeSize: "2br",
        optDistance: "under_50",
        optPacking: "none",
        optSpecial: "none",
      },
    },
    {
      label: "longdistance-3br-partial-piano",
      picks: {
        optMoveType: "long_distance",
        optHomeSize: "3br",
        optDistance: "250_1000",
        optPacking: "partial",
        optSpecial: "piano",
      },
    },
    {
      label: "same-building-studio",
      // same_building skips optDistance per the source walk; the standard
      // step loop just logs "missed" if a pick can't be applied, so leaving
      // optDistance in here is harmless.
      picks: {
        optMoveType: "same_building",
        optHomeSize: "studio_1br",
        optPacking: "none",
        optSpecial: "stairs",
      },
    },
  ],
});
