#!/usr/bin/env node
/* Check every internal HTML link references an existing file.
   Only checks local absolute hrefs like /foo.html, /foo/bar.html. */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const exists = new Set();
function indexFiles(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    const rel = (prefix + "/" + entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "output", "test-quotes", "test", "data", "scripts", "competitor-research"].includes(entry.name)) continue;
      indexFiles(fp, rel);
    } else {
      exists.add(rel);
    }
  }
}
indexFiles(ROOT);

const missing = new Map();

function scanHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if ([".git","node_modules","output","templates"].includes(entry.name)) continue;
      scanHtml(fp);
    } else if (entry.name.toLowerCase().endsWith(".html")) {
      const rel = "/" + path.relative(ROOT, fp).replace(/\\/g, "/");
      const html = fs.readFileSync(fp, "utf8");
      const re = /href=["']([^"']+)["']/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        let target = m[1];
        if (!target.startsWith("/")) continue;
        if (target.startsWith("//")) continue;
        if (target.startsWith("/api/")) continue;
        target = target.split("?")[0].split("#")[0];
        if (!target) continue;
        if (!target.endsWith(".html")) continue;
        if (!exists.has(target)) {
          if (!missing.has(target)) missing.set(target, new Set());
          missing.get(target).add(rel);
        }
      }
    }
  }
}

scanHtml(ROOT);

console.log(missing.size + " missing link targets\n");
const sorted = [...missing.entries()].sort((a, b) => b[1].size - a[1].size);
for (const [target, files] of sorted.slice(0, 30)) {
  console.log(target + " (" + files.size + " referencing files)");
  for (const f of [...files].slice(0, 3)) console.log("  ← " + f);
}
