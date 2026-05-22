#!/usr/bin/env node
/**
 * Phase 3 patcher — applies city-aware FAQ generation to the 13 remaining
 * Tier B vertical builders + templates in one pass. Idempotent.
 *
 * For each vertical it:
 *   1. Inserts faq-helpers imports + per-vertical getCtx loader into
 *      scripts/build-<vertical>-pages.js (after the city-nav-widget import).
 *   2. Inserts a build<Vertical>FAQ() function using the shared helpers.
 *   3. Wires the {{<VERTICAL>_FAQ_BLOCK}} placeholder into the
 *      .replaceAll() chain (inserted before the first existing replaceAll
 *      so positioning doesn't matter).
 *   4. Replaces the 3-FAQ hardcoded block in
 *      templates/<vertical>-city-page-template.html with the placeholder.
 *
 * Per-vertical config (Q3 slot pick, display labels, multiplier key) is
 * encoded below — selected against scripts/_check-all-slots-output.json
 * to use the slot with strongest normalized-template signal per vertical.
 *
 * The seasonal FAQ (Q4 in the gap-list) is DROPPED for every vertical:
 * the `seasonNote` slot is 2-template across the corpus, fabricating
 * per-city specificity from it would manufacture false signal (HARD-RULE).
 */

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

// Per-vertical patcher config.
//   v               canonical vertical name
//   builder         path under scripts/
//   template        path under templates/
//   ctxFile         path under data/  (per-vertical context)
//   placeholder     {{<X>_FAQ_BLOCK}} token in template
//   varName         JS variable name for the cached context dict
//   ctxFn           JS function name for the loader
//   buildFn         JS function name for the FAQ builder
//   multKey         key under serviceMultipliers in city-cost-multipliers.json
//   productLabel    Q1 prefix (e.g. "An HVAC system", "A plumbing project")
//   displayLabel    Q2 framing (e.g. "HVAC installation")
//   workLabel       work noun phrase for Q1/Q4 (lowercased) — unused here
//   productKindQ3   Q3 question wording (e.g. "HVAC system", "siding material")
//   contractorLabel Q5 contractor noun ("plumber", "electrician", "kitchen contractor")
//   q3Slot          per-vertical context field name with best Q3 signal
//   q3UsesLeadIn    true if Q3 answer benefits from climate-zone lead-in
//                   (false when the slot itself already names the climate)
const VERTICALS = [
  {
    v: "hvac", builder: "build-hvac-pages.js", template: "hvac-city-page-template.html",
    ctxFile: "data/hvac-city-context.json", placeholder: "HVAC_FAQ_BLOCK",
    varName: "_hvacFAQContext", ctxFn: "getHvacFAQContext", buildFn: "buildHvacFAQ",
    multKey: "hvac",
    productLabel: "An HVAC system", displayLabel: "HVAC installation",
    productKindQ3: "HVAC system", contractorLabel: "HVAC contractor",
    q3Slot: "systemTip", q3UsesLeadIn: false,
  },
  {
    v: "plumbing", builder: "build-plumbing-pages.js", template: "plumbing-city-page-template.html",
    ctxFile: "data/plumbing-city-context.json", placeholder: "PLUMBING_FAQ_BLOCK",
    varName: "_plumbingFAQContext", ctxFn: "getPlumbingFAQContext", buildFn: "buildPlumbingFAQ",
    multKey: "plumbing",
    productLabel: "Plumbing work", displayLabel: "Plumbing work",
    productKindQ3: "approach to local water conditions", contractorLabel: "plumber",
    q3Slot: "waterNote", q3UsesLeadIn: false,
  },
  {
    v: "electrical", builder: "build-electrical-pages.js", template: "electrical-city-page-template.html",
    ctxFile: "data/electrical-city-context.json", placeholder: "ELECTRICAL_FAQ_BLOCK",
    varName: "_electricalFAQContext", ctxFn: "getElectricalFAQContext", buildFn: "buildElectricalFAQ",
    multKey: "electrical",
    productLabel: "Electrical work", displayLabel: "Electrical work",
    productKindQ3: "electrical service strategy", contractorLabel: "electrician",
    q3Slot: "climateNote", q3UsesLeadIn: false,
  },
  {
    v: "solar", builder: "build-solar-pages.js", template: "solar-city-page-template.html",
    ctxFile: "data/solar-city-context.json", placeholder: "SOLAR_FAQ_BLOCK",
    varName: "_solarFAQContext", ctxFn: "getSolarFAQContext", buildFn: "buildSolarFAQ",
    multKey: "solar",
    productLabel: "A solar installation", displayLabel: "Solar installation",
    productKindQ3: "solar system size and configuration", contractorLabel: "solar installer",
    q3Slot: "materialTip", q3UsesLeadIn: false,
  },
  {
    v: "kitchen", builder: "build-kitchen-pages.js", template: "kitchen-city-page-template.html",
    ctxFile: "data/kitchen-remodel-city-context.json", placeholder: "KITCHEN_FAQ_BLOCK",
    varName: "_kitchenFAQContext", ctxFn: "getKitchenFAQContext", buildFn: "buildKitchenFAQ",
    multKey: "kitchen",
    productLabel: "A kitchen remodel", displayLabel: "Kitchen remodel",
    productKindQ3: "kitchen-remodel scope", contractorLabel: "kitchen contractor",
    q3Slot: "materialTip", q3UsesLeadIn: true,
  },
  {
    v: "window", builder: "build-window-pages.js", template: "window-city-page-template.html",
    ctxFile: "data/window-city-context.json", placeholder: "WINDOW_FAQ_BLOCK",
    varName: "_windowFAQContext", ctxFn: "getWindowFAQContext", buildFn: "buildWindowFAQ",
    multKey: "window",
    productLabel: "Window replacement", displayLabel: "Window replacement",
    productKindQ3: "window type", contractorLabel: "window installer",
    q3Slot: "climateNote", q3UsesLeadIn: false,
  },
  {
    v: "siding", builder: "build-siding-pages.js", template: "siding-city-page-template.html",
    ctxFile: "data/siding-city-context.json", placeholder: "SIDING_FAQ_BLOCK",
    varName: "_sidingFAQContext", ctxFn: "getSidingFAQContext", buildFn: "buildSidingFAQ",
    multKey: "siding",
    productLabel: "Siding replacement", displayLabel: "Siding replacement",
    productKindQ3: "siding material", contractorLabel: "siding contractor",
    q3Slot: "materialTip", q3UsesLeadIn: true,
  },
  {
    v: "painting", builder: "build-painting-pages.js", template: "painting-city-page-template.html",
    ctxFile: "data/painting-city-context.json", placeholder: "PAINTING_FAQ_BLOCK",
    varName: "_paintingFAQContext", ctxFn: "getPaintingFAQContext", buildFn: "buildPaintingFAQ",
    multKey: "painting",
    productLabel: "Exterior painting", displayLabel: "Exterior painting",
    productKindQ3: "paint type and prep approach", contractorLabel: "painter",
    q3Slot: "climateNote", q3UsesLeadIn: false,
  },
  {
    v: "fence", builder: "build-fencing-pages.js", template: "fencing-city-page-template.html",
    ctxFile: "data/fence-city-context.json", placeholder: "FENCE_FAQ_BLOCK",
    varName: "_fenceFAQContext", ctxFn: "getFenceFAQContext", buildFn: "buildFenceFAQ",
    multKey: "fencing",
    productLabel: "Fence installation", displayLabel: "Fence installation",
    productKindQ3: "fence material",
    contractorLabel: "fence contractor",
    q3Slot: "climateNote", q3UsesLeadIn: false,
  },
  {
    v: "concrete", builder: "build-concrete-pages.js", template: "concrete-city-page-template.html",
    ctxFile: "data/concrete-city-context.json", placeholder: "CONCRETE_FAQ_BLOCK",
    varName: "_concreteFAQContext", ctxFn: "getConcreteFAQContext", buildFn: "buildConcreteFAQ",
    multKey: "concrete",
    productLabel: "Concrete work", displayLabel: "Concrete work",
    productKindQ3: "concrete mix and prep", contractorLabel: "concrete contractor",
    q3Slot: "materialTip", q3UsesLeadIn: true,
  },
  {
    v: "landscaping", builder: "build-landscaping-pages.js", template: "landscaping-city-page-template.html",
    ctxFile: "data/landscaping-city-context.json", placeholder: "LANDSCAPING_FAQ_BLOCK",
    varName: "_landscapingFAQContext", ctxFn: "getLandscapingFAQContext", buildFn: "buildLandscapingFAQ",
    multKey: "landscaping",
    productLabel: "Landscaping work", displayLabel: "Landscaping work",
    productKindQ3: "plant and hardscape plan", contractorLabel: "landscaper",
    q3Slot: "materialTip", q3UsesLeadIn: true,
  },
  {
    v: "foundation", builder: "build-foundation-pages.js", template: "foundation-city-page-template.html",
    ctxFile: "data/foundation-city-context.json", placeholder: "FOUNDATION_FAQ_BLOCK",
    varName: "_foundationFAQContext", ctxFn: "getFoundationFAQContext", buildFn: "buildFoundationFAQ",
    multKey: "foundation",
    productLabel: "Foundation repair", displayLabel: "Foundation repair",
    productKindQ3: "foundation repair method", contractorLabel: "foundation contractor",
    q3Slot: "materialTip", q3UsesLeadIn: true,
  },
  {
    v: "insulation", builder: "build-insulation-pages.js", template: "insulation-city-page-template.html",
    ctxFile: "data/insulation-city-context.json", placeholder: "INSULATION_FAQ_BLOCK",
    varName: "_insulationFAQContext", ctxFn: "getInsulationFAQContext", buildFn: "buildInsulationFAQ",
    multKey: "insulation",
    productLabel: "Insulation upgrades", displayLabel: "Insulation upgrades",
    productKindQ3: "insulation type and R-value",
    contractorLabel: "insulation contractor",
    q3Slot: "materialTip", q3UsesLeadIn: true,
  },
];

function buildBuilderInsertion(cfg) {
  return `\nconst {
  getSharedCityContext,
  naturalCostFraming,
  climateZoneLeadIn,
  faqCostInCity,
  faqWhyCostDiffers,
  faqBestForCity,
  faqRedFlags,
} = require("./lib/faq-helpers");

const CITY_FAQ_CONTEXT_PATH = path.join(ROOT, "${cfg.ctxFile}");
let ${cfg.varName} = null;
function ${cfg.ctxFn}(city, stateCode) {
  if (!${cfg.varName}) {
    try { ${cfg.varName} = JSON.parse(fs.readFileSync(CITY_FAQ_CONTEXT_PATH, "utf8")); }
    catch (e) { ${cfg.varName} = {}; }
  }
  return ${cfg.varName}[\`\${city}|\${stateCode}\`] || null;
}

// Phase 3 city-aware FAQ block (with Phase 4 Q-stem variation). Replaces
// the 3 hardcoded <details> blocks that previously appeared identically
// across ~740 city pages with 4 FAQs that interpolate per-city slot data
// from data/${cfg.ctxFile.split("/").pop()} AND vary the Q3/Q5 question
// wording by climate-zone + hoaPrevalence + growthRate so per-page Q
// stems stop normalizing to a single hash across the corpus.
//
// The seasonal FAQ from the Phase 1 gap-list is intentionally dropped:
// seasonNote slot has only 2-3 normalized templates across the corpus, so
// forcing the question would manufacture false per-city specificity.
function ${cfg.buildFn}({ city, stateCode, multiplier, priceRange }) {
  const ctx = ${cfg.ctxFn}(city, stateCode) || {};
  const shared = getSharedCityContext(city, stateCode) || {};
  const framing = naturalCostFraming(multiplier);

  const q1 = faqCostInCity({
    workLabel: ${JSON.stringify(cfg.displayLabel.toLowerCase())},
    productLabel: ${JSON.stringify(cfg.productLabel)},
    city,
    priceRange,
    framing,
    weatherNote: ctx.climateNote || ctx.waterNote,
    costDriverNote: ctx.costDriverNote,
  });

  const q2 = faqWhyCostDiffers({
    vertical: ${JSON.stringify(cfg.v)},
    displayLabel: ${JSON.stringify(cfg.displayLabel)},
    city,
    framing,
    costDriverNote: ctx.costDriverNote,
  });

  const q3 = faqBestForCity({
    city,
    productKindLabel: ${JSON.stringify(cfg.productKindQ3)},
    materialOrSystemNote: ctx.${cfg.q3Slot},
    climateLeadIn: ${cfg.q3UsesLeadIn} ? climateZoneLeadIn((shared.climateZone || ""), city) : null,
    climateZone: shared.climateZone,
  });

  const q5 = faqRedFlags({
    city,
    contractorLabel: ${JSON.stringify(cfg.contractorLabel)},
    redFlagNote: ctx.redFlagNote,
    hoaPrevalence: shared.hoaPrevalence,
    growthRate: shared.growthRate,
  });

  return [q1, q2, q3, q5].join("\\n\\n");
}
`;
}

function patchBuilder(cfg) {
  const builderPath = path.join(ROOT, "scripts", cfg.builder);
  let src = fs.readFileSync(builderPath, "utf8");
  const force = process.argv.includes("--force");

  // Idempotence: skip if already patched, unless --force is set
  if (src.includes(cfg.buildFn) && !force) {
    return { skipped: true, reason: "already patched (use --force to re-patch)" };
  }

  // Strip prior insertion when --force, then fall through to normal
  // re-insertion. Three separate strip steps to avoid removing the
  // surrounding code (esp. the `let html = template\n  .replaceAll` chain
  // that lives between the two insertion sites).
  if (force && src.includes(cfg.buildFn)) {
    // 1) Strip the imports + loader + buildFn function block. Anchored at
    //    `\nconst {\n  getSharedCityContext,` OR `\nconst {\n  naturalCostFraming,`
    //    (the first identifier inserted), ending at the closing `}\n` of
    //    the buildFn function (`return [...].join("\\n\\n");\n}`).
    const startRe = /\nconst \{\s*\n\s*(getSharedCityContext|naturalCostFraming),/;
    const startMatch = startRe.exec(src);
    if (startMatch) {
      const fnCloseRe = /return \[q1, q2, q3, q5\]\.join\("\\n\\n"\);\s*\n\}\n/;
      const closeMatch = fnCloseRe.exec(src.slice(startMatch.index));
      if (closeMatch) {
        const endIdx = startMatch.index + closeMatch.index + closeMatch[0].length;
        src = src.slice(0, startMatch.index) + src.slice(endIdx);
      }
    }

    // 2) Strip ONLY the __faqServiceMult/__faqBlockHtml setup block
    //    (3-7 lines starting `const __faqServiceMult =`, ending at the
    //    `});` that closes the buildFn() call). Stops BEFORE the
    //    `let html = template` chain.
    const wireSetupRe =
      /\n\s+const __faqServiceMult =[\s\S]*?\n\s+\}\);\n/;
    const wireSetup = wireSetupRe.exec(src);
    if (wireSetup) {
      src =
        src.slice(0, wireSetup.index) +
        src.slice(wireSetup.index + wireSetup[0].length);
    }

    // 3) Strip ONLY the inserted `.replaceAll("{{<placeholder>}}", __faqBlockHtml)`
    //    line from inside the chain. Single-line removal.
    const placeholderLineRe = new RegExp(
      "\\n\\s+\\.replaceAll\\(\"\\{\\{" + cfg.placeholder + "\\}\\}\", __faqBlockHtml\\)"
    );
    src = src.replace(placeholderLineRe, "");

    fs.writeFileSync(builderPath, src);
  }

  // 1) Insert imports + helpers BEFORE `function main()`. That gives the
  //    insertion access to ROOT + helper functions like readJson() which
  //    are declared after the require() block but before main(). Inserting
  //    just-after the city-nav-widget require() would put us before ROOT.
  const mainAnchor = "function main()";
  if (!src.includes(mainAnchor)) {
    return { failed: true, reason: "no `function main()` declaration to anchor on" };
  }
  src = src.replace(mainAnchor, buildBuilderInsertion(cfg) + "\n" + mainAnchor);

  // 2) Wire the placeholder into the .replaceAll chain. Insert AFTER the
  //    `let html = template` line and BEFORE the first .replaceAll call.
  const replaceAllAnchor = src.match(/(\s+let html = template\s*)(\n\s+\.replaceAll)/);
  if (!replaceAllAnchor) {
    return { failed: true, reason: "no `let html = template\\n  .replaceAll` chain found" };
  }
  const faqWiring = `
    const __faqServiceMult =
      cityMultipliers[cityKey] && cityMultipliers[cityKey].serviceMultipliers
        ? cityMultipliers[cityKey].serviceMultipliers[${JSON.stringify(cfg.multKey)}]
        : cityMult;
    const __faqBlockHtml = ${cfg.buildFn}({
      city: cityName,
      stateCode,
      multiplier: __faqServiceMult,
      priceRange: \`\${avgLow} to \${avgHigh}\`,
    });
`;
  src = src.replace(
    replaceAllAnchor[0],
    `${faqWiring}${replaceAllAnchor[1]}${replaceAllAnchor[2]}`
  );

  // 3) Tail-append the placeholder .replaceAll after the chain. Find the
  //    last `.replaceAll("{{<...>}}", ...)` in the chain ending with a `;`
  //    and append our line immediately before the `;`.
  // Strategy: find the chain's terminator — the first `;` after the
  //    inserted block. Insert our line just before that `;`.
  const idx = src.indexOf(replaceAllAnchor[0]) + replaceAllAnchor[0].length;
  const semiIdx = src.indexOf(";", idx);
  if (semiIdx < 0) return { failed: true, reason: "couldn't find replaceAll terminator" };
  src = src.slice(0, semiIdx) +
    `\n      .replaceAll("{{${cfg.placeholder}}}", __faqBlockHtml)` +
    src.slice(semiIdx);

  fs.writeFileSync(builderPath, src);
  return { patched: true };
}

function patchTemplate(cfg) {
  const tmplPath = path.join(ROOT, "templates", cfg.template);
  let src = fs.readFileSync(tmplPath, "utf8");

  if (src.includes(`{{${cfg.placeholder}}}`)) {
    return { skipped: true, reason: "already patched" };
  }

  // Match all <details class="faq-item">…</details> blocks in the file and
  // replace the run of them with the single placeholder. The blocks are
  // contiguous (separated only by whitespace) inside the
  // <div class="faq-list"> wrapper.
  const re = /<details class="faq-item">[\s\S]*?<\/details>(\s*<details class="faq-item">[\s\S]*?<\/details>)*/;
  const m = re.exec(src);
  if (!m) {
    return { failed: true, reason: "no <details class=\"faq-item\"> blocks found" };
  }
  src = src.replace(m[0], `{{${cfg.placeholder}}}`);

  fs.writeFileSync(tmplPath, src);
  return { patched: true };
}

function main() {
  const dry = process.argv.includes("--dry");
  console.log("VERTICAL".padEnd(14) + " | BUILDER".padEnd(28) + " | TEMPLATE");
  console.log("-".repeat(80));
  for (const cfg of VERTICALS) {
    const builderResult = dry ? { skipped: true, reason: "dry-run" } : patchBuilder(cfg);
    const templateResult = dry ? { skipped: true, reason: "dry-run" } : patchTemplate(cfg);
    console.log(
      cfg.v.padEnd(14) + " | " +
      (builderResult.patched ? "patched" : builderResult.skipped ? "skip (" + builderResult.reason + ")" : "FAILED (" + builderResult.reason + ")").padEnd(26) + " | " +
      (templateResult.patched ? "patched" : templateResult.skipped ? "skip (" + templateResult.reason + ")" : "FAILED (" + templateResult.reason + ")")
    );
  }
}

main();
