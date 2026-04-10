#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "insulation-images"),
  cacheDir: __dirname,
  analyzerPath: "/insulation-quote-analyzer.html?path=quote"
});
