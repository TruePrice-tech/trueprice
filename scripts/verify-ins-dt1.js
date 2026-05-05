// Verify INS-DT-1 fix on insulation-quote-analyzer.html.
const { runVerifier } = require("./lib/dt1-verifier");

runVerifier({
  analyzerPath: "/insulation-quote-analyzer.html",
  detailClass: "ins-detail",
  pricingLabelKey: "pricing",
  leakTokens: ["spray.?foam", "blown.?in", "fiberglass", "cellulose", "rigid.?foam", "batt", "attic", "walls", "crawl.?space", "basement"],
  manualPrice: "3000",
  fixtures: [
    { label: "messy insulation high (OCR-stripped form labels)",
      file: "test-quotes/insulation-images/messy-comparison-insul-high.jpg" },
    { label: "messy insulation mid (sub-type leak risk)",
      file: "test-quotes/insulation-images/messy-comparison-insul-mid.jpg" }
  ]
});
