#!/usr/bin/env node
/**
 * verify-roof-scope.js — sanity check the expanded roofing scope
 * regex patterns against realistic quote text including brand names.
 */
const path = require("path");
const fs = require("fs");

// Load analyzer-parser.js into a sandbox
const src = fs.readFileSync(path.join(__dirname, "..", "js", "analyzer-parser.js"), "utf8");
const vm = require("vm");
const sandbox = { window: {}, document: undefined, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const detect = sandbox.detectScopeSignals || sandbox.window.detectScopeSignals;
if (!detect) { console.error("detectScopeSignals not loaded"); process.exit(1); }

// Realistic roofing quote text combining brand names and generic terms
const fixtures = [
  {
    name: "GAF-branded quote (WeatherWatch, ProStart, TimberTex, Cobra)",
    text: `
      GAF Timberline HDZ architectural shingles
      Tear off existing roof
      GAF FeltBuster synthetic underlayment
      GAF WeatherWatch ice and water shield at eaves and valleys
      Aluminum drip edge on all eaves and rakes
      GAF Pro-Start starter strip at eaves
      GAF TimberTex hip and ridge cap shingles
      GAF Cobra ridge vent system
      Replace decking as needed at $5/sq ft
      Dumpster disposal included
      Building permit included
    `,
  },
  {
    name: "Owens Corning quote (WeatherLock, Starter Strip Plus, DuraRidge)",
    text: `
      Owens Corning Duration architectural shingles
      Complete tear off and haul away
      Synthetic underlayment Deck Defense
      WeatherLock self-adhesive ice barrier membrane
      Drip edge at eaves and rake
      Starter Strip Plus at perimeter
      DuraRidge hip and ridge cap
      Continuous ridge vent
      Step flashing at all walls
      Permit included
    `,
  },
  {
    name: "CertainTeed quote (WinterGuard, Swiftstart, ShadowRidge)",
    text: `
      CertainTeed Landmark architectural shingles
      Remove existing roof and dispose
      CertainTeed DiamondDeck synthetic underlayment
      CertainTeed WinterGuard ice and water barrier
      Aluminum drip metal
      Swift Start starter strip
      ShadowRidge hip and ridge cap
      Ridge vent continuous
      Pipe boots replaced
      Permit
    `,
  },
  {
    name: "Generic cheap quote (minimal brand terminology)",
    text: `
      Architectural shingles installed
      Tear off old roof
      Felt underlayment
      Ice shield in valleys
      Drip edge installed
      Starter row at eaves
      Hip cap installed
      Roof vents installed
      Cleanup and disposal included
    `,
  },
  {
    name: "User's Evans GA scenario (sparse mentions)",
    text: `
      Architectural shingles roofing
      Remove existing shingles
      Synthetic underlayment
      Drip edge
      Flashing around penetrations
      Replace damaged decking per sheet
      Haul away debris
      Permit
    `,
  },
];

const keys = ["tearOff", "underlayment", "flashing", "iceShield", "dripEdge",
              "ventilation", "ridgeVent", "starterStrip", "ridgeCap", "decking", "disposal", "permit"];

for (const f of fixtures) {
  console.log(`\n=== ${f.name} ===`);
  const signals = detect(f.text);
  const found = keys.filter(k => signals[k]?.status === "included");
  const missing = keys.filter(k => signals[k]?.status !== "included");
  console.log(`Found (${found.length}/${keys.length}): ${found.join(", ")}`);
  if (missing.length) console.log(`Missing:           ${missing.join(", ")}`);
}
