#!/usr/bin/env node
/**
 * Trim overlong titles on legal (47) and medical (47) city pages so SERPs
 * don't truncate them. Every current title exceeds 60 chars for longer city
 * names (Colorado Springs, Virginia Beach, etc.).
 *
 * Legal trim: "Legal Fee & Attorney Cost Guide" -> "Legal Fee & Attorney Cost"
 *             (also drop " (2026)" from the <title> tag only)
 *
 * Medical trim: "Medical Bill & Healthcare Cost Guide" -> "Medical Bill Cost"
 *             (drops "& Healthcare" which is a broader keyword but less
 *             common in search intent than "medical bill")
 *             (also drop " (2026)" from the <title> tag only)
 *
 * Trim applies to <title>, og:title, twitter:title, and og:image:alt.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function trimFile(filename, bodyReplacements, titleOnlyReplacements) {
  const filePath = path.join(ROOT, filename);
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [from, to] of bodyReplacements) {
    if (html.includes(from)) {
      html = html.split(from).join(to);
      changed = true;
    }
  }

  // Title-only replacements scoped to the <title>...</title> tag.
  for (const [from, to] of titleOnlyReplacements) {
    const titleRe = /<title>([^<]*)<\/title>/;
    const m = html.match(titleRe);
    if (m && m[1].includes(from)) {
      const newTitle = m[1].split(from).join(to);
      html = html.replace(titleRe, '<title>' + newTitle + '</title>');
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(filePath, html, 'utf8');
  return changed;
}

let legalChanged = 0, medicalChanged = 0;

// Legal
for (const file of fs.readdirSync(ROOT).filter(f => f.endsWith('-legal-cost.html'))) {
  const ok = trimFile(file,
    [['Legal Fee &amp; Attorney Cost Guide', 'Legal Fee &amp; Attorney Cost']],
    [[' (2026)', '']]
  );
  if (ok) legalChanged++;
}

// Medical
for (const file of fs.readdirSync(ROOT).filter(f => f.endsWith('-medical-cost.html'))) {
  const ok = trimFile(file,
    [['Medical Bill &amp; Healthcare Cost Guide', 'Medical Bill Cost']],
    [[' (2026)', '']]
  );
  if (ok) medicalChanged++;
}

console.log('Trimmed legal titles:', legalChanged);
console.log('Trimmed medical titles:', medicalChanged);
