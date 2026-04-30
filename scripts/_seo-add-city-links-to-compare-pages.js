#!/usr/bin/env node
/**
 * One-shot: add a "Popular metros for X pricing" section to each
 * compare-X-quotes.html page. These pages are noindex,follow — Google
 * doesn't index them but does follow the links, so adding city links
 * routes authority to city pages without competing in SERP.
 *
 * Inserts after the "Helpful X Guides" <section> block on each page.
 * Idempotent: skips if the new section is already present.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const FLAGSHIPS = [
  ['new-york-ny',    'New York, NY'],
  ['los-angeles-ca', 'Los Angeles, CA'],
  ['chicago-il',     'Chicago, IL'],
  ['houston-tx',     'Houston, TX'],
  ['phoenix-az',     'Phoenix, AZ'],
  ['dallas-tx',      'Dallas, TX'],
  ['atlanta-ga',     'Atlanta, GA'],
  ['denver-co',      'Denver, CO'],
  ['seattle-wa',     'Seattle, WA'],
  ['austin-tx',      'Austin, TX'],
];

// compare-FILE -> { slug: city-URL slug, label: human label }
const VERTICALS = {
  'compare-auto-quotes.html':       { slug: 'auto-repair',     label: 'auto repair' },
  'compare-concrete-quotes.html':   { slug: 'concrete',        label: 'concrete' },
  'compare-electrical-quotes.html': { slug: 'electrical',      label: 'electrical work' },
  'compare-fencing-quotes.html':    { slug: 'fence',           label: 'fence installation' },
  'compare-foundation-quotes.html': { slug: 'foundation',      label: 'foundation repair' },
  'compare-garage-door-quotes.html':{ slug: 'garage-door',     label: 'garage door' },
  'compare-gutters-quotes.html':    { slug: 'gutter',          label: 'gutter installation' },
  'compare-hvac-quotes.html':       { slug: 'hvac',            label: 'HVAC' },
  'compare-insulation-quotes.html': { slug: 'insulation',      label: 'insulation' },
  'compare-kitchen-quotes.html':    { slug: 'kitchen-remodel', label: 'kitchen remodel' },
  'compare-landscaping-quotes.html':{ slug: 'landscaping',     label: 'landscaping' },
  'compare-legal-quotes.html':      { slug: 'legal',           label: 'legal' },
  'compare-medical-quotes.html':    { slug: 'medical',         label: 'medical bill' },
  'compare-moving-quotes.html':     { slug: 'moving',          label: 'moving' },
  'compare-painting-quotes.html':   { slug: 'painting',        label: 'painting' },
  'compare-plumbing-quotes.html':   { slug: 'plumbing',        label: 'plumbing' },
  'compare-roofing-quotes.html':    { slug: 'roof',            label: 'roof' },
  'compare-siding-quotes.html':     { slug: 'siding',          label: 'siding' },
  'compare-solar-quotes.html':      { slug: 'solar',           label: 'solar installation' },
  'compare-windows-quotes.html':    { slug: 'window',          label: 'window' },
};

const SENTINEL = '<!-- compare-page city links: do not duplicate -->';

function buildSection(slug, label) {
  const items = FLAGSHIPS
    .map(([cityslug, cityname]) => {
      const href = `/${cityslug}-${slug}-cost.html`;
      return `            <li><a href="${href}">${cityname}</a></li>`;
    })
    .join('\n');
  return `      <section style="background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:24px; margin-bottom:16px;">
        ${SENTINEL}
        <h2 style="margin:0 0 12px; font-size:20px;">Popular metros for ${label} pricing</h2>
        <p style="color:#475569; margin:0 0 12px; font-size:14px;">City pages with metro-specific ${label} cost ranges, contractor signals, and quote benchmarks.</p>
        <ul style="line-height:1.8; color:#475569; margin:0; padding-left:20px;">
${items}
        </ul>
      </section>`;
}

let updated = 0;
let skipped = 0;
const missing = [];

for (const [file, { slug, label }] of Object.entries(VERTICALS)) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) {
    missing.push(file);
    continue;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  if (html.includes(SENTINEL)) {
    skipped++;
    console.log(`  ${file}: already has city-link section, skipping`);
    continue;
  }

  // Verify a sample target exists; abort whole file if not (don't ship 404 links)
  const sampleTarget = `new-york-ny-${slug}-cost.html`;
  if (!fs.existsSync(path.join(ROOT, sampleTarget))) {
    console.log(`  ${file}: target ${sampleTarget} MISSING, skipping`);
    skipped++;
    continue;
  }

  // Insert after the "Helpful X Guides" </section> block. Find it by the
  // structural anchor: the </section> immediately preceding the </div>
  // that closes the right-rail content area. Use a forgiving match: the
  // last </section> before </main>.
  const mainCloseIdx = html.indexOf('</main>');
  if (mainCloseIdx === -1) {
    console.log(`  ${file}: no </main> tag found, skipping`);
    skipped++;
    continue;
  }
  const lastSectionCloseIdx = html.lastIndexOf('</section>', mainCloseIdx);
  if (lastSectionCloseIdx === -1) {
    console.log(`  ${file}: no </section> before </main>, skipping`);
    skipped++;
    continue;
  }

  const insertAt = lastSectionCloseIdx + '</section>'.length;
  const section = buildSection(slug, label);
  const newHtml = html.slice(0, insertAt) + '\n' + section + html.slice(insertAt);
  fs.writeFileSync(filePath, newHtml, 'utf8');
  console.log(`  ${file}: added city-link section (${slug})`);
  updated++;
}

console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}, missing: ${missing.length}`);
if (missing.length) console.log(`Missing files: ${missing.join(', ')}`);
