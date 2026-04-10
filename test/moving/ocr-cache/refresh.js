#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "moving-images"),
  cacheDir: __dirname,
  analyzerPath: "/moving-quote-analyzer.html?path=quote"
});
