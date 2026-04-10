#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "plumbing-images"),
  cacheDir: __dirname,
  analyzerPath: "/plumbing-quote-analyzer.html?path=quote"
});
