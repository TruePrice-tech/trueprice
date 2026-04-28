const { defineRunner } = require("../lib/runner");

// Auto-repair: per scripts/auto-repair-walk2.js + repo file inventory.
//   estimate at /auto-repair.html (the unified router; ?path=estimate or default).
//     Does NOT use the standard #optX [data-val=Y] pattern -- it's a chip-picker
//     UI with #repairChips / #repairSelect / #yearInput / #makeInput / #modelInput
//     / #stateSelect that loads vehicle data dynamically. Onboarding the
//     estimate path needs a custom step type (chip-pick + form-fill); deferred
//     until the auto-repair re-walk dive captures the exact flow.
//   analyzer at /auto-repair-quote-analyzer.html (also reachable via the
//     /auto-repair.html?path=quote router; using the standalone URL for clarity)
//   file input id="fileInput", confirm button id="tpConfirmPriceBtn"
//   compare at /compare-auto-quotes.html (note: "auto", not "auto-repair")
//   manifest dir is "auto-images" (fixturesDir override)
//   result selector: #quoteApp
module.exports = defineRunner({
  vertical: "auto-repair",
  fixturesDir: "auto",
  resultSelector: "#quoteApp, main",
  estimateUrl: "/auto-repair.html",
  analyzerUrl: "/auto-repair-quote-analyzer.html",
  compareUrl: "/compare-auto-quotes.html",
  fileInputSelector: "#fileInput",
  analyzerPriceConfirm: true,
  confirmButtonSelector: "#tpConfirmPriceBtn",
  estimatePermutations: [], // chip-picker UI -- needs custom step type, deferred
});
