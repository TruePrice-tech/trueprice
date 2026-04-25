#!/usr/bin/env node
/* Sitemap-drift audit. Four set-difference checks the SEO crawl misses:
   1. Orphans: indexable HTML files in the repo not listed in any sitemap.
   2. Soft-404 / broken sitemap entries: URLs in sitemaps whose source file
      is missing or matches the 404 template fingerprint.
   3. Ghost links: internal <a href> targets whose file is missing, soft-404,
      or otherwise not indexable (so Google wastes crawl on them).
   4. Stub references in source: any noindex redirect-stub URL referenced by
      templates, build scripts, or JS source. These would re-emit stub URLs
      into served HTML on the next build. (One known-good exception:
      add_footer_links.py SKIP_FILES, which intentionally lists the stub.) */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const SITEMAP_FILES = fs
  .readdirSync(ROOT)
  .filter((f) => /^sitemap.*\.xml$/i.test(f) && f !== "sitemap-index.xml");

const NOT_FOUND_TITLE_RE = /<title>\s*Page Not Found\s*\|\s*Woogoro\s*<\/title>/i;
const NOINDEX_RE = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i;

// HTML files we expect NOT to be in sitemap (legal, utility, transactional,
// private admin). Listed here so the drift + ghost-link checks don't flag
// intentional cross-references between them.
const SITEMAP_EXEMPT = new Set([
  "/404.html",
  "/privacy.html",
  "/terms.html",
  "/accessibility.html",
  "/unsubscribe.html",
  "/search.html",
  "/contractor-dashboard.html",
  "/analytics-dashboard.html",
]);

// Directories to skip when scanning the repo for indexable HTML.
const SKIP_DIRS = new Set([
  ".git", "node_modules", "output", "scripts", "test", "test-quotes",
  "data", "templates", "competitor-research", "inputs", "config",
  "blog-queue", "docs", "images", "css", "js", "api", "experiments",
  "__pycache__",
]);

// Known JS-redirect-stub URLs (noindex, redirect to canonical).
// Source files MUST NOT reference these — every reference becomes a
// future soft-404 or wasted crawl when emitted into served HTML.
const STUB_URLS = [
  "/analyze-quote.html",
  "/roof-replacement-cost-per-square-foot.html",
  "/roof-replacement-cost-guide.html",
  "/roof-replacement-cost-by-house-size.html",
  "/auto-repair-quote-analyzer.html",
  "/roof-replacement-cost-calculator.html",
];

// Files allowlisted for the stub-reference check. These mention stubs
// as data (skip lists, sweep config), not as URLs being emitted.
const STUB_REF_ALLOWLIST = new Set([
  "scripts/add_footer_links.py",       // SKIP_FILES intentionally lists stubs
  "scripts/_sweep-stub-links.js",      // sweep config defines the stubs
  "scripts/_audit-sitemap-drift.js",   // this file
  "scripts/_audit-stub-spot-check.js", // spot-check enumerates stubs to detect
]);

// Where to scan for stub references (broader than the sitemap walk).
const STUB_SCAN_ROOTS = ["templates", "js", "api", "scripts"];
const STUB_SCAN_EXTS = [".html", ".js", ".py"];

function listRepoHtml() {
  const out = new Set();
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (!entry.name.toLowerCase().endsWith(".html")) continue;
    out.add("/" + entry.name);
  }
  return out;
}

function parseSitemap(file) {
  const xml = fs.readFileSync(path.join(ROOT, file), "utf8");
  const urls = new Set();
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const loc = m[1].trim();
    const u = new URL(loc);
    urls.add(u.pathname);
  }
  return urls;
}

function loadAllSitemapUrls() {
  const urls = new Set();
  for (const f of SITEMAP_FILES) {
    for (const u of parseSitemap(f)) urls.add(u);
  }
  return urls;
}

function readMaybe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function classifyFile(relPath) {
  const fp = path.join(ROOT, relPath.replace(/^\//, ""));
  const html = readMaybe(fp);
  if (html === null) return "missing";
  if (NOT_FOUND_TITLE_RE.test(html)) return "soft-404";
  if (NOINDEX_RE.test(html)) return "noindex";
  return "ok";
}

function walkSourceFiles() {
  const files = [];
  const seen = new Set();
  // Root-level files (excluding stubs, .min.js)
  const stubBasenames = new Set(STUB_URLS.map((u) => u.slice(1)));
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!e.isFile()) continue;
    if (!STUB_SCAN_EXTS.some((x) => e.name.toLowerCase().endsWith(x))) continue;
    if (e.name.toLowerCase().endsWith(".min.js")) continue;
    if (stubBasenames.has(e.name)) continue;
    const rel = e.name;
    if (!seen.has(rel)) { seen.add(rel); files.push(rel); }
  }
  // Subdirectory walks
  function walk(rel) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const sub = path.join(rel, e.name).replace(/\\/g, "/");
      if (e.isDirectory()) {
        if (e.name === "__pycache__" || e.name === "node_modules") continue;
        walk(sub);
      } else {
        if (!STUB_SCAN_EXTS.some((x) => e.name.toLowerCase().endsWith(x))) continue;
        if (e.name.toLowerCase().endsWith(".min.js")) continue;
        if (!seen.has(sub)) { seen.add(sub); files.push(sub); }
      }
    }
  }
  for (const root of STUB_SCAN_ROOTS) walk(root);
  return files;
}

function scanStubReferences() {
  const hits = []; // { file, stub, line }
  const files = walkSourceFiles();
  for (const rel of files) {
    if (STUB_REF_ALLOWLIST.has(rel)) continue;
    const text = readMaybe(path.join(ROOT, rel));
    if (!text) continue;
    for (const stub of STUB_URLS) {
      const basename = stub.slice(1);
      if (!text.includes(basename)) continue;
      // Locate first matching line for better reporting.
      const lines = text.split(/\r?\n/);
      const lineIdx = lines.findIndex((l) => l.includes(basename));
      hits.push({
        file: rel,
        stub,
        line: lineIdx >= 0 ? lineIdx + 1 : 0,
        sample: lineIdx >= 0 ? lines[lineIdx].trim().slice(0, 120) : "",
      });
    }
  }
  return hits;
}

function scanInternalLinks() {
  const results = new Map(); // target -> Set of files referencing it
  const repoHtml = [...listRepoHtml()].map((p) => p.replace(/^\//, ""));
  const linkRe = /href=["']([^"']+)["']/g;
  for (const file of repoHtml) {
    const html = readMaybe(path.join(ROOT, file));
    if (!html) continue;
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      let target = m[1];
      if (!target.startsWith("/") || target.startsWith("//")) continue;
      if (target.startsWith("/api/")) continue;
      target = target.split("?")[0].split("#")[0];
      if (!target.endsWith(".html")) continue;
      if (!results.has(target)) results.set(target, new Set());
      results.get(target).add("/" + file);
    }
  }
  return results;
}

function main() {
  const repoHtml = listRepoHtml();
  const sitemapUrls = loadAllSitemapUrls();

  // --- 1. Orphans: indexable repo HTML not in any sitemap ---
  const orphans = [];
  for (const f of repoHtml) {
    if (sitemapUrls.has(f)) continue;
    if (SITEMAP_EXEMPT.has(f)) continue;
    const klass = classifyFile(f);
    if (klass === "noindex" || klass === "soft-404") continue; // intentional
    orphans.push(f);
  }

  // --- 2. Sitemap drift: sitemap URLs that are missing or soft-404 on disk ---
  const sitemapDrift = []; // { url, reason }
  for (const u of sitemapUrls) {
    const klass = classifyFile(u);
    if (klass === "missing") sitemapDrift.push({ url: u, reason: "missing source file" });
    else if (klass === "soft-404") sitemapDrift.push({ url: u, reason: "404 template content" });
    else if (klass === "noindex") sitemapDrift.push({ url: u, reason: "noindex meta tag" });
  }

  // --- 3. Ghost links: internal hrefs pointing to a non-indexable target ---
  const linkGraph = scanInternalLinks();
  const ghostLinks = []; // { target, reason, refCount, sample }
  for (const [target, refs] of linkGraph) {
    const klass = classifyFile(target);
    if (klass === "ok") continue;
    if (SITEMAP_EXEMPT.has(target)) continue; // privacy/terms/etc are fine
    ghostLinks.push({
      target,
      reason: klass,
      refCount: refs.size,
      sample: [...refs].slice(0, 3),
    });
  }

  // --- 4. Stub references in source: any reference to a known stub URL
  //        in templates, JS, build scripts, etc. (excluding allowlist) ---
  const stubRefs = scanStubReferences();

  // --- report ---
  let exitCode = 0;
  console.log("=== Sitemap drift audit ===\n");

  console.log(`Repo indexable HTML: ${repoHtml.size}`);
  console.log(`Sitemap entries (deduped across ${SITEMAP_FILES.length} files): ${sitemapUrls.size}\n`);

  console.log(`1. Orphans (in repo, not in sitemap, not noindex/soft-404): ${orphans.length}`);
  for (const f of orphans.slice(0, 25)) console.log("   " + f);
  if (orphans.length > 25) console.log(`   ... and ${orphans.length - 25} more`);
  if (orphans.length) exitCode = 1;
  console.log("");

  console.log(`2. Sitemap drift (URL in sitemap, page is missing/soft-404/noindex): ${sitemapDrift.length}`);
  const driftByReason = sitemapDrift.reduce((acc, d) => {
    acc[d.reason] = (acc[d.reason] || 0) + 1;
    return acc;
  }, {});
  for (const [reason, count] of Object.entries(driftByReason)) {
    console.log(`   ${reason}: ${count}`);
  }
  for (const d of sitemapDrift.slice(0, 25)) console.log(`   ${d.url}  [${d.reason}]`);
  if (sitemapDrift.length > 25) console.log(`   ... and ${sitemapDrift.length - 25} more`);
  if (sitemapDrift.length) exitCode = 1;
  console.log("");

  console.log(`3. Ghost links (internal hrefs to missing/soft-404/noindex targets): ${ghostLinks.length}`);
  ghostLinks.sort((a, b) => b.refCount - a.refCount);
  for (const g of ghostLinks.slice(0, 25)) {
    console.log(`   ${g.target}  [${g.reason}]  (${g.refCount} refs, e.g. ${g.sample[0]})`);
  }
  if (ghostLinks.length > 25) console.log(`   ... and ${ghostLinks.length - 25} more`);
  if (ghostLinks.length) exitCode = 1;
  console.log("");

  console.log(`4. Stub references in source (templates / JS / build scripts): ${stubRefs.length}`);
  for (const r of stubRefs.slice(0, 25)) {
    console.log(`   ${r.file}:${r.line}  ${r.stub}`);
    if (r.sample) console.log(`     | ${r.sample}`);
  }
  if (stubRefs.length > 25) console.log(`   ... and ${stubRefs.length - 25} more`);
  if (stubRefs.length) exitCode = 1;
  console.log("");

  if (exitCode === 0) {
    console.log("OK: no sitemap drift detected.");
  } else {
    console.log("FAIL: sitemap drift detected. Fix or allowlist before shipping.");
  }
  process.exit(exitCode);
}

main();
