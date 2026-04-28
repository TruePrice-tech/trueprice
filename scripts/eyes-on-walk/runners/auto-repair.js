const { defineRunner } = require("../lib/runner");

// Auto-repair has unique URLs and file input ID. Per scripts/auto-repair-walk2.js:
//   analyzer at /auto-repair.html?path=quote (single page with ?path= router)
//   file input id="fileInput", confirm button id="tpConfirmPriceBtn"
//   compare at /compare-auto-quotes.html (auto, not auto-repair)
//   manifest dir is "auto-images" (not "auto-repair-images")
// Estimate path lives at the same /auto-repair.html?path=estimate but the
// flow isn't standardized in walks yet -- skipped for now; analyzer + compare
// give plenty of signal.
module.exports = defineRunner({
  vertical: "auto-repair",
  fixturesDir: "auto",
  resultSelector: "#quoteApp, main",
  analyzerUrl: "/auto-repair.html?path=quote",
  compareUrl: "/compare-auto-quotes.html",
  fileInputSelector: "#fileInput",
  analyzerPriceConfirm: true,
  confirmButtonSelector: "#tpConfirmPriceBtn",
  estimatePermutations: [], // estimate path TODO -- needs a dedicated walker run as human first
});
