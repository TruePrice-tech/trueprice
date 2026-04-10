#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "siding-images"),
  cacheDir: __dirname,
  analyzerPath: "/siding-quote-analyzer.html?path=quote"
});
