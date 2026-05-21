// Remove dead pricingData.commonUpsells loops from APIs whose data file
// doesn't actually have a commonUpsells array. Same shape as concrete + fencing
// fixes — the loop iterates an undefined array, so detectedUpsells is always
// undefined regardless of input. Verified data files: foundation, painting,
// siding all lack the key.
const fs = require("fs");
const files = [
  "api/foundation-estimate.js",
  "api/painting-estimate.js",
  "api/siding-estimate.js"
];

// Match the canonical shape (slight variations across files).
// The trailing "if (serverUpsells.length > 0)" block can be one-line OR
// multi-line ({ parsed.detectedUpsells = serverUpsells; }).
const pat = /\r?\n\s*(?:\/\/[^\n]*\n\s*)*const serverUpsells = \[\];\r?\n\s*if \(parsed\.lineItems && pricingData\.commonUpsells\) \{[\s\S]*?\n\s*\}\r?\n\s*if \(serverUpsells\.length > 0\)\s*\{?\s*\n?\s*parsed\.detectedUpsells = serverUpsells;\s*\n?\s*\}?\r?\n/;

let ok = 0, miss = 0;
files.forEach((f) => {
  const txt = fs.readFileSync(f, "utf8");
  if (!pat.test(txt)) { console.log("MISS:", f); miss++; return; }
  const fixed = txt.replace(pat, "\n");
  fs.writeFileSync(f, fixed);
  console.log("OK:", f);
  ok++;
});
console.log("Removed:", ok, "Missed:", miss);
