#!/usr/bin/env node
// scripts/_patch-sitemap-lastmods.js
//
// Truthful sitemap patch: keeps HEAD's lastmod for URLs whose files
// didn't change, and bumps lastmod to today only for URLs whose files
// actually changed in the working tree.
//
// Born from 2026-05-25: build-site.js naively rewrites every lastmod
// on every run, which lies to Google about which pages actually
// changed. Inflated lastmods erode crawl-trust over time.
//
// Usage: node scripts/_patch-sitemap-lastmods.js [YYYY-MM-DD]
//   Default date is today (UTC).

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SITEMAP = path.join(ROOT, "sitemap.xml");
const SITE_BASE = "https://woogoro.com";

const today =
  process.argv[2] || new Date().toISOString().slice(0, 10);

function urlToFilename(url) {
  if (!url.startsWith(SITE_BASE)) return null;
  const tail = url.slice(SITE_BASE.length);
  if (tail === "/" || tail === "") return "index.html";
  return tail.startsWith("/") ? tail.slice(1) : tail;
}

function getModifiedHtmlFiles() {
  // Compare working tree against HEAD; capture only .html files.
  const out = execSync("git diff HEAD --name-only --diff-filter=M", {
    encoding: "utf8"
  });
  const set = new Set(
    out
      .split(/\r?\n/)
      .filter((f) => f.endsWith(".html"))
  );
  return set;
}

function main() {
  const headSitemap = execSync("git show HEAD:sitemap.xml", {
    encoding: "utf8"
  });
  const modified = getModifiedHtmlFiles();

  console.log(`Modified HTML files: ${modified.size}`);
  console.log(`Bumping lastmod to ${today} only for those URLs.`);

  let bumped = 0;
  let preserved = 0;

  const patched = headSitemap.replace(
    /<url>(<loc>([^<]+)<\/loc>)<lastmod>([^<]+)<\/lastmod><\/url>/g,
    (_, locTag, url, headLastmod) => {
      const file = urlToFilename(url);
      const isModified = file && modified.has(file);
      const lastmod = isModified ? today : headLastmod;
      if (isModified) bumped++;
      else preserved++;
      return `<url>${locTag}<lastmod>${lastmod}</lastmod></url>`;
    }
  );

  fs.writeFileSync(SITEMAP, patched, "utf8");
  console.log(`Bumped: ${bumped} | Preserved: ${preserved}`);
}

main();
