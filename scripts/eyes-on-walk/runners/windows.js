const { defineRunner } = require("../lib/runner");

// Note: estimate URL is /window-estimate.html (singular), compare is
// /compare-window-quotes.html. Manifest dir stays "windows" -- see fixturesDir.
module.exports = defineRunner({
  vertical: "windows",
  fixturesDir: "windows",
  resultSelector: "#winApp, main",
  estimateUrl: "/window-estimate.html",
  analyzerUrl: "/window-quote-analyzer.html",
  compareUrl: "/compare-window-quotes.html",
  estimatePermutations: [
    {
      label: "16plus-vinyl-mid-doublehung-doublelowe-pocket",
      picks: {
        optCount: "16+",
        optMaterial: "vinyl",
        optBrandTier: "mid",
        optStyle: "double-hung",
        optGlass: "double-lowe",
        optInstall: "pocket",
      },
    },
    {
      label: "8-fiberglass-premium-casement-triple-fullframe",
      picks: {
        optCount: "8",
        optMaterial: "fiberglass",
        optBrandTier: "premium",
        optStyle: "casement",
        optGlass: "triple",
        optInstall: "full-frame",
      },
    },
  ],
});
