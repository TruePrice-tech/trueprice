// Reports which verticals need an eyes-on walk based on a list of changed
// files (defaults to `git diff --name-only origin/main...HEAD`). Used by
// the pre-push hook and the GitHub Action for tier-1 (commit-time) walks.
// Prints space-separated vertical names to stdout, or nothing if no
// triggers fired. Exit code 0 either way.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function loadMap() {
  const file = path.join(__dirname, "triggers.json");
  return JSON.parse(fs.readFileSync(file, "utf8")).map;
}

function matchGlob(file, glob) {
  if (glob.endsWith("/**")) return file.startsWith(glob.slice(0, -3) + "/");
  if (glob.includes("*")) {
    const re = new RegExp("^" + glob.replace(/\./g, "\\.").replace(/\*/g, "[^/]*") + "$");
    return re.test(file);
  }
  return file === glob;
}

function changedFiles() {
  if (process.argv.length > 2) return process.argv.slice(2);
  try {
    const out = execSync("git diff --name-only origin/main...HEAD", { encoding: "utf8" });
    return out.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    try {
      const out = execSync("git diff --name-only HEAD~1", { encoding: "utf8" });
      return out.split("\n").map((s) => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
}

const map = loadMap();
const files = changedFiles();
const set = new Set();
for (const f of files) {
  for (const [glob, verticals] of Object.entries(map)) {
    if (matchGlob(f, glob)) for (const v of verticals) set.add(v);
  }
}

if (set.size > 0) {
  process.stdout.write([...set].sort().join(" ") + "\n");
}
