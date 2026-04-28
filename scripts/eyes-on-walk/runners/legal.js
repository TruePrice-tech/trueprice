// Legal is the "different beast" per project_deep_dive_status.md -- fee-
// structure-driven, not range-based. Analyzer URL is /legal-fee-analyzer.html
// (NOT the default /legal-quote-analyzer.html which doesn't exist). Estimate
// page exists at /legal-estimate.html but the question flow hasn't been
// walked-as-human yet, so estimatePermutations stays empty until that dive
// happens. Analyzer + compare paths still walk and surface mascot/copy/CTA
// issues automatically.
const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "legal",
  resultSelector: "#legalApp, #legalFeeApp, main",
  analyzerUrl: "/legal-fee-analyzer.html",
  compareUrl: "/compare-legal-quotes.html",
  estimatePermutations: [],
});
