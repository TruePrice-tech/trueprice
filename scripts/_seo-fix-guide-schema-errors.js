#!/usr/bin/env node
/**
 * Fix the 12 schema parse errors flagged by the SEO dashboard's schema
 * collector. Two distinct bugs across the 11 affected guide pages.
 *
 * BUG A (11 occurrences): the analytics tracking pixel <img> got injected
 * INSIDE the FAQPage JSON-LD <script> block instead of after the </script>.
 * Pattern:
 *     }
 *     <img src="/api/analytics?pixel=1&p=...html" alt="" style="..." />
 *     </script>
 * Fix: move the <img> to AFTER </script>.
 *
 * BUG B (1 occurrence in medical-cost-guide.html): the BreadcrumbList
 * <script> block at the top of the file is missing its closing </script>.
 * The next element in the source is <style>, so the JSON is concatenated
 * with CSS, breaking parse.
 * Pattern:
 *     {...BreadcrumbList json...}
 *     <style>
 * Fix: insert </script> between them.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const FILES_BUG_A = [
  'auto-repair-cost-guide.html',
  'concrete-cost-guide.html',
  'electrical-cost-guide.html',
  'foundation-repair-cost-guide.html',
  'garage-door-cost-guide.html',
  'hvac-replacement-cost-guide.html',
  'landscaping-cost-guide.html',
  'legal-cost-guide.html',
  'medical-cost-guide.html',
  'plumbing-cost-guide.html',
  'solar-installation-cost-guide.html',
];

// Bug A (revised): the JSON-LD <script type="application/ld+json"> block is
// MISSING its closing </script>. The next element after the closing `}` of
// the JSON is the analytics tracking <img>, so the schema collector's regex
// grabs everything until the next </script> (which belongs to the city-
// enhance script tag much later). Result: JSON parse fails on the trailing
// HTML.
//
// Pattern at the bug site:
//     }<newline>
//     <img src="/api/analytics?pixel=..."... />
//
// Fix: insert </script><newline> between the JSON close `}` and the <img>.
const BUG_A_RE = /(\r?\n\})(\r?\n)(<img\s+src="\/api\/analytics\?pixel=1&p=[^"]+"[^>]*\/>)/;

function fixBugA(html) {
  if (!BUG_A_RE.test(html)) return { html, applied: false };
  const fixed = html.replace(BUG_A_RE, (_, jsonClose, nl, img) => {
    return `${jsonClose}${nl}</script>${nl}${img}`;
  });
  return { html: fixed, applied: true };
}

// Bug B: medical-cost-guide.html specifically — BreadcrumbList JSON ends with
// `]}` then immediately `<style>` on the next line, no </script> in between.
function fixBugB(html, filename) {
  if (filename !== 'medical-cost-guide.html') return { html, applied: false };
  // Find a closing `]}` followed directly by newline + <style>
  const re = /(\]\})\s*(\r?\n)(<style>)/;
  if (!re.test(html)) return { html, applied: false };
  const fixed = html.replace(re, (_, jsonEnd, nl, style) => {
    return `${jsonEnd}${nl}</script>${nl}${style}`;
  });
  return { html: fixed, applied: true };
}

let totalAFixed = 0, totalBFixed = 0;

for (const file of FILES_BUG_A) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) {
    console.warn('  missing:', file);
    continue;
  }
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const a = fixBugA(html);
  if (a.applied) { html = a.html; totalAFixed++; changed = true; }

  const b = fixBugB(html, file);
  if (b.applied) { html = b.html; totalBFixed++; changed = true; }

  if (changed) {
    fs.writeFileSync(filePath, html, 'utf8');
    const tags = [];
    if (a.applied) tags.push('A');
    if (b.applied) tags.push('B');
    console.log(`  ${file}  [${tags.join('+')}]`);
  } else {
    console.log(`  ${file}  (no pattern matched)`);
  }
}

console.log(`\nBug A fixed: ${totalAFixed}/${FILES_BUG_A.length} files`);
console.log(`Bug B fixed: ${totalBFixed} (medical-cost-guide.html)`);
