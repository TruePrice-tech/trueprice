// scripts/_handwritten-guard.js
//
// Shared helper used by every build-flagship-{vertical}.js regenerator.
// Skips any file that has the HANDWRITTEN-PROTECTED marker so hand-written
// content cannot be silently overwritten by a future regenerator run.
//
// To protect a file from regeneration, add this comment to the <head>:
//   <!-- HANDWRITTEN-PROTECTED: do not regenerate. Edit by hand only. -->
//
// Why this exists (Lane 2026-04-29): hand-written flagship metro pages
// for auto-repair, medical, legal, and moving regressed from ~90%
// uniqueness to ~50% over the course of normal operations because nothing
// stopped a regenerator script from running over them. This guard makes
// regenerator regression IMPOSSIBLE for marked files.
//
// Usage in build-flagship-X.js:
//   const { isProtected, listProtected } = require("./_handwritten-guard.js");
//   for (const metro of METROS) {
//     if (isProtected(metro.file)) {
//       console.log(`SKIP ${metro.file} (HANDWRITTEN-PROTECTED)`);
//       continue;
//     }
//     // ... normal regeneration ...
//   }

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MARKER = "HANDWRITTEN-PROTECTED";

function isProtected(relOrAbsPath) {
  const p = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(ROOT, relOrAbsPath);
  if (!fs.existsSync(p)) return false;
  try {
    // Read just the first 4KB — the marker should be in <head>, no need
    // to slurp the whole file.
    const fd = fs.openSync(p, "r");
    const buf = Buffer.alloc(4096);
    fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    return buf.toString("utf8").indexOf(MARKER) !== -1;
  } catch (e) {
    return false;
  }
}

function listProtected(dir) {
  const d = dir || ROOT;
  const files = fs.readdirSync(d).filter((f) => f.endsWith(".html"));
  const out = [];
  for (const f of files) {
    if (isProtected(path.join(d, f))) out.push(f);
  }
  return out;
}

// Monkey-patch fs.writeFileSync so ANY script that requires this module
// gets automatic protection. If a script tries to write to a HANDWRITTEN-
// PROTECTED file, the write silently no-ops with a console warning. This
// means build-flagship-X.js scripts only need to add ONE require line at
// the top to be safe — they don't need to thread isProtected() into
// every loop.
const _origWriteFileSync = fs.writeFileSync.bind(fs);
fs.writeFileSync = function (p, data, opts) {
  const abs = typeof p === "string"
    ? (path.isAbsolute(p) ? p : path.resolve(p))
    : p;
  if (typeof abs === "string" && abs.endsWith(".html") && isProtected(abs)) {
    console.warn(`[handwritten-guard] REFUSED write to ${path.basename(abs)} (HANDWRITTEN-PROTECTED). To edit this file, remove the marker first.`);
    return;
  }
  return _origWriteFileSync(p, data, opts);
};

module.exports = { isProtected, listProtected, MARKER };

// CLI: list all protected files. Useful for sanity-checking what's marked.
if (require.main === module) {
  const protectedFiles = listProtected();
  if (protectedFiles.length === 0) {
    console.log("No HANDWRITTEN-PROTECTED files found.");
    process.exit(0);
  }
  console.log(`Found ${protectedFiles.length} HANDWRITTEN-PROTECTED file(s):\n`);
  for (const f of protectedFiles) console.log("  " + f);
}
