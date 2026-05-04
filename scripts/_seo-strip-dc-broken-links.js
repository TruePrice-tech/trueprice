#!/usr/bin/env node
// Strips broken internal links to missing District of Columbia pages.
// 17 verticals don't have DC state hub pages but every state's hub links
// to its DC sibling — ~850 broken internal links sending crawl budget to
// 404s. Per the 2026-05-04 sitemap-drift audit, this is the biggest SEO
// bug currently on the site.
//
// Restoration path: when DC state pages are created (Phase A.2), re-add
// these links via the same template.
const fs = require("fs");
const { execSync } = require("child_process");

const DRY_RUN = process.argv.includes("--dry");
// Strip the entire <li>...</li> + trailing newline. Pattern is:
//   <leading-ws><li><a href="/(district-of-columbia|dc)-XXX-cost.html">District of Columbia</a></li>\n
const RE = /[ \t]*<li><a href="\/(?:district-of-columbia|dc)-[a-z-]+-cost\.html">District of Columbia<\/a><\/li>\r?\n/g;

function listGitFiles() {
  const out = execSync(`git ls-files -- "*.html"`, { encoding: "utf8" });
  return out.split("\n").filter(Boolean).filter(p => !p.includes("/"));
}

function fixFile(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  if (!RE.test(html)) return { changed: false };
  RE.lastIndex = 0; // reset stateful global regex
  const matches = html.match(RE) || [];
  const next = html.replace(RE, "");
  if (next === html) return { changed: false };
  if (!DRY_RUN) fs.writeFileSync(filePath, next);
  return { changed: true, links: matches.length };
}

(function main() {
  const files = listGitFiles();
  let fixed = 0, totalLinks = 0;
  for (const f of files) {
    const r = fixFile(f);
    if (r.changed) { fixed++; totalLinks += r.links; }
  }
  console.log(`total=${files.length}  fixed=${fixed}  links-removed=${totalLinks}${DRY_RUN ? "  (DRY RUN)" : ""}`);
})();
