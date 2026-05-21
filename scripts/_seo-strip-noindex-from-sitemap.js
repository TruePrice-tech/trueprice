#!/usr/bin/env node
/**
 * Removes URLs from sitemap-*.xml whose target HTML page has a noindex meta
 * tag. Sitemap entries for noindex pages waste Google crawl budget and send
 * a contradictory signal (sitemap = "please index", meta = "do not index").
 *
 * Idempotent. Safe to re-run. Reads each <loc> URL, checks the corresponding
 * file on disk, drops the entry if the file has noindex.
 *
 * Does NOT touch files outside `sitemap-*.xml`. Does NOT add anything new.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NOINDEX_RE = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i;

function isNoindex(filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    return NOINDEX_RE.test(html);
  } catch {
    return false;
  }
}

function stripFromSitemap(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  // Match a full <url>...</url> block including surrounding whitespace.
  const urlBlockRe = /\s*<url>[\s\S]*?<\/url>/g;
  let dropped = 0;
  const updated = xml.replace(urlBlockRe, (block) => {
    const locMatch = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/);
    if (!locMatch) return block;
    const url = new URL(locMatch[1]);
    const target = path.join(ROOT, url.pathname);
    if (isNoindex(target)) {
      dropped++;
      return '';
    }
    return block;
  });
  if (dropped > 0) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }
  return dropped;
}

function main() {
  const files = fs.readdirSync(ROOT)
    .filter(f => /^sitemap.*\.xml$/.test(f) && f !== 'sitemap-index.xml');
  let total = 0;
  for (const f of files) {
    const n = stripFromSitemap(path.join(ROOT, f));
    if (n > 0) console.log(`  ${f}: dropped ${n} noindex entries`);
    total += n;
  }
  console.log(`Total noindex entries removed: ${total}`);
}

main();
