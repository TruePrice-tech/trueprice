#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "fencing-images"),
  cacheDir: __dirname,
  analyzerPath: "/fencing-quote-analyzer.html?path=quote"
});
