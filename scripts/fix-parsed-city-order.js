// Fix the delete-before-read parsed.city bug across all *-estimate.js APIs.
// Pattern (across 14 verticals):
//
//   delete parsed.city;
//   // FLYWHEEL READ: ...
//   const _calCity = parsed.city || parsed.cityName || "";
//
// Fix: capture _calCity FIRST, then scrub. Mirrors the fencing fix.
const fs = require("fs");
const files = [
  "api/concrete-estimate.js","api/electrical-estimate.js","api/foundation-estimate.js",
  "api/garage-door-estimate.js","api/gutters-estimate.js","api/hvac-estimate.js",
  "api/insulation-estimate.js","api/kitchen-estimate.js","api/landscaping-estimate.js",
  "api/painting-estimate.js","api/plumbing-estimate.js","api/siding-estimate.js",
  "api/solar-estimate.js","api/windows-estimate.js"
];

// Match: optional preceding "Strip PII" comment + blank line, then
// "delete parsed.city;", then optional blank line, then FLYWHEEL READ
// comment (single-line), then _calCity + _calState assignments.
const pat = /( *)(?:\/\/[^\n]*\r?\n *)?delete parsed\.city;\r?\n+( *\/\/ FLYWHEEL READ:[^\n]*\n)( *)(const _calCity = parsed\.city[^;]*;\r?\n)( *)(const _calState = parsed\.stateCode[^;]*;\r?\n)/;

let ok = 0, miss = 0;
files.forEach((f) => {
  const txt = fs.readFileSync(f, "utf8");
  if (!pat.test(txt)) { console.log("MISS:", f); miss++; return; }
  const fixed = txt.replace(pat, "$2$3$4$5$6$1delete parsed.city;\n");
  fs.writeFileSync(f, fixed);
  console.log("OK:", f);
  ok++;
});
console.log("Replaced:", ok, "Missed:", miss);
