#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "solar-images"),
  cacheDir: __dirname,
  analyzerPath: "/solar-quote-analyzer.html?path=quote"
});
