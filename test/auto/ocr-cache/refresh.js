#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "auto-images"),
  cacheDir: __dirname,
  analyzerPath: "/auto-repair.html?path=quote"
});
