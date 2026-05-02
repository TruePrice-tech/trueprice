#!/usr/bin/env node
/**
 * build-state-vertical-hub.js
 *
 * Phase A.2 — generate state-vertical hub pages with rich per-state data.
 *
 * Reads per-state data dictionaries (data/state-<vertical>-data.json) and
 * shared datasets (state-energy-prices.json, state-regions.json), enumerates
 * matching city pages from disk, and emits [state-slug]-[vertical]-cost.html
 * pages.
 *
 * Differentiation lives in:
 *   - distinctive_law (state-specific statute/code, hand-curated unique)
 *   - climate_concern (state-specific climate driver, hand-curated unique)
 *   - hurricane/hail/snow tier and IECC climate zone (numeric/categorical)
 *   - license board name + URL
 *   - state-typical replacement cost range and BLS roofer wage
 *   - city-list (computed from filesystem, varies per state)
 *
 * Audit gate (per docs/full-city-page-indexing-plan.md): pairwise similarity
 * within a vertical's 50 state pages must be ≤25%. Run
 * scripts/audit-state-hub-uniqueness.js after generation.
 *
 * Usage:
 *   node scripts/build-state-vertical-hub.js <vertical>
 *
 * Example:
 *   node scripts/build-state-vertical-hub.js roof
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const VERTICAL_CONFIG = {
  roof: {
    fileSuffix: "-roof-cost.html",
    cityFileSuffix: "-roof-cost.html",
    pageTitle: (s) => `Roof Replacement Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average roof replacement cost in ${s.name} runs ${money(s.avg_replacement_low)}–${money(s.avg_replacement_high)} for a 2,000 sq ft asphalt re-roof. Per-state climate, license, and code drivers explained.`,
    h1: (s) => `Roof Replacement Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/roof-cities.html",
    costGuideHref: "/roofing-replacement-cost-guide.html",
    quoteAnalyzerHref: "/roofing-quote-analyzer.html",
    estimatorHref: "/roofing-quote-analyzer.html?mode=estimator",
    verticalLabel: "roof replacement",
    verticalLabelCap: "Roof Replacement",
    pricingMetricLabel: "2,000 sq ft asphalt re-roof",
    sitemapFile: "sitemap-roof.xml",
  },
};

function money(n) {
  return "$" + Number(n).toLocaleString("en-US");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function titleCaseCity(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function loadStateRegions() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-regions.json"), "utf8"));
}

function loadStateEnergyPrices() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-energy-prices.json"), "utf8"));
}

function loadStateVerticalData(vertical) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data", `state-${vertical}-data.json`), "utf8"));
}

function enumerateCityPagesByState(cityFileSuffix) {
  const STATES = "al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc".split(" ");
  const STATE_SET = new Set(STATES);
  const all = fs.readdirSync(ROOT).filter((f) => f.endsWith(cityFileSuffix));
  const byState = {};
  for (const f of all) {
    const stem = f.replace(new RegExp(cityFileSuffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "");
    const parts = stem.split("-");
    const tail = parts[parts.length - 1];
    if (!STATE_SET.has(tail)) continue;
    if (parts.length < 2) continue;
    const citySlugParts = parts.slice(0, -1);
    const citySlug = citySlugParts.join("-");
    if (!citySlug) continue;
    const stateAbbr = tail.toUpperCase();
    if (!byState[stateAbbr]) byState[stateAbbr] = [];
    byState[stateAbbr].push({
      slug: citySlug,
      file: f,
      cityName: titleCaseCity(citySlug),
      stateAbbr,
    });
  }
  for (const k of Object.keys(byState)) {
    byState[k].sort((a, b) => a.cityName.localeCompare(b.cityName));
  }
  return byState;
}

function summaryCardsHTML(state, cityCount, vConf) {
  const range = `${money(state.avg_replacement_low)} – ${money(state.avg_replacement_high)}`;
  const wage = `$${state.roofer_wage_mean_hourly.toFixed(2)}/hr`;
  return `      <div class="summary-grid">
        <div class="summary-card">
          <strong>State</strong>
          <span>${escapeHtml(state.name)}</span>
        </div>
        <div class="summary-card">
          <strong>Cities Covered</strong>
          <span>${cityCount}</span>
        </div>
        <div class="summary-card">
          <strong>Typical ${vConf.pricingMetricLabel}</strong>
          <span>${range}</span>
        </div>
        <div class="summary-card">
          <strong>BLS roofer wage</strong>
          <span>${wage}</span>
        </div>
      </div>`;
}

function climateAndCodeFactsHTML(state) {
  const tierLabel = {
    HVHZ: "High-Velocity Hurricane Zone (HVHZ) — Miami-Dade and Broward counties under 175-mph design wind",
    wind_high: "High wind exposure — 140 mph+ design wind on coastal counties",
    wind_moderate: "Moderate wind exposure — 110–140 mph design wind on coastal counties",
    wind_low: "Low wind exposure — sub-110 mph design wind",
    none: "No hurricane wind-design exposure",
  };
  const hailLabel = {
    very_high: "Very high — central U.S. hail corridor, 8+ severe hail days/year",
    high: "High — frequent severe hail seasons",
    moderate: "Moderate — periodic severe hail",
    low: "Low — minimal severe hail history",
  };
  const snowLabel = (psf) => {
    if (psf >= 50) return `${psf} psf+ — heavy snow load, ice-dam protection essential`;
    if (psf >= 25) return `${psf} psf — moderate snow load, ice-and-water shield required`;
    if (psf >= 10) return `${psf} psf — light snow load`;
    if (psf >= 5) return `${psf} psf — minimal snow load`;
    return `${psf} psf — no design snow load`;
  };

  const items = [
    `<li><strong>IECC climate zone:</strong> ${escapeHtml(state.iecc_zone)}</li>`,
    `<li><strong>Hurricane wind tier:</strong> ${escapeHtml(tierLabel[state.hurricane_tier] || state.hurricane_tier)}</li>`,
    `<li><strong>Hail risk tier:</strong> ${escapeHtml(hailLabel[state.hail_tier] || state.hail_tier)}</li>`,
    `<li><strong>Ground snow load:</strong> ${escapeHtml(snowLabel(state.snow_load_psf))}</li>`,
    `<li><strong>Dominant residential roof material:</strong> ${escapeHtml(state.dominant_material.replace(/-/g, " "))}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function licenseAndPermitHTML(state) {
  const statusLabel = {
    required: "Statewide license required",
    registration: "Statewide registration required (no exam)",
    none: "No statewide roofing license",
  };
  return `      <ul class="state-fact-list">
        <li><strong>License status:</strong> ${escapeHtml(statusLabel[state.license_status] || state.license_status)}</li>
        <li><strong>License board:</strong> ${escapeHtml(state.license_board_name)} (<a href="${escapeHtml(state.license_url)}" rel="nofollow noopener" target="_blank">official site</a>)</li>
        <li><strong>Permit:</strong> ${escapeHtml(state.permit_typical)}</li>
      </ul>`;
}

function cityCardsHTML(cities, vConf) {
  if (!cities || cities.length === 0) {
    return `      <p>No ${vConf.verticalLabel} city guides published in this state yet. We're adding coverage state-by-state — check back, or use our <a href="${escapeHtml(vConf.estimatorHref)}">free estimate tool</a> to price your project right now.</p>`;
  }
  const cards = cities
    .map(
      (c) => `        <div class="city-link-card">
          <a href="/${c.file}">${escapeHtml(c.cityName)}, ${c.stateAbbr}</a>
          <p>Compare local ${vConf.verticalLabel} pricing in ${escapeHtml(c.cityName)}.</p>
        </div>`
    )
    .join("\n");
  return `      <div class="city-grid">
${cards}
      </div>`;
}

function moreStatesHTML(currentSlug, allStates) {
  const others = Object.entries(allStates)
    .filter(([k]) => !k.startsWith("_"))
    .map(([_, v]) => v)
    .filter((s) => s.slug !== currentSlug)
    .sort((a, b) => a.name.localeCompare(b.name));
  const links = others
    .map((s) => `        <li><a href="/${s.slug}-roof-cost.html">${escapeHtml(s.name)}</a></li>`)
    .join("\n");
  return `      <div class="related-links">
        <ul>
${links}
        </ul>
      </div>`;
}

function buildPage(stateAbbr, allStates, cityIndex, vConf) {
  const state = allStates[stateAbbr];
  const cities = cityIndex[stateAbbr] || [];
  const cityCount = cities.length;

  const introHero = `Roof replacement in ${state.name} typically runs ${money(state.avg_replacement_low)}–${money(state.avg_replacement_high)} for a ${vConf.pricingMetricLabel}, with ${state.dominant_material.replace(/-/g, " ")} as the dominant residential covering. ${state.climate_concern}`;

  const costsVarySection = `<p>${state.climate_concern}</p>
      <p><strong>State-specific code or insurance rule:</strong> ${state.distinctive_law}</p>`;

  const title = vConf.pageTitle(state);
  const description = vConf.pageDescription(state);
  const canonical = `https://woogoro.com/${state.slug}${vConf.fileSuffix}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="google-site-verification" content="oV5ZHpm-OqxhT3CV6qg-V0YaMpcNFEkwEFHtQN88T0w" />
  <link rel="icon" href="/favicon.png" type="image/png" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />

  <link rel="alternate" hreflang="en-US" href="${escapeHtml(canonical)}" />
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:image" content="https://woogoro.com/images/woogoro-social.png" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  <meta property="og:site_name" content="Woogoro" />
  <meta name="robots" content="index,follow" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />

  <link rel="stylesheet" href="/css/woogoro.min.css" />
  <style>
    .state-fact-list{list-style:none;padding:0;margin:0;display:grid;gap:10px;}
    .state-fact-list li{padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:15px;line-height:1.5;}
    .state-fact-list li strong{color:#0f172a;}
    .state-section-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin:24px 0;}
  </style>
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

  <div class="hero">
    <div class="container">
      <div class="breadcrumbs">
        <a href="/">Home</a> &rsaquo;
        <a href="${escapeHtml(vConf.citiesDirHref)}">Roof cities</a> &rsaquo;
        <span>${escapeHtml(state.name)}</span>
      </div>

      <h1>${escapeHtml(vConf.h1(state))}</h1>
      <p>${escapeHtml(introHero)}</p>
    </div>
  </div>

  <main id="main" class="container" style="padding-top:32px; padding-bottom:32px;">
    <div class="summary-box">
${summaryCardsHTML(state, cityCount, vConf)}
    </div>

    <div class="state-section-grid">
      <section class="section">
        <h2>${escapeHtml(state.name)} climate &amp; code drivers</h2>
${climateAndCodeFactsHTML(state)}
      </section>

      <section class="section">
        <h2>${escapeHtml(state.name)} licensing &amp; permits</h2>
${licenseAndPermitHTML(state)}
      </section>
    </div>

    <section class="section">
      <h2>How ${vConf.verticalLabel} costs vary in ${escapeHtml(state.name)}</h2>
      ${costsVarySection}
    </section>

    <section class="section">
      <h2>Cities in ${escapeHtml(state.name)}</h2>
      <p>Compare ${vConf.verticalLabel} pricing for ${cityCount > 0 ? `${cityCount} ${cityCount === 1 ? "city" : "cities"} across ${escapeHtml(state.name)}` : `${escapeHtml(state.name)}`}.</p>
${cityCardsHTML(cities, vConf)}
    </section>

    <div class="cta-box">
      <h2>Got a quote? Check if it's fair.</h2>
      <p>Upload your estimate for an instant price and scope review tuned to ${escapeHtml(state.name)} labor and material rates.</p>
      <a class="btn" href="${escapeHtml(vConf.quoteAnalyzerHref)}">Analyze your quote</a>
    </div>

    <section class="section">
      <h2>More state guides</h2>
${moreStatesHTML(state.slug, allStates)}
    </section>

    <p class="footer-note">
      Pricing ranges reflect ${escapeHtml(state.name)} market labor (BLS OEWS roofer mean ${"$" + state.roofer_wage_mean_hourly.toFixed(2)}/hr) and Woogoro regional cost modeling.
      For the most localized estimate, see your nearest city page above.
    </p>
  <!-- TP-INTERNAL-TOOLS-BLOCK -->
<section class="tp-tools-block" style="margin:32px 0;padding:24px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;">
  <h3 style="margin:0 0 12px;font-size:18px;color:#1e293b;">More Woogoro tools for your area</h3>
  <p style="margin:0 0 16px;font-size:14px;color:#64748b;">Free pricing tools that work anywhere in your area and across the US.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
    <a href="/auto-repair.html" style="display:block;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;font-size:14px;">Auto repair pricing &rarr;<div style="font-weight:400;color:#64748b;font-size:12px;margin-top:2px;">98 repairs, BLS-backed labor rates</div></a>
    <a href="/find-contractors.html" style="display:block;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;font-size:14px;">Find contractors &rarr;<div style="font-weight:400;color:#64748b;font-size:12px;margin-top:2px;">Vetted local pros</div></a>
    <a href="${escapeHtml(vConf.estimatorHref)}" style="display:block;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;font-size:14px;">Roof estimate &rarr;<div style="font-weight:400;color:#64748b;font-size:12px;margin-top:2px;">Enter your address, get a price</div></a>
    <a href="/analyze-my-quote.html" style="display:block;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;font-size:14px;">Analyze a quote &rarr;<div style="font-weight:400;color:#64748b;font-size:12px;margin-top:2px;">Iris checks every line item</div></a>
  </div>
</section>
<!-- /TP-INTERNAL-TOOLS-BLOCK -->
</main>

  <footer class="site-footer">
    <div class="container">
<div class="tp-footer-links">
  <div class="tp-footer-col">
    <h4>Get a Price</h4>
    <a href="/get-an-estimate.html">Get an estimate</a>
    <a href="/analyze-my-quote.html">Analyze a quote</a>
    <a href="/compare-quotes-picker.html">Compare quotes</a>
    <a href="${escapeHtml(vConf.estimatorHref)}">Roof estimate</a>
  </div>
  <div class="tp-footer-col">
    <h4>Service types</h4>
    <a href="/all-cities.html">All cities</a>
    <a href="/guides.html">Cost guides</a>
    <a href="/find-contractors.html">Find contractors</a>
    <a href="/medical-cost-lookup.html">Medical cost lookup</a>
  </div>
  <div class="tp-footer-col">
    <h4>Hot categories</h4>
    <a href="/roofing-quote-analyzer.html">Roofing</a>
    <a href="/hvac-quote-analyzer.html">HVAC</a>
    <a href="/plumbing-quote-analyzer.html">Plumbing</a>
    <a href="/electrical-quote-analyzer.html">Electrical</a>
    <a href="/solar-quote-analyzer.html">Solar</a>
    <a href="/auto-repair.html">Auto repair</a>
  </div>
  <div class="tp-footer-col">
    <h4>About Us</h4>
    <a href="/about.html">About Woogoro</a>
    <a href="/methodology.html">Methodology</a>
    <a href="/accessibility.html">Accessibility</a>
    <a href="/privacy.html">Privacy</a>
    <a href="/terms.html">Terms</a>
  </div>
</div>

      <p>
        Woogoro helps homeowners analyze contractor quotes, compare bids, and estimate costs across 16 home services plus auto repair.
        <a href="/privacy.html" style="color:inherit;">Privacy</a>
      </p>
      <p style="font-size:12px;color:#94a3b8;margin-top:16px;">Operated by <strong>Woogoro LLC</strong>, a South Carolina limited liability company &middot; 17064 Laurelmont Court, Fort Mill, SC 29707</p>
    </div>
  </footer>
<script src="/js/city-enhance.min.js" defer></script>
</body>
</html>
`;

  return html;
}

function main() {
  const vertical = process.argv[2];
  if (!vertical) {
    console.error("Usage: node scripts/build-state-vertical-hub.js <vertical>");
    process.exit(2);
  }
  const vConf = VERTICAL_CONFIG[vertical];
  if (!vConf) {
    console.error(`No config for vertical "${vertical}". Add to VERTICAL_CONFIG.`);
    process.exit(2);
  }

  const allStates = loadStateVerticalData(vertical);
  const cityIndex = enumerateCityPagesByState(vConf.cityFileSuffix);

  const stateKeys = Object.keys(allStates).filter((k) => !k.startsWith("_"));
  console.log(`Generating ${stateKeys.length} state-vertical hub pages for vertical=${vertical}`);

  let written = 0;
  let skipped = 0;
  for (const stateAbbr of stateKeys) {
    const state = allStates[stateAbbr];
    const cities = cityIndex[stateAbbr] || [];
    if (cities.length === 0 && stateAbbr !== "DC") {
      // No city pages exist for this state-vertical combo (rare).
      // Still ship the page — the rich state data is its own value.
    }
    if (stateAbbr === "DC" && cities.length === 0) {
      console.log(`  skip DC (no city pages)`);
      skipped++;
      continue;
    }

    const html = buildPage(stateAbbr, allStates, cityIndex, vConf);
    const outFile = path.join(ROOT, `${state.slug}${vConf.fileSuffix}`);
    fs.writeFileSync(outFile, html, "utf8");
    written++;
  }

  console.log(`Written: ${written}, skipped: ${skipped}`);
}

main();
