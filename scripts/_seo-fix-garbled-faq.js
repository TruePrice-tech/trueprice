#!/usr/bin/env node
/**
 * Removes the garbled second-FAQ block that was injected into city-cost
 * pages by an earlier sed/regex run that mangled `$X,000` price strings
 * into `<div class="faq-list">X,000` and inserted orphan `</section>` tags
 * mid-paragraph.
 *
 * Strategy: drop everything between the legit `<!-- /UNIQUE-FAQ --></div>
 * </section>` close and the next legit section marker (`<!-- 14.` or
 * `<section class="section popular-cities">`). The UNIQUE-FAQ section
 * above is well-formed and city-specific. The block being removed is
 * generic templated FAQ noise with corrupted HTML — uniqueness-positive.
 *
 * Usage:
 *   node _seo-fix-garbled-faq.js <glob>          # dry-run
 *   node _seo-fix-garbled-faq.js <glob> --apply  # write
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function listGlob(pattern) {
  const out = execSync(
    `git ls-files -- ${JSON.stringify(pattern)}`,
    { cwd: ROOT, encoding: 'utf8' }
  );
  return out.split('\n').filter(Boolean).filter(p => !p.includes('/'));
}

const BROKEN_MARKER = /<div class="faq-list">[0-9]?,?000|<\/section>-5 per square foot installed/;
// The broken block is appended directly to the </section> close of the
// preceding (legit) FAQ section: no whitespace, the orphan text starts with
// "-5 per square foot installed". Find that fingerprint, preserve the legit
// </section>, drop the broken text and orphan FAQ items up to <!-- 14. ...
const FIX_RE = /(<\/section>)-5 per square foot installed[\s\S]*?(<!-- 14\.)/;

function fix(file, apply) {
  const html = fs.readFileSync(file, 'utf8');
  if (!BROKEN_MARKER.test(html)) return { skipped: true };
  if (!FIX_RE.test(html)) return { error: 'BROKEN_MARKER present but FIX_RE did not match' };
  const updated = html.replace(FIX_RE, '$1\n\n$2');
  if (updated === html) return { skipped: true };
  if (apply) fs.writeFileSync(file, updated, 'utf8');
  // Sanity check: result must not still contain the broken patterns
  const stillBroken = BROKEN_MARKER.test(updated) ||
    /<\/section>[^<\s]/.test(updated.slice(updated.indexOf('<!-- /UNIQUE-FAQ -->')));
  return { fixed: true, stillBroken };
}

function main() {
  const pattern = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!pattern) {
    console.error('Usage: node _seo-fix-garbled-faq.js <glob> [--apply]');
    process.exit(1);
  }
  const files = listGlob(pattern);
  let n = 0, errors = 0, broken = 0;
  for (const f of files) {
    const r = fix(path.join(ROOT, f), apply);
    if (r.error) { console.error(f + ': ' + r.error); errors++; continue; }
    if (r.fixed) {
      n++;
      if (r.stillBroken) { console.error(f + ': still broken after fix'); broken++; }
    }
  }
  console.log(`Pattern: ${pattern}  total=${files.length}  ${apply ? 'fixed' : 'would fix'}=${n}  errors=${errors}  still-broken=${broken}`);
  if (!apply) console.log('(dry-run; pass --apply to write)');
}

main();
