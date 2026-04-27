#!/usr/bin/env node
// 2026-04-27 audit fix: trim hub-page titles >65 chars and descriptions >160 chars to avoid SERP truncation.
// Each entry is the hub filename + new title + new description. Idempotent: if already matches new value, no-op.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const FIXES = [
  {
    file: 'plumbing-cost.html',
    title: 'Plumbing Cost 2026: $150-$15,000 by Project | Woogoro',
    desc:  'Plumbing $150-$15,000 in 2026. Water heater $1,000-$3,500, drain cleaning $150-$500, repipe $4,000-$15,000. 1,000+ U.S. cities.',
  },
  {
    file: 'electrical-cost.html',
    title: 'Electrical Cost 2026: $200-$15,000 by Project | Woogoro',
    desc:  'Electrical $200-$15,000 in 2026. Panel upgrade $2,500-$4,500, EV charger $600-$2,500, rewire $5,000-$15,000. 1,000+ U.S. cities.',
  },
  {
    file: 'hvac-cost.html',
    title: 'HVAC Cost 2026: $4,000-$25,000 by System Type | Woogoro',
    desc:  'HVAC replacement $4,000-$25,000 in 2026. Central AC $5K-$10K, furnace $4K-$8K, heat pump $7K-$25K, mini-split $4K-$15K. 1,000+ cities.',
  },
  {
    file: 'siding-cost.html',
    title: 'Siding Cost 2026: $10,000-$50,000 Whole Home | Woogoro',
    desc:  'Siding $10,000-$50,000 in 2026. Vinyl $4-$8/sqft, fiber cement $7-$14/sqft, engineered wood $6-$11/sqft. 1,000+ U.S. cities, no email.',
  },
  {
    file: 'painting-cost.html',
    title: 'House Painting Cost 2026: $3,000-$15,000 | Woogoro',
    desc:  'House painting $3,000-$15,000 in 2026. Interior $2-$6/sqft, exterior $1.50-$5/sqft, per room $300-$900. 1,000+ U.S. cities.',
  },
  {
    file: 'solar-cost.html',
    title: 'Solar Panel Cost 2026: $10,500-$26,600 After Tax Credit | Woogoro',
    desc:  'Solar $15,000-$38,000 before the 30% federal tax credit, $10,500-$26,600 after. $2.50-$3.80 per watt installed in 2026.',
  },
  {
    file: 'garage-door-cost.html',
    title: 'Garage Door Cost 2026: $700-$5,000 Installed | Woogoro',
    desc:  'Garage door $700-$5,000 in 2026. Single-car $700-$1,500, double-car $1,200-$2,500, insulated $1,800-$3,500. Opener $300-$700.',
  },
  {
    file: 'landscaping-cost.html',
    title: 'Landscaping Cost 2026: $5,000-$50,000+ Design + Install | Woogoro',
    desc:  'Landscaping $50-$200/visit, $5,000-$50,000+ design + install in 2026. Sod $0.50-$2/sqft, hardscape $15-$50/sqft, irrigation $3K-$8K.',
  },
  {
    file: 'concrete-cost.html',
    title: 'Concrete Cost 2026: $4-$15/sqft, $4,500-$9,500 Driveway | Woogoro',
    desc:  'Concrete $4-$15/sqft in 2026. Plain $4-$8, stamped $8-$18, exposed aggregate $6-$12/sqft. Driveway $4,500-$9,500. 1,000+ cities.',
  },
  {
    file: 'kitchen-remodel-cost.html',
    title: 'Kitchen Remodel Cost 2026: $5,000-$200,000+ | Woogoro',
    desc:  'Kitchen remodel $5,000-$200,000+ in 2026. Minor $5K-$15K, mid-range $15K-$35K, major $30K-$80K, upscale $80K-$200K+. 1,000+ cities.',
  },
  {
    file: 'insulation-cost.html',
    title: 'Insulation Cost 2026: $1-$7/sqft, $2,000-$15,000 Home | Woogoro',
    desc:  'Insulation $1-$7/sqft in 2026. Fiberglass $1-$3, blown $1-$2, open-cell foam $1-$2.50, closed-cell $2-$4.50. Whole-home $2K-$15K.',
  },
  {
    file: 'foundation-repair-cost.html',
    title: 'Foundation Repair Cost 2026: $500-$26,000 by Type | Woogoro',
    desc:  'Foundation repair $500-$26,000 in 2026. Push piers $1,800-$3,000 each, slabjacking $500-$1,500, wall stabilization $4K-$12K.',
  },
  {
    file: 'window-replacement-cost.html',
    title: 'Window Replacement Cost 2026: $400-$1,600 per Window | Woogoro',
    desc:  'Window replacement $6,000-$18,000 in 2026. Vinyl $400-$800/window, fiberglass $700-$1,200, wood-clad $900-$1,600. 1,000+ U.S. cities.',
  },
];

let touched = 0;
for (const fix of FIXES) {
  const p = path.join(ROOT, fix.file);
  if (!fs.existsSync(p)) {
    console.warn(`SKIP missing: ${fix.file}`);
    continue;
  }
  let html = fs.readFileSync(p, 'utf8');
  const before = html;

  // Replace <title>...</title> (first occurrence — only one expected)
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${fix.title}</title>`);

  // Replace <meta name="description" content="..."> (first occurrence)
  html = html.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${fix.desc}">`
  );

  if (html !== before) {
    fs.writeFileSync(p, html);
    touched++;
    console.log(`OK ${fix.file} | T=${fix.title.length} D=${fix.desc.length}`);
  } else {
    console.log(`UNCHANGED ${fix.file}`);
  }
}
console.log(`\nDone. ${touched}/${FIXES.length} files updated.`);
