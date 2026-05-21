#!/usr/bin/env node
// P1 from SEO audit 2026-05-20: ~93% of pages lack three head tags that
// the flagship Chattanooga template already has (or should have). This
// pass brings every indexable HTML page to head-tag parity by injecting
// the missing tags, derived from existing canonical / og:image / og:title.
//
// Tags injected when missing:
//   1. <link rel="alternate" hreflang="en-US"     href="<canonical>" />
//   2. <link rel="alternate" hreflang="x-default" href="<canonical>" />
//      → Inserted right after <link rel="canonical"> so the hreflang
//        cluster sits together.
//   3. <meta property="og:image:alt" content="<og:title>" />
//      → Inserted right after <meta property="og:image">. og:title is
//        already a clean, descriptive string on city pages.
//   4. <meta name="twitter:image" content="<og:image-url>" />
//      → Inserted right after <meta name="twitter:title">. og:image and
//        twitter:image always point to the same asset on this site.
//
// Idempotent: each tag has a presence check, so re-running is a no-op.
// HANDWRITTEN-PROTECTED files are auto-skipped via fs.writeFileSync
// monkey-patch in _handwritten-guard.js.

require('./_handwritten-guard.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function extract(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

function injectTags(html) {
  const canonical = extract(html, /<link rel="canonical" href="([^"]+)"/);
  const ogImage   = extract(html, /<meta property="og:image" content="([^"]+)"/);
  const ogTitle   = extract(html, /<meta property="og:title" content="([^"]+)"/);
  const twTitle   = extract(html, /<meta name="twitter:title" content="([^"]+)"/);

  let added = { hreflang: 0, ogImageAlt: 0, twitterImage: 0 };
  let out = html;

  // 1+2. hreflang cluster — needs canonical URL.
  const hasHreflang = /hreflang="en-US"/.test(out) && /hreflang="x-default"/.test(out);
  if (!hasHreflang && canonical) {
    const block =
      `\n<link rel="alternate" hreflang="en-US" href="${canonical}" />` +
      `\n<link rel="alternate" hreflang="x-default" href="${canonical}" />`;
    const canonRe = /(<link rel="canonical" href="[^"]+"\s*\/?>)/;
    if (canonRe.test(out)) {
      out = out.replace(canonRe, `$1${block}`);
      added.hreflang = 2;
    }
  }

  // 3. og:image:alt — needs og:title to be useful.
  const hasOgImageAlt = /<meta property="og:image:alt"/.test(out);
  if (!hasOgImageAlt && ogImage && ogTitle) {
    const ogImageRe = /(<meta property="og:image" content="[^"]+"\s*\/?>)/;
    const block = `\n<meta property="og:image:alt" content="${ogTitle}" />`;
    if (ogImageRe.test(out)) {
      out = out.replace(ogImageRe, `$1${block}`);
      added.ogImageAlt = 1;
    }
  }

  // 4. twitter:image — mirror og:image.
  const hasTwitterImage = /<meta name="twitter:image"/.test(out);
  if (!hasTwitterImage && ogImage) {
    const twTitleRe = /(<meta name="twitter:title" content="[^"]+"\s*\/?>)/;
    const twCardRe  = /(<meta name="twitter:card" content="[^"]+"\s*\/?>)/;
    const block = `\n<meta name="twitter:image" content="${ogImage}" />`;
    if (twTitleRe.test(out)) {
      out = out.replace(twTitleRe, `$1${block}`);
      added.twitterImage = 1;
    } else if (twCardRe.test(out)) {
      out = out.replace(twCardRe, `$1${block}`);
      added.twitterImage = 1;
    }
  }

  return { html: out, added };
}

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

let scanned = 0;
let touched = 0;
let skippedNoChange = 0;
let skippedProtected = 0;
let totals = { hreflang: 0, ogImageAlt: 0, twitterImage: 0 };

for (const f of files) {
  scanned++;
  const filePath = path.join(ROOT, f);
  const orig = fs.readFileSync(filePath, 'utf8');
  const { html: updated, added } = injectTags(orig);
  const totalAdded = added.hreflang + added.ogImageAlt + added.twitterImage;
  if (totalAdded === 0) { skippedNoChange++; continue; }

  fs.writeFileSync(filePath, updated, 'utf8');
  const after = fs.readFileSync(filePath, 'utf8');
  if (after === orig) { skippedProtected++; continue; }
  touched++;
  totals.hreflang     += added.hreflang;
  totals.ogImageAlt   += added.ogImageAlt;
  totals.twitterImage += added.twitterImage;
}

console.log('\nHead-tag parity inject — summary');
console.log(`  files scanned:               ${scanned}`);
console.log(`  files modified:              ${touched}`);
console.log(`  files skipped (already complete): ${skippedNoChange}`);
console.log(`  files skipped (protected):   ${skippedProtected}`);
console.log(`  hreflang lines added:        ${totals.hreflang}`);
console.log(`  og:image:alt tags added:     ${totals.ogImageAlt}`);
console.log(`  twitter:image tags added:    ${totals.twitterImage}`);
