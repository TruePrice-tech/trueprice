#!/usr/bin/env node
/**
 * Validate every JSON-LD <script type="application/ld+json"> block on every
 * HTML page. Reports per-page-type stats: total schemas, parseable, unique
 * @types, and any pages with parse errors.
 *
 * Returns: { scoredAt, totalPages, totalSchemas, parseErrors,
 *   typesCount: { Article: 12345, FAQPage: 12244, ... }, errorPages: [...] }
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function collect() {
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  const result = {
    scoredAt: new Date().toISOString(),
    totalPages: files.length,
    pagesWithSchema: 0,
    totalSchemas: 0,
    parseErrors: 0,
    typesCount: {},
    errorPages: [],
    pagesByType: {},
  };

  const pageTypes = {
    'city-cost': /^[a-z-]+-[a-z]{2}-[a-z-]+-cost\.html$/,
    'vertical-guide': /^[a-z-]+-cost(-guide)?\.html$/,
    'analyzer': /-(quote-analyzer|fee-analyzer|bill-analyzer)\.html$/,
    'comparison': /(-vs-|alternative-to-)/,
  };

  function detectType(filename) {
    for (const [t, re] of Object.entries(pageTypes)) {
      if (re.test(filename)) return t;
    }
    return 'other';
  }

  const blockRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

  for (const file of files) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const blocks = html.match(blockRe) || [];
    if (blocks.length === 0) continue;
    result.pagesWithSchema++;

    const type = detectType(file);
    result.pagesByType[type] = (result.pagesByType[type] || 0) + 1;

    let pageErrors = 0;
    for (const block of blocks) {
      result.totalSchemas++;
      const inner = block.replace(/<\/?script[^>]*>/g, '').trim();
      try {
        const obj = JSON.parse(inner);
        // Walk the object to find all @type declarations
        const types = new Set();
        function walk(v) {
          if (Array.isArray(v)) for (const x of v) walk(x);
          else if (v && typeof v === 'object') {
            if (v['@type']) types.add(v['@type']);
            for (const k of Object.keys(v)) walk(v[k]);
          }
        }
        walk(obj);
        for (const t of types) {
          result.typesCount[t] = (result.typesCount[t] || 0) + 1;
        }
      } catch (e) {
        pageErrors++;
        result.parseErrors++;
      }
    }
    if (pageErrors > 0 && result.errorPages.length < 50) {
      result.errorPages.push({ file, errors: pageErrors });
    }
  }

  return result;
}

if (require.main === module) {
  const out = collect();
  console.log(JSON.stringify(out, null, 2));
}

module.exports = { collect };
