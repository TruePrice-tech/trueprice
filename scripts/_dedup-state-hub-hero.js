#!/usr/bin/env node
// One-shot fix: state hubs duplicate the hero <p> verbatim as the first <p>
// inside the "How X costs vary in <State>" section. This is a thinness
// signal for Google. Strip the duplicate <p>, keeping the unique
// "State-specific code or insurance rule:" <p> as the section body.
//
// Run from repo root. Pass --dry to preview.

'use strict';
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const ROOT = process.cwd();

const STATES = [
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada','new-hampshire',
  'new-jersey','new-mexico','new-york','north-carolina','north-dakota','ohio',
  'oklahoma','oregon','pennsylvania','rhode-island','south-carolina','south-dakota',
  'tennessee','texas','utah','vermont','virginia','washington','west-virginia',
  'wisconsin','wyoming',
];
const VERTICALS = [
  'medical','legal','moving','auto-repair','hvac','plumbing','electrical','roof',
  'kitchen-remodel','window','siding','painting','landscaping','insulation',
  'gutter','garage-door','foundation','fence','concrete','solar',
];

function normalize(s) {
  return s.replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').trim();
}

const stats = { checked: 0, dedup: 0, alreadyClean: 0, noPattern: 0, secondPMissing: 0 };
const examples = { dedup: [], noPattern: [], alreadyClean: [], secondPMissing: [] };

for (const s of STATES) {
  for (const v of VERTICALS) {
    const f = `${s}-${v}-cost.html`;
    const fp = path.join(ROOT, f);
    if (!fs.existsSync(fp)) continue;
    stats.checked++;
    const before = fs.readFileSync(fp, 'utf8');

    const heroM = before.match(/<div class="hero">[\s\S]*?<p>([\s\S]*?)<\/p>/);
    if (!heroM) { stats.noPattern++; if (examples.noPattern.length < 3) examples.noPattern.push(f); continue; }

    // Match the full section so we can confirm there's a second <p> before stripping the first.
    const sectRe = /(<section class="section">\s*<h2>How [^<]+<\/h2>)([\s\S]*?)(<\/section>)/;
    const sectM = before.match(sectRe);
    if (!sectM) { stats.noPattern++; if (examples.noPattern.length < 3) examples.noPattern.push(f); continue; }

    const sectInner = sectM[2];
    // Capture all <p>...</p> blocks in the inner section content
    const pMatches = [...sectInner.matchAll(/<p>([\s\S]*?)<\/p>/g)];
    if (pMatches.length < 2) {
      // section has only one <p> — can't safely remove it (would leave section empty).
      stats.secondPMissing++;
      if (examples.secondPMissing.length < 3) examples.secondPMissing.push(f);
      continue;
    }

    const firstP = pMatches[0][1];
    const heroP = heroM[1];
    if (!normalize(heroP).includes(normalize(firstP))) {
      stats.alreadyClean++;
      if (examples.alreadyClean.length < 3) examples.alreadyClean.push(f);
      continue;
    }

    // Remove the first <p>...</p> block (and any preceding whitespace).
    const firstPFull = pMatches[0][0];
    // Find its index within sectInner; trim preceding whitespace cleanly.
    const idx = sectInner.indexOf(firstPFull);
    // Capture preceding whitespace up to (but not including) any prior content
    let leadStart = idx;
    while (leadStart > 0 && /\s/.test(sectInner[leadStart - 1])) leadStart--;
    // Replacement: drop the leading whitespace + the <p> block. Trailing whitespace
    // before the next <p> stays untouched, preserving the section's existing indent.
    const newInner = sectInner.slice(0, leadStart) + sectInner.slice(idx + firstPFull.length);
    const newSection = sectM[1] + newInner + sectM[3];
    // Use a callback to avoid JS replace's $-interpolation eating literal "$300,000".
    const after = before.replace(sectRe, () => newSection);

    if (after === before) {
      // shouldn't happen, but guard
      stats.noPattern++;
      continue;
    }

    if (!DRY) fs.writeFileSync(fp, after);
    stats.dedup++;
    if (examples.dedup.length < 3) examples.dedup.push(f);
  }
}

console.log(JSON.stringify({ stats, examples }, null, 2));
console.log(DRY ? '\n[DRY RUN — no files written]' : '\n[wrote files]');
