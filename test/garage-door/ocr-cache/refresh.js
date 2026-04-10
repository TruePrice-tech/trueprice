#!/usr/bin/env node
require("../../lib/parallel-refresh")({
  fixturesDir: require("path").resolve(__dirname, "..", "..", "..", "test-quotes", "garage-door-images"),
  cacheDir: __dirname,
  analyzerPath: "/garage-door-quote-analyzer.html?path=quote"
});
