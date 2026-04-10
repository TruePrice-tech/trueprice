#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "hvac-images"),
  cacheDir: __dirname,
  analyzerPath: "/hvac-quote-analyzer.html?path=quote"
});
