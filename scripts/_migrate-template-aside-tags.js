#!/usr/bin/env node
/**
 * _migrate-template-aside-tags.js
 *
 * One-shot migration for the city-page templates that drive every Tier B
 * cost page. Converts two leak-prone widget shells to semantic auxiliary
 * tags so Google + our uniqueness audit can correctly de-weight them:
 *
 *   1. Newsletter signup CTA:
 *        <div class="cta-box" style="background:var(--bg-subtle…">
 *        … </div>
 *      -> <aside class="cta-box cta-box-newsletter" aria-label="Newsletter signup" style="background:var(--bg-subtle…">
 *         … </aside>
 *
 *   2. Inside-<main> "Other Services in {{CITY}}" cross-link block:
 *        <section class="section">
 *        <h2>Other Services in {{CITY}}</h2>
 *        … </section>
 *      -> <aside class="related-services" aria-label="Other services in {{CITY}}">
 *         <h2>Other Services in {{CITY}}</h2>
 *         … </aside>
 *
 * Idempotent: re-runs are no-ops if both shells are already <aside>.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATE_DIR = path.join(ROOT, "templates");

const TEMPLATES = [
  "city-page-template.html",
  "concrete-city-page-template.html",
  "electrical-city-page-template.html",
  "fencing-city-page-template.html",
  "foundation-city-page-template.html",
  "garage-door-city-page-template.html",
  "gutters-city-page-template.html",
  "hvac-city-page-template.html",
  "insulation-city-page-template.html",
  "kitchen-city-page-template.html",
  "landscaping-city-page-template.html",
  "painting-city-page-template.html",
  "plumbing-city-page-template.html",
  "siding-city-page-template.html",
  "solar-city-page-template.html",
  "window-city-page-template.html",
];

function migrateNewsletter(src) {
  // The newsletter cta-box is the ONLY <div class="cta-box"> with a
  // background:var(--bg-subtle override and a city-email-form inside.
  // Find the opening tag, then walk forward finding the matching </div>
  // for that div by depth-counting.
  const openRe = /<div class="cta-box" style="background:var\(--bg-subtle,[^"]*"[^>]*>/;
  const m = openRe.exec(src);
  if (!m) return { src, changed: false };
  const openStart = m.index;
  const openEnd = openStart + m[0].length;

  // Walk forward, counting div depth, to find the matching </div>
  let depth = 1;
  let i = openEnd;
  const divRe = /<\/?div\b/gi;
  divRe.lastIndex = i;
  let closeIdx = -1;
  while (depth > 0) {
    divRe.lastIndex = i;
    const tag = divRe.exec(src);
    if (!tag) break;
    if (tag[0].toLowerCase().startsWith("</")) {
      depth--;
      if (depth === 0) {
        closeIdx = tag.index;
        break;
      }
    } else {
      depth++;
    }
    i = tag.index + tag[0].length;
  }
  if (closeIdx < 0) return { src, changed: false };

  // Sanity check: this block should contain a city-email-form
  const block = src.slice(openStart, closeIdx + "</div>".length);
  if (!/city-email-form/.test(block)) return { src, changed: false };

  // Rewrite the opening and closing tags
  const newOpen = m[0].replace(
    /^<div class="cta-box" style=/,
    '<aside class="cta-box cta-box-newsletter" aria-label="Newsletter signup" style='
  );
  const before = src.slice(0, openStart);
  const newInner = src.slice(openEnd, closeIdx);
  const after = src.slice(closeIdx + "</div>".length);
  return {
    src: before + newOpen + newInner + "</aside>" + after,
    changed: true,
    detail: "newsletter cta-box -> <aside>",
  };
}

function migrateOtherServices(src) {
  // The inside-<main> "Other Services in {{CITY}}" cross-link block:
  //   <section class="section">
  //   <h2>Other Services in {{CITY}}</h2>
  //   …
  //   </section>
  // We anchor on the unique H2 to locate the section open, then depth-count
  // <section> tags forward to find the matching </section>.
  const h2Idx = src.search(/<h2>\s*Other Services in \{\{CITY\}\}\s*<\/h2>/);
  if (h2Idx < 0) return { src, changed: false };

  // Walk backwards to find the nearest <section class="section"> opening
  const before = src.slice(0, h2Idx);
  const lastSectionOpen = before.lastIndexOf('<section class="section">');
  if (lastSectionOpen < 0) return { src, changed: false };

  // Depth-count forward from end of opening tag to matching </section>
  const openTagEnd = lastSectionOpen + '<section class="section">'.length;
  let depth = 1;
  let i = openTagEnd;
  const sectionRe = /<\/?section\b/gi;
  let closeIdx = -1;
  while (depth > 0) {
    sectionRe.lastIndex = i;
    const tag = sectionRe.exec(src);
    if (!tag) break;
    if (tag[0].toLowerCase().startsWith("</")) {
      depth--;
      if (depth === 0) {
        closeIdx = tag.index;
        break;
      }
    } else {
      depth++;
    }
    i = tag.index + tag[0].length;
  }
  if (closeIdx < 0) return { src, changed: false };

  // Sanity check: this section must contain the Other-Services H2
  const block = src.slice(lastSectionOpen, closeIdx + "</section>".length);
  if (!/<h2>\s*Other Services in \{\{CITY\}\}/.test(block)) return { src, changed: false };

  const newOpen =
    '<aside class="related-services" aria-label="Other services in {{CITY}}">';
  const head = src.slice(0, lastSectionOpen);
  const inner = src.slice(openTagEnd, closeIdx);
  const tail = src.slice(closeIdx + "</section>".length);
  return {
    src: head + newOpen + inner + "</aside>" + tail,
    changed: true,
    detail: "inside-main Other Services <section> -> <aside>",
  };
}

function migrateOne(file) {
  const full = path.join(TEMPLATE_DIR, file);
  const orig = fs.readFileSync(full, "utf8");

  let next = orig;
  const changes = [];

  let r1 = migrateNewsletter(next);
  if (r1.changed) {
    next = r1.src;
    changes.push(r1.detail);
  }

  let r2 = migrateOtherServices(next);
  if (r2.changed) {
    next = r2.src;
    changes.push(r2.detail);
  }

  if (next === orig) {
    return { file, changes: [], skipped: true };
  }
  fs.writeFileSync(full, next);
  return { file, changes };
}

function main() {
  const results = TEMPLATES.map(migrateOne);
  for (const r of results) {
    if (r.skipped) {
      console.log(`SKIP  ${r.file}  (no matches — already migrated?)`);
    } else {
      console.log(`OK    ${r.file}  ${r.changes.join(" | ")}`);
    }
  }
  const totalChanged = results.filter((r) => !r.skipped).length;
  console.log(`\n${totalChanged}/${results.length} templates updated`);
}

main();
