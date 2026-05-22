#!/usr/bin/env node
/**
 * In-place updater for the 13 already-patched Tier B builders. Adds the
 * Q-stem variation (Phase 4 follow-up) without re-running the full
 * `_phase3-tier-b-patcher.js` strip-and-reinsert, which proved fragile
 * (silent strip failure left duplicated blocks).
 *
 * Applies 4 targeted text replacements per builder:
 *   1. Add `getSharedCityContext,` to the faq-helpers import list.
 *   2. Add `const shared = getSharedCityContext(city, stateCode) || {};`
 *      after the existing `const ctx = …` line.
 *   3. Update faqBestForCity({ … climateLeadIn: <bool> ? climateZoneLeadIn(
 *      (ctx.climateZone || …), city) : null, }) to use `shared.climateZone`
 *      and add `climateZone: shared.climateZone,`.
 *   4. Add `hoaPrevalence: shared.hoaPrevalence,` + `growthRate: shared.growthRate,`
 *      to the faqRedFlags({ … redFlagNote: ctx.redFlagNote, }) call.
 *
 * Idempotent: re-runs are no-ops if `getSharedCityContext` is already imported.
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const BUILDERS = [
  "build-hvac-pages.js",
  "build-plumbing-pages.js",
  "build-electrical-pages.js",
  "build-solar-pages.js",
  "build-kitchen-pages.js",
  "build-window-pages.js",
  "build-siding-pages.js",
  "build-painting-pages.js",
  "build-fencing-pages.js",
  "build-concrete-pages.js",
  "build-landscaping-pages.js",
  "build-foundation-pages.js",
  "build-insulation-pages.js",
];

function patchBuilder(file) {
  const full = path.join(ROOT, "scripts", file);
  let src = fs.readFileSync(full, "utf8");
  const before = src;
  const ops = [];

  // 1) Add getSharedCityContext to faq-helpers import. CRLF-tolerant.
  if (!src.includes("getSharedCityContext,")) {
    const m = src.match(/const \{\s*\r?\n\s*naturalCostFraming,/);
    if (m) {
      src = src.replace(m[0], "const {\n  getSharedCityContext,\n  naturalCostFraming,");
      ops.push("import");
    }
  }

  // 2) Add shared-context lookup after `const ctx = <ctxFn>(city, stateCode) || {};`.
  if (!src.includes("const shared = getSharedCityContext")) {
    const m = src.match(/const ctx = \w+\(city, stateCode\) \|\| \{\};\r?\n/);
    if (m) {
      src = src.replace(
        m[0],
        m[0] + "  const shared = getSharedCityContext(city, stateCode) || {};\n"
      );
      ops.push("shared-ctx");
    }
  }

  // 3) faqBestForCity: switch ctx.climateZone -> shared.climateZone AND
  //    add `climateZone: shared.climateZone,` line.
  if (!src.includes("climateZone: shared.climateZone,")) {
    const m = src.match(
      /climateLeadIn: (?:true|false) \? climateZoneLeadIn\(\(ctx\.climateZone \|\| ""\), city\) : null,/
    );
    if (m) {
      const replacement =
        m[0].replace("ctx.climateZone", "shared.climateZone") +
        "\n    climateZone: shared.climateZone,";
      src = src.replace(m[0], replacement);
      ops.push("q3-climate");
    }
  }

  // 4) Add hoaPrevalence + growthRate to faqRedFlags call.
  if (!src.includes("hoaPrevalence: shared.hoaPrevalence,")) {
    const m = src.match(/redFlagNote: ctx\.redFlagNote,\r?\n(\s+)\}\);/);
    if (m) {
      const indent = m[1];
      const replacement =
        `redFlagNote: ctx.redFlagNote,\n${indent}hoaPrevalence: shared.hoaPrevalence,\n${indent}growthRate: shared.growthRate,\n${indent}});`;
      src = src.replace(m[0], replacement);
      ops.push("q5-hoa");
    }
  }

  if (src === before) {
    return { skipped: true };
  }
  fs.writeFileSync(full, src);
  return { patched: true, ops };
}

function main() {
  console.log("Phase 4 Q-stem update on 13 Tier B builders:");
  console.log("-".repeat(72));
  for (const f of BUILDERS) {
    const r = patchBuilder(f);
    if (r.skipped) console.log("SKIP  " + f + " (already updated)");
    else console.log("OK    " + f + "  [" + r.ops.join(", ") + "]");
  }
}
main();
