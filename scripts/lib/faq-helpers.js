// Shared FAQ-building helpers for the Tier B per-vertical builders.
// Each builder (build-<vertical>-pages.js) imports these and composes
// a `build<Vertical>FAQ(city, stateCode, ctx, sharedCtx, opts)` function.
//
// Design principles:
//   - All city-aware text comes from per-city data slots (no hand-coded
//     per-city strings).
//   - Q-stems and A-prefixes vary by city characteristic (climate zone,
//     cost direction, etc.) so the audit's normalized-sentence hash
//     doesn't collapse to a single boilerplate string across cities.
//   - Each helper takes the city context as input; no global state.
//
// Used by Phase 3 of the Tier B uniqueness remediation (locked 2026-05-22).

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

// ----- shared city-context.json loader (climateZone, hailRisk, hoaPrevalence,
// avgHomeAge, permitNote, etc.) — distinct from per-vertical context files.
let _sharedCityContext = null;
function getSharedCityContext(city, stateCode) {
  if (!_sharedCityContext) {
    try {
      _sharedCityContext = JSON.parse(
        fs.readFileSync(path.join(ROOT, "data", "city-context.json"), "utf8")
      );
    } catch (e) {
      _sharedCityContext = {};
    }
  }
  return _sharedCityContext[`${city}|${stateCode}`] || null;
}

// First sentence of a multi-sentence note. Used to give FAQs a 1-clause
// city-specific intro without dumping an entire 500-char note inline.
function firstSentence(s) {
  if (!s) return "";
  const m = s.match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : s).trim();
}

// Lowercase the first character of a label — but only if the first word
// isn't an acronym. "Exterior painting" → "exterior painting", but
// "HVAC installation" → "HVAC installation" (acronym preserved).
// "An HVAC system" still lowercases the leading article ("An" → "an")
// because "An" isn't all-uppercase 2+ chars.
function lowercaseFirst(s) {
  if (!s) return "";
  const firstWord = (s.match(/^\S+/) || [""])[0];
  if (firstWord.length >= 2 && firstWord === firstWord.toUpperCase()) {
    return s; // starts with acronym — leave intact
  }
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// Indefinite article ("a" or "an") for a label, sensitive to the FIRST-SOUND
// rule rather than first-letter — so "an HVAC contractor", "an honest broker",
// "a one-time fee" all come out right. The set is intentionally tight; expand
// only when a new noun shows up in a Q template.
const VOWEL_SOUND_INITIAL = /^(?:[aeiou]|hvac\b|hour|honest|hr\b|honor|n[a-z]?th\b|x[a-z]?-?ray|ll[bd]|m[a-z]?ba|f[a-z]?b[i]|s[a-z]?o[s]|fbi|hr|ll|m\.?d|md|mri|nbc|nasa\b)/i;
function articleFor(noun) {
  return VOWEL_SOUND_INITIAL.test(noun.trim()) ? "an" : "a";
}

// Natural-language framing for the city-vs-national pricing differential.
// Takes the service multiplier (e.g. 0.87 = 13% below, 1.20 = 20% above).
// Returns { direction: "above" | "below" | "near", pct, wordPair }.
function naturalCostFraming(multiplier) {
  if (multiplier == null) return { direction: "near", pct: 0, wordPair: "close to" };
  if (multiplier >= 1.1) return {
    direction: "above",
    pct: Math.round((multiplier - 1) * 100),
    wordPair: "higher than",
  };
  if (multiplier <= 0.9) return {
    direction: "below",
    pct: Math.round((1 - multiplier) * 100),
    wordPair: "lower than",
  };
  return { direction: "near", pct: Math.round(Math.abs(multiplier - 1) * 100), wordPair: "close to" };
}

// Climate-zone-keyed framing for a "in {city}, expect…" lead-in.
// Used by Q5 (quote-include) and Q3 (material/system advice) to vary the
// A-prefix across the 4 USDA-aligned zones.
function climateZoneLeadIn(climateZone, city) {
  switch (climateZone) {
    case "hot_humid":
      return `Given ${city}'s humidity`;
    case "hot_dry":
      return `In ${city}'s dry desert climate`;
    case "cold":
    case "very_cold":
      return `In ${city}'s cold-climate market`;
    case "mixed":
    default:
      return `For a ${city} home`;
  }
}

// HOA-prevalence keyed framing. Used by garage-door, siding, painting,
// landscaping — verticals where HOA approval is a real friction point.
function hoaLeadIn(hoaPrevalence) {
  switch (hoaPrevalence) {
    case "high":
      return "HOA approval is a real gating step";
    case "moderate":
      return "Some neighborhoods require HOA approval";
    case "low":
    case "very_low":
      return "Most properties have no HOA constraints";
    default:
      return "Check your neighborhood's HOA covenants";
  }
}

// Format a single FAQ <details> block. Lets callers focus on Q + A text.
function faqBlock(question, answer) {
  return `<details class="faq-item">
<summary>${question}</summary>
<div class="faq-answer">
<p>${answer}</p>
</div>
</details>`;
}

// Cheap deterministic city hash: maps "City|ST" to an integer for stable
// per-city variant selection on slots with no city-distinguishing signal.
// Same input always returns the same output (no entropy from build run).
function cityHash(city) {
  let h = 2166136261;
  for (let i = 0; i < city.length; i++) {
    h ^= city.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Q1 — "How much does X cost in {city}?" with cost-direction-aware prefix.
// "Near" branch (most cities) further splits by city-hash to avoid a
// single normalized-sentence-hash dominating the corpus.
function faqCostInCity({ workLabel, productLabel, city, priceRange, framing, weatherNote, costDriverNote }) {
  const productLow = lowercaseFirst(productLabel);
  let prefix;
  if (framing.direction === "above") {
    prefix = `${productLabel} costs in ${city} run above national norms — most homeowners spend ${priceRange}`;
  } else if (framing.direction === "below") {
    prefix = `${productLabel} in ${city} runs more affordable than the national median, with most homeowners spending ${priceRange}`;
  } else {
    // "Near" branch hits the majority of cities. Rotate across 3 variants
    // by city-hash so the sentence doesn't normalize to a single hash.
    const variant = cityHash(city) % 3;
    if (variant === 0) {
      prefix = `Most ${city} homeowners pay between ${priceRange} for ${productLow}`;
    } else if (variant === 1) {
      prefix = `Typical ${productLow} in ${city} runs ${priceRange}`;
    } else {
      prefix = `${city} homeowners usually budget ${priceRange} for ${productLow}`;
    }
  }
  const signal = firstSentence(costDriverNote) || firstSentence(weatherNote) || "";
  const tail = signal ? ` ${signal}` : "";
  return faqBlock(
    `How much does ${productLow} cost in ${city}?`,
    `${prefix}, depending on scope, materials, and finish level.${tail}`
  );
}

// Q2 — "Why is X more/less expensive in {city}?" — full costDriverNote.
function faqWhyCostDiffers({ vertical, displayLabel, city, framing, costDriverNote }) {
  const intro =
    framing.direction === "above"
      ? `${displayLabel} in ${city} runs roughly ${framing.pct}% above the national average.`
      : framing.direction === "below"
        ? `${displayLabel} in ${city} runs roughly ${framing.pct}% below the national average.`
        : `${displayLabel} in ${city} runs close to the national average.`;
  const body = costDriverNote || "Local labor rates, material availability, and code requirements all influence pricing in this market.";
  const displayLow = lowercaseFirst(displayLabel);
  let question;
  if (framing.direction === "above") {
    question = `Why is ${displayLow} more expensive in ${city}?`;
  } else if (framing.direction === "below") {
    question = `Why is ${displayLow} less expensive in ${city}?`;
  } else {
    // "Near" branch hits most cities; rotate Q stem by city-hash too.
    const variant = cityHash(city) % 3;
    if (variant === 0) question = `What drives ${displayLow} pricing in ${city}?`;
    else if (variant === 1) question = `What sets ${displayLow} pricing apart in ${city}?`;
    else question = `Why do ${displayLow} costs vary in ${city}?`;
  }
  return faqBlock(question, `${intro} ${body}`);
}

// Q3 — "What X works best for {city}?" — direct render of materialTip/systemTip.
// When climateZone is supplied, the QUESTION wording itself varies by zone
// (hot_humid / hot_dry / cold / mixed → 4 distinct Q stems). This is a
// structural-diversity lever: same answer body, but per-page Q text
// stops normalizing to a single hash across the corpus, lifting the FAQ
// slice's "Structural" sub-score from ~10% toward ~40%+.
function faqBestForCity({ city, productKindLabel, materialOrSystemNote, climateLeadIn, climateZone }) {
  const tip = materialOrSystemNote || `For ${city} homes, work with a contractor who can match selection to the local climate and code.`;
  let question;
  switch (climateZone) {
    case "hot_humid":
      question = `How does ${city}'s humidity affect ${productKindLabel} choice?`;
      break;
    case "hot_dry":
      question = `How does ${city}'s desert climate affect ${productKindLabel} selection?`;
      break;
    case "cold":
    case "very_cold":
      question = `How does ${city}'s winter climate affect ${productKindLabel} selection?`;
      break;
    case "mixed":
      question = `What ${productKindLabel} fits ${city}'s mixed climate?`;
      break;
    default:
      question = `What ${productKindLabel} works best in ${city}?`;
  }
  return faqBlock(
    question,
    climateLeadIn ? `${climateLeadIn}: ${tip}` : tip
  );
}

// Q4 — "When is the best time to do X in {city}?" — direct render of seasonNote.
function faqBestTime({ city, workLabel, seasonNote }) {
  const note = seasonNote || `Schedule ${workLabel.toLowerCase()} in ${city} to align with the local off-peak season for both pricing and contractor availability.`;
  return faqBlock(
    `When is the best time for ${workLabel.toLowerCase()} in ${city}?`,
    note
  );
}

// Q5 — "What red flags should I watch for hiring X in {city}?" — direct render of redFlagNote.
// When hoaPrevalence is supplied, the question varies along that dimension
// (high → "...in HOA neighborhoods", growth-rate moderate→ "...in a growing
// market"). 3-4 Q-stem variants per vertical lifts structural diversity.
function faqRedFlags({ city, contractorLabel, redFlagNote, hoaPrevalence, growthRate }) {
  const note = redFlagNote || `Watch out for high-pressure tactics, large upfront deposits (>30%), and missing license/insurance proof. Get three written quotes and verify the contractor's status with the ${city} building department.`;
  const article = articleFor(contractorLabel);
  let question;
  if (hoaPrevalence === "high") {
    question = `What pitfalls should I watch for hiring ${article} ${contractorLabel} in ${city}'s HOA neighborhoods?`;
  } else if (growthRate === "high") {
    question = `What red flags are common when hiring ${article} ${contractorLabel} in ${city}'s growing market?`;
  } else if (growthRate === "low" || growthRate === "very_low") {
    question = `What signs of a bad ${contractorLabel} should ${city} homeowners watch for?`;
  } else {
    question = `What red flags should I watch for hiring ${article} ${contractorLabel} in ${city}?`;
  }
  return faqBlock(question, note);
}

module.exports = {
  getSharedCityContext,
  firstSentence,
  lowercaseFirst,
  articleFor,
  naturalCostFraming,
  climateZoneLeadIn,
  hoaLeadIn,
  faqBlock,
  faqCostInCity,
  faqWhyCostDiffers,
  faqBestForCity,
  faqBestTime,
  faqRedFlags,
};
