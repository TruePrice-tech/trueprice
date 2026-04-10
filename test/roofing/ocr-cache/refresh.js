#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "roofing-images"),
  cacheDir: __dirname,
  analyzerPath: "/roofing-quote-analyzer.html?path=quote"
});
