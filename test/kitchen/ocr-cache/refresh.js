#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "kitchen-images"),
  cacheDir: __dirname,
  analyzerPath: "/kitchen-quote-analyzer.html?path=quote"
});
