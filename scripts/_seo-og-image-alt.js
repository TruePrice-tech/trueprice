#!/usr/bin/env node
/**
 * One-shot: add <meta property="og:image:alt" ...> to every HTML page that has
 * og:image but no og:image:alt. Alt text is derived from og:title (preferred)
 * or <title> (fallback).
 *
 * Inserts the new tag immediately AFTER the og:image tag, so when og:image:width
 * and og:image:height follow, they still appear (just after og:image:alt).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

// Match an og:image meta tag on its own line. We capture the indentation
// so the inserted alt line follows the same style.
const ogImageLine = /^([ \t]*)<meta\s+property=["']og:image["']\s+content=["'][^"']+["']\s*\/?>\s*$/m;
const ogTitleRe = /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i;
const titleRe = /<title>([^<]+)<\/title>/i;

// The og:title value is already HTML-escaped in its source attribute, so we
// pass it through unchanged. Only fall back values (from <title>) or plain
// strings need escaping. Both sources happen to be safe for attribute context,
// but we escape any stray " to be defensive.
function escQuote(s) {
  return s.replace(/"/g, '&quot;');
}

function deriveAlt(html) {
  const ogt = html.match(ogTitleRe);
  if (ogt) return ogt[1].trim();  // already escaped from its source attribute
  const t = html.match(titleRe);
  if (t) return escQuote(t[1].trim());
  return 'Woogoro';
}

let changed = 0, skipped = 0, noMatch = 0;

for (const file of files) {
  const filePath = path.join(ROOT, file);
  const html = fs.readFileSync(filePath, 'utf8');

  if (html.includes('og:image:alt')) { skipped++; continue; }
  if (!ogImageLine.test(html)) { noMatch++; continue; }

  const alt = deriveAlt(html);
  const updated = html.replace(ogImageLine, (line, indent) => {
    return `${line}\n${indent}<meta property="og:image:alt" content="${alt}" />`;
  });

  if (updated === html) { noMatch++; continue; }

  fs.writeFileSync(filePath, updated, 'utf8');
  changed++;
}

console.log(`Added og:image:alt to ${changed} files`);
console.log(`Skipped (already had alt): ${skipped}`);
console.log(`Skipped (no single-line og:image match): ${noMatch}`);
