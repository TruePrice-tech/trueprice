// Loads js/analyzer-parser.js (shared) + js/hvac-parser.js (helper) into Node
// with a fake `window` shim. HVAC uses the same price-extraction core as every
// other vertical; only scope/system detection is vertical-specific.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const sandbox = { window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const rel of ["js/analyzer-parser.js", "js/hvac-parser.js"]) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}

module.exports = sandbox.window;
