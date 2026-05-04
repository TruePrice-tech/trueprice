#!/usr/bin/env node
// Strips the <!-- TP-INTERNAL-TOOLS-BLOCK --> ... <!-- /TP-INTERNAL-TOOLS-BLOCK -->
// section across all root-level *.html pages. Diagnostic showed +1.02pp uniqueness
// uplift on insulation; block has no city-specific data and duplicates nav links.
const fs = require("fs");
const { execSync } = require("child_process");

const DRY_RUN = process.argv.includes("--dry");
// Match the comment-bounded block plus any leading whitespace/newlines that precede it
// so we don't leave a blank gap.
const BLOCK_RE = /\r?\n[ \t]*<!-- TP-INTERNAL-TOOLS-BLOCK -->[\s\S]*?<!-- \/TP-INTERNAL-TOOLS-BLOCK -->/g;

function listGitFiles() {
  const out = execSync(`git ls-files -- "*.html"`, { encoding: "utf8" });
  return out.split("\n").filter(Boolean).filter(p => !p.includes("/"));
}

function fixFile(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  if (!html.includes("<!-- TP-INTERNAL-TOOLS-BLOCK -->")) return { changed: false };
  const next = html.replace(BLOCK_RE, "");
  if (next === html) return { changed: false, reason: "regex-mismatch" };
  if (!DRY_RUN) fs.writeFileSync(filePath, next);
  return { changed: true, stripped: html.length - next.length };
}

(function main() {
  const files = listGitFiles();
  let fixed = 0, skipped = 0, mismatches = [], totalStripped = 0;
  for (const f of files) {
    const r = fixFile(f);
    if (r.changed) { fixed++; totalStripped += r.stripped; }
    else if (r.reason === "regex-mismatch") mismatches.push(f);
    else skipped++;
  }
  const avg = fixed ? Math.round(totalStripped / fixed) : 0;
  console.log(`total=${files.length}  fixed=${fixed}  skipped=${skipped}${DRY_RUN ? "  (DRY RUN)" : ""}`);
  console.log(`stripped: total=${totalStripped} chars, avg=${avg}/page`);
  if (mismatches.length) { console.log("\nRegex mismatches (block present but didn't match):"); mismatches.forEach(m => console.log("  - " + m)); }
})();
