// Per-template SEO contracts. The contract for a page is the loose-band
// fingerprint a regression would break: title length, description length,
// h1 count, canonical pointing to self, JSON-LD blocks parse + carry the
// expected types, OG tags present, internal-link count above a floor.
//
// Each contract describes ONE template type. Add a new template = add a new
// entry. Each sampled URL is matched to a template via the `urlMatches`
// predicate (first match wins).

const TEMPLATES = {
  hub: {
    label: "Vertical hub / cost guide",
    urlMatches: (u) => /^\/(?!.*-(roof|hvac|plumbing|electrical|solar|fence|fencing|gutters?|landscaping|medical|legal|moving|auto-repair|garage-door|windows?|kitchen-remodel|kitchen|siding|painting|foundation|concrete|insulation)-cost\.html$)([a-z0-9-]+)-cost(-guide)?\.html$/.test(u),
    titleLength: { min: 30, max: 70 },
    descriptionLength: { min: 110, max: 175 },
    h1Count: { min: 1, max: 1 },
    canonicalSelf: true,
    jsonLdRequired: ["Article|FAQPage|WebPage"],
    ogRequired: ["og:title", "og:description", "og:image", "og:url", "og:type"],
    twitterRequired: ["twitter:card", "twitter:title"],
    internalLinkFloor: 15,
    requireSkipLink: true,
    indexable: true,
  },
  metroCity: {
    label: "City+state metro page (flagship or non-flagship)",
    // matches e.g. charlotte-nc-roof-cost.html, abilene-tx-foundation-cost.html
    urlMatches: (u) => /^\/[a-z0-9-]+-[a-z]{2}-[a-z0-9-]+-cost\.html$/.test(u),
    titleLength: { min: 30, max: 70 },
    descriptionLength: { min: 110, max: 175 },
    h1Count: { min: 1, max: 1 },
    canonicalSelf: true,
    jsonLdRequired: ["Article|WebPage|LocalBusiness|Service"],
    ogRequired: ["og:title", "og:description", "og:image", "og:url"],
    internalLinkFloor: 8,
    requireSkipLink: true,
    indexable: true,
  },
  subMetro: {
    label: "Sub-metro / neighborhood page",
    // matches e.g. ballantyne-charlotte-roof-cost.html (no state suffix in middle)
    urlMatches: (u) => /^\/[a-z0-9-]+-(charlotte|atlanta|los-angeles|new-york|chicago|seattle|houston|phoenix|denver|dallas|brooklyn|manhattan)-[a-z0-9-]+-cost\.html$/.test(u),
    titleLength: { min: 30, max: 70 },
    descriptionLength: { min: 110, max: 175 },
    h1Count: { min: 1, max: 1 },
    canonicalSelf: true,
    jsonLdRequired: ["Article|WebPage"],
    ogRequired: ["og:title", "og:description", "og:url"],
    internalLinkFloor: 5,
    requireSkipLink: true,
    indexable: true,
  },
  blog: {
    label: "Blog post",
    urlMatches: (u) => /^\/blog\/.+\.html$/.test(u),
    titleLength: { min: 30, max: 75 },
    descriptionLength: { min: 110, max: 175 },
    h1Count: { min: 1, max: 1 },
    canonicalSelf: true,
    jsonLdRequired: ["BlogPosting|Article"],
    ogRequired: ["og:title", "og:description", "og:image", "og:url", "og:type"],
    twitterRequired: ["twitter:card", "twitter:image"],
    internalLinkFloor: 5,
    requireSkipLink: true,
    indexable: true,
  },
  calculator: {
    label: "Calculator / interactive tool page",
    urlMatches: (u) => /^\/[a-z0-9-]+(-calculator|-billing-calculator)\.html$/.test(u),
    titleLength: { min: 30, max: 70 },
    descriptionLength: { min: 110, max: 175 },
    h1Count: { min: 1, max: 1 },
    canonicalSelf: true,
    jsonLdRequired: ["SoftwareApplication|WebApplication"],
    ogRequired: ["og:title", "og:description", "og:url"],
    internalLinkFloor: 3,
    requireSkipLink: true,
    indexable: true,
  },
  // Tool pages (estimate / analyzer / compare) are intentionally noindex.
  // We assert that they STAY noindex so an accidental indexable flip would
  // surface as a regression.
  toolNoindex: {
    label: "Tool page (estimate / analyzer / compare) -- must stay noindex",
    urlMatches: (u) => /^\/(([a-z0-9-]+-estimate)|([a-z0-9-]+-(quote|fee|bill)-analyzer)|(compare-[a-z0-9-]+-quotes))\.html$/.test(u),
    requireSkipLink: true,
    indexable: false, // assert robots is noindex
  },
};

function resolveTemplate(urlPath) {
  for (const [key, tpl] of Object.entries(TEMPLATES)) {
    if (tpl.urlMatches(urlPath)) return { key, ...tpl };
  }
  return null;
}

module.exports = { TEMPLATES, resolveTemplate };
