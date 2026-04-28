const { defineRunner } = require("../lib/runner");

// Auto-repair: per scripts/auto-repair-walk2.js + repo file inventory.
//   estimate at /auto-repair-cost-estimate.html (selectors not yet captured)
//   analyzer at /auto-repair-quote-analyzer.html (also reachable via the
//     /auto-repair.html?path=quote router; using the standalone URL for clarity)
//   file input id="fileInput", confirm button id="tpConfirmPriceBtn"
//   compare at /compare-auto-quotes.html (note: "auto", not "auto-repair")
//   manifest dir is "auto-images" (fixturesDir override)
//   result selector: #quoteApp
// Estimate flow stays empty until a dedicated walker captures the option
// container IDs from /auto-repair-cost-estimate.html.
module.exports = defineRunner({
  vertical: "auto-repair",
  fixturesDir: "auto",
  resultSelector: "#quoteApp, main",
  estimateUrl: "/auto-repair-cost-estimate.html",
  analyzerUrl: "/auto-repair-quote-analyzer.html",
  compareUrl: "/compare-auto-quotes.html",
  fileInputSelector: "#fileInput",
  analyzerPriceConfirm: true,
  confirmButtonSelector: "#tpConfirmPriceBtn",
  estimatePermutations: [],
});
