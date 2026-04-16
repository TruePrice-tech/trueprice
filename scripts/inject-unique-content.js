#!/usr/bin/env node
/**
 * Injects unique long-form paragraph + city-specific FAQs into city cost pages.
 * Uses city-context.json + city-local-facts.json for per-city data.
 * Idempotent: re-running replaces previously injected content.
 *
 * Usage:
 *   node scripts/inject-unique-content.js roof         # roofing pages only
 *   node scripts/inject-unique-content.js all          # all verticals
 *   node scripts/inject-unique-content.js roof --dry   # preview, no writes
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const cityContext = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-context.json"), "utf8"));
const localFacts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/city-local-facts.json"), "utf8"));

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const vertical = args.find((a) => a !== "--dry") || "roof";

const MARKER_START = "<!-- UNIQUE-LOCAL-GUIDE -->";
const MARKER_END = "<!-- /UNIQUE-LOCAL-GUIDE -->";
const FAQ_MARKER_START = "<!-- UNIQUE-FAQ -->";
const FAQ_MARKER_END = "<!-- /UNIQUE-FAQ -->";

function lookupCity(city, state) {
  const key1 = `${city}|${state}`;
  const ctx = cityContext[key1] || null;
  const factsKey = Object.keys(localFacts).find(
    (k) => k.toLowerCase() === `${city}|${state}`.toLowerCase()
  );
  const facts = factsKey ? localFacts[factsKey] : null;
  return { ctx, facts };
}

function parseCityFromFilename(filename, verticalSlug) {
  const base = path.basename(filename, ".html");
  const suffix = `-${verticalSlug}`;
  if (!base.endsWith(suffix)) return null;
  const slug = base.slice(0, -suffix.length);
  const parts = slug.split("-");
  if (parts.length < 2) return null;
  const stateCode = parts.pop().toUpperCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  const cityName = parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  if (!cityName) return null;
  return { city: cityName, state: stateCode };
}

// --- ROOFING TEMPLATES ---

function roofingParagraph(city, state, ctx, facts) {
  const lines = [];

  // Opening by climate
  const climateMap = {
    hot_humid: `Roofing in ${city} means contending with ${state === "TX" ? "Texas" : state}'s combination of intense UV exposure, high humidity, and sudden temperature swings. These conditions accelerate granule loss on standard asphalt shingles and can shorten roof lifespan by 3-5 years compared to milder climates.`,
    hot_dry: `The arid climate around ${city} creates a harsh environment for roofing materials. Sustained UV bombardment and extreme surface temperatures (roof surfaces regularly exceed 160F in summer) degrade standard materials faster than national averages suggest.`,
    cold: `${city}'s cold winters bring unique roofing challenges: ice dams, freeze-thaw cycling, and heavy snow loads all factor into material selection and installation technique. A roof built for mild weather will fail early here.`,
    temperate: `${city}'s moderate four-season climate is relatively forgiving on roofing materials, giving homeowners more flexibility in material choice. That said, local factors like tree coverage, wind exposure, and occasional severe weather still matter.`,
    mixed_humid: `${city} gets the full range of weather stress on a roof: summer heat and humidity, occasional severe storms, and enough cold-weather cycling to test flashing and sealant integrity over time.`,
    mixed_dry: `The semi-arid conditions around ${city} mean UV degradation is the primary roofing concern. Materials that perform well in humid climates may underperform here due to sustained heat and minimal moisture.`,
  };
  lines.push(climateMap[ctx?.climateZone] || climateMap.temperate);

  // Hail
  if (ctx?.hailRisk === "high") {
    lines.push(
      `${city} sits in an active hail corridor. Homeowners here should seriously consider Class 4 impact-resistant shingles, which can reduce insurance premiums by 15-25% while providing meaningfully better protection against the severe spring storms this area regularly experiences.`
    );
  } else if (ctx?.hailRisk === "moderate") {
    lines.push(
      `Hail is an occasional but real risk in ${city}. While not as frequent as cities in the central plains, impact-resistant materials are still worth the 10-15% cost premium for homeowners planning to stay in their home for 10+ years.`
    );
  }

  // Hurricane
  if (ctx?.hurricaneZone) {
    lines.push(
      `As a hurricane-exposure area, ${city} has specific building code requirements for wind uplift resistance. Roofing contractors here must install to higher wind-rated standards, which adds roughly 5-10% to material and labor costs compared to inland cities.`
    );
  }

  // Home age
  if (ctx?.avgHomeAge) {
    const age = ctx.avgHomeAge;
    if (age > 40) {
      lines.push(
        `With an average home age of ${age} years, many ${city} roofs are on their second or third replacement. Older homes frequently need decking repairs, upgraded ventilation to current code, and sometimes structural reinforcement before new roofing goes on. Budget an additional 10-20% contingency for homes built before 1985.`
      );
    } else if (age > 25) {
      lines.push(
        `The average home in ${city} is about ${age} years old, meaning many original roofs are approaching or past their expected lifespan. First-time replacements on homes this age typically reveal minor decking issues and outdated ventilation that should be addressed during the reroof rather than deferred.`
      );
    } else {
      lines.push(
        `${city}'s housing stock is relatively new (average age ${age} years), so most roof replacements here are storm-damage-driven rather than age-related. The good news: newer construction typically has modern decking and ventilation already in place, which simplifies the replacement scope and keeps costs closer to the lower end of the range.`
      );
    }
  }

  // Local facts: soil / geography
  if (facts?.soil) {
    lines.push(
      `One factor often overlooked in ${city}: ${facts.soil}. This can affect not just foundation work but also how roof loads distribute and whether additional structural evaluation is warranted before a heavy material like tile or slate is installed.`
    );
  }

  // Permits
  if (facts?.permits) {
    lines.push(
      `On the permitting side, ${facts.permits}. Always confirm your contractor is pulling the permit themselves rather than asking you to do it, since the permit holder is legally responsible for code compliance.`
    );
  }

  // Growth rate / contractor market
  if (ctx?.growthRate === "high") {
    lines.push(
      `${city} is a high-growth market, which means contractor availability is tighter and labor costs run higher than similarly sized cities with slower growth. Getting 3 quotes is especially important here since pricing variance between contractors tends to be wider in competitive markets.`
    );
  }

  return lines.join("\n\n");
}

function roofingFAQs(city, state, ctx, facts) {
  const faqs = [];

  // Climate-specific FAQ
  if (ctx?.hailRisk === "high") {
    faqs.push({
      q: `Do I need impact-resistant shingles in ${city}?`,
      a: `They are strongly recommended. ${city} experiences frequent hail events that can damage standard shingles in a single storm. Class 4 impact-resistant shingles cost 10-20% more but qualify for insurance discounts of 15-25% in most ${state} policies, often paying for themselves within 3-5 years. If your current roof was damaged by hail, your insurance claim may cover the upgrade to IR-rated materials at no additional out-of-pocket cost.`,
    });
  } else if (ctx?.hurricaneZone) {
    faqs.push({
      q: `What wind rating do I need for a roof in ${city}?`,
      a: `${city} falls within a hurricane exposure zone, so building code requires roofing materials and installation methods rated for higher wind speeds than inland areas. Most contractors here install to 130+ mph wind ratings using enhanced nailing patterns and high-wind-rated underlayment. Verify your quote specifies the wind rating and ask whether the installation method matches the manufacturer's high-wind warranty requirements.`,
    });
  } else if (ctx?.climateZone === "cold") {
    faqs.push({
      q: `How do I prevent ice dams on my ${city} roof?`,
      a: `Ice dams form when heat escapes through the roof, melting snow that refreezes at the eaves. Prevention starts with proper attic insulation (R-49 or higher for ${city}'s climate zone) and continuous soffit-to-ridge ventilation. Your roofing quote should include ice and water shield membrane on the first 3-6 feet from all eaves. If your current roof has ice dam damage, address the insulation and ventilation before replacing the roof or the problem will recur.`,
    });
  } else {
    faqs.push({
      q: `How long does a roof last in ${city}?`,
      a: `In ${city}'s climate, architectural asphalt shingles typically last 20-25 years, standard 3-tab shingles 15-20 years, metal roofing 40-60 years, and tile 50+ years. These estimates assume proper ventilation and no major storm damage. UV exposure is the primary degradation factor here, so lighter-colored materials and adequate attic ventilation both extend lifespan meaningfully.`,
    });
  }

  // Permit FAQ
  faqs.push({
    q: `Do I need a permit to replace my roof in ${city}?`,
    a: facts?.permits
      ? `Yes. ${facts.permits} A reputable contractor handles the permit process as part of the job. If a contractor suggests skipping the permit or asks you to pull it yourself, that is a red flag. Unpermitted work can void your homeowners insurance, create problems when selling, and leave you liable if the installation does not meet code.`
      : `In most jurisdictions including ${city}, a building permit is required for a full roof replacement. Your contractor should pull the permit before work begins. Unpermitted roofing work can void your homeowners insurance coverage and create disclosure issues when selling the home.`,
  });

  // Timing FAQ
  const seasonMap = {
    hot_humid: { best: "late fall or early winter", why: "after hurricane season passes and before spring storm demand begins" },
    hot_dry: { best: "fall or early spring", why: "summer surface temperatures make installation difficult and can affect adhesive curing" },
    cold: { best: "late spring or early fall", why: "materials install best above 45F and before snow season pricing surcharges" },
    temperate: { best: "late summer or early fall", why: "stable weather allows proper curing and contractors are less backlogged than spring" },
    mixed_humid: { best: "early fall", why: "after summer storms subside and before winter weather complicates scheduling" },
    mixed_dry: { best: "spring or fall", why: "moderate temperatures allow proper material adhesion and curing" },
  };
  const season = seasonMap[ctx?.climateZone] || seasonMap.temperate;
  faqs.push({
    q: `When is the best time to replace a roof in ${city}?`,
    a: `The optimal window for roof replacement in ${city} is ${season.best}, ${season.why}. Scheduling during off-peak periods can save 10-15% on labor costs since contractors have more availability and may offer competitive pricing to fill their calendar. Avoid scheduling immediately after a major storm event when contractor demand (and prices) spike.`,
  });

  return faqs;
}

// --- VERTICAL CONFIG ---

const VERTICALS = {
  roof: {
    slugSuffix: "roof-cost",
    sectionTitle: "Local Roofing Guide",
    genParagraph: roofingParagraph,
    genFAQs: roofingFAQs,
  },
};

function buildHTML(title, paragraph, faqs, city) {
  let html = `\n${MARKER_START}\n`;
  html += `<section class="section">\n`;
  html += `<h2>${title} for ${city}</h2>\n`;
  html += paragraph
    .split("\n\n")
    .map((p) => `<p>${p}</p>`)
    .join("\n");
  html += `\n</section>\n`;
  html += `${MARKER_END}\n`;
  return html;
}

function buildFAQHTML(faqs) {
  let html = `${FAQ_MARKER_START}\n`;
  for (const { q, a } of faqs) {
    html += `<details class="faq-item">\n`;
    html += `<summary>${q}</summary>\n`;
    html += `<div class="faq-answer"><p>${a}</p></div>\n`;
    html += `</details>\n`;
  }
  html += `${FAQ_MARKER_END}\n`;
  return html;
}

function buildFAQSchema(faqs) {
  return faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  }));
}

function injectIntoFile(filepath, vertConfig) {
  const parsed = parseCityFromFilename(filepath, vertConfig.slugSuffix);
  if (!parsed) return null;
  const { city, state } = parsed;
  const { ctx, facts } = lookupCity(city, state);
  if (!ctx) return null;

  const paragraph = vertConfig.genParagraph(city, state, ctx, facts);
  const faqs = vertConfig.genFAQs(city, state, ctx, facts);

  let content = fs.readFileSync(filepath, "utf8");

  // Remove old injected content if present (idempotent)
  const markerRe = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, "g");
  content = content.replace(markerRe, "");
  const faqMarkerRe = new RegExp(`${FAQ_MARKER_START}[\\s\\S]*?${FAQ_MARKER_END}\\n?`, "g");
  content = content.replace(faqMarkerRe, "");

  // Inject unique paragraph after local context cards section (before section 6)
  const section6Match = content.indexOf("<!-- 6.");
  if (section6Match >= 0) {
    const sectionEndBefore = content.lastIndexOf("</section>", section6Match);
    if (sectionEndBefore >= 0) {
      const insertAt = sectionEndBefore + "</section>".length;
      const nl = content.includes("\r\n") ? "\r\n" : "\n";
      const newSection = buildHTML(vertConfig.sectionTitle, paragraph, faqs, `${city}, ${state}`).replace(/\n/g, nl);
      content = content.slice(0, insertAt) + nl + newSection + content.slice(insertAt);
    }
  }

  // Inject unique FAQs before the closing </div></section> of FAQ section
  const faqSectionComment = "<!-- 13. FAQ -->";
  const faqSectionIdx = content.indexOf(faqSectionComment);
  if (faqSectionIdx >= 0) {
    const closingTag = "</div>\r\n</section>";
    const closingTagAlt = "</div>\n</section>";
    let faqEndIdx = content.indexOf(closingTag, faqSectionIdx);
    if (faqEndIdx < 0) faqEndIdx = content.indexOf(closingTagAlt, faqSectionIdx);
    if (faqEndIdx >= 0) {
      const nl = content.includes("\r\n") ? "\r\n" : "\n";
      const faqHTML = buildFAQHTML(faqs).replace(/\n/g, nl);
      content = content.slice(0, faqEndIdx) + faqHTML + content.slice(faqEndIdx);
    }
  }

  // Update FAQPage schema to include new questions
  const faqSchemaEntries = buildFAQSchema(faqs);
  const faqSchemaRe = /"@type":"FAQPage","mainEntity":\[/;
  if (faqSchemaRe.test(content)) {
    const newEntries = faqSchemaEntries.map((e) => JSON.stringify(e)).join(",");
    content = content.replace(faqSchemaRe, `"@type":"FAQPage","mainEntity":[${newEntries},`);
  }

  if (!DRY) {
    fs.writeFileSync(filepath, content, "utf8");
  }
  return { city, state, paragraphLen: paragraph.length, faqCount: faqs.length };
}

function main() {
  const vertConfig = VERTICALS[vertical];
  if (!vertConfig && vertical !== "all") {
    console.error(`Unknown vertical: ${vertical}. Available: ${Object.keys(VERTICALS).join(", ")}, all`);
    process.exit(1);
  }

  const verts = vertical === "all" ? Object.keys(VERTICALS) : [vertical];

  for (const v of verts) {
    const config = VERTICALS[v];
    const pattern = `*-${config.slugSuffix}.html`;
    const glob = require("path");
    const files = fs.readdirSync(ROOT).filter((f) => f.endsWith(`-${config.slugSuffix}.html`));
    console.log(`\n${v}: found ${files.length} city pages`);

    let injected = 0;
    let skipped = 0;
    for (const f of files) {
      const result = injectIntoFile(path.join(ROOT, f), config);
      if (result) {
        injected++;
        if (injected <= 3) {
          console.log(`  ${result.city}, ${result.state}: ${result.paragraphLen} chars paragraph, ${result.faqCount} FAQs`);
        }
      } else {
        skipped++;
      }
    }
    console.log(`  ${injected} injected, ${skipped} skipped (no city data match)`);
    if (DRY) console.log("  [DRY RUN: no files written]");
  }
}

main();
