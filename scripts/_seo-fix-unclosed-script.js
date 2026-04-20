#!/usr/bin/env node
/**
 * Fix pre-existing bug: 739 roof city pages generated the Service schema
 * <script> block without a closing </script> tag. The schema ends at a
 * bare '}' followed directly by </head>. Browsers tolerate this but strict
 * JSON-LD consumers (Google Rich Results, Bing) may skip the block.
 *
 * Fix: insert </script>\n immediately before </head> on every page where
 * the last <script type="application/ld+json"> has no matching </script>
 * before </head>.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

let fixed = 0;

for (const file of files) {
  const filePath = path.join(ROOT, file);
  const html = fs.readFileSync(filePath, 'utf8');

  const lastScriptStart = html.lastIndexOf('<script type="application/ld+json">');
  if (lastScriptStart < 0) continue;

  const headClose = html.indexOf('</head>', lastScriptStart);
  if (headClose < 0) continue;

  const chunk = html.slice(lastScriptStart, headClose);
  if (chunk.includes('</script>')) continue;

  // Insert </script>\n immediately before </head>, preserving the indent of
  // </head> (usually zero but be safe).
  const updated = html.slice(0, headClose) + '</script>\n' + html.slice(headClose);
  fs.writeFileSync(filePath, updated, 'utf8');
  fixed++;
}

console.log('Fixed unclosed </script> on', fixed, 'files');
