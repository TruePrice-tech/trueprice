#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "windows-images"),
  cacheDir: __dirname,
  analyzerPath: "/window-quote-analyzer.html?path=quote"
});
