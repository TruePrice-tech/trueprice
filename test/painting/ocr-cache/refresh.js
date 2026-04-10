#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "painting-images"),
  cacheDir: __dirname,
  analyzerPath: "/painting-quote-analyzer.html?path=quote"
});
