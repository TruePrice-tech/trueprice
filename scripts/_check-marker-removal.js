#!/usr/bin/env node
// scripts/_check-marker-removal.js
//
// Pre-commit lint: fail if any staged HTML file is dropping its
// HANDWRITTEN-PROTECTED marker. Catches the failure mode where a
// regenerator (or a hand edit) silently strips the marker from a
// flagship page, leaving it exposed to the next mass regen.
//
// Companion to scripts/_handwritten-guard.js, which prevents
// fs.writeFileSync from overwriting marked files in the first place.
// This lint catches the case where the marker itself disappears.
//
// Install as a pre-commit hook:
//   .git/hooks/pre-commit  (shell wrapper that calls node on this)
//
// Override with `git commit --no-verify` if removing the marker is
// intentional (e.g. demoting a flagship back to templated).

const { execSync } = require("child_process");

const MARKER = "HANDWRITTEN-PROTECTED";

function getStagedHtmlFiles() {
  const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
    encoding: "utf8"
  });
  return out
    .split(/\r?\n/)
    .filter((f) => f.endsWith(".html"));
}

function headHadMarker(file) {
  try {
    const head = execSync(`git show HEAD:"${file}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    });
    return head.slice(0, 4096).indexOf(MARKER) !== -1;
  } catch (e) {
    return false;
  }
}

function stagedHasMarker(file) {
  try {
    const staged = execSync(`git show :"${file}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    });
    return staged.slice(0, 4096).indexOf(MARKER) !== -1;
  } catch (e) {
    return false;
  }
}

function main() {
  const files = getStagedHtmlFiles();
  if (files.length === 0) process.exit(0);

  const losses = [];
  for (const f of files) {
    if (headHadMarker(f) && !stagedHasMarker(f)) {
      losses.push(f);
    }
  }

  if (losses.length === 0) process.exit(0);

  console.error("");
  console.error("[marker-removal-lint] REFUSING commit: HANDWRITTEN-PROTECTED");
  console.error("marker is being removed from the following file(s):");
  console.error("");
  for (const f of losses) console.error("  " + f);
  console.error("");
  console.error("If this is intentional (e.g. demoting a flagship back to");
  console.error("templated), bypass with: git commit --no-verify");
  console.error("");
  console.error("If unintentional (e.g. a regenerator stripped the marker),");
  console.error("restore the marker before committing.");
  process.exit(1);
}

main();
