#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "gutters-images"),
  cacheDir: __dirname,
  analyzerPath: "/gutters-quote-analyzer.html?path=quote"
});
