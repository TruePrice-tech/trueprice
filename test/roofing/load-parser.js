// Loads js/analyzer-parser.js (shared) into Node with a fake `window` shim.
// Roofing IS the original parser — analyzer-parser.js was built for roofing
// first, so calling parseExtractedTextMultiStrategy(text, "roofing") is what
// the live site does for every uploaded roof quote.

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
