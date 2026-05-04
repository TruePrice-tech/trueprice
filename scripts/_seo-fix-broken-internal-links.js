#!/usr/bin/env node
// Two-pass internal-link cleanup:
//   1. Rename /legal-quote-analyzer.html → /legal-fee-analyzer.html (50 refs)
//      The page was renamed but inbound links never updated.
//   2. Add rel="nofollow" to links from INDEXABLE pages to noindex tool/
//      compare pages. Tells crawlers not to spend budget on noindex pages
//      that users still need as CTAs. Does NOT touch links from noindex
//      pages (no crawl-budget waste there).
//
// Detects noindex pages dynamically (via <meta name="robots" content="...
// noindex...">). Doesn't hardcode the list — picks up future noindex
// additions automatically.
const fs = require("fs");
const { execSync } = require("child_process");

const DRY_RUN = process.argv.includes("--dry");

function listGitFiles() {
  const out = execSync(`git ls-files -- "*.html"`, { encoding: "utf8" });
  return out.split("\n").filter(Boolean).filter(p => !p.includes("/"));
}

function isNoindex(html) {
  return /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

(function main() {
  const files = listGitFiles();

  // Pass 0: build set of noindex pages.
  const noindexSet = new Set();
  for (const f of files) {
    if (isNoindex(fs.readFileSync(f, "utf8"))) noindexSet.add("/" + f);
  }
  console.log(`Discovered ${noindexSet.size} noindex pages.`);

  let renameFiles = 0, renameLinks = 0;
  let nofollowFiles = 0, nofollowLinks = 0;

  for (const f of files) {
    let html = fs.readFileSync(f, "utf8");
    const orig = html;
    const sourceNoindex = noindexSet.has("/" + f);

    // PASS 1: rename legal-quote-analyzer (unconditional — broken link is bad
    // from any source page).
    const beforeRename = html;
    html = html.replace(/\/legal-quote-analyzer\.html/g, "/legal-fee-analyzer.html");
    if (html !== beforeRename) {
      renameLinks += (beforeRename.match(/\/legal-quote-analyzer\.html/g) || []).length;
      renameFiles++;
    }

    // PASS 2: rel="nofollow" on every internal link to a noindex page,
    // regardless of source page's index status. Crawlers visit noindex
    // pages and follow links from them; nofollow saves crawl budget for
    // those links too. Conservative correctness across both source types.
    {
      // Match <a ... href="/some-page.html" ...> where the page is in noindexSet.
      // Replace with the same tag but with rel="nofollow" added/merged.
      html = html.replace(/<a\b([^>]*?)\bhref=["']([^"']+)["']([^>]*)>/gi, (full, before, href, after) => {
        // Only same-host, root-relative links.
        if (!href.startsWith("/")) return full;
        // Strip any query/fragment when checking against noindexSet.
        const path = href.split(/[?#]/)[0];
        if (!noindexSet.has(path)) return full;
        // Merge rel attribute. If existing rel="..." present, add nofollow if not already there.
        const combined = before + after;
        const relMatch = combined.match(/\brel=["']([^"']*)["']/i);
        if (relMatch) {
          if (/\bnofollow\b/i.test(relMatch[1])) return full; // already nofollow
          const newRel = `rel="${relMatch[1].trim()} nofollow"`;
          const replaced = (before + after).replace(/\brel=["'][^"']*["']/i, newRel);
          nofollowLinks++;
          return `<a${replaced.startsWith(" ") ? "" : " "}${replaced} href="${href}">`.replace(/\s+/g, " ").replace(" >", ">");
        } else {
          // No rel attribute — add one.
          nofollowLinks++;
          // Reconstruct cleanly: <a [before-attrs] href="..." [after-attrs] rel="nofollow">
          return `<a${before}href="${href}"${after} rel="nofollow">`.replace(/\s+/g, " ").replace(" >", ">");
        }
      });
    }

    if (html !== orig) {
      if (!DRY_RUN) fs.writeFileSync(f, html);
      if (html.includes('rel="nofollow"') && !orig.includes('rel="nofollow"')) nofollowFiles++;
    }
  }

  console.log(`legal-quote-analyzer rename: ${renameFiles} files, ${renameLinks} links${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`nofollow on noindex-target links: ${nofollowLinks} links across files${DRY_RUN ? " (DRY RUN)" : ""}`);
})();
