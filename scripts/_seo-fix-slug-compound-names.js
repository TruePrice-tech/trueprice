#!/usr/bin/env node
/**
 * Fix display names for cities whose URL slugs dropped internal punctuation
 * during site generation. The slugs (in filenames and URLs) stay unchanged —
 * only the human-readable display names are corrected.
 *
 * Examples:
 *   athensclarke-county-ga (slug) -> "Athens-Clarke County" (display)
 *   winstonsalem-nc         (slug) -> "Winston-Salem" (display)
 *
 * Page-generated content (H1, title, schema, breadcrumb) had correct names
 * already — they came from a city-name source. The bugs are in meta
 * descriptions and in the city-nav widget I injected (which derived names
 * from slugs). Bulk find/replace catches both.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PAIRS = [
  ['Athensclarke County',       'Athens-Clarke County'],
  ['Augustarichmond County',    'Augusta-Richmond County'],
  ['Coeur Dalene',              "Coeur d'Alene"],
  ['Lexingtonfayette',          'Lexington-Fayette'],
  ['Winstonsalem',              'Winston-Salem'],
  ['Wilkesbarre',               'Wilkes-Barre'],
  ['Mcallen',                   'McAllen'],
  ['Mckinney',                  'McKinney'],
  ['Ofallon',                   "O'Fallon"],
  ['Lees Summit',               "Lee's Summit"],
  ['Port St Lucie',             'Port St. Lucie'],
  ['Fond Du Lac',               'Fond du Lac'],
  ['Dekalb',                    'DeKalb'],
];

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

let totalReplacements = 0;
let filesChanged = 0;

for (const file of files) {
  const filePath = path.join(ROOT, file);
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [bad, good] of PAIRS) {
    if (html.includes(bad)) {
      const parts = html.split(bad);
      const count = parts.length - 1;
      html = parts.join(good);
      totalReplacements += count;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, html, 'utf8');
    filesChanged++;
  }
}

console.log('Replacements:', totalReplacements);
console.log('Files changed:', filesChanged);
