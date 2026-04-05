#!/usr/bin/env node
/**
 * Generate personalized outreach emails from a target list.
 *
 * Usage:
 *   node scripts/generate-outreach.js
 *
 * Reads scripts/outreach-targets.json, outputs scripts/outreach-ready.md
 * with personalized emails ready to send.
 *
 * Target format:
 * [
 *   { "name": "John", "blog": "RoofingCalc", "url": "roofingcalc.com", "vertical": "home", "article": "How Much Does a New Roof Cost in 2026?", "service": "roofing" },
 *   ...
 * ]
 */

const fs = require('fs');
const path = require('path');

const TARGETS_FILE = path.join(__dirname, 'outreach-targets.json');
const OUTPUT_FILE = path.join(__dirname, 'outreach-ready.md');

const templates = {
  home: {
    subject: 'Free pricing widget for your cost guides',
    body: (t) => `Hi ${t.name},

I read your "${t.article}" and thought your readers might find this useful. I built a free embeddable widget that shows local home service costs (roofing, HVAC, plumbing, etc.) broken down by material and city.

It's one line of code, no signup, no ads, and it auto-updates with current pricing. Here's what it looks like: https://truepricehq.com/widget.html

It can also auto-detect your visitor's location so the pricing is always local to them.

If you're interested, the embed code is just:

<script src="https://truepricehq.com/widget/tp-widget.js" data-service="${t.service || 'roofing'}" data-auto="true" async></script>

Happy to customize it for your site if needed. No catch, it's free.

Lane
TruePrice (https://truepricehq.com)`
  },

  auto: {
    subject: 'Free auto repair cost widget for your site',
    body: (t) => `Hi ${t.name},

I came across your "${t.article}" and wanted to share something your readers might like. I built a free widget that shows local auto repair costs (brakes, timing belts, alternators, transmission work, etc.) broken down by repair type.

One line of code, no signup, updates automatically: https://truepricehq.com/widget.html

<script src="https://truepricehq.com/widget/tp-widget.js" data-service="auto-repair" data-auto="true" async></script>

It auto-detects visitor location so prices are local. Let me know if you'd like to try it out.

Lane
TruePrice (https://truepricehq.com)`
  },

  medical: {
    subject: 'Free medical cost widget for your readers',
    body: (t) => `Hi ${t.name},

I saw your "${t.article}" and thought this might be a good fit. I built a free widget that shows typical costs for common medical procedures (ER visits, MRIs, lab work, knee replacements, etc.) so patients know what to expect before they get the bill.

It's one line of code, no signup: https://truepricehq.com/widget.html

<script src="https://truepricehq.com/widget/tp-widget.js" data-service="medical" data-auto="true" async></script>

We also have a medical bill analyzer where people can upload a hospital bill and get a line-by-line check against benchmark rates. Could be worth linking to as a resource.

Lane
TruePrice (https://truepricehq.com)`
  },

  legal: {
    subject: 'Free legal fee widget for your readers',
    body: (t) => `Hi ${t.name},

I read your "${t.article}" and wanted to share something your audience might appreciate. I built a free widget that shows typical legal fees by practice area (family law, criminal defense, estate planning, immigration, etc.) adjusted by region.

One line of code, no signup, light/dark theme: https://truepricehq.com/widget.html

<script src="https://truepricehq.com/widget/tp-widget.js" data-service="legal" data-auto="true" async></script>

We also have a legal fee analyzer where people can upload a retainer agreement and check if the rates are in line with market data.

Lane
TruePrice (https://truepricehq.com)`
  },

  finance: {
    subject: 'Free home cost widget for your readers',
    body: (t) => `Hi ${t.name},

I saw your "${t.article}" and thought this might add value for your readers. I built a free embeddable widget that shows local costs for 16 home services, auto repair, medical procedures, and legal fees.

It auto-detects visitor location and shows pricing specific to their city. One line of code: https://truepricehq.com/widget.html

<script src="https://truepricehq.com/widget/tp-widget.js" data-service="${t.service || 'roofing'}" data-auto="true" async></script>

You can swap "${t.service || 'roofing'}" for any of 19 services. No signup, no ads, no catch.

Lane
TruePrice (https://truepricehq.com)`
  }
};

function main() {
  if (!fs.existsSync(TARGETS_FILE)) {
    console.log('Create scripts/outreach-targets.json first. See format in this script header.');
    console.log('\nExample entry:');
    console.log(JSON.stringify({
      name: "John",
      blog: "RoofingCalc",
      url: "roofingcalc.com",
      vertical: "home",
      article: "How Much Does a New Roof Cost in 2026?",
      service: "roofing"
    }, null, 2));
    process.exit(0);
  }

  const targets = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf-8'));
  let output = '# Outreach Emails - Ready to Send\n\nGenerated: ' + new Date().toISOString().split('T')[0] + '\n\n';

  for (const t of targets) {
    const tmpl = templates[t.vertical] || templates.home;
    output += `---\n\n`;
    output += `## ${t.blog} (${t.url})\n`;
    output += `**To:** ${t.name} | **Vertical:** ${t.vertical}\n`;
    output += `**Subject:** ${tmpl.subject}\n\n`;
    output += tmpl.body(t) + '\n\n';
  }

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Generated ${targets.length} emails -> ${OUTPUT_FILE}`);
}

main();
