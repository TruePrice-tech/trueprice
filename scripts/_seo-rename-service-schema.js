#!/usr/bin/env node
/**
 * Rename Service schema 'name' across all city pages so it reads as cost
 * data rather than a service offered by Woogoro. We already removed the
 * misleading provider field, but 'name: "HVAC Replacement in Atlanta, GA"'
 * with @type: Service still implicitly claims someone (the page owner)
 * provides HVAC replacement.
 *
 * Simple fix: insert "Cost" before "in <City>" in every Service name. The
 * offers/AggregateOffer block continues to carry the price range for rich
 * results; the name now accurately describes what the schema is about.
 *
 * The patterns are narrow enough ("name":"<vertical phrase> in ") that they
 * only match inside Service schemas — other schemas use different name
 * values.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PATTERNS = [
  'HVAC Replacement',
  'Roof Replacement',
  'Plumbing Service',
  'Electrical Service',
  'Solar Installation',
  'Concrete Work',
  'House Painting',
  'Fence Installation',
  'Foundation Repair',
  'Siding Installation',
  'Window Replacement',
  'Insulation',
  'Gutter Installation',
  'Landscaping',
  'Kitchen Remodel',
  'Garage Door Installation',
  'Auto Repair',
];

// Special cases for legal/medical/moving — their current names aren't
// "<thing> in <City>" with an obvious action word. Rewrite to more accurate
// names reflecting the cost-analysis intent.
const SPECIAL_REPLACEMENTS = [
  ['"name":"Legal Services in ',   '"name":"Legal Fee Cost in '],
  ['"name":"Medical Services in ', '"name":"Medical Bill Cost in '],
  ['"name":"Moving Services in ',  '"name":"Moving Cost in '],
];

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

let totalReplacements = 0;
let filesChanged = 0;

for (const file of files) {
  const filePath = path.join(ROOT, file);
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Standard patterns: insert " Cost" before " in <City>".
  for (const pattern of PATTERNS) {
    const bad = `"name":"${pattern} in `;
    const good = `"name":"${pattern} Cost in `;
    if (html.includes(bad)) {
      const count = html.split(bad).length - 1;
      html = html.split(bad).join(good);
      totalReplacements += count;
      changed = true;
    }
  }

  // Special cases.
  for (const [bad, good] of SPECIAL_REPLACEMENTS) {
    if (html.includes(bad)) {
      const count = html.split(bad).length - 1;
      html = html.split(bad).join(good);
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
