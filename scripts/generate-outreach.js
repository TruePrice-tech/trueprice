#!/usr/bin/env node
/**
 * Generate personalized outreach emails from a target list.
 *
 * Usage:
 *   node scripts/generate-outreach.js
 *
 * Reads scripts/outreach-targets.json, outputs scripts/outreach-ready.md
 */

const fs = require('fs');
const path = require('path');

const TARGETS_FILE = path.join(__dirname, 'outreach-targets.json');
const OUTPUT_FILE = path.join(__dirname, 'outreach-ready.md');

const SIG = `Geoff Lane
704-906-4030 (text or call, seriously)
truepricehq.com`;

const templates = {
  home: {
    subject: (t) => `quick question about ${t.blog}`,
    body: (t) => `Hey ${t.name},

I was reading your piece on ${t.article.toLowerCase()} and figured I'd reach out directly instead of filling out a contact form into the void.

I'm Geoff. I built a free pricing widget that shows local home service costs, broken down by material and city. Roofing, HVAC, plumbing, the works. It pulls live data and auto-detects where your visitor is, so the numbers are always local to them.

I thought it might be a good fit for your cost content since it gives readers actual numbers for their area instead of generic national ranges. Here's the widget page if you want to see it: truepricehq.com/widget.html

The embed is literally one line of code:

<script src="https://truepricehq.com/widget/tp-widget.js" data-service="${t.service || 'roofing'}" data-auto="true" async></script>

No signup, no ads, no affiliate stuff. I'm a real person, not a bot, and you're welcome to call me anytime if you want to talk about it.

${SIG}`
  },

  auto: {
    subject: (t) => `quick question about ${t.blog}`,
    body: (t) => `Hey ${t.name},

Found your site while researching auto repair pricing and thought this might be up your alley.

I'm Geoff. I built a free widget that shows local auto repair costs (brakes, timing belts, alternators, transmission, etc.). It auto-detects the reader's location so the prices are specific to their area, not some national average that doesn't help anyone.

Figured it could be useful embedded alongside your repair content. Here's what it looks like: truepricehq.com/widget.html (pick "Auto Repair" from the dropdown)

One line to embed:

<script src="https://truepricehq.com/widget/tp-widget.js" data-service="auto-repair" data-auto="true" async></script>

Totally free, no catch. I'm just trying to get it in front of people who'd actually use it. Feel free to call or text me if you have questions.

${SIG}`
  },

  medical: {
    subject: (t) => `free tool your readers might actually use`,
    body: (t) => `Hey ${t.name},

I came across ${t.blog} while looking into medical cost transparency and wanted to reach out.

I'm Geoff. I built a free widget that shows typical costs for common medical procedures (ER visits, MRIs, lab work, surgeries, etc.). The idea is that people should know what something costs before they get the bill, not after.

We also have a medical bill analyzer where someone can upload their hospital bill and get a line-by-line check against benchmark rates. It flags overcharges, duplicate charges, and upcoding.

Here's the widget: truepricehq.com/widget.html (pick "Medical Costs")

One line to embed:

<script src="https://truepricehq.com/widget/tp-widget.js" data-service="medical" data-auto="true" async></script>

No signup, no ads. I'm a real person building this because medical billing is broken and people deserve better tools. Call me anytime if you want to chat about it.

${SIG}`
  },

  legal: {
    subject: (t) => `free tool for ${t.blog} readers`,
    body: (t) => `Hey ${t.name},

I was poking around ${t.blog} and thought your audience might get value from something I built.

I'm Geoff. I made a free widget that shows typical legal fees by practice area (family law, criminal defense, estate planning, immigration, etc.) adjusted for the reader's region. It also shows common flat fees for things like simple wills, DUI defense, LLC formation, etc.

We have a legal fee analyzer too where someone can upload a retainer agreement and check if the rates make sense.

Widget demo: truepricehq.com/widget.html (pick "Legal Fees")

Embed code:

<script src="https://truepricehq.com/widget/tp-widget.js" data-service="legal" data-auto="true" async></script>

Free, no signup, no strings. Happy to jump on a call if you want to talk through it. I'm a real human, I promise.

${SIG}`
  },

  finance: {
    subject: (t) => `something your readers might like`,
    body: (t) => `Hey ${t.name},

I follow ${t.blog} and thought I'd share something I built that might fit with your content.

I'm Geoff. I made a free embeddable widget that shows local costs for home services, auto repair, medical procedures, and legal fees. It auto-detects where the reader is and shows pricing for their city. Useful for anyone budgeting for a roof, a mechanic visit, or trying to figure out if their doctor's bill is normal.

Here's the widget page: truepricehq.com/widget.html

One line to embed, works with any of 19 services:

<script src="https://truepricehq.com/widget/tp-widget.js" data-service="${t.service || 'roofing'}" data-auto="true" async></script>

No signup, no ads, no affiliate links. Just a tool I think people would actually use. Feel free to call or text me, I'm happy to answer any questions.

${SIG}`
  }
};

function main() {
  if (!fs.existsSync(TARGETS_FILE)) {
    console.log('Create scripts/outreach-targets.json first.');
    process.exit(0);
  }

  const targets = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf-8'));
  let output = '# Outreach Emails - Ready to Send\n\n';
  output += 'Generated: ' + new Date().toISOString().split('T')[0] + '\n\n';
  output += '> **Before sending:** Replace "Editor" with real names. Find a specific article on their site to reference. Send Tuesday-Thursday mornings. One follow-up max, 5-7 days later.\n\n';

  for (const t of targets) {
    const tmpl = templates[t.vertical] || templates.home;
    output += `---\n\n`;
    output += `## ${t.blog} (${t.url})\n`;
    output += `**To:** ${t.name} | **Vertical:** ${t.vertical}\n`;
    output += `**Subject:** ${tmpl.subject(t)}\n\n`;
    output += tmpl.body(t) + '\n\n';
  }

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Generated ${targets.length} emails -> ${OUTPUT_FILE}`);
}

main();
