#!/usr/bin/env node
/**
 * Generate personalized backlink-acquisition emails (asking sites to add a link
 * to one of our pages, NOT to embed the widget).
 *
 * Usage:
 *   node scripts/generate-backlink-outreach.js
 *
 * Reads scripts/backlink-targets.json, outputs scripts/backlink-ready.md
 */

const fs = require('fs');
const path = require('path');

const TARGETS_FILE = path.join(__dirname, 'backlink-targets.json');
const OUTPUT_FILE = path.join(__dirname, 'backlink-ready.md');

const SIG = `Lane Adams
TruePrice
truepricehq.com`;

const templates = {
  resource: (t) => ({
    subject: `quick suggestion for your ${t.topic} list`,
    body: `Hi ${t.name},

I was reading "${t.article}" on ${t.site} and noticed you maintain a solid roundup of resources for ${t.topic}.

I run TruePrice (truepricehq.com), a free homeowner tool that breaks down local contractor pricing by city, material, and contractor tier. We show real ranges (not national averages) and let visitors paste their actual quote for a free analysis. No email gate, no lead-gen, no ads.

If you ever update that resource list, this page might be a fit:
${t.ourPage}

Either way, thanks for keeping that page maintained. It's a genuinely useful list.

${SIG}`
  }),

  skyscraper: (t) => ({
    subject: `more detailed ${t.topic} data for your readers`,
    body: `Hi ${t.name},

In your post "${t.article}" on ${t.site}, you covered ${t.topic} at a national-average level. Strong piece, but I noticed your readers in the comments asking for city-specific numbers.

I just published a 2026 ${t.topic} guide that includes:
  - Live pricing for 700+ US cities (not national averages)
  - Material-tier breakdowns with $ ranges
  - A free quote analyzer if readers want to check their own quote

Link: ${t.ourPage}

If you're refreshing the article, would you consider adding ours as a "for local pricing, see..." pointer? No pressure -- I know link edits are work. Just thought it'd be useful for your readers either way.

${SIG}`
  }),

  journalist: (t) => ({
    subject: `data: ${t.topic} (story idea)`,
    body: `Hi ${t.name},

I saw your work on ${t.article} -- thought you might find this useful for a future segment.

I run TruePrice, an independent tool that tracks real contractor quotes across 700+ US cities. A few interesting recent data points relevant to your audience:

  - Roof replacement quotes in Charlotte are up ~14% YoY, with the spread between low and high bids widening to 2.1x
  - HVAC install quotes show a ~$4,500 gap between the lowest and highest tier of contractors for the same job
  - Most-overcharged repairs locally: panel upgrades and tankless water heaters

Happy to pull more granular data anytime if a quote-driven angle ever fits a story. Methodology is published openly: truepricehq.com/methodology.html

For your audience, our ${t.topic} page is here: ${t.ourPage}

${SIG}`
  }),

  library: (t) => ({
    subject: `free homeowner cost research tool for your consumer guides`,
    body: `Hi ${t.name},

I noticed ${t.site} maintains resources around ${t.topic}. I wanted to share a free, no-signup tool that may be useful to include for residents:

  - truepricehq.com -- shows local pricing for roofing, HVAC, plumbing, and 17 other home services across 700+ US cities
  - No email required, no lead-gen sales calls, no advertising
  - Methodology is published openly: ${t.ourPage}

The site is operated independently (not by a contractor or lead-generation company). Happy to answer any sourcing questions if it helps your evaluation.

${SIG}`
  })
};

function main() {
  if (!fs.existsSync(TARGETS_FILE)) {
    console.log('Create scripts/backlink-targets.json first.');
    process.exit(0);
  }

  const targets = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf-8'));
  let output = '# Backlink Outreach - Ready to Send\n\n';
  output += 'Generated: ' + new Date().toISOString().split('T')[0] + '\n\n';
  output += '> **Send rate:** 5-10/day max. Personalize the article reference -- generic templates get filtered. ONE follow-up after 7 days, then drop it. Track sends in scripts/outreach-tracker.csv.\n\n';

  const grouped = {};
  for (const t of targets) {
    grouped[t.tactic] = grouped[t.tactic] || [];
    grouped[t.tactic].push(t);
  }

  const order = ['resource', 'skyscraper', 'journalist', 'library'];
  for (const tactic of order) {
    if (!grouped[tactic]) continue;
    output += `\n# ${tactic.toUpperCase()} (${grouped[tactic].length})\n\n`;
    for (const t of grouped[tactic]) {
      const tmpl = templates[t.tactic];
      if (!tmpl) continue;
      const built = tmpl(t);
      output += `---\n\n`;
      output += `## ${t.site} (${t.url})\n`;
      output += `**To:** ${t.name} | **Tactic:** ${t.tactic} | **Vertical:** ${t.vertical}\n`;
      output += `**Subject:** ${built.subject}\n\n`;
      output += built.body + '\n\n';
    }
  }

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Generated ${targets.length} backlink emails -> ${OUTPUT_FILE}`);
}

main();
