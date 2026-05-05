// Verify FENCE-DT-1 fix on fencing-quote-analyzer.html.
const { runVerifier } = require("./lib/dt1-verifier");

runVerifier({
  analyzerPath: "/fencing-quote-analyzer.html",
  detailClass: "fence-detail",
  pricingLabelKey: "pricing source",
  leakTokens: ["wood", "vinyl", "chain.?link", "aluminum", "wrought.?iron", "composite", "barbed"],
  fixtures: [
    { label: "messy fence high (OCR-stripped form labels)",
      file: "test-quotes/fencing-images/messy-comparison-fence-high.jpg" },
    { label: "messy fence mid (sub-type leak risk)",
      file: "test-quotes/fencing-images/messy-comparison-fence-mid.jpg" }
  ]
});
