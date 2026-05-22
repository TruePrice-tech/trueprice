#!/usr/bin/env node
/**
 * Phase 4 body-depth pass — wraps the remaining body-level leak patterns
 * in semantic auxiliary tags so Google's main-content evaluator + our
 * uniqueness audit can correctly de-weight them.
 *
 * Targets across the 15 per-vertical templates (roof's city-page-template.html
 * was handled in Phase 3 mid-iteration with `<aside class="dual-cta">`):
 *
 *   1. First `<div class="cta-box">` (the "Get a free <product> estimate
 *      for {{CITY}}" instant-quote CTA — auxiliary conversion element,
 *      NOT main content) → `<aside class="cta-box cta-box-instant">`.
 *
 * The "What affects X cost in {{CITY}}" factor-list section is INTENTIONALLY
 * left alone — it's tangentially related but arguably useful main content,
 * and varying it per-city is Phase 4 follow-up work (richer rather than
 * de-weighted).
 *
 * Idempotent: re-runs are no-ops if the cta-box is already an aside.
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const TEMPLATES = [
  "hvac-city-page-template.html",
  "plumbing-city-page-template.html",
  "electrical-city-page-template.html",
  "solar-city-page-template.html",
  "kitchen-city-page-template.html",
  "window-city-page-template.html",
  "siding-city-page-template.html",
  "painting-city-page-template.html",
  "garage-door-city-page-template.html",
  "fencing-city-page-template.html",
  "concrete-city-page-template.html",
  "landscaping-city-page-template.html",
  "foundation-city-page-template.html",
  "insulation-city-page-template.html",
  "gutters-city-page-template.html",
];

function patchTemplate(file) {
  const full = path.join(ROOT, "templates", file);
  let src = fs.readFileSync(full, "utf8");
  const before = src;

  // Idempotence
  if (src.includes('<aside class="cta-box cta-box-instant"')) {
    return { skipped: true, reason: "already patched" };
  }

  // Find the first `<div class="cta-box">` block that contains the
  // "Get a free <X> estimate for {{CITY}}" heading. Depth-count to find
  // the matching `</div>`.
  const openRe = /<div class="cta-box"[^>]*>/;
  const m = openRe.exec(src);
  if (!m) {
    return { failed: true, reason: 'no <div class="cta-box"> found' };
  }
  const openStart = m.index;
  const openEnd = openStart + m[0].length;

  // Walk forward, depth-counting div, to find the matching close.
  const divRe = /<\/?div\b/gi;
  divRe.lastIndex = openEnd;
  let depth = 1;
  let closeIdx = -1;
  while (depth > 0) {
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
  }
  if (closeIdx < 0) return { failed: true, reason: "no matching </div>" };

  // Sanity check: this block should contain the "Get a free … estimate"
  // heading. We don't want to accidentally wrap a different cta-box.
  const block = src.slice(openStart, closeIdx + "</div>".length);
  if (!/Get a free (\w+ )?estimate/.test(block)) {
    return { failed: true, reason: "first cta-box isn't the instant-estimate CTA" };
  }

  const newOpen = m[0].replace(
    /<div class="cta-box"/,
    '<aside class="cta-box cta-box-instant" aria-label="Instant estimate CTA"'
  );
  src =
    src.slice(0, openStart) +
    newOpen +
    src.slice(openEnd, closeIdx) +
    "</aside>" +
    src.slice(closeIdx + "</div>".length);

  if (src === before) return { skipped: true, reason: "no change" };
  fs.writeFileSync(full, src);
  return { patched: true };
}

function main() {
  console.log("Phase 4 body-wrap pass — instant-estimate cta-box -> <aside>");
  console.log("-".repeat(80));
  let patchedCount = 0;
  for (const tmpl of TEMPLATES) {
    const r = patchTemplate(tmpl);
    if (r.patched) {
      console.log("OK    " + tmpl);
      patchedCount++;
    } else if (r.skipped) {
      console.log("SKIP  " + tmpl + "  (" + r.reason + ")");
    } else {
      console.log("FAIL  " + tmpl + "  (" + r.reason + ")");
    }
  }
  console.log("-".repeat(80));
  console.log(`${patchedCount}/${TEMPLATES.length} templates updated`);
}

main();
