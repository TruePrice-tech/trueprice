// Add cacheNamespace to runAbuseGuard + storeImageCache calls in APIs that
// lack one. Versioned to "<vertical>:v2-2026-04-27" so the next prompt or
// data change can bump it cleanly.
const fs = require("fs");
const targets = [
  { f: "api/auto-repair-estimate.js",  vertical: "auto-repair",  ns: "auto-repair:v2" },
  { f: "api/electrical-estimate.js",   vertical: "electrical",   ns: "electrical:v2" },
  { f: "api/foundation-estimate.js",   vertical: "foundation",   ns: "foundation:v2" },
  { f: "api/garage-door-estimate.js",  vertical: "garage-door",  ns: "garage-door:v2" },
  { f: "api/gutters-estimate.js",      vertical: "gutters",      ns: "gutters:v2" },
  { f: "api/kitchen-estimate.js",      vertical: "kitchen",      ns: "kitchen:v2" },
  { f: "api/medical-bill-estimate.js", vertical: "medical",      ns: "medical:v2" },
  { f: "api/painting-estimate.js",     vertical: "painting",     ns: "painting:v2" },
  { f: "api/siding-estimate.js",       vertical: "siding",       ns: "siding:v2" },
  { f: "api/solar-estimate.js",        vertical: "solar",        ns: "solar:v2" }
];

let ok = 0, miss = 0;
targets.forEach(({ f, vertical, ns }) => {
  let txt = fs.readFileSync(f, "utf8");

  // 1. Add cacheNamespace to runAbuseGuard call.
  // Match: runAbuseGuard(req, { vertical: "X", imageBytes: ... })
  // OR: runAbuseGuard(req, { vertical: "X" }) with no imageBytes
  const guardPat = new RegExp(
    "runAbuseGuard\\(req,\\s*\\{\\s*vertical:\\s*\"" + vertical.replace(/[-]/g, "\\-") + "\"\\s*,\\s*imageBytes:\\s*_imageBuf\\s*\\}\\)"
  );
  const guardSub = `runAbuseGuard(req, { vertical: "${vertical}", cacheNamespace: "${ns}", imageBytes: _imageBuf })`;
  let touched = false;
  if (guardPat.test(txt)) { txt = txt.replace(guardPat, guardSub); touched = true; }

  // 2. Update storeImageCache first arg from "vertical" -> namespaced version.
  const storePat = new RegExp(
    "storeImageCache\\(\"" + vertical.replace(/[-]/g, "\\-") + "\""
  );
  if (storePat.test(txt)) { txt = txt.replace(storePat, `storeImageCache("${ns}"`); touched = true; }

  if (!touched) { console.log("MISS:", f); miss++; return; }
  fs.writeFileSync(f, txt);
  console.log("OK:", f, "→", ns);
  ok++;
});
console.log("Updated:", ok, "Missed:", miss);
