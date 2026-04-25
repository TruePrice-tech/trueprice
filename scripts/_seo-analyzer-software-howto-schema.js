#!/usr/bin/env node
/**
 * Inject SoftwareApplication + HowTo schema into every analyzer page so each
 * one is eligible for app-style and how-to rich results in Google and Bing.
 *
 * SoftwareApplication: marks the analyzer as a free web app. Google may
 * surface it with app-card UI for relevant queries.
 *
 * HowTo: 4-step "how to check a contractor quote" structure. Eligible for
 * step-by-step rich results.
 *
 * Idempotent — skips pages that already have either schema.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Filename -> { vertical display name, what gets analyzed (for HowTo text) }
const ANALYZERS = {
  'hvac-quote-analyzer.html':         { label: 'HVAC',            item: 'HVAC' },
  'roofing-quote-analyzer.html':      { label: 'Roofing',         item: 'roofing' },
  'plumbing-quote-analyzer.html':     { label: 'Plumbing',        item: 'plumbing' },
  'electrical-quote-analyzer.html':   { label: 'Electrical',      item: 'electrical' },
  'solar-quote-analyzer.html':        { label: 'Solar',           item: 'solar' },
  'concrete-quote-analyzer.html':     { label: 'Concrete',        item: 'concrete' },
  'painting-quote-analyzer.html':     { label: 'Painting',        item: 'painting' },
  'fencing-quote-analyzer.html':      { label: 'Fencing',         item: 'fence' },
  'foundation-quote-analyzer.html':   { label: 'Foundation',      item: 'foundation repair' },
  'siding-quote-analyzer.html':       { label: 'Siding',          item: 'siding' },
  'window-quote-analyzer.html':       { label: 'Window',          item: 'window replacement' },
  'insulation-quote-analyzer.html':   { label: 'Insulation',      item: 'insulation' },
  'gutters-quote-analyzer.html':      { label: 'Gutters',         item: 'gutter' },
  'landscaping-quote-analyzer.html':  { label: 'Landscaping',     item: 'landscaping' },
  'kitchen-quote-analyzer.html':      { label: 'Kitchen Remodel', item: 'kitchen remodel' },
  'garage-door-quote-analyzer.html':  { label: 'Garage Door',     item: 'garage door' },
  'auto-repair.html':                 { label: 'Auto Repair',     item: 'auto repair' },
  'moving-quote-analyzer.html':       { label: 'Moving',          item: 'moving' },
  'legal-fee-analyzer.html':          { label: 'Legal Fee',       item: 'legal fee' },
  'medical-bill-analyzer.html':       { label: 'Medical Bill',    item: 'medical bill' },
};

function buildSchemas(filename, info) {
  const url = `https://woogoro.com/${filename}`;

  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `Woogoro ${info.label} Quote Analyzer`,
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Quote Analyzer',
    operatingSystem: 'Web Browser',
    url,
    description: `Free analyzer for ${info.item} quotes. Upload your quote and check the price, scope, and red flags. No email or signup required.`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'Woogoro', url: 'https://woogoro.com' },
  };

  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to check if your ${info.item} quote is fair`,
    description: `Use the Woogoro analyzer to compare a contractor quote against city-specific ${info.item} pricing in under a minute.`,
    totalTime: 'PT1M',
    estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: '0' },
    tool: [
      { '@type': 'HowToTool', name: `Your ${info.item} contractor quote (PDF, photo, or text)` },
    ],
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Upload your quote',
        text: `Drag your ${info.item} quote into the analyzer or paste the text. PDFs, photos, and screenshots all work.`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Enter your city',
        text: 'Choose your city so pricing is benchmarked against local cost-of-living and labor rates.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Review the price check',
        text: `See where your quote falls in the local price range, what scope items may be missing, and any red flags in the fine print.`,
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Use the questions to push back',
        text: 'Take the contractor follow-up questions Woogoro generates into your conversation with the contractor.',
      },
    ],
  };

  return [software, howTo];
}

function renderBlock(obj) {
  return '<script type="application/ld+json">\n' + JSON.stringify(obj) + '\n</script>';
}

let injected = 0, skippedHas = 0, skippedMissing = 0, skippedNoHead = 0;

for (const [filename, info] of Object.entries(ANALYZERS)) {
  const filePath = path.join(ROOT, filename);
  if (!fs.existsSync(filePath)) { skippedMissing++; continue; }
  const html = fs.readFileSync(filePath, 'utf8');

  // Skip if either schema already present
  if (/"@type":\s*"SoftwareApplication"/.test(html) || /"@type":\s*"HowTo"/.test(html)) {
    skippedHas++; continue;
  }

  const headClose = html.indexOf('</head>');
  if (headClose < 0) { skippedNoHead++; continue; }

  const block = buildSchemas(filename, info).map(renderBlock).join('\n');
  const updated = html.slice(0, headClose) + block + '\n' + html.slice(headClose);

  // JSON parse-check both new schemas before writing
  for (const schema of buildSchemas(filename, info)) {
    try { JSON.parse(JSON.stringify(schema)); } catch (e) {
      console.error(`Schema build error for ${filename}: ${e.message}`);
      continue;
    }
  }

  fs.writeFileSync(filePath, updated, 'utf8');
  injected++;
}

console.log('Injected SoftwareApplication + HowTo into:', injected);
console.log('Skipped (already had):', skippedHas);
console.log('Skipped (file missing):', skippedMissing);
console.log('Skipped (no </head>):', skippedNoHead);
