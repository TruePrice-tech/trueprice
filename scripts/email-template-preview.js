// Render welcome + digest templates with mock data and write to disk.
// Open the resulting .html files in a browser to eyeball them.
//
// Run: node scripts/email-template-preview.js
//
// No env vars needed — pure template render, no I/O to Resend or Redis.

import { writeFileSync } from "fs";
import { welcomeTemplate, digestTemplate } from "../api/_email-templates.js";

const outDir = "tmp-email-preview";
import { mkdirSync, existsSync } from "fs";
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const welcome = welcomeTemplate({
  city: "Charleston",
  stateCode: "SC",
  service: "hvac",
});

const digestMixed = digestTemplate({
  interests: [
    {
      city: "Charleston",
      stateCode: "SC",
      service: "hvac",
      change: { currentAvg: 8200, baseline: 7400, deviation: 0.108, currentQuotes: 28 },
    },
    {
      city: "Greenville",
      stateCode: "SC",
      service: "roofing",
      change: { currentAvg: 11800, baseline: 13200, deviation: -0.106, currentQuotes: 12 },
    },
    {
      // Below 5% threshold — should be filtered out.
      city: "Columbia",
      stateCode: "SC",
      service: "plumbing",
      change: { currentAvg: 480, baseline: 472, deviation: 0.017, currentQuotes: 6 },
    },
  ],
});

const digestEmpty = digestTemplate({
  interests: [
    {
      city: "Columbia",
      stateCode: "SC",
      service: "plumbing",
      change: { currentAvg: 480, baseline: 472, deviation: 0.017, currentQuotes: 6 },
    },
  ],
});

function shell(title, subject, html) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{background:#f1f5f9;margin:0;padding:30px;font-family:sans-serif;}
  .meta{max-width:600px;margin:0 auto 16px;background:#fff;padding:12px 18px;border-radius:8px;border:1px solid #e2e8f0;color:#475569;font-size:13px;}
  .frame{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;}
  .frame > div{padding:0!important;}</style></head>
  <body>
    <div class="meta"><strong>${title}</strong><br>Subject: ${subject}</div>
    <div class="frame">${html}</div>
  </body></html>`;
}

writeFileSync(`${outDir}/welcome.html`, shell("Welcome email", welcome.subject, welcome.html));
console.log(`wrote ${outDir}/welcome.html`);

if (digestMixed) {
  writeFileSync(`${outDir}/digest-with-changes.html`, shell("Monthly digest (with changes)", digestMixed.subject, digestMixed.html));
  console.log(`wrote ${outDir}/digest-with-changes.html`);
}

if (digestEmpty === null) {
  console.log("digest with only sub-threshold changes correctly returned null (no email would send)");
} else {
  console.warn("WARN: digestTemplate did not filter sub-threshold changes — check the 5% threshold logic");
}

console.log("\nOpen these in a browser to eyeball.");
