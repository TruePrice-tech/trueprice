// Verify WIN-DT-1 fix on window-quote-analyzer.html.
const { runVerifier } = require("./lib/dt1-verifier");

runVerifier({
  analyzerPath: "/window-quote-analyzer.html",
  detailClass: "win-detail",
  pricingLabelKey: "pricing source",
  leakTokens: ["double.?hung", "single.?hung", "casement", "awning", "slider", "picture", "bay", "bow", "egress", "small", "medium", "large", "extra.?large"],
  manualPrice: "8000",
  fixtures: [
    { label: "messy windows high (OCR-stripped form labels)",
      file: "test-quotes/windows-images/messy-comparison-windows-high.jpg" },
    { label: "messy windows mid (sub-type leak risk)",
      file: "test-quotes/windows-images/messy-comparison-windows-mid.jpg" }
  ]
});
