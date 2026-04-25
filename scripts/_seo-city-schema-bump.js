// City pages (*-cost.html with state-suffix slugs):
// 1. Bump Article dateModified to today
// 2. Replace Org-only Article author with Geoff Lane Person schema (E-E-A-T)
// Idempotent: re-running with same TODAY is a no-op.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TODAY = new Date().toISOString().slice(0, 10);

const PERSON_AUTHOR = '"author":{"@type":"Person","name":"Geoff Lane","url":"https://woogoro.com/about.html","jobTitle":"Founder","worksFor":{"@type":"Organization","name":"Woogoro","url":"https://woogoro.com/"}}';

// City page slug pattern: <city>-<2letterstate>-<vertical>-cost.html
const CITY_PAGE = /^[a-z0-9-]+-[a-z]{2}-[a-z-]+-cost\.html$/i;

const files = fs.readdirSync(ROOT).filter(f => CITY_PAGE.test(f));
console.log(`${files.length} city pages to process. Today: ${TODAY}`);

let bumpedDate = 0;
let injectedAuthor = 0;
let touched = 0;

for (const f of files) {
  const filePath = path.join(ROOT, f);
  const before = fs.readFileSync(filePath, 'utf8');
  let html = before;

  // 1) Bump dateModified inside Article schema only.
  // We look for the Article block and replace its dateModified field.
  html = html.replace(
    /("@type"\s*:\s*"Article"[\s\S]{0,800}?"dateModified"\s*:\s*")(\d{4}-\d{2}-\d{2})(")/g,
    (m, pre, old, post) => {
      if (old === TODAY) return m;
      bumpedDate++;
      return pre + TODAY + post;
    }
  );

  // 2) Replace Org-only Article author with Person schema.
  // Match: "@type":"Article" ... "author":{"@type":"Organization","name":"Woogoro"}
  html = html.replace(
    /("@type"\s*:\s*"Article"[\s\S]{0,400}?)"author"\s*:\s*\{\s*"@type"\s*:\s*"Organization"\s*,\s*"name"\s*:\s*"Woogoro"\s*\}/g,
    (m, pre) => {
      injectedAuthor++;
      return pre + PERSON_AUTHOR;
    }
  );

  if (html !== before) {
    fs.writeFileSync(filePath, html);
    touched++;
  }
}

console.log(`\nDone. ${touched} files modified.`);
console.log(`  dateModified bumps: ${bumpedDate}`);
console.log(`  Person author injections: ${injectedAuthor}`);
