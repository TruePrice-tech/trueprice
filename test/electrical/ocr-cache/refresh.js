#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "electrical-images"),
  cacheDir: __dirname,
  analyzerPath: "/electrical-quote-analyzer.html?path=quote"
});
