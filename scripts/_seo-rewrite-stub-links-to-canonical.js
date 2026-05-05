#!/usr/bin/env node
// Rewrites internal links pointing at JS-redirect stubs (noindex pages whose
// only purpose is to redirect to a canonical URL) directly to the canonical.
//
// Why: redirect chains add latency for users and a small SEO penalty (PageRank
// damping). Direct canonical links are cleaner and faster. After this sweep,
// the previous rel="nofollow" we added on these (nofollow because target was
// noindex) is also stripped — the new target is indexable, and we want link
// equity to flow through.
const fs = require("fs");
const { execSync } = require("child_process");

const DRY_RUN = process.argv.includes("--dry");

// Stub → canonical mapping. Confirmed by reading each stub file's
// <link rel="canonical"> + <script>location.replace(...)</script>.
const REWRITES = [
  { stub: "/auto-repair-quote-analyzer.html", canonical: "/auto-repair.html" },
  { stub: "/analyze-quote.html",              canonical: "/analyze-my-quote.html" },
];

function listGitFiles() {
  const out = execSync(`git ls-files -- "*.html"`, { encoding: "utf8" });
  return out.split("\n").filter(Boolean).filter(p => !p.includes("/"));
}

(function main() {
  const files = listGitFiles();
  let totalLinks = 0, totalNofollowDropped = 0, filesChanged = 0;

  for (const f of files) {
    let html = fs.readFileSync(f, "utf8");
    const orig = html;

    for (const { stub, canonical } of REWRITES) {
      // Build a pattern matching <a ... href="<stub>[?qs][#frag]" ...>.
      // Capture rel attribute so we can strip nofollow if present.
      // Note: stub URL might appear inside text content too, but those are
      // rare; we only target href attributes here. (Schema.org "url" fields
      // referencing the stub are intentional for those redirect pages
      // themselves and aren't matched here anyway since this scans served
      // content from indexable pages.)
      const escapedStub = stub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`<a\\b([^>]*?)\\bhref=(["'])${escapedStub}([^"'#]*?)?(["'])([^>]*)>`, "gi");
      html = html.replace(re, (full, before, q1, qsfrag, q2, after) => {
        totalLinks++;
        const newHref = canonical + (qsfrag || "");
        // Strip rel="nofollow" if present (now-indexable target should pass equity).
        let beforeClean = before, afterClean = after;
        const stripNofollowFromAttrs = (attrs) => {
          return attrs.replace(/\srel=(["'])((?:[^"']|(?!\1))*?)\bnofollow\b((?:[^"']|(?!\1))*?)\1/gi, (m, q, pre, post) => {
            const newRel = (pre + post).replace(/\s+/g, " ").trim();
            totalNofollowDropped++;
            return newRel ? ` rel=${q}${newRel}${q}` : "";
          });
        };
        beforeClean = stripNofollowFromAttrs(beforeClean);
        afterClean = stripNofollowFromAttrs(afterClean);
        return `<a${beforeClean}href=${q1}${newHref}${q2}${afterClean}>`;
      });
    }

    if (html !== orig) {
      if (!DRY_RUN) fs.writeFileSync(f, html);
      filesChanged++;
    }
  }

  console.log(`Files changed: ${filesChanged}${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`Stub links rewritten to canonical: ${totalLinks}`);
  console.log(`rel="nofollow" stripped on rewritten links: ${totalNofollowDropped}`);
})();
