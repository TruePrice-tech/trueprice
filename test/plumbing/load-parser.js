// Loads js/analyzer-parser.js into Node with a fake `window` shim so the
// parser's browser-style `window.parseExtractedTextMultiStrategy = ...`
// assignments become callable from the test harness.
//
// Usage:
//   const parser = require("./load-parser");
//   parser.parseExtractedTextMultiStrategy(text, "plumbing");

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.resolve(__dirname, "..", "..", "js", "analyzer-parser.js");
const code = fs.readFileSync(SRC, "utf8");

const sandbox = { window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "analyzer-parser.js" });

module.exports = sandbox.window;
