#!/usr/bin/env node
/**
 * Inject Dataset schema on the 20 vertical guide pages. Positions Woogoro as
 * an authoritative cost-data source. Google increasingly surfaces Dataset
 * results directly in SERPs and AI Overviews.
 *
 * Scoped to ~20 guide pages (not the 12k city pages) to keep the addition
 * bounded and avoid any risk of boilerplate creep — even though JSON-LD is
 * stripped from the uniqueness audit, caution is warranted per site policy.
 *
 * Idempotent — skips pages that already have a Dataset schema.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const GUIDES = [
  { file: 'hvac-cost.html',               label: 'HVAC Replacement',   variable: 'HVAC Replacement Cost (USD)',          keywords: ['HVAC cost', 'HVAC replacement cost', 'AC installation cost', 'heat pump cost', 'furnace cost'] },
  { file: 'roof-cost-by-house-size.html', label: 'Roof Replacement',   variable: 'Roof Replacement Cost (USD)',          keywords: ['roof cost', 'roof replacement cost', 'new roof cost', 'shingle roof cost', 'metal roof cost'] },
  { file: 'plumbing-cost.html',           label: 'Plumbing Service',   variable: 'Plumbing Service Cost (USD)',          keywords: ['plumbing cost', 'water heater cost', 'repipe cost', 'plumber hourly rate'] },
  { file: 'electrical-cost.html',         label: 'Electrical Service', variable: 'Electrical Service Cost (USD)',        keywords: ['electrician cost', 'electrical panel cost', 'rewiring cost', 'electrician hourly rate'] },
  { file: 'solar-cost.html',              label: 'Solar Installation', variable: 'Solar Installation Cost (USD)',        keywords: ['solar cost', 'solar panel cost', 'solar installation cost', 'residential solar'] },
  { file: 'concrete-cost.html',           label: 'Concrete Work',      variable: 'Concrete Work Cost (USD)',             keywords: ['concrete cost', 'driveway cost', 'patio cost', 'concrete per square foot'] },
  { file: 'painting-cost.html',           label: 'House Painting',     variable: 'House Painting Cost (USD)',            keywords: ['painting cost', 'interior painting cost', 'exterior painting cost', 'painter hourly rate'] },
  { file: 'fence-cost.html',              label: 'Fence Installation', variable: 'Fence Installation Cost (USD)',        keywords: ['fence cost', 'wood fence cost', 'vinyl fence cost', 'fence per linear foot'] },
  { file: 'foundation-repair-cost.html',  label: 'Foundation Repair',  variable: 'Foundation Repair Cost (USD)',         keywords: ['foundation repair cost', 'foundation crack repair', 'slab foundation cost'] },
  { file: 'siding-cost.html',             label: 'Siding Installation',variable: 'Siding Installation Cost (USD)',       keywords: ['siding cost', 'vinyl siding cost', 'fiber cement siding cost'] },
  { file: 'window-replacement-cost.html', label: 'Window Replacement', variable: 'Window Replacement Cost (USD)',        keywords: ['window replacement cost', 'new windows cost', 'replacement window cost'] },
  { file: 'insulation-cost.html',         label: 'Insulation',         variable: 'Insulation Cost (USD)',                keywords: ['insulation cost', 'attic insulation cost', 'spray foam cost'] },
  { file: 'gutters-cost.html',            label: 'Gutter Installation',variable: 'Gutter Installation Cost (USD)',       keywords: ['gutter cost', 'gutter replacement cost', 'gutter guard cost'] },
  { file: 'landscaping-cost.html',        label: 'Landscaping',        variable: 'Landscaping Cost (USD)',               keywords: ['landscaping cost', 'lawn care cost', 'sod installation cost'] },
  { file: 'kitchen-remodel-cost.html',    label: 'Kitchen Remodel',    variable: 'Kitchen Remodel Cost (USD)',           keywords: ['kitchen remodel cost', 'kitchen renovation cost'] },
  { file: 'garage-door-cost.html',        label: 'Garage Door Installation', variable: 'Garage Door Installation Cost (USD)', keywords: ['garage door cost', 'garage door opener cost'] },
  { file: 'auto-repair-cost-guide.html',  label: 'Auto Repair',        variable: 'Auto Repair Cost (USD)',               keywords: ['auto repair cost', 'mechanic cost', 'car repair cost'] },
  { file: 'legal-cost-guide.html',        label: 'Legal Fee',          variable: 'Legal Fee Cost (USD)',                 keywords: ['lawyer cost', 'attorney fees', 'legal fee cost'] },
  { file: 'medical-cost-guide.html',      label: 'Medical Bill',       variable: 'Medical Bill Cost (USD)',              keywords: ['medical bill cost', 'healthcare cost', 'hospital bill cost'] },
  { file: 'moving-cost-guide.html',       label: 'Moving Service',     variable: 'Moving Service Cost (USD)',            keywords: ['moving cost', 'mover cost', 'long distance move cost'] },
];

const TODAY = new Date().toISOString().split('T')[0];

function buildDataset(guide) {
  const url = `https://woogoro.com/${guide.file}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${guide.label} Cost Data (2026)`,
    description: `City-specific ${guide.label.toLowerCase()} cost ranges across 739 U.S. cities, derived from Bureau of Labor Statistics wage data and Bureau of Economic Analysis regional cost-of-living indices. Updated for 2026.`,
    url,
    creator: { '@type': 'Organization', name: 'Woogoro', url: 'https://woogoro.com' },
    license: 'https://woogoro.com/terms.html',
    datePublished: '2026-01-01',
    dateModified: TODAY,
    variableMeasured: guide.variable,
    spatialCoverage: { '@type': 'Place', name: 'United States' },
    temporalCoverage: '2026',
    keywords: guide.keywords,
    isAccessibleForFree: true,
    distribution: [{
      '@type': 'DataDownload',
      encodingFormat: 'text/html',
      contentUrl: url,
    }],
  };
}

function renderBlock(obj) {
  return '<script type="application/ld+json">\n' + JSON.stringify(obj) + '\n</script>';
}

let injected = 0, skippedHas = 0, skippedMissing = 0, skippedNoHead = 0;

for (const guide of GUIDES) {
  const filePath = path.join(ROOT, guide.file);
  if (!fs.existsSync(filePath)) { skippedMissing++; console.log('  missing:', guide.file); continue; }

  const html = fs.readFileSync(filePath, 'utf8');
  if (/"@type":\s*"Dataset"/.test(html)) { skippedHas++; continue; }

  const headClose = html.indexOf('</head>');
  if (headClose < 0) { skippedNoHead++; continue; }

  const block = renderBlock(buildDataset(guide));
  const updated = html.slice(0, headClose) + block + '\n' + html.slice(headClose);
  fs.writeFileSync(filePath, updated, 'utf8');
  injected++;
}

console.log('Injected Dataset schema into:', injected);
console.log('Skipped (already had):', skippedHas);
console.log('Skipped (file missing):', skippedMissing);
console.log('Skipped (no </head>):', skippedNoHead);
