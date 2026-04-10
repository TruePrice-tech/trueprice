#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "landscaping-images"),
  cacheDir: __dirname,
  analyzerPath: "/landscaping-quote-analyzer.html?path=quote"
});
