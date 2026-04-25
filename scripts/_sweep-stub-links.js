#!/usr/bin/env node
/* Sweep: rewrite internal references from JS-redirect stub URLs to their
   canonical destinations. Stubs themselves stay in place (they protect
   external backlinks).

   Handles:
   - href="..."  (root-relative)
   - href='...'  (single-quoted)
   - https://woogoro.com/...  (absolute, used in JSON-LD, og:url, schema)

   Walks: HTML files (root + subdirs) and JS source files (excluding .min.js).
   Skips: stub files themselves, node_modules, output, .git, test fixtures,
   build scripts (those need manual review for template-variable safety). */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const REWRITES = {
  "/analyze-quote.html": "/analyze-my-quote.html",
  "/roof-replacement-cost-per-square-foot.html": "/roof-cost-calculator.html",
  "/roof-replacement-cost-guide.html": "/roof-cost-by-material.html",
  "/roof-replacement-cost-by-house-size.html": "/roof-cost-by-house-size.html",
  "/auto-repair-quote-analyzer.html": "/auto-repair.html",
  "/roof-replacement-cost-calculator.html": "/roof-cost-calculator.html",
};

const STUB_BASENAMES = new Set(Object.keys(REWRITES).map((p) => p.slice(1)));

const SKIP_DIRS = new Set([
  ".git", "node_modules", "output", "test", "test-quotes",
  "data", "competitor-research", "inputs", "config", "blog-queue",
  "docs", "images", "css", "experiments", "__pycache__",
  ".claude", ".vscode", ".github", "memory",
]);

// Audit/sweep scripts that mention stubs as data — never edit them.
const SKIP_FILES = new Set([
  "_sweep-stub-links.js",
  "_audit-sitemap-drift.js",
  "_audit-broken-links.js",
]);

const ABSOLUTE_BASE = "https://woogoro.com";

function walk(dir, exts, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), exts, files);
    } else {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith(".min.js")) continue; // regenerated from .js
      if (!exts.some((e) => lower.endsWith(e))) continue;
      if (STUB_BASENAMES.has(entry.name)) continue; // never touch stub files
      if (SKIP_FILES.has(entry.name)) continue;
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function rewriteFile(filePath, totals) {
  const before = fs.readFileSync(filePath, "utf8");
  let after = before;
  let fileChanged = false;

  for (const [stub, canonical] of Object.entries(REWRITES)) {
    const escStub = stub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Pattern 1: href="<stub>" or href='<stub>' with optional #anchor or ?query
    const hrefRe = new RegExp(
      `href=(["'])${escStub}((?:[#?][^"']*)?)\\1`,
      "g"
    );
    after = after.replace(hrefRe, (_m, q, suffix) => {
      totals[stub] = (totals[stub] || 0) + 1;
      fileChanged = true;
      return `href=${q}${canonical}${suffix}${q}`;
    });

    // Pattern 2: absolute URL https://woogoro.com<stub>
    // Used in JSON-LD, og:url, hreflang, canonical link, schema URL fields.
    const absStub = (ABSOLUTE_BASE + stub).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const absRe = new RegExp(absStub, "g");
    after = after.replace(absRe, () => {
      totals[stub + " (abs)"] = (totals[stub + " (abs)"] || 0) + 1;
      fileChanged = true;
      return ABSOLUTE_BASE + canonical;
    });

    // Pattern 3: bare path strings in JS/Python — '<stub>' or "<stub>".
    // Restricted to code files to avoid matching incidental text in HTML.
    if (filePath.endsWith(".js") || filePath.endsWith(".py")) {
      const codeStringRe = new RegExp(
        `(['"\`])${escStub}((?:[#?][^'"\`]*)?)\\1`,
        "g"
      );
      after = after.replace(codeStringRe, (_m, q, suffix) => {
        totals[stub + " (code-string)"] = (totals[stub + " (code-string)"] || 0) + 1;
        fileChanged = true;
        return `${q}${canonical}${suffix}${q}`;
      });
    }
  }

  if (fileChanged) {
    fs.writeFileSync(filePath, after, "utf8");
  }
  return fileChanged;
}

function main() {
  const totals = {};
  let touched = 0;

  // HTML and code files anywhere except SKIP_DIRS / SKIP_FILES
  const htmlFiles = walk(ROOT, [".html"]);
  const jsFiles = walk(ROOT, [".js"]);
  const pyFiles = walk(ROOT, [".py"]);

  console.log(`Scanning ${htmlFiles.length} HTML / ${jsFiles.length} JS / ${pyFiles.length} Python files...\n`);

  for (const f of [...htmlFiles, ...jsFiles, ...pyFiles]) {
    if (rewriteFile(f, totals)) touched++;
  }

  console.log("=== Stub-link sweep ===\n");
  console.log(`Files modified: ${touched}\n`);
  for (const [k, v] of Object.entries(totals).sort()) {
    console.log(`  ${k}: ${v}`);
  }
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(`\nTotal rewrites: ${grand}`);
}

main();
