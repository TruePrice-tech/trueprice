#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "foundation-images"),
  cacheDir: __dirname,
  analyzerPath: "/foundation-quote-analyzer.html?path=quote"
});
