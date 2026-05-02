#!/usr/bin/env node
/**
 * build-vertical-cities.js
 *
 * Phase A.1 generator: builds <vertical>-cities.html — a state-grouped
 * directory of every city page for one vertical. Structure is identical
 * across verticals; the intro paragraph + all metadata is hand-written.
 *
 * Usage:
 *   node scripts/build-vertical-cities.js <config.json>
 *
 * Config schema (JSON):
 *   {
 *     "vertical": "roof",
 *     "fileSuffix": "-roof-cost.html",
 *     "outputFile": "roof-cities.html",
 *     "displayNoun": "roof replacement",          // for H1, used in "All cities with X cost data"
 *     "shortNoun": "roof",                         // for breadcrumb crumb text
 *     "hubUrl": "/roof-cost-by-material.html",
 *     "hubLabel": "Roof Replacement Cost Guide",
 *     "analyzerUrl": "/roofing-quote-analyzer.html",
 *     "analyzerLabel": "Analyze a roof quote",
 *     "pageTitle": "All cities with roof replacement cost data | Woogoro",
 *     "metaDescription": "...",                    // ~140 chars
 *     "ogTitle": "...",
 *     "ogDescription": "...",                      // ~120 chars
 *     "schemaName": "Roof replacement cost by city",
 *     "schemaDescription": "...",
 *     "intro": "<hand-written paragraph, vertical-specific cost driver, 80-150 words>"
 *   }
 */

const fs = require("fs");
const path = require("path");

const STATE_NAMES = {
  ak: "Alaska", al: "Alabama", ar: "Arkansas", az: "Arizona", ca: "California",
  co: "Colorado", ct: "Connecticut", dc: "Washington, D.C.", de: "Delaware",
  fl: "Florida", ga: "Georgia", hi: "Hawaii", ia: "Iowa", id: "Idaho",
  il: "Illinois", in: "Indiana", ks: "Kansas", ky: "Kentucky", la: "Louisiana",
  ma: "Massachusetts", md: "Maryland", me: "Maine", mi: "Michigan",
  mn: "Minnesota", mo: "Missouri", ms: "Mississippi", mt: "Montana",
  nc: "North Carolina", nd: "North Dakota", ne: "Nebraska", nh: "New Hampshire",
  nj: "New Jersey", nm: "New Mexico", nv: "Nevada", ny: "New York",
  oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania", ri: "Rhode Island",
  sc: "South Carolina", sd: "South Dakota", tn: "Tennessee", tx: "Texas",
  ut: "Utah", va: "Virginia", vt: "Vermont", wa: "Washington", wi: "Wisconsin",
  wv: "West Virginia", wy: "Wyoming",
};

const STATE_SLUG_EXCLUDE = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine",
  "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
  "missouri", "montana", "nebraska", "nevada", "new-hampshire", "new-jersey",
  "new-mexico", "new-york", "north-carolina", "north-dakota", "ohio",
  "oklahoma", "oregon", "pennsylvania", "rhode-island", "south-carolina",
  "south-dakota", "tennessee", "texas", "utah", "vermont", "virginia",
  "washington", "west-virginia", "wisconsin", "wyoming",
]);

function titleCase(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function enumerateCityPages(fileSuffix, root) {
  const all = fs.readdirSync(root).filter((f) => f.endsWith(fileSuffix));
  // Strict city pattern: <slug>-<2-letter>-<suffix>, where slug is a-z0-9-
  // (excluding period — legacy files like "st." get filtered).
  const cityRe = new RegExp(
    `^([a-z0-9][a-z0-9-]*)-([a-z]{2})${fileSuffix.replace(/\./g, "\\.").replace(/-/g, "-")}$`
  );

  const cities = [];
  const cityFiles = [];
  const metroLookup = {}; // slug -> state
  const cityKeySet = new Set(); // dedupe by slug+state

  for (const f of all) {
    const m = f.match(cityRe);
    if (!m) continue;
    const [, citySlug, st] = m;
    if (!STATE_NAMES[st]) continue; // unknown state code
    if (STATE_SLUG_EXCLUDE.has(citySlug)) continue; // false-positive: alabama-al, etc.
    const key = `${citySlug}|${st}`;
    if (cityKeySet.has(key)) continue;
    cityKeySet.add(key);
    cities.push({ slug: citySlug, state: st, file: f, label: titleCase(citySlug) });
    metroLookup[citySlug] = st;
    cityFiles.push(f);
  }

  // Neighborhood-of-metro detection: file is <prefix>-<metroSlug>-<suffix>
  // where metroSlug is a known metro (city we already cataloged).
  const nonCity = all.filter((f) => !cityRe.test(f));
  const neighborhoods = [];
  const stem = (f) => f.slice(0, -fileSuffix.length);

  for (const f of nonCity) {
    const s = stem(f);
    if (s.includes(".")) continue; // skip legacy period slugs
    if (s.startsWith("how-much-")) continue;
    if (STATE_SLUG_EXCLUDE.has(s)) continue;

    const tokens = s.split("-");
    if (tokens.length < 2) continue;

    let matched = null;
    for (let len = Math.min(3, tokens.length - 1); len >= 1; len--) {
      const candidate = tokens.slice(-len).join("-");
      if (metroLookup[candidate]) {
        const nbhdSlug = tokens.slice(0, -len).join("-");
        if (STATE_SLUG_EXCLUDE.has(nbhdSlug)) break; // e.g., "new-york" prefix
        matched = {
          slug: s,
          state: metroLookup[candidate],
          file: f,
          label: `${titleCase(nbhdSlug)} (${titleCase(candidate)})`,
        };
        break;
      }
    }
    if (matched) neighborhoods.push(matched);
  }

  // Combined entries
  const all_entries = [...cities, ...neighborhoods];

  // Group by state
  const byState = {};
  for (const e of all_entries) {
    if (!byState[e.state]) byState[e.state] = [];
    byState[e.state].push(e);
  }
  for (const st of Object.keys(byState)) {
    byState[st].sort((a, b) => a.label.localeCompare(b.label));
  }

  return { byState, totalCount: all_entries.length, cityCount: cities.length, neighborhoodCount: neighborhoods.length };
}

function renderPage(cfg, byState, totalCount) {
  const stateKeys = Object.keys(byState).sort((a, b) =>
    STATE_NAMES[a].localeCompare(STATE_NAMES[b])
  );
  const stateCount = stateKeys.length;

  const jumpNav = stateKeys
    .map((st) => `<a href="#${st}">${STATE_NAMES[st]}</a>`)
    .join(" &middot; ");

  const sections = stateKeys
    .map((st) => {
      const items = byState[st]
        .map((e) => `<li><a href="/${e.file}">${escapeHtml(e.label)}</a></li>`)
        .join("\n");
      return `<section class="section">
<h2 id="${st}">${STATE_NAMES[st]}</h2>
<ul class="city-link-list">
${items}
</ul>
</section>`;
    })
    .join("\n\n");

  const introHtml = cfg.intro;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<link rel="icon" href="/favicon.png" type="image/png" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(cfg.pageTitle)}</title>
<meta name="description" content="${escapeHtml(cfg.metaDescription)}" />
<link rel="canonical" href="https://woogoro.com/${cfg.outputFile}" />
<link rel="alternate" hreflang="en-US" href="https://woogoro.com/${cfg.outputFile}" />
<link rel="alternate" hreflang="x-default" href="https://woogoro.com/${cfg.outputFile}" />
<meta name="robots" content="index,follow" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(cfg.ogTitle)}" />
<meta property="og:description" content="${escapeHtml(cfg.ogDescription)}" />
<meta property="og:url" content="https://woogoro.com/${cfg.outputFile}" />
<meta property="og:site_name" content="Woogoro" />
<link rel="stylesheet" href="/css/woogoro.min.css" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"CollectionPage","name":${JSON.stringify(cfg.schemaName)},"description":${JSON.stringify(cfg.schemaDescription)},"url":"https://woogoro.com/${cfg.outputFile}","isPartOf":{"@type":"WebSite","name":"Woogoro","url":"https://woogoro.com"},"publisher":{"@type":"Organization","name":"Woogoro","url":"https://woogoro.com"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://woogoro.com/"},{"@type":"ListItem","position":2,"name":${JSON.stringify((cfg.shortNoun.charAt(0).toUpperCase() + cfg.shortNoun.slice(1)) + " cost")},"item":"https://woogoro.com${cfg.hubUrl}"},{"@type":"ListItem","position":3,"name":"All cities"}]}
</script>
</head>
<body>
<a href="#main" class="skip-link">Skip to main content</a>
<header class="site-header">
  <div class="container">
    <a class="logo" href="/"><picture><source srcset="/images/Iris/Iris%20color%20side%20silhouette.webp" type="image/webp"/><img class="logo-mark" src="/images/Iris/Iris%20color%20side%20silhouette.png" alt="" width="32" height="32" /></picture><span class="logo-text">Woogoro</span></a>
    <nav>
<a href="/guides.html">Guides</a>
<a href="/methodology.html">Methodology</a>
</nav>
  </div>
</header>
<div class="container" style="padding-top:16px;">
  <div class="breadcrumbs">
    <a href="/">Home</a> &rsaquo; <a href="${cfg.hubUrl}">${escapeHtml(cfg.shortNoun.charAt(0).toUpperCase() + cfg.shortNoun.slice(1))} cost</a> &rsaquo; <span>All cities</span>
  </div>
</div>
<main id="main" class="container">
<h1>All cities with ${escapeHtml(cfg.displayNoun)} cost data</h1>
<p style="font-size:14px; color:var(--text-muted); margin:8px 0 20px;">${totalCount} U.S. cities across ${stateCount} states &middot; data updated 2026</p>
${introHtml}
<p style="margin-top:16px;"><strong>Related:</strong> <a href="${cfg.hubUrl}">${escapeHtml(cfg.hubLabel)}</a> &middot; <a href="/all-cities.html">All cities (cross-vertical)</a> &middot; <a href="${cfg.analyzerUrl}">${escapeHtml(cfg.analyzerLabel)}</a></p>
<nav class="section" style="font-size:14px; line-height:2;" aria-label="Jump to state"><strong>Jump to state:</strong> ${jumpNav}</nav>

${sections}

</main>
<footer class="site-footer">
  <div class="container">
<div class="tp-footer-links">
  <div class="tp-footer-col">
    <h4>Get a Price</h4>
    <a href="/get-an-estimate.html">Get an estimate</a>
    <a href="/analyze-my-quote.html">Analyze a quote</a>
    <a href="/compare-quotes-picker.html">Compare quotes</a>
  </div>
  <div class="tp-footer-col">
    <h4>Browse</h4>
    <a href="/all-cities.html">All cities</a>
    <a href="/guides.html">Cost guides</a>
    <a href="/find-contractors.html">Find contractors</a>
  </div>
  <div class="tp-footer-col">
    <h4>About</h4>
    <a href="/about.html">About Woogoro</a>
    <a href="/methodology.html">Methodology</a>
    <a href="/accessibility.html">Accessibility</a>
    <a href="/privacy.html">Privacy</a>
    <a href="/terms.html">Terms</a>
  </div>
</div>
    <p>Woogoro helps homeowners analyze contractor quotes, compare bids, and estimate costs across 15 home services.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:16px;">Operated by <strong>Woogoro LLC</strong>, a South Carolina limited liability company &middot; 17064 Laurelmont Court, Fort Mill, SC 29707</p>
  </div>
</footer>
</body>
</html>
`;
}

function main() {
  const cfgPath = process.argv[2];
  if (!cfgPath) {
    console.error("Usage: node build-vertical-cities.js <config.json>");
    process.exit(2);
  }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const root = path.resolve(__dirname, "..");

  const { byState, totalCount, cityCount, neighborhoodCount } = enumerateCityPages(cfg.fileSuffix, root);

  if (totalCount === 0) {
    console.error(`No city pages found for suffix ${cfg.fileSuffix}`);
    process.exit(1);
  }

  const html = renderPage(cfg, byState, totalCount);
  const outPath = path.join(root, cfg.outputFile);
  fs.writeFileSync(outPath, html);

  console.log(`✅ Wrote ${cfg.outputFile}`);
  console.log(`   Cities: ${cityCount}  Neighborhoods: ${neighborhoodCount}  Total: ${totalCount}`);
  console.log(`   States: ${Object.keys(byState).length}`);
}

if (require.main === module) main();
