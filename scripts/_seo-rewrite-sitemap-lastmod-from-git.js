#!/usr/bin/env node
/**
 * Rewrites every <lastmod> in every sitemap-*.xml to that URL's actual
 * git mtime (last commit date for the corresponding HTML file).
 *
 * Replaces the brute-force `_seo-bump-sitemap-lastmod.js` which set every
 * lastmod to today regardless of whether the file changed. Google ignores
 * uniform lastmods because they signal nothing.
 *
 * Falls back to today's date if a file has no git history or doesn't exist.
 *
 * Performance: builds a single file→mtime map from one `git log` pass,
 * then rewrites sitemap XMLs from the map. ~2 sec for 12K URLs vs ~10 min
 * if we did one git command per URL.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const today = new Date().toISOString().split('T')[0];

function buildMtimeMap() {
  const out = execSync(
    'git log --pretty=format:"COMMIT %cs" --name-only --diff-filter=AMRC',
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  );
  const map = new Map();
  let currentDate = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('COMMIT ')) {
      currentDate = line.slice(7).trim();
    } else if (line && currentDate && !map.has(line)) {
      map.set(line, currentDate);
    }
  }
  return map;
}

function main() {
  console.log('Building file->mtime map from git log...');
  const mtimeMap = buildMtimeMap();
  console.log(`Map has ${mtimeMap.size} files.`);

  const files = fs.readdirSync(ROOT).filter(f => /^sitemap(-[a-z-]+)?\.xml$/.test(f));

  let totalEntries = 0;
  let totalChanged = 0;

  for (const f of files) {
    const filePath = path.join(ROOT, f);
    const xml = fs.readFileSync(filePath, 'utf8');

    let count = 0;
    let changed = 0;
    const updated = xml.replace(
      /(<loc>https:\/\/[^<]+<\/loc>\s*<lastmod>)([^<]+)(<\/lastmod>)/g,
      (match, openTag, oldDate, closeTag) => {
        count++;
        const locMatch = openTag.match(/<loc>https:\/\/[^/]+\/([^<]*)<\/loc>/);
        const urlPath = locMatch ? locMatch[1] : null;
        const isXml = urlPath && urlPath.endsWith('.xml');
        let newDate;
        if (isXml || !urlPath) {
          newDate = today;
        } else {
          newDate = mtimeMap.get(urlPath) || today;
        }
        if (newDate !== oldDate) changed++;
        return `${openTag}${newDate}${closeTag}`;
      }
    );

    if (count > 0) {
      if (changed > 0) {
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log(`  ${f}: rewrote ${changed}/${count} lastmod entries`);
      } else {
        console.log(`  ${f}: ${count} entries already accurate`);
      }
      totalEntries += count;
      totalChanged += changed;
    }
  }

  console.log(`\nDone. ${totalChanged}/${totalEntries} lastmod entries updated across ${files.length} sitemap files.`);
}

main();
