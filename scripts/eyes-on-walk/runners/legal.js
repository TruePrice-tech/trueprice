// Legal: per legal-estimate.html source. Steps are optService -> optSubType
// -> optFee -> optComplexity. analyzerUrl is /legal-fee-analyzer.html (NOT
// the default /legal-quote-analyzer.html which doesn't exist in repo).
const { defineRunner } = require("../lib/runner");

module.exports = defineRunner({
  vertical: "legal",
  resultSelector: "#legalApp, main",
  analyzerUrl: "/legal-fee-analyzer.html",
  compareUrl: "/compare-legal-quotes.html",
  estimatePermutations: [
    {
      label: "divorce-hourly-moderate",
      picks: {
        optService: "divorce",
        optFee: "hourly",
        optComplexity: "moderate",
      },
    },
    {
      label: "personal-injury-contingency-complex",
      picks: {
        optService: "personal_injury",
        optFee: "contingency",
        optComplexity: "complex",
      },
    },
    {
      label: "estate-planning-flat-simple",
      picks: {
        optService: "estate_planning",
        optFee: "flat_fee",
        optComplexity: "simple",
      },
    },
  ],
});
