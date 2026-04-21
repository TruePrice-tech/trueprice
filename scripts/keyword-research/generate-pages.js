#!/usr/bin/env node
/**
 * Generate long-tail content pages from approved clusters.
 *
 * Usage:
 *   node scripts/keyword-research/generate-pages.js --sample=5   # top 5 only
 *   node scripts/keyword-research/generate-pages.js --top=50     # top 50
 *   node scripts/keyword-research/generate-pages.js --all        # all gap clusters
 *   node scripts/keyword-research/generate-pages.js --dry-run    # print filenames only
 */

const fs = require('fs');
const path = require('path');
const {
  tableLedTemplate,
  transactionalTemplate,
  comparisonTemplate,
  decisionTemplate,
  howToTemplate,
  slug,
} = require('./page-templates');

const TEMPLATE_MAP = {
  'table-led':     tableLedTemplate,
  'transactional': transactionalTemplate,
  'comparison':    comparisonTemplate,
  'decision':      decisionTemplate,
  'how-to':        howToTemplate,
};

const ROOT = path.resolve(__dirname, '..', '..');
const IN_FILE = path.join(__dirname, 'output', 'clusters.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dryRun: false, sample: 0, top: 0, all: false };
  for (const a of args) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--all') out.all = true;
    else if (a.startsWith('--sample=')) out.sample = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--top=')) out.top = parseInt(a.split('=')[1], 10);
  }
  if (!out.sample && !out.top && !out.all) out.sample = 5;
  return out;
}

const args = parseArgs();

if (!fs.existsSync(IN_FILE)) {
  console.error('Missing', IN_FILE, '— run cluster-and-intent.js first.');
  process.exit(1);
}

const clusters = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
const gaps = clusters.filter(c => c.newPageNeeded);

let toGenerate;
if (args.all) toGenerate = gaps;
else if (args.top) toGenerate = gaps.slice(0, args.top);
else toGenerate = gaps.slice(0, args.sample);

// Dispatch each cluster to the right template
const byTemplate = {};
for (const c of toGenerate) {
  byTemplate[c.template] = (byTemplate[c.template] || 0) + 1;
}
console.log(`Clusters selected: ${toGenerate.length}`);
for (const [t, n] of Object.entries(byTemplate)) {
  const impl = TEMPLATE_MAP[t] ? '' : ' (no template — falls back to table-led)';
  console.log(`  ${t}: ${n}${impl}`);
}
console.log('');

let written = 0, skippedExisting = 0, errors = 0;
const generated = [];

for (const c of toGenerate) {
  const filename = slug(c.canonicalQuery) + '.html';
  const filePath = path.join(ROOT, filename);

  if (fs.existsSync(filePath)) {
    skippedExisting++;
    continue;
  }

  try {
    const tmpl = TEMPLATE_MAP[c.template] || tableLedTemplate;
    const html = tmpl(c);
    if (args.dryRun) {
      console.log(`[DRY] ${c.template.padEnd(13)} → ${filename}  (${c.memberCount} variants)`);
    } else {
      fs.writeFileSync(filePath, html, 'utf8');
      console.log(`  ${c.template.padEnd(13)} → ${filename}`);
    }
    written++;
    generated.push({ filename, canonicalQuery: c.canonicalQuery, vertical: c.vertical, template: c.template });
  } catch (e) {
    errors++;
    console.error(`  ERROR on "${c.canonicalQuery}": ${e.message}`);
  }
}

console.log(`\n${args.dryRun ? 'Would write' : 'Wrote'}: ${written}`);
console.log(`Skipped (file exists): ${skippedExisting}`);
console.log(`Errors: ${errors}`);

if (!args.dryRun && generated.length > 0) {
  const manifestPath = path.join(__dirname, 'output', 'generated-pages.json');
  fs.writeFileSync(manifestPath, JSON.stringify(generated, null, 2), 'utf8');
  console.log(`\nManifest: ${manifestPath}`);
}
