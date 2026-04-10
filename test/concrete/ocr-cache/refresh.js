#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "concrete-images"),
  cacheDir: __dirname,
  analyzerPath: "/concrete-quote-analyzer.html?path=quote"
});
