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
    citiesDirLabel: "Roof cities",
    costGuideHref: "/roofing-replacement-cost-guide.html",
    quoteAnalyzerHref: "/roofing-quote-analyzer.html",
    estimatorHref: "/roofing-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Roof estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "roof replacement",
    verticalLabelCap: "Roof Replacement",
    pricingMetricLabel: "2,000 sq ft asphalt re-roof",
    wageField: "roofer_wage_mean_hourly",
    wageLabel: "BLS roofer wage",
    wageSourceLabel: "BLS OEWS roofer mean",
    sitemapFile: "sitemap-roof.xml",
    introHero: (s, vConf) =>
      `Roof replacement in ${s.name} typically runs ${money(s.avg_replacement_low)}–${money(s.avg_replacement_high)} for a ${vConf.pricingMetricLabel}, with ${s.dominant_material.replace(/-/g, " ")} as the dominant residential covering. ${s.climate_concern}`,
    climateFactsHTML: (s) => climateAndCodeFactsRoofHTML(s),
    climateSectionHeading: (stateName) => `${stateName} climate & code drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  hvac: {
    fileSuffix: "-hvac-cost.html",
    cityFileSuffix: "-hvac-cost.html",
    pageTitle: (s) => `HVAC Replacement Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average HVAC replacement cost in ${s.name} runs ${money(s.avg_replacement_low)}–${money(s.avg_replacement_high)} for a complete 3-ton system. Per-state climate, license, refrigerant, and rebate drivers explained.`,
    h1: (s) => `HVAC Replacement Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/hvac-cities.html",
    citiesDirLabel: "HVAC cities",
    costGuideHref: "/hvac-replacement-cost-guide.html",
    quoteAnalyzerHref: "/hvac-quote-analyzer.html",
    estimatorHref: "/hvac-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "HVAC estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "HVAC replacement",
    verticalLabelCap: "HVAC Replacement",
    pricingMetricLabel: "complete 3-ton system replacement",
    wageField: "hvac_wage_mean_hourly",
    wageLabel: "BLS HVAC mechanic wage",
    wageSourceLabel: "BLS OEWS HVAC mechanic mean",
    sitemapFile: "sitemap-hvac.xml",
    introHero: (s, vConf) => {
      const fuelLabel = {
        "natural-gas": "natural-gas furnaces with central AC",
        "electricity-heat-pump": "electric heat pumps",
        "electric-resistance": "electric-resistance heat",
        "fuel-oil": "fuel-oil furnaces or boilers",
        "propane": "propane furnaces",
      };
      const fuel = fuelLabel[s.dominant_heating_fuel] || s.dominant_heating_fuel.replace(/-/g, " ");
      return `HVAC replacement in ${s.name} typically runs ${money(s.avg_replacement_low)}–${money(s.avg_replacement_high)} for a ${vConf.pricingMetricLabel}, with ${fuel} as the dominant heating choice and roughly ${s.hdd_annual.toLocaleString()} heating degree days against ${s.cdd_annual.toLocaleString()} cooling degree days driving the seasonal load mix. ${s.climate_concern}`;
    },
    climateFactsHTML: (s) => climateAndCodeFactsHvacHTML(s),
    climateSectionHeading: (stateName) => `${stateName} climate & load drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  plumbing: {
    fileSuffix: "-plumbing-cost.html",
    cityFileSuffix: "-plumbing-cost.html",
    pageTitle: (s) => `Plumbing & Repipe Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average whole-house repipe cost in ${s.name} runs ${money(s.avg_repipe_low)}–${money(s.avg_repipe_high)} for a typical 2-bath home. Per-state plumbing code, license tier, water-quality, and freeze drivers explained.`,
    h1: (s) => `Plumbing & Repipe Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/plumbing-cities.html",
    citiesDirLabel: "Plumbing cities",
    costGuideHref: "/plumbing-replacement-cost-guide.html",
    quoteAnalyzerHref: "/plumbing-quote-analyzer.html",
    estimatorHref: "/plumbing-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Plumbing estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "plumbing and repipe",
    verticalLabelCap: "Plumbing & Repipe",
    pricingMetricLabel: "whole-house 2-bath PEX repipe",
    wageField: "plumber_wage_mean_hourly",
    wageLabel: "BLS plumber wage",
    wageSourceLabel: "BLS OEWS plumber mean",
    sitemapFile: "sitemap-plumbing.xml",
    introHero: (s, vConf) => {
      const codeLabel = {
        "uniform-plumbing-code": "the Uniform Plumbing Code (UPC)",
        "international-plumbing-code": "the International Plumbing Code (IPC)",
        "state-specific": "a state-specific plumbing code",
      };
      const supplyLabel = {
        "copper": "Type-L copper",
        "pex": "PEX-A or PEX-B cross-linked polyethylene",
        "cpvc": "CPVC chlorinated PVC",
        "galvanized-mixed": "mixed copper-and-galvanized retrofits",
      };
      const code = codeLabel[s.code_basis] || s.code_basis.replace(/-/g, " ");
      const supply = supplyLabel[s.dominant_supply_material] || s.dominant_supply_material.replace(/-/g, " ");
      return `Plumbing repipe in ${s.name} typically runs ${money(s.avg_repipe_low)}–${money(s.avg_repipe_high)} for a ${vConf.pricingMetricLabel}, with ${supply} the dominant retrofit choice and ${code} as the adopted enforcement basis. Buried service-line trench depth must clear the ${s.frost_line_inches}-inch design frost line. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_repipe_low",
    avgFieldHigh: "avg_repipe_high",
    climateFactsHTML: (s) => climateAndCodeFactsPlumbingHTML(s),
    climateSectionHeading: (stateName) => `${stateName} water-quality & freeze drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  electrical: {
    fileSuffix: "-electrical-cost.html",
    cityFileSuffix: "-electrical-cost.html",
    pageTitle: (s) => `Electrical & Panel Upgrade Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average 200A panel upgrade cost in ${s.name} runs ${money(s.avg_panel_upgrade_low)}–${money(s.avg_panel_upgrade_high)}. Per-state NEC adoption, license tier, AFCI/GFCI, and lightning/freeze drivers explained.`,
    h1: (s) => `Electrical & Panel Upgrade Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/electrical-cities.html",
    citiesDirLabel: "Electrical cities",
    costGuideHref: "/electrical-cost-guide.html",
    quoteAnalyzerHref: "/electrical-quote-analyzer.html",
    estimatorHref: "/electrical-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Electrical estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "electrical and panel upgrade",
    verticalLabelCap: "Electrical & Panel Upgrade",
    pricingMetricLabel: "200A service panel upgrade",
    wageField: "electrician_wage_mean_hourly",
    wageLabel: "BLS electrician wage",
    wageSourceLabel: "BLS OEWS electrician mean",
    sitemapFile: "sitemap-electrical.xml",
    introHero: (s, vConf) => {
      const codeYearLabel = `the ${s.nec_code_year} NEC`;
      return `Panel upgrades and rewires in ${s.name} typically run ${money(s.avg_panel_upgrade_low)}–${money(s.avg_panel_upgrade_high)} for a ${vConf.pricingMetricLabel}, with ${codeYearLabel} as the adopted enforcement basis. Service entrance design assumes a ${s.service_size_typical} minimum on new residential construction. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_panel_upgrade_low",
    avgFieldHigh: "avg_panel_upgrade_high",
    climateFactsHTML: (s) => climateAndCodeFactsElectricalHTML(s),
    climateSectionHeading: (stateName) => `${stateName} code & environmental drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  siding: {
    fileSuffix: "-siding-cost.html",
    cityFileSuffix: "-siding-cost.html",
    pageTitle: (s) => `Siding Replacement Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average full-house re-side cost in ${s.name} runs ${money(s.avg_reside_low)}–${money(s.avg_reside_high)} for a 1,500 sq ft single-story home. Per-state climate, WUI, hurricane, and salt-air drivers explained.`,
    h1: (s) => `Siding Replacement Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/siding-cities.html",
    citiesDirLabel: "Siding cities",
    costGuideHref: "/siding-cost-guide.html",
    quoteAnalyzerHref: "/siding-quote-analyzer.html",
    estimatorHref: "/siding-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Siding estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "siding replacement",
    verticalLabelCap: "Siding Replacement",
    pricingMetricLabel: "1,500 sq ft single-story full re-side",
    wageField: "siding_installer_wage_mean_hourly",
    wageLabel: "BLS carpenter wage",
    wageSourceLabel: "BLS OEWS carpenter (siding installers) mean",
    sitemapFile: "sitemap-siding.xml",
    introHero: (s, vConf) => {
      const matLabel = {
        "vinyl": "vinyl panel",
        "fiber-cement": "fiber-cement plank (Hardie or LP SmartSide-style)",
        "brick-veneer": "brick veneer over wood frame",
        "stucco": "three-coat hard-coat stucco",
        "wood": "cedar lap or shake wood",
        "engineered-wood": "engineered wood lap (LP SmartSide-style)",
      };
      const mat = matLabel[s.dominant_material] || s.dominant_material.replace(/-/g, " ");
      return `Re-siding a 1,500 sq ft home in ${s.name} typically runs ${money(s.avg_reside_low)}–${money(s.avg_reside_high)}, with ${mat} the dominant residential cladding choice. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_reside_low",
    avgFieldHigh: "avg_reside_high",
    climateFactsHTML: (s) => climateAndCodeFactsSidingHTML(s),
    climateSectionHeading: (stateName) => `${stateName} climate & cladding drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  gutter: {
    fileSuffix: "-gutter-cost.html",
    cityFileSuffix: "-gutter-cost.html",
    pageTitle: (s) => `Gutter Installation Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average whole-house gutter and downspout installation in ${s.name} runs ${money(s.avg_gutter_install_low)}–${money(s.avg_gutter_install_high)}. Per-state rainfall, ice-dam, hurricane, and tree-canopy drivers explained.`,
    h1: (s) => `Gutter Installation Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/gutter-cities.html",
    citiesDirLabel: "Gutter cities",
    costGuideHref: "/gutter-installation-cost-guide.html",
    quoteAnalyzerHref: "/gutters-quote-analyzer.html",
    estimatorHref: "/gutters-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Gutter estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "gutter installation",
    verticalLabelCap: "Gutter Installation",
    pricingMetricLabel: "whole-house seamless aluminum K-style with downspouts",
    wageField: "gutter_installer_wage_mean_hourly",
    wageLabel: "BLS roofer wage",
    wageSourceLabel: "BLS OEWS roofer (gutter installers) mean",
    sitemapFile: "sitemap-gutters.xml",
    introHero: (s, vConf) => {
      const matLabel = {
        "aluminum-k-style-5in": "5-inch K-style seamless aluminum",
        "aluminum-k-style-6in": "6-inch oversized K-style seamless aluminum",
        "copper": "16 oz half-round copper",
        "galvanized-steel": "G90 galvanized steel",
      };
      const mat = matLabel[s.dominant_gutter_material] || s.dominant_gutter_material.replace(/-/g, " ");
      return `Whole-house gutter installation in ${s.name} typically runs ${money(s.avg_gutter_install_low)}–${money(s.avg_gutter_install_high)}, with ${mat} the dominant residential profile and roughly ${s.annual_rainfall_inches} inches of annual precipitation driving sizing. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_gutter_install_low",
    avgFieldHigh: "avg_gutter_install_high",
    climateFactsHTML: (s) => climateAndCodeFactsGutterHTML(s),
    climateSectionHeading: (stateName) => `${stateName} rainfall & drainage drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  concrete: {
    fileSuffix: "-concrete-cost.html",
    cityFileSuffix: "-concrete-cost.html",
    pageTitle: (s) => `Concrete Driveway Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average 600 sq ft 4-inch concrete driveway pour in ${s.name} runs ${money(s.avg_driveway_low)}–${money(s.avg_driveway_high)}. Per-state frost depth, freeze-thaw, expansive soil, seismic, and de-icer drivers explained.`,
    h1: (s) => `Concrete Driveway Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/concrete-cities.html",
    citiesDirLabel: "Concrete cities",
    costGuideHref: "/concrete-cost-guide.html",
    quoteAnalyzerHref: "/concrete-quote-analyzer.html",
    estimatorHref: "/concrete-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Concrete estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "concrete driveway",
    verticalLabelCap: "Concrete Driveway",
    pricingMetricLabel: "600 sq ft 4-inch concrete driveway pour",
    wageField: "cement_mason_wage_mean_hourly",
    wageLabel: "BLS cement mason wage",
    wageSourceLabel: "BLS OEWS cement mason & concrete finisher mean",
    sitemapFile: "sitemap-concrete.xml",
    introHero: (s, vConf) => {
      const ftLabel = {
        "F0": "no freeze-thaw exposure (ACI F0)",
        "F1": "moderate freeze-thaw exposure (ACI F1)",
        "F2": "severe freeze-thaw exposure (ACI F2)",
        "F3": "most severe freeze-thaw exposure (ACI F3)",
      };
      const ft = ftLabel[s.freeze_thaw_exposure] || s.freeze_thaw_exposure;
      return `Concrete driveway pours in ${s.name} typically run ${money(s.avg_driveway_low)}–${money(s.avg_driveway_high)} for a ${vConf.pricingMetricLabel} at ${s.typical_psi} psi compressive strength. Buried footings must clear the ${s.frost_line_inches}-inch design frost line, and the state sits in ${ft}. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_driveway_low",
    avgFieldHigh: "avg_driveway_high",
    climateFactsHTML: (s) => climateAndCodeFactsConcreteHTML(s),
    climateSectionHeading: (stateName) => `${stateName} climate, soil & seismic drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  insulation: {
    fileSuffix: "-insulation-cost.html",
    cityFileSuffix: "-insulation-cost.html",
    pageTitle: (s) => `Attic Insulation Upgrade Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average attic insulation upgrade cost in ${s.name} runs ${money(s.avg_attic_upgrade_low)}–${money(s.avg_attic_upgrade_high)} for a 1,500 sq ft R-30 → R-49 blown cellulose retrofit. Per-state IECC code, R-value, IRA rebate, and air-sealing drivers explained.`,
    h1: (s) => `Attic Insulation Upgrade Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/insulation-cities.html",
    citiesDirLabel: "Insulation cities",
    costGuideHref: "/insulation-cost-guide.html",
    quoteAnalyzerHref: "/insulation-quote-analyzer.html",
    estimatorHref: "/insulation-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Insulation estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "attic insulation upgrade",
    verticalLabelCap: "Attic Insulation Upgrade",
    pricingMetricLabel: "1,500 sq ft attic upgrade R-30 to R-49 blown cellulose",
    wageField: "insulation_worker_wage_mean_hourly",
    wageLabel: "BLS insulation worker wage",
    wageSourceLabel: "BLS OEWS insulation worker (floor/ceiling/wall) mean",
    sitemapFile: "sitemap-insulation.xml",
    introHero: (s, vConf) => {
      const matLabel = {
        "blown-cellulose": "blown cellulose loose-fill",
        "fiberglass-batt": "fiberglass batt rolled-and-cut",
        "blown-fiberglass": "blown fiberglass loose-fill",
        "spray-foam-closed-cell": "closed-cell spray polyurethane foam at the roofline",
        "spray-foam-open-cell": "open-cell spray polyurethane foam at the roofline",
      };
      const mat = matLabel[s.dominant_attic_insulation] || s.dominant_attic_insulation.replace(/-/g, " ");
      return `Attic insulation upgrades in ${s.name} typically run ${money(s.avg_attic_upgrade_low)}–${money(s.avg_attic_upgrade_high)} for a ${vConf.pricingMetricLabel}, with ${mat} the dominant residential retrofit material at the IECC R-${s.required_attic_r_value} attic minimum. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_attic_upgrade_low",
    avgFieldHigh: "avg_attic_upgrade_high",
    climateFactsHTML: (s) => climateAndCodeFactsInsulationHTML(s),
    climateSectionHeading: (stateName) => `${stateName} energy code & climate-load drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing, rebates & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  landscaping: {
    fileSuffix: "-landscaping-cost.html",
    cityFileSuffix: "-landscaping-cost.html",
    pageTitle: (s) => `Landscape Installation Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average front-and-back-yard landscape install in ${s.name} runs ${money(s.avg_install_low)}–${money(s.avg_install_high)}. Per-state hardiness zone, drought, water-rights, pesticide, and HOA drivers explained.`,
    h1: (s) => `Landscape Installation Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/landscaping-cities.html",
    citiesDirLabel: "Landscaping cities",
    costGuideHref: "/landscaping-cost-guide.html",
    quoteAnalyzerHref: "/landscaping-quote-analyzer.html",
    estimatorHref: "/landscaping-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Landscape estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "landscape installation",
    verticalLabelCap: "Landscape Installation",
    pricingMetricLabel: "front-and-back-yard residential landscape install",
    wageField: "landscaper_wage_mean_hourly",
    wageLabel: "BLS landscape worker wage",
    wageSourceLabel: "BLS OEWS landscaping & groundskeeping mean",
    sitemapFile: "sitemap-landscaping.xml",
    introHero: (s, vConf) => {
      const aestheticLabel = {
        "turf-dominant": "cool- or warm-season turf-dominant front-yard design",
        "native-prairie": "native-prairie short-grass aesthetic",
        "xeriscape": "xeriscape with drought-tolerant perennials and gravel mulch",
        "desert-adapted": "desert-adapted Sonoran or Mojave plant palette",
        "forest-edge": "forest-edge native-shrub and shade-perennial design",
        "coastal-mediterranean": "Pacific NW or California Mediterranean plant palette",
      };
      const aesthetic = aestheticLabel[s.dominant_landscape_type] || s.dominant_landscape_type.replace(/-/g, " ");
      return `Landscape installation in ${s.name} typically runs ${money(s.avg_install_low)}–${money(s.avg_install_high)} for a ${vConf.pricingMetricLabel}, with ${aesthetic} as the dominant residential approach across USDA hardiness zone ${s.usda_hardiness_zone}. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_install_low",
    avgFieldHigh: "avg_install_high",
    climateFactsHTML: (s) => climateAndCodeFactsLandscapingHTML(s),
    climateSectionHeading: (stateName) => `${stateName} climate, water & plant-palette drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing, pesticide & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  painting: {
    fileSuffix: "-painting-cost.html",
    cityFileSuffix: "-painting-cost.html",
    pageTitle: (s) => `Exterior Painting Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average exterior repaint cost in ${s.name} runs ${money(s.avg_repaint_low)}–${money(s.avg_repaint_high)} for a 1,500 sq ft single-story home. Per-state humidity, UV, salt-air, lead-safe, and VOC drivers explained.`,
    h1: (s) => `Exterior Painting Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/painting-cities.html",
    citiesDirLabel: "Painting cities",
    costGuideHref: "/painting-cost-guide.html",
    quoteAnalyzerHref: "/painting-quote-analyzer.html",
    estimatorHref: "/painting-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Painting estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "exterior repaint",
    verticalLabelCap: "Exterior Painting",
    pricingMetricLabel: "1,500 sq ft single-story exterior repaint",
    wageField: "painter_wage_mean_hourly",
    wageLabel: "BLS painter wage",
    wageSourceLabel: "BLS OEWS painter (construction & maintenance) mean",
    sitemapFile: "sitemap-painting.xml",
    introHero: (s, vConf) => {
      const subLabel = {
        "wood-lap": "wood lap or shake siding",
        "fiber-cement": "fiber-cement plank (Hardie or LP SmartSide-style)",
        "brick-veneer": "painted-brick or brick-with-trim",
        "stucco": "three-coat hard-coat stucco",
        "vinyl": "vinyl panel (trim painting only on most homes)",
        "engineered-wood": "engineered wood lap (LP SmartSide-style)",
      };
      const sub = subLabel[s.dominant_substrate] || s.dominant_substrate.replace(/-/g, " ");
      return `Repainting a 1,500 sq ft home in ${s.name} typically runs ${money(s.avg_repaint_low)}–${money(s.avg_repaint_high)}, with ${sub} the dominant residential substrate driving prep scope. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_repaint_low",
    avgFieldHigh: "avg_repaint_high",
    climateFactsHTML: (s) => climateAndCodeFactsPaintingHTML(s),
    climateSectionHeading: (stateName) => `${stateName} climate & coatings drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing, lead-safe & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  "auto-repair": {
    fileSuffix: "-auto-repair-cost.html",
    cityFileSuffix: "-auto-repair-cost.html",
    pageTitle: (s) => `Auto Repair Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average front-axle brake pad + rotor replacement in ${s.name} runs ${money(s.avg_brake_low)}–${money(s.avg_brake_high)}, with shop labor rates ${money(s.labor_rate_low)}–${money(s.labor_rate_high)}/hour. Per-state inspection mandate, Right-to-Repair, ZEV, and license drivers explained.`,
    h1: (s) => `Auto Repair Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/auto-repair-cities.html",
    citiesDirLabel: "Auto repair cities",
    costGuideHref: "/auto-repair-cost-guide.html",
    quoteAnalyzerHref: "/auto-repair-quote-analyzer.html",
    estimatorHref: "/auto-repair-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Auto repair estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "auto repair",
    verticalLabelCap: "Auto Repair",
    pricingMetricLabel: "front-axle brake pad + rotor replacement",
    wageField: "automotive_tech_wage_mean_hourly",
    wageLabel: "BLS automotive technician wage",
    wageSourceLabel: "BLS OEWS automotive service technician + mechanic mean",
    sitemapFile: "sitemap.xml",
    introHero: (s, vConf) => {
      const inspLabel = {
        "yes-annual": "annual state safety inspection mandatory",
        "yes-biennial": "biennial state safety inspection mandatory",
        "yes-emissions-only": "emissions-only inspection mandatory (no separate safety inspection)",
        "yes-emissions-metro-only": "metropolitan emissions inspection only",
        "yes-on-transfer": "safety inspection only on transfer of ownership",
        "no": "no state safety or emissions inspection mandate",
      };
      const insp = inspLabel[s.state_inspection_required] || s.state_inspection_required.replace(/-/g, " ");
      return `Auto repair shops in ${s.name} typically charge ${money(s.labor_rate_low)}–${money(s.labor_rate_high)}/hour, with a front-axle brake pad and rotor replacement running ${money(s.avg_brake_low)}–${money(s.avg_brake_high)}. ${s.name} is a ${insp} state. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_brake_low",
    avgFieldHigh: "avg_brake_high",
    climateFactsHTML: (s) => climateAndCodeFactsAutoRepairHTML(s),
    climateSectionHeading: (stateName) => `${stateName} inspection, R2R & ZEV drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  window: {
    fileSuffix: "-window-cost.html",
    cityFileSuffix: "-window-cost.html",
    pageTitle: (s) => `Window Replacement Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average 10-window 1500 sq ft single-story full-house residential window replacement in ${s.name} runs ${money(s.avg_window_low)}–${money(s.avg_window_high)}. Per-state ENERGY STAR climate zone, U-factor, hurricane impact-rated, historic-district, and license drivers explained.`,
    h1: (s) => `Window Replacement Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/window-cities.html",
    citiesDirLabel: "Window cities",
    costGuideHref: "/window-replacement-cost-guide.html",
    quoteAnalyzerHref: "/window-quote-analyzer.html",
    estimatorHref: "/window-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Window estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "window replacement",
    verticalLabelCap: "Window Replacement",
    pricingMetricLabel: "10-window 1,500 sq ft single-story full-house window replacement",
    wageField: "carpenter_window_installer_wage_mean_hourly",
    wageLabel: "BLS carpenter wage",
    wageSourceLabel: "BLS OEWS carpenter (window installers) mean",
    sitemapFile: "sitemap-window.xml",
    introHero: (s, vConf) => {
      const matLabel = {
        "vinyl": "vinyl-frame double-hung",
        "wood": "wood-frame double-hung",
        "aluminum-clad-wood": "aluminum-clad wood-frame",
        "fiberglass": "pultruded fiberglass-frame",
        "composite-pultruded": "composite-pultruded frame",
        "aluminum": "aluminum-frame",
      };
      const mat = matLabel[s.dominant_frame_material] || s.dominant_frame_material.replace(/-/g, " ");
      const shgcText = s.max_shgc === "no-limit" ? "no SHGC limit" : `SHGC ≤ ${s.max_shgc}`;
      return `Window replacements in ${s.name} typically run ${money(s.avg_window_low)}–${money(s.avg_window_high)} for a ${vConf.pricingMetricLabel}, with ${mat} the dominant residential choice and ENERGY STAR ${s.energy_star_climate_zone} climate-zone glazing requirements (U-factor ≤ ${s.max_u_factor}, ${shgcText}). ${s.climate_concern}`;
    },
    avgFieldLow: "avg_window_low",
    avgFieldHigh: "avg_window_high",
    climateFactsHTML: (s) => climateAndCodeFactsWindowHTML(s),
    climateSectionHeading: (stateName) => `${stateName} climate, wind & energy-code drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing, lead-safe & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  "garage-door": {
    fileSuffix: "-garage-door-cost.html",
    cityFileSuffix: "-garage-door-cost.html",
    pageTitle: (s) => `Garage Door Replacement Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average 16x7 single-bay or 18x7 double-bay garage door installation in ${s.name} runs ${money(s.avg_install_low)}–${money(s.avg_install_high)}. Per-state hurricane wind rating, R-value, HOA, and license drivers explained.`,
    h1: (s) => `Garage Door Replacement Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/garage-door-cities.html",
    citiesDirLabel: "Garage door cities",
    costGuideHref: "/garage-door-cost-guide.html",
    quoteAnalyzerHref: "/garage-door-quote-analyzer.html",
    estimatorHref: "/garage-door-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Garage door estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "garage door installation",
    verticalLabelCap: "Garage Door Installation",
    pricingMetricLabel: "16x7 single-bay or 18x7 double-bay steel-insulated garage door + opener replacement",
    wageField: "garage_door_installer_wage_mean_hourly",
    wageLabel: "BLS garage-door installer wage",
    wageSourceLabel: "BLS OEWS home-appliance-repairer / carpenter (garage-door installers) blend",
    sitemapFile: "sitemap-garage-door.xml",
    introHero: (s, vConf) => {
      const matLabel = {
        "steel-insulated": "steel-insulated panel",
        "aluminum-glass": "aluminum-glass full-view",
        "wood-composite": "wood-composite carriage-house",
        "wood-solid": "solid-wood carriage-house",
        "fiberglass": "fiberglass panel",
        "vinyl": "vinyl panel",
      };
      const mat = matLabel[s.dominant_door_material] || s.dominant_door_material.replace(/-/g, " ");
      return `Garage door replacements in ${s.name} typically run ${money(s.avg_install_low)}–${money(s.avg_install_high)} for a ${vConf.pricingMetricLabel}, with ${mat} the dominant residential choice and ${s.design_wind_speed_mph} mph ASCE 7-22 design wind speed driving DASMA wind-pressure rating selection. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_install_low",
    avgFieldHigh: "avg_install_high",
    climateFactsHTML: (s) => climateAndCodeFactsGarageDoorHTML(s),
    climateSectionHeading: (stateName) => `${stateName} climate, wind & HOA drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  foundation: {
    fileSuffix: "-foundation-cost.html",
    cityFileSuffix: "-foundation-cost.html",
    pageTitle: (s) => `Foundation Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average full-house 2,000 sq ft new-construction foundation pour in ${s.name} runs ${money(s.avg_foundation_low)}–${money(s.avg_foundation_high)}. Per-state frost depth, expansive soil, seismic, hurricane tie-down, and radon-zone drivers explained.`,
    h1: (s) => `Foundation Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/foundation-cities.html",
    citiesDirLabel: "Foundation cities",
    costGuideHref: "/foundation-cost-guide.html",
    quoteAnalyzerHref: "/foundation-quote-analyzer.html",
    estimatorHref: "/foundation-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Foundation estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "foundation pour",
    verticalLabelCap: "Foundation",
    pricingMetricLabel: "full-house 2,000 sq ft new-construction foundation pour",
    wageField: "construction_laborer_wage_mean_hourly",
    wageLabel: "BLS construction-laborer wage",
    wageSourceLabel: "BLS OEWS construction-laborer (foundation work) mean",
    sitemapFile: "sitemap-foundation.xml",
    introHero: (s, vConf) => {
      const typeLabel = {
        "basement": "full basement pour",
        "slab-on-grade": "slab-on-grade",
        "crawl-space": "crawl-space stem-wall",
        "pier-and-beam": "pier-and-beam pile-supported",
        "pile-supported": "driven-pile pile-supported",
        "mixed-basement-slab": "mixed basement-and-slab",
      };
      const type = typeLabel[s.dominant_foundation_type] || s.dominant_foundation_type.replace(/-/g, " ");
      return `New-construction foundation pours in ${s.name} typically run ${money(s.avg_foundation_low)}–${money(s.avg_foundation_high)} for a ${vConf.pricingMetricLabel}, with ${type} as the dominant residential foundation type. Buried footings must clear the ${s.frost_line_inches}-inch design frost line. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_foundation_low",
    avgFieldHigh: "avg_foundation_high",
    climateFactsHTML: (s) => climateAndCodeFactsFoundationHTML(s),
    climateSectionHeading: (stateName) => `${stateName} climate, soil, seismic & hydrologic drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing & permits`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  legal: {
    fileSuffix: "-legal-cost.html",
    cityFileSuffix: "-legal-cost.html",
    pageTitle: (s) => `Lawyer & Legal Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average uncontested no-fault divorce filing in ${s.name} runs ${money(s.avg_divorce_low)}–${money(s.avg_divorce_high)} (attorney + court fees). Per-state bar admission, UPL enforcement, divorce grounds, and personal-injury statute drivers explained.`,
    h1: (s) => `Lawyer & Legal Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/legal-cities.html",
    citiesDirLabel: "Legal cities",
    costGuideHref: "/legal-cost-guide.html",
    quoteAnalyzerHref: "/legal-quote-analyzer.html",
    estimatorHref: "/legal-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Legal estimate",
    estimatorLinkSubtitle: "Get a flat-fee or hourly attorney cost",
    verticalLabel: "legal services",
    verticalLabelCap: "Legal Services",
    pricingMetricLabel: "uncontested no-fault divorce filing (attorney + court fees)",
    wageField: "attorney_wage_mean_hourly",
    wageLabel: "BLS attorney wage",
    wageSourceLabel: "BLS OEWS lawyers (SOC 23-1011) state mean",
    sitemapFile: "sitemap.xml",
    introHero: (s, vConf) => {
      const barLabel = {
        "ube-adopter": `UBE adopter at a ${s.ube_score_required} minimum score`,
        "non-ube": "non-UBE jurisdiction with a state-specific bar exam",
        "diploma-privilege": "the only diploma-privilege jurisdiction in the U.S.",
      };
      const bar = barLabel[s.bar_admission_status] || s.bar_admission_status;
      return `Hiring an attorney in ${s.name} for an uncontested no-fault divorce typically runs ${money(s.avg_divorce_low)}–${money(s.avg_divorce_high)} including ${vConf.pricingMetricLabel.replace("uncontested no-fault divorce filing ", "")}, with the state bar's ${bar}. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_divorce_low",
    avgFieldHigh: "avg_divorce_high",
    climateFactsHTML: (s) => climateAndCodeFactsLegalHTML(s),
    climateSectionHeading: (stateName) => `${stateName} bar admission, divorce & tort drivers`,
    licensingSectionHeading: (stateName) => `${stateName} bar admission & UPL`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
  },
  fencing: {
    fileSuffix: "-fence-cost.html",
    cityFileSuffix: "-fence-cost.html",
    pageTitle: (s) => `Fence Installation Cost in ${s.name} (2026) | Woogoro`,
    pageDescription: (s) => `Average 150 linear-foot 6-ft privacy fence in ${s.name} runs ${money(s.avg_fence_install_low)}–${money(s.avg_fence_install_high)}. Per-state frost-line, HOA, termite, hurricane, and good-neighbor law drivers explained.`,
    h1: (s) => `Fence Installation Cost in ${s.name} (2026)`,
    breadcrumbHubLabel: "All Cities",
    breadcrumbHubHref: "/all-cities.html",
    citiesDirHref: "/fencing-cities.html",
    citiesDirLabel: "Fencing cities",
    costGuideHref: "/fencing-cost-guide.html",
    quoteAnalyzerHref: "/fencing-quote-analyzer.html",
    estimatorHref: "/fencing-quote-analyzer.html?mode=estimator",
    estimatorLinkLabel: "Fence estimate",
    estimatorLinkSubtitle: "Enter your address, get a price",
    verticalLabel: "fence installation",
    verticalLabelCap: "Fence Installation",
    pricingMetricLabel: "150 linear-foot 6-foot cedar privacy fence with three gates",
    wageField: "fence_installer_wage_mean_hourly",
    wageLabel: "BLS construction-laborer wage",
    wageSourceLabel: "BLS OEWS construction-laborer (fence installers) mean",
    sitemapFile: "sitemap-fence.xml",
    introHero: (s, vConf) => {
      const matLabel = {
        "cedar-privacy": "6-foot western red cedar privacy",
        "pine-treated": "6-foot pressure-treated southern yellow pine",
        "vinyl": "6-foot vinyl panel",
        "chain-link": "4-to-6-foot galvanized chain-link",
        "wrought-iron": "5-foot ornamental aluminum or wrought-iron",
        "composite": "6-foot composite plastic-wood-blend",
      };
      const mat = matLabel[s.dominant_material] || s.dominant_material.replace(/-/g, " ");
      return `Installing 150 linear feet of fencing in ${s.name} typically runs ${money(s.avg_fence_install_low)}–${money(s.avg_fence_install_high)}, with ${mat} the dominant residential choice. Concrete-set posts must clear the ${s.frost_line_inches}-inch design frost line. ${s.climate_concern}`;
    },
    avgFieldLow: "avg_fence_install_low",
    avgFieldHigh: "avg_fence_install_high",
    climateFactsHTML: (s) => climateAndCodeFactsFencingHTML(s),
    climateSectionHeading: (stateName) => `${stateName} climate & post-design drivers`,
    licensingSectionHeading: (stateName) => `${stateName} licensing, HOA & boundary law`,
    costsVarySectionHeading: (stateName, vConf) =>
      `How ${vConf.verticalLabel} costs vary in ${stateName}`,
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
  const lowField = vConf.avgFieldLow || "avg_replacement_low";
  const highField = vConf.avgFieldHigh || "avg_replacement_high";
  const range = `${money(state[lowField])} – ${money(state[highField])}`;
  const wageVal = state[vConf.wageField];
  const wage = `$${Number(wageVal).toFixed(2)}/hr`;
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
          <strong>${escapeHtml(vConf.wageLabel)}</strong>
          <span>${wage}</span>
        </div>
      </div>`;
}

function climateAndCodeFactsHvacHTML(state) {
  const fuelLabel = {
    "natural-gas": "Natural gas — piped utility supply through state pipeline network",
    "electricity-heat-pump": "Electricity (heat pump) — air-source HPs as primary heat",
    "electric-resistance": "Electric resistance — baseboard or strip heat",
    "fuel-oil": "Fuel oil — delivered #2 heating oil, common in older Northeast housing",
    "propane": "Propane — delivered LP gas, common in rural areas without pipeline service",
  };
  const coolingLabel = {
    "central-ac": "Central air conditioning paired with separate heating equipment",
    "heat-pump": "Air-source heat pump providing both heating and cooling",
    "mini-split": "Ductless mini-split heat pumps as primary HVAC",
    "window-only": "Window or portable units — central cooling not standard",
  };
  const splitLabel = {
    cooling_dominant: "Cooling-dominant — annual cooling load exceeds heating load",
    heating_dominant: "Heating-dominant — annual heating load exceeds cooling load",
    balanced: "Balanced — heating and cooling loads roughly equal",
  };
  const items = [
    `<li><strong>IECC climate zone:</strong> ${escapeHtml(state.iecc_zone)}</li>`,
    `<li><strong>Annual load split:</strong> ${escapeHtml(splitLabel[state.climate_split] || state.climate_split)} (${state.hdd_annual.toLocaleString()} HDD / ${state.cdd_annual.toLocaleString()} CDD)</li>`,
    `<li><strong>Dominant heating fuel:</strong> ${escapeHtml(fuelLabel[state.dominant_heating_fuel] || state.dominant_heating_fuel)}</li>`,
    `<li><strong>Dominant cooling system:</strong> ${escapeHtml(coolingLabel[state.dominant_cooling_system] || state.dominant_cooling_system)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsPlumbingHTML(state) {
  const codeLabel = {
    "uniform-plumbing-code": "Uniform Plumbing Code (UPC) — IAPMO model adopted statewide",
    "international-plumbing-code": "International Plumbing Code (IPC) — ICC model adopted statewide",
    "state-specific": "State-specific plumbing code (deviates from both UPC and IPC)",
  };
  const supplyLabel = {
    "copper": "Type-L copper — dominant on retrofits in high-soft-water and pre-1990 housing stock",
    "pex": "PEX-A or PEX-B cross-linked polyethylene — dominant on whole-house repipes since 2005",
    "cpvc": "CPVC chlorinated PVC — dominant retrofit choice in slab-on-grade Sun-Belt construction",
    "galvanized-mixed": "Mixed copper-and-galvanized — common in incomplete pre-1980 retrofits, prone to galvanic corrosion",
  };
  const hardnessLabel = {
    "soft": "Soft (under 3.5 grains/gallon) — minimal scaling, no softener required",
    "moderate": "Moderate (3.5–7 grains/gallon) — periodic appliance descaling recommended",
    "hard": "Hard (7–10.5 grains/gallon) — softener cost-effective on tankless and water-heater retrofits",
    "very-hard": "Very hard (10.5+ grains/gallon) — whole-house softener standard on most repipes",
  };
  const lslLabel = {
    "high": "High — pre-1986 lead service line corridor under active LCRR replacement",
    "moderate": "Moderate — partial pre-1986 service line inventory under utility review",
    "low": "Low — minimal pre-1986 lead service line installations",
  };
  const items = [
    `<li><strong>IECC climate zone:</strong> ${escapeHtml(state.iecc_zone)} — drives freeze-protection scope on supply lines</li>`,
    `<li><strong>Frost-line trench depth:</strong> ${state.frost_line_inches}-inch design minimum for buried water service</li>`,
    `<li><strong>Water hardness profile:</strong> ${escapeHtml(hardnessLabel[state.water_hardness_tier] || state.water_hardness_tier)}</li>`,
    `<li><strong>Dominant retrofit supply material:</strong> ${escapeHtml(supplyLabel[state.dominant_supply_material] || state.dominant_supply_material)}</li>`,
    `<li><strong>Adopted plumbing code basis:</strong> ${escapeHtml(codeLabel[state.code_basis] || state.code_basis)}</li>`,
    `<li><strong>Lead service line risk tier:</strong> ${escapeHtml(lslLabel[state.lead_service_line_risk] || state.lead_service_line_risk)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsRoofHTML(state) {
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

function climateAndCodeFactsElectricalHTML(state) {
  const codeYearLabel = {
    "2017": "2017 NEC — older adoption cycle, local amendments common",
    "2020": "2020 NEC — dwelling unit AFCI on most 120V branch circuits, GFCI expanded",
    "2023": "2023 NEC — current cycle with expanded GFCI on dwelling outdoor and 250V circuits, EV charging requirements",
  };
  const lightningLabel = {
    "very-high": "Very high — central Florida and Gulf Coast lightning corridor (10+ flashes/sq mi/yr)",
    "high": "High — Southeast and lower Plains lightning belt",
    "moderate": "Moderate — typical interior continental flash density",
    "low": "Low — Pacific coastal and high desert minimal flash density",
  };
  const conduitLabel = {
    "deep": "30-inch+ design depth — buried service conduit must clear hard frost line",
    "moderate": "18-to-24-inch design depth on buried service conduit",
    "shallow": "12-to-18-inch design depth on buried service conduit",
  };
  const items = [
    `<li><strong>Adopted code basis:</strong> ${escapeHtml(codeYearLabel[state.nec_code_year] || state.nec_code_year)}</li>`,
    `<li><strong>State amendments:</strong> ${escapeHtml(state.nec_amendment_summary)}</li>`,
    `<li><strong>Service entrance minimum:</strong> ${escapeHtml(state.service_size_typical)} for new residential construction</li>`,
    `<li><strong>Lightning flash density:</strong> ${escapeHtml(lightningLabel[state.lightning_tier] || state.lightning_tier)}</li>`,
    `<li><strong>Buried-conduit frost depth:</strong> ${escapeHtml(conduitLabel[state.conduit_depth_class] || state.conduit_depth_class)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsSidingHTML(state) {
  const matLabel = {
    "vinyl": "Vinyl panel — dominant low-budget retrofit choice in non-WUI, non-coastal corridors",
    "fiber-cement": "Fiber-cement plank — dominant in WUI fire-zone and high-humidity Sun Belt",
    "brick-veneer": "Brick veneer — dominant in tornado-alley and historic-district overlays",
    "stucco": "Three-coat hard-coat stucco — dominant in arid and Mediterranean Sun Belt",
    "wood": "Cedar lap or shake — dominant in Pacific Northwest and historic Northeast",
    "engineered-wood": "Engineered wood lap — dominant in Sun Belt subdivision new-build retrofits",
  };
  const windLabel = {
    "HVHZ": "High-Velocity Hurricane Zone (HVHZ) — Miami-Dade and Broward fastener-test approval mandatory",
    "wind_high": "High wind exposure — 140 mph+ design wind on coastal counties",
    "wind_moderate": "Moderate wind exposure — 110–140 mph design wind on coastal counties",
    "wind_low": "Low wind exposure — sub-110 mph design wind",
    "none": "No hurricane wind-design exposure",
  };
  const wuiLabel = {
    "required-statewide": "Statewide ignition-resistant cladding required in WUI overlay",
    "regional": "Regional WUI overlay — ignition-resistant cladding required in mapped fire-hazard zones",
    "none": "No statewide WUI cladding mandate",
  };
  const saltLabel = {
    "high-coastal": "High-corrosion coastal — stainless or hot-dipped galvanized fasteners required within 3,000 ft of saltwater",
    "moderate-coastal": "Moderate-corrosion coastal — stainless fasteners recommended on bayfront and tidal exposures",
    "low": "Low salt-air corrosion — standard galvanized fasteners adequate",
    "none": "No salt-air corrosion exposure (interior continental)",
  };
  const items = [
    `<li><strong>IECC climate zone:</strong> ${escapeHtml(state.iecc_zone)}</li>`,
    `<li><strong>Dominant residential cladding:</strong> ${escapeHtml(matLabel[state.dominant_material] || state.dominant_material)}</li>`,
    `<li><strong>Hurricane wind tier:</strong> ${escapeHtml(windLabel[state.wind_tier] || state.wind_tier)}</li>`,
    `<li><strong>Wildland-urban interface (WUI) cladding rule:</strong> ${escapeHtml(wuiLabel[state.wui_fire_requirement] || state.wui_fire_requirement)}</li>`,
    `<li><strong>Salt-air corrosion zone:</strong> ${escapeHtml(saltLabel[state.salt_corrosion_zone] || state.salt_corrosion_zone)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsGutterHTML(state) {
  const matLabel = {
    "aluminum-k-style-5in": "5-inch K-style seamless aluminum — dominant low-rainfall retrofit profile",
    "aluminum-k-style-6in": "6-inch oversized K-style seamless aluminum — dominant in high-rainfall and steep-pitch corridors",
    "copper": "16 oz half-round copper — dominant in historic-district overlays and high-end coastal",
    "galvanized-steel": "G90 galvanized steel — dominant in high-snow-load and ice-dam corridors",
  };
  const iceLabel = {
    "high": "High — sustained sub-freezing winter requires ice-and-water shield + heat-cable retrofit budget",
    "moderate": "Moderate — periodic ice-dam events on north-facing eaves",
    "low": "Low — occasional freeze events, minimal ice-dam history",
    "none": "No ice-dam exposure",
  };
  const canopyLabel = {
    "high": "High — mature deciduous canopy drives gutter-guard demand and 2x annual cleaning frequency",
    "moderate": "Moderate — mixed canopy, gutter guards optional",
    "low": "Low — sparse canopy, standard open gutters adequate",
  };
  const tierLabel = {
    HVHZ: "HVHZ — Miami-Dade NOA strap-mount required",
    wind_high: "High — 140 mph+ design wind on coastal counties",
    wind_moderate: "Moderate — 110–140 mph design wind",
    wind_low: "Low — sub-110 mph design wind",
    none: "None",
  };
  const items = [
    `<li><strong>Annual rainfall:</strong> ${state.annual_rainfall_inches} inches/yr — drives K-style sizing and downspout count</li>`,
    `<li><strong>Dominant residential gutter profile:</strong> ${escapeHtml(matLabel[state.dominant_gutter_material] || state.dominant_gutter_material)}</li>`,
    `<li><strong>Ground snow load:</strong> ${state.snow_load_psf} psf — drives gutter bracket spacing and ice-shield requirements</li>`,
    `<li><strong>Ice-dam risk tier:</strong> ${escapeHtml(iceLabel[state.ice_dam_risk] || state.ice_dam_risk)}</li>`,
    `<li><strong>Hurricane wind tier:</strong> ${escapeHtml(tierLabel[state.hurricane_tier] || state.hurricane_tier)}</li>`,
    `<li><strong>Tree-canopy density:</strong> ${escapeHtml(canopyLabel[state.tree_canopy_density] || state.tree_canopy_density)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsConcreteHTML(state) {
  const ftLabel = {
    "F0": "F0 — no freeze-thaw exposure, no air-entrainment required",
    "F1": "F1 — moderate freeze-thaw, 4.5-6% air-entrainment recommended",
    "F2": "F2 — severe freeze-thaw + de-icer exposure, 5-7% air-entrainment required",
    "F3": "F3 — most severe freeze-thaw + heavy de-icer use, 6-8% air-entrainment + 0.40 max w/c required",
  };
  const expansiveLabel = {
    "very-high": "Very high — bentonitic clay subsoil drives post-tension foundation requirement",
    "high": "High — expansive clay subsoil requires geotechnical investigation + reinforced footings",
    "moderate": "Moderate — periodic clay shrink-swell, standard footing reinforcement adequate",
    "low": "Low — sandy or stable subsoil, standard slab-on-grade design",
    "none": "None — non-expansive subsoil",
  };
  const sulfateLabel = {
    "S0": "S0 — no sulfate exposure, Type I/II cement adequate",
    "S1": "S1 — moderate sulfate exposure, ASTM C150 Type II cement required",
    "S2": "S2 — severe sulfate exposure, ASTM C150 Type II/V cement required",
    "S3": "S3 — very severe sulfate exposure, ASTM C150 Type V cement required + low w/c",
  };
  const sdcLabel = {
    "A": "SDC A — no seismic design considerations",
    "B": "SDC B — minor seismic risk, standard tie-down requirements",
    "C": "SDC C — moderate seismic risk, continuous-rebar-tie footings required",
    "D0": "SDC D0 — high seismic risk, full ASCE 7-22 detailing requirements",
    "D1": "SDC D1 — high seismic risk + Special Inspector continuous observation required",
    "D2": "SDC D2 — highest seismic risk, full ASCE 7-22 + Special Inspector + post-tension foundation typical",
    "E": "SDC E — extreme seismic, near-fault design required",
    "F": "SDC F — extreme seismic, special structural design required",
  };
  const saltLabel = {
    "very-high": "Very high — heavy de-icer use drives 0.40 max w/c + epoxy-coated rebar",
    "high": "High — winter de-icing salt drives air-entrainment + corrosion-protected rebar",
    "moderate": "Moderate — periodic de-icer use",
    "low": "Low — minimal winter de-icer use",
    "none": "None — no winter de-icer exposure",
  };
  const items = [
    `<li><strong>Frost-line trench depth:</strong> ${state.frost_line_inches}-inch design minimum for buried footings</li>`,
    `<li><strong>Freeze-thaw exposure (ACI 201.2R):</strong> ${escapeHtml(ftLabel[state.freeze_thaw_exposure] || state.freeze_thaw_exposure)}</li>`,
    `<li><strong>Typical residential mix:</strong> ${state.typical_psi} psi compressive strength</li>`,
    `<li><strong>Expansive soil risk:</strong> ${escapeHtml(expansiveLabel[state.expansive_soil_risk] || state.expansive_soil_risk)}</li>`,
    `<li><strong>Sulfate exposure (ACI 318):</strong> ${escapeHtml(sulfateLabel[state.sulfate_exposure_class] || state.sulfate_exposure_class)}</li>`,
    `<li><strong>Seismic design category (ASCE 7-22):</strong> ${escapeHtml(sdcLabel[state.seismic_design_category] || state.seismic_design_category)}</li>`,
    `<li><strong>Winter de-icer salt exposure:</strong> ${escapeHtml(saltLabel[state.salt_de_icer_exposure] || state.salt_de_icer_exposure)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsInsulationHTML(state) {
  const codeLabel = {
    "iecc-2021": "IECC 2021 — current cycle, full mandatory R-49 attic + R-20 wall + air-sealing requirements",
    "iecc-2018": "IECC 2018 — prior cycle, R-49 attic + R-20 wall, advisory air-sealing",
    "iecc-2015": "IECC 2015 — older cycle, R-49 attic + R-20 wall (cold) or R-38 (warm)",
    "iecc-2012": "IECC 2012 — legacy cycle, R-49 attic + R-20 wall",
    "iecc-2009": "IECC 2009 — oldest active cycle, R-38/R-49 attic + R-13 wall",
    "state-specific": "State-specific code (deviates from IECC baseline — typically more restrictive)",
    "no-statewide-code": "No statewide residential energy code — municipal adoption only",
  };
  const matLabel = {
    "blown-cellulose": "Blown cellulose loose-fill — dominant in heating-dominant Northeast and Upper Midwest",
    "fiberglass-batt": "Fiberglass batt rolled-and-cut — dominant on new construction wall cavity",
    "blown-fiberglass": "Blown fiberglass loose-fill — dominant in cooling-dominant Sun Belt",
    "spray-foam-closed-cell": "Closed-cell spray polyurethane foam at the roofline — dominant in coastal humid + extreme cold",
    "spray-foam-open-cell": "Open-cell spray polyurethane foam at the roofline — dominant in mixed-humid retrofits",
  };
  const vbLabel = {
    "warm-side": "Warm-side vapor retarder required (typical IECC zones 5+)",
    "no-statewide-rule": "No statewide vapor retarder rule — climate zone determines",
    "climate-specific": "Climate-zone-specific vapor retarder rule (varies within state)",
  };
  const iraLabel = {
    "live": "Live — IRA HOMES + HEER rebates currently available to residential homeowners",
    "launching": "Launching — state energy office implementation underway, rebates expected within 12 months",
    "planning": "Planning — IRA implementation plan filed with DOE, rebates pending state legislature",
    "not-yet": "Not yet launched — no IRA HOMES + HEER timeline announced",
  };
  const items = [
    `<li><strong>IECC climate zone:</strong> ${escapeHtml(state.iecc_zone)}</li>`,
    `<li><strong>Required attic R-value:</strong> R-${state.required_attic_r_value} (IECC 2021 prescriptive minimum)</li>`,
    `<li><strong>Required wall R-value:</strong> R-${state.required_wall_r_value} (above-grade wood-frame)</li>`,
    `<li><strong>Adopted energy code basis:</strong> ${escapeHtml(codeLabel[state.energy_code_basis] || state.energy_code_basis)}</li>`,
    `<li><strong>Stretch code available:</strong> ${state.stretch_code_available === "yes" ? "Yes — opt-in or mandatory above-baseline pathway" : "No — IECC base code only"}</li>`,
    `<li><strong>Annual heating + cooling load:</strong> ${state.hdd_annual.toLocaleString()} HDD / ${state.cdd_annual.toLocaleString()} CDD</li>`,
    `<li><strong>Vapor barrier requirement:</strong> ${escapeHtml(vbLabel[state.vapor_barrier_required] || state.vapor_barrier_required)}</li>`,
    `<li><strong>Dominant attic insulation material:</strong> ${escapeHtml(matLabel[state.dominant_attic_insulation] || state.dominant_attic_insulation)}</li>`,
    `<li><strong>IRA HOMES + HEER rebate status:</strong> ${escapeHtml(iraLabel[state.ira_rebate_program_status] || state.ira_rebate_program_status)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsLandscapingHTML(state) {
  const aestheticLabel = {
    "turf-dominant": "Turf-dominant — cool- or warm-season residential lawn as primary front-yard ground cover",
    "native-prairie": "Native-prairie — short-grass and forb meadow as dominant front-yard aesthetic",
    "xeriscape": "Xeriscape — drought-tolerant perennials with gravel or decomposed-granite mulch",
    "desert-adapted": "Desert-adapted — Sonoran or Mojave palette (cactus, palo verde, agave) on most front yards",
    "forest-edge": "Forest-edge — native-shrub and shade-perennial design under mature canopy",
    "coastal-mediterranean": "Coastal-mediterranean — Pacific NW natives or California Mediterranean palette",
  };
  const droughtLabel = {
    "extreme": "Extreme — multi-year drought cycles drive xeriscape adoption + statewide turf restrictions",
    "severe": "Severe — recurring drought drives turf-replacement rebate programs",
    "moderate": "Moderate — periodic drought, advisory water-saving guidelines",
    "low": "Low — adequate residential precipitation, minimal drought stress",
    "none": "None — no historical residential drought stress",
  };
  const irrigationLabel = {
    "very-high": "Very high — 60%+ of residential outdoor water for irrigation",
    "high": "High — 40-60% of residential outdoor water for irrigation",
    "moderate": "Moderate — periodic irrigation needed during dry season",
    "low": "Low — irrigation optional, established plants survive on rainfall",
    "none": "None — established plants thrive on natural precipitation",
  };
  const wuiLabel = {
    "required-statewide": "Statewide WUI defensible-space requirement on every property in fire-hazard zones",
    "regional": "Regional WUI defensible-space rule in mapped fire-hazard zones (CAL FIRE-style)",
    "advisory": "Advisory — state forestry recommends defensible-space cleanup in mapped fire zones",
    "none": "No WUI defensible-space requirement",
  };
  const items = [
    `<li><strong>USDA hardiness zone:</strong> ${escapeHtml(state.usda_hardiness_zone)} — drives plant-palette selection and frost-survival ratings</li>`,
    `<li><strong>Annual rainfall:</strong> ${state.annual_rainfall_inches} inches/yr — drives irrigation system sizing</li>`,
    `<li><strong>Growing season:</strong> ${state.growing_season_days} frost-free days per year</li>`,
    `<li><strong>Drought tier:</strong> ${escapeHtml(droughtLabel[state.drought_tier] || state.drought_tier)}</li>`,
    `<li><strong>Irrigation dependency:</strong> ${escapeHtml(irrigationLabel[state.irrigation_dependency] || state.irrigation_dependency)}</li>`,
    `<li><strong>Frost-line trench depth:</strong> ${state.frost_line_inches}-inch design minimum for irrigation backflow + bed prep</li>`,
    `<li><strong>Dominant residential aesthetic:</strong> ${escapeHtml(aestheticLabel[state.dominant_landscape_type] || state.dominant_landscape_type)}</li>`,
    `<li><strong>Wildfire defensible-space rule:</strong> ${escapeHtml(wuiLabel[state.wui_defensible_space_rule] || state.wui_defensible_space_rule)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsPaintingHTML(state) {
  const subLabel = {
    "wood-lap": "Wood lap or shake — dominant pre-1990 substrate, drives full prep + caulk + prime + 2-coat",
    "fiber-cement": "Fiber-cement plank (Hardie or LP SmartSide-style) — dominant post-2000 Sun Belt subdivision substrate",
    "brick-veneer": "Painted brick or brick-with-trim — dominant in tornado-alley and historic-district overlays",
    "stucco": "Three-coat hard-coat stucco — dominant in arid and Sun Belt corridors, drives elastomeric topcoats",
    "vinyl": "Vinyl panel — paint scope reduced to wood trim, doors, and shutters on most homes",
    "engineered-wood": "Engineered wood lap — dominant Sun Belt subdivision retrofit substrate",
  };
  const humidityLabel = {
    "very-high": "Very high — 75%+ year-round drives mildew bloom + biocide-additive coatings",
    "high": "High — extended summer humidity drives mildewcide-additive topcoats",
    "moderate": "Moderate — typical continental humidity, standard topcoat formulations adequate",
    "low": "Low — arid climate, dust-staining is the larger contamination risk",
    "very-low": "Very low — extreme arid, no mildew exposure",
  };
  const uvLabel = {
    "very-high": "Very high — 280+ sun-days drive Sun Belt-rated UV-stabilized binders + high-PVC TiO2 topcoats",
    "high": "High — long sun seasons drive south-facing fade in 5-7 years on standard topcoats",
    "moderate": "Moderate — typical continental UV, standard binder packages adequate",
    "low": "Low — Pacific NW or high-latitude diffuse light, fade not the primary failure mode",
  };
  const saltLabel = {
    "high-coastal": "High-corrosion coastal — marine-grade alkyd primer + stainless fastener replacement on every coastal repaint",
    "moderate-coastal": "Moderate-corrosion coastal — marine primer recommended on bayfront and tidal exposures",
    "low": "Low salt-air — standard primers adequate inland of 3,000 ft from saltwater",
    "none": "No salt-air corrosion exposure (interior continental)",
  };
  const freezeLabel = {
    "very-high": "Very high — 100+ annual freeze-thaw cycles drive caulk-and-recaulk on every repaint",
    "high": "High — 60-100 freeze-thaw cycles drive sealant inspection on every repaint",
    "moderate": "Moderate — periodic freeze events, standard caulk formulations adequate",
    "low": "Low — occasional freeze events",
    "none": "No freeze exposure",
  };
  const vocLabel = {
    "carb-strict": "CARB-strict — 50 g/L flat exterior topcoat limit (matches CA SCAQMD Rule 1113)",
    "otc-phase-ii": "OTC Phase II — 100 g/L flat exterior topcoat limit (Northeast/Mid-Atlantic)",
    "federal-default": "Federal default — 250 g/L flat exterior topcoat limit (EPA 40 CFR Part 59)",
  };
  const items = [
    `<li><strong>IECC climate zone:</strong> ${escapeHtml(state.iecc_zone)}</li>`,
    `<li><strong>Dominant residential substrate:</strong> ${escapeHtml(subLabel[state.dominant_substrate] || state.dominant_substrate)}</li>`,
    `<li><strong>Annual humidity tier:</strong> ${escapeHtml(humidityLabel[state.annual_humidity_tier] || state.annual_humidity_tier)}</li>`,
    `<li><strong>UV exposure:</strong> ${escapeHtml(uvLabel[state.uv_exposure_tier] || state.uv_exposure_tier)}</li>`,
    `<li><strong>Salt-air corrosion zone:</strong> ${escapeHtml(saltLabel[state.salt_corrosion_zone] || state.salt_corrosion_zone)}</li>`,
    `<li><strong>Freeze-thaw cycling:</strong> ${escapeHtml(freezeLabel[state.freeze_thaw_cycles] || state.freeze_thaw_cycles)}</li>`,
    `<li><strong>VOC architectural coatings rule:</strong> ${escapeHtml(vocLabel[state.voc_regulation_tier] || state.voc_regulation_tier)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsFencingHTML(state) {
  const matLabel = {
    "cedar-privacy": "Western red cedar privacy — dominant in moderate-climate suburban subdivisions",
    "pine-treated": "Pressure-treated southern yellow pine — dominant low-budget Sun Belt and Plains",
    "vinyl": "Vinyl panel — dominant in HOA-heavy Sun Belt and termite-risk corridors",
    "chain-link": "Galvanized chain-link — dominant in rural and utility-yard applications",
    "wrought-iron": "Ornamental aluminum or wrought-iron — dominant in HOA front-yard and historic-district overlays",
    "composite": "Composite plastic-wood-blend — dominant in coastal salt-spray and high-termite Sun Belt",
  };
  const windLabel = {
    HVHZ: "HVHZ — Miami-Dade engineered post-spacing and concrete-set required",
    wind_high: "High — 140 mph+ design wind drives 8-foot post spacing max and concrete sleeves",
    wind_moderate: "Moderate — 110–140 mph design wind drives 8-foot post spacing",
    wind_low: "Low — sub-110 mph design wind, standard 8-foot post spacing",
    none: "No hurricane wind-design exposure",
  };
  const termiteLabel = {
    "very-high": "Very high — TPCT zone 1, all in-ground wood requires PT southern yellow pine .60 CCA or alternative",
    "high": "High — TPCT zone 2, PT post requirement",
    "moderate": "Moderate — periodic termite pressure",
    "low": "Low — minimal termite pressure",
  };
  const hoaLabel = {
    "high": "High — large planned-community HOA penetration restricts material/color/height",
    "moderate": "Moderate — suburban HOA prevalence on newer subdivisions",
    "low": "Low — limited HOA fencing restrictions outside metro subdivisions",
  };
  const items = [
    `<li><strong>Frost-line trench depth:</strong> ${state.frost_line_inches}-inch design minimum for post footings</li>`,
    `<li><strong>Dominant residential fence material:</strong> ${escapeHtml(matLabel[state.dominant_material] || state.dominant_material)}</li>`,
    `<li><strong>Hurricane wind tier:</strong> ${escapeHtml(windLabel[state.wind_tier] || state.wind_tier)}</li>`,
    `<li><strong>Termite pressure (TPCT zone):</strong> ${escapeHtml(termiteLabel[state.termite_risk] || state.termite_risk)}</li>`,
    `<li><strong>HOA fencing-rule prevalence:</strong> ${escapeHtml(hoaLabel[state.hoa_prevalence] || state.hoa_prevalence)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsAutoRepairHTML(state) {
  const inspLabel = {
    "yes-annual": "Annual state safety inspection — mandatory periodic inspection at every annual registration renewal",
    "yes-biennial": "Biennial state safety inspection — mandatory periodic inspection every two years",
    "yes-emissions-only": "Emissions-only inspection mandatory (no separate safety inspection)",
    "yes-emissions-metro-only": "Metropolitan emissions inspection only — no statewide safety inspection",
    "yes-on-transfer": "Safety inspection only on transfer of ownership (not periodic)",
    "no": "No state safety or emissions inspection mandate",
  };
  const emissLabel = {
    "yes-statewide": "Statewide Title-II Clean Air Act emissions inspection mandatory",
    "yes-metropolitan": "Metropolitan-only Title-II Clean Air Act emissions inspection (selected counties)",
    "no": "No state emissions inspection program",
  };
  const r2rLabel = {
    "enacted": "Enacted — state Right-to-Repair (R2R) statute requires manufacturer data access for independent shops",
    "pending": "Pending — R2R legislation introduced and active in state legislature",
    "federal-preemption-only": "Federal preemption only — relies on MAGNUSON-MOSS Warranty Act federal framework",
    "no-state-law": "No state R2R law and no pending legislation",
  };
  const zevLabel = {
    "carb-leader": "CARB leader — sets the national ZEV standard, Clean Cars II at 100% ZEV by 2035",
    "section-177-adopter": "§177 adopter — one of 17 states adopting CARB Clean Cars II ZEV mandate",
    "federal-only": "Federal-only — no state ZEV mandate, EPA federal CO2 standards apply",
  };
  const chainLabel = {
    "dealership-dominant": "Dealership-dominant — manufacturer-affiliated shops capture majority of repairs",
    "independent-shop-dominant": "Independent-shop-dominant — non-affiliated shops capture majority of repairs",
    "mixed": "Mixed — dealership and independent shops compete on roughly equal market share",
  };
  const items = [
    `<li><strong>State safety inspection:</strong> ${escapeHtml(inspLabel[state.state_inspection_required] || state.state_inspection_required)}</li>`,
    `<li><strong>Emissions inspection (Title-II Clean Air Act):</strong> ${escapeHtml(emissLabel[state.emissions_inspection_required] || state.emissions_inspection_required)}</li>`,
    `<li><strong>Right-to-Repair (R2R) status:</strong> ${escapeHtml(r2rLabel[state.right_to_repair_law_status] || state.right_to_repair_law_status)}</li>`,
    `<li><strong>ZEV / EV mandate:</strong> ${escapeHtml(zevLabel[state.ev_mandate_zev_program] || state.ev_mandate_zev_program)}</li>`,
    `<li><strong>Dominant repair channel:</strong> ${escapeHtml(chainLabel[state.dominant_repair_chain] || state.dominant_repair_chain)}</li>`,
    `<li><strong>Shop density per 100K population:</strong> ${escapeHtml(state.shop_density_per_100k)}</li>`,
    `<li><strong>Hourly labor rate range:</strong> ${"$" + state.labor_rate_low}–$${state.labor_rate_high}/hour</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsWindowHTML(state) {
  const zoneLabel = {
    "Northern": "Northern — coldest climates, U-factor priority (U ≤ 0.27 in coldest tier)",
    "North-Central": "North-Central — heating-dominant, balanced U-factor and SHGC (U ≤ 0.32, SHGC ≤ 0.40)",
    "South-Central": "South-Central — mixed climate, balanced U-factor and lower SHGC (U ≤ 0.32, SHGC ≤ 0.40)",
    "Southern": "Southern — cooling-dominant, low SHGC priority (U ≤ 0.40, SHGC ≤ 0.25)",
  };
  const matLabel = {
    "vinyl": "Vinyl frame — dominant in most climates, lowest cost-per-window",
    "wood": "Wood frame — dominant in historic-preservation overlays and luxury subdivisions",
    "aluminum-clad-wood": "Aluminum-clad wood — dominant in coastal salt-spray and Pacific NW corridors",
    "fiberglass": "Pultruded fiberglass — dominant in extreme cold and HVHZ Florida coastal exposure",
    "composite-pultruded": "Composite pultruded frame — premium specialty, gaining share in luxury cold-climate",
    "aluminum": "Aluminum frame — dominant in commercial-style retrofits, declining in residential",
  };
  const impactLabel = {
    "yes-statewide": "Statewide ASTM E1996 large-missile impact-rated requirement",
    "yes-coastal-counties": "Mandatory ASTM E1996 large-missile impact-rated in coastal counties only",
    "no-mandate": "No statewide impact-rated requirement",
  };
  const histLabel = {
    "very-high": "Very high — extensive historic-preservation overlays + mandatory profile/glazing-pattern review",
    "high": "High — multiple state-mapped historic districts with mandatory review",
    "moderate": "Moderate — selected metro historic districts with review",
    "low": "Low — limited historic-preservation review outside specific neighborhoods",
  };
  const leadLabel = {
    "very-high": "Very high — 60%+ pre-1978 housing share, mandatory EPA RRP lead-safe certification on every replacement",
    "high": "High — 40-60% pre-1978 housing share, EPA RRP required on most replacements",
    "moderate": "Moderate — 20-40% pre-1978 housing share, EPA RRP required on selected replacements",
    "low": "Low — sub-20% pre-1978 housing share, RRP rarely triggered",
  };
  const items = [
    `<li><strong>ENERGY STAR climate zone:</strong> ${escapeHtml(zoneLabel[state.energy_star_climate_zone] || state.energy_star_climate_zone)}</li>`,
    `<li><strong>IECC climate zone:</strong> ${escapeHtml(state.iecc_zone)}</li>`,
    `<li><strong>Maximum U-factor:</strong> ${state.max_u_factor} (IECC 2021 + state amendments)</li>`,
    `<li><strong>Maximum SHGC:</strong> ${state.max_shgc === "no-limit" ? "No limit (cold climate)" : escapeHtml(String(state.max_shgc))}</li>`,
    `<li><strong>ASCE 7-22 design wind speed:</strong> ${state.design_wind_speed_mph} mph (Risk Category II)</li>`,
    `<li><strong>Hurricane impact-rated requirement:</strong> ${escapeHtml(impactLabel[state.hurricane_impact_rated_required] || state.hurricane_impact_rated_required)}</li>`,
    `<li><strong>Dominant residential frame material:</strong> ${escapeHtml(matLabel[state.dominant_frame_material] || state.dominant_frame_material)}</li>`,
    `<li><strong>Historic-preservation overlay prevalence:</strong> ${escapeHtml(histLabel[state.historic_overlay_prevalence] || state.historic_overlay_prevalence)}</li>`,
    `<li><strong>EPA RRP lead-safe trigger (pre-1978 housing share):</strong> ${escapeHtml(leadLabel[state.lead_safe_rrp_pre_1978_housing_share] || state.lead_safe_rrp_pre_1978_housing_share)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsGarageDoorHTML(state) {
  const matLabel = {
    "steel-insulated": "Steel-insulated panel — dominant in most regions, polyurethane or polystyrene foam core",
    "aluminum-glass": "Aluminum-glass full-view — dominant in modern Sun Belt and contemporary architecture",
    "wood-composite": "Wood-composite carriage-house — dominant in HOA-heavy and historic-preservation overlays",
    "wood-solid": "Solid-wood carriage-house — dominant in luxury subdivisions and custom builds",
    "fiberglass": "Fiberglass panel — dominant in coastal salt-spray corridors",
    "vinyl": "Vinyl panel — dominant in low-budget Sun Belt subdivisions",
  };
  const operatorLabel = {
    "belt-drive": "Belt-drive — dominant in attached-garage residential, quietest operation",
    "chain-drive": "Chain-drive — dominant on detached or budget installs, durable and economical",
    "direct-drive": "Direct-drive — premium quiet operation, gaining share in luxury subdivisions",
    "jackshaft-side-mount": "Jackshaft side-mount — dominant in HVHZ Florida and high-ceiling carriage-house garages",
    "screw-drive": "Screw-drive — declining share, reliable in extreme cold, slower than belt or chain",
  };
  const hurricaneLabel = {
    HVHZ: "HVHZ — Miami-Dade NOA-rated and DASMA 115-tested at 175 mph design wind plus large-missile impact resistance",
    wind_high: "High — DASMA 108 wind-pressure rating at 140-150 mph design wind",
    wind_moderate: "Moderate — DASMA 108 wind-pressure rating at 110-140 mph design wind",
    wind_low: "Low — DASMA 108 standard rating at sub-110 mph design wind",
    none: "No hurricane wind-design exposure",
  };
  const termiteLabel = {
    "very-high": "Very high — TPCT zone 1, all wood jamb framing requires PT southern yellow pine .60 CCA",
    "high": "High — TPCT zone 2, PT wood jamb framing required",
    "moderate": "Moderate — periodic termite pressure, PT framing recommended",
    "low": "Low — minimal termite pressure",
  };
  const hoaLabel = {
    "very-high": "Very high — 80%+ of subdivisions enforce HOA architectural-committee pre-approval on door color/material/style",
    "high": "High — 60-80% of subdivisions enforce HOA architectural-committee pre-approval",
    "moderate": "Moderate — suburban HOA prevalence on newer subdivisions",
    "low": "Low — limited HOA garage-door restrictions outside metro subdivisions",
  };
  const saltLabel = {
    "high-coastal": "High — coastal salt-spray drives stainless-hardware-and-zinc-coated-track requirement at 5-7 year intervals",
    "moderate-coastal": "Moderate — bayfront salt-spray, stainless hardware recommended",
    "low": "Low — minimal salt-air corrosion, standard galvanized hardware adequate",
    "none": "None — no salt-air corrosion exposure",
  };
  const items = [
    `<li><strong>ASCE 7-22 design wind speed:</strong> ${state.design_wind_speed_mph} mph (Risk Category II)</li>`,
    `<li><strong>Hurricane wind tier:</strong> ${escapeHtml(hurricaneLabel[state.hurricane_tier] || state.hurricane_tier)}</li>`,
    `<li><strong>Required garage-door R-value:</strong> ${escapeHtml(state.garage_door_r_value_required)} (IECC 2021 + state amendments)</li>`,
    `<li><strong>Dominant residential door material:</strong> ${escapeHtml(matLabel[state.dominant_door_material] || state.dominant_door_material)}</li>`,
    `<li><strong>Dominant residential opener type:</strong> ${escapeHtml(operatorLabel[state.dominant_opener_type] || state.dominant_opener_type)}</li>`,
    `<li><strong>Termite pressure (TPCT zone):</strong> ${escapeHtml(termiteLabel[state.termite_risk] || state.termite_risk)}</li>`,
    `<li><strong>HOA architectural-control prevalence:</strong> ${escapeHtml(hoaLabel[state.hoa_prevalence] || state.hoa_prevalence)}</li>`,
    `<li><strong>Salt-air corrosion zone:</strong> ${escapeHtml(saltLabel[state.salt_air_corrosion] || state.salt_air_corrosion)}</li>`,
    `<li><strong>IECC climate zone:</strong> ${escapeHtml(state.iecc_zone)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsFoundationHTML(state) {
  const typeLabel = {
    "basement": "Full basement — dominant in Upper Midwest, Northeast, and Mid-Atlantic on freeze-thaw + radon-zone-1 sites",
    "slab-on-grade": "Slab-on-grade — dominant in Sun Belt and Southeast on warm climates with shallow frost line",
    "crawl-space": "Crawl-space stem-wall — dominant in Southeast humid corridor and termite-pressure zones",
    "pier-and-beam": "Pier-and-beam pile-supported — dominant in Lowcountry coastal and Mississippi alluvium",
    "pile-supported": "Driven-pile or drilled-shaft — dominant in permafrost (AK), HVHZ coastal (FL), and high water table",
    "mixed-basement-slab": "Mixed basement-and-slab — varies by lot grading and water table",
  };
  const expansiveLabel = {
    "very-high": "Very high — bentonitic or Black Prairie clay subsoil drives caisson-pier or post-tension foundation requirement",
    "high": "High — expansive clay subsoil requires geotechnical investigation + reinforced footings",
    "moderate": "Moderate — periodic clay shrink-swell, standard footing reinforcement adequate",
    "low": "Low — sandy or stable subsoil, standard slab-on-grade design",
    "none": "None — non-expansive subsoil",
  };
  const sdcLabel = {
    "A": "SDC A — no seismic design considerations",
    "B": "SDC B — minor seismic risk, standard tie-down requirements",
    "C": "SDC C — moderate seismic risk, continuous-rebar-tie footings required",
    "D0": "SDC D0 — high seismic risk, full ASCE 7-22 detailing required",
    "D1": "SDC D1 — high seismic risk + Special Inspector continuous observation required",
    "D2": "SDC D2 — highest seismic risk, full ASCE 7-22 + Special Inspector + post-tension foundation typical",
    "E": "SDC E — extreme seismic, near-fault design required",
    "F": "SDC F — extreme seismic, special structural design required",
  };
  const hurricaneLabel = {
    HVHZ: "HVHZ — Miami-Dade NOA-rated foundation tie-down at 175 mph design wind",
    wind_high: "High — 140 mph+ design wind drives continuous load-path tie-down from foundation to roof",
    wind_moderate: "Moderate — 110-140 mph design wind, standard tie-down",
    wind_low: "Low — sub-110 mph design wind, minimal tie-down detailing",
    none: "No hurricane wind-design exposure",
  };
  const waterLabel = {
    "very-high": "Very high — water within 5 ft of grade, sump-pump + waterproofing membrane required on every basement",
    "high": "High — periodic water table within footing depth, sump-pump rough-in standard",
    "moderate": "Moderate — water table below frost line in most lots",
    "low": "Low — deep water table, no sump-pump rough-in required",
    "very-low": "Very low — arid, no water-table exposure on residential lots",
  };
  const sulfateLabel = {
    "S0": "S0 — no sulfate exposure, Type I/II cement adequate",
    "S1": "S1 — moderate sulfate exposure, ASTM C150 Type II cement required",
    "S2": "S2 — severe sulfate exposure, ASTM C150 Type II/V cement required",
    "S3": "S3 — very severe sulfate exposure, ASTM C150 Type V cement required + low w/c",
  };
  const radonLabel = {
    1: "Zone 1 (highest) — passive sub-slab depressurization rough-in required on every basement and slab pour",
    2: "Zone 2 (moderate) — sub-slab depressurization rough-in recommended",
    3: "Zone 3 (lowest) — no statewide rough-in requirement",
  };
  const items = [
    `<li><strong>Frost-line trench depth:</strong> ${state.frost_line_inches}-inch design minimum for buried footings</li>`,
    `<li><strong>Dominant residential foundation type:</strong> ${escapeHtml(typeLabel[state.dominant_foundation_type] || state.dominant_foundation_type)}</li>`,
    `<li><strong>Expansive soil risk:</strong> ${escapeHtml(expansiveLabel[state.expansive_soil_risk] || state.expansive_soil_risk)}</li>`,
    `<li><strong>Seismic design category (ASCE 7-22):</strong> ${escapeHtml(sdcLabel[state.seismic_design_category] || state.seismic_design_category)}</li>`,
    `<li><strong>Hurricane wind tier:</strong> ${escapeHtml(hurricaneLabel[state.hurricane_tier] || state.hurricane_tier)}</li>`,
    `<li><strong>Water table risk:</strong> ${escapeHtml(waterLabel[state.water_table_risk] || state.water_table_risk)}</li>`,
    `<li><strong>Sulfate exposure (ACI 318):</strong> ${escapeHtml(sulfateLabel[state.sulfate_exposure_class] || state.sulfate_exposure_class)}</li>`,
    `<li><strong>IECC climate zone:</strong> ${escapeHtml(state.iecc_zone)}</li>`,
    `<li><strong>EPA radon zone:</strong> ${escapeHtml(radonLabel[state.radon_zone] || String(state.radon_zone))}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function climateAndCodeFactsLegalHTML(state) {
  const barLabel = {
    "ube-adopter": `Uniform Bar Examination (UBE) adopter — ${state.ube_score_required} minimum score`,
    "non-ube": "Non-UBE jurisdiction — state-specific bar exam with state-tested essays",
    "diploma-privilege": `Diploma Privilege jurisdiction — Wisconsin law school graduates admitted without bar exam (UBE ${state.ube_score_required} for non-WI grads)`,
  };
  const orgLabel = {
    "integrated-mandatory": "Integrated mandatory bar — membership compulsory for active practice",
    "voluntary": "Voluntary bar association — admission by state supreme court / board of law examiners",
  };
  const uplLabel = {
    "very-aggressive": "Very aggressive — active disciplinary docket and broad state-bar UPL standing committee enforcement",
    "aggressive": "Aggressive — formal UPL committee referrals and cease-and-desist enforcement",
    "moderate": "Moderate — standard state-bar UPL enforcement",
    "limited": "Limited — minimal state-bar UPL enforcement",
    "abs-reform": "Reform jurisdiction — non-attorney ownership / Alternative Business Structures authorized",
  };
  const groundsLabel = {
    "no-fault-only": "No-fault only — single statutory ground (typically irretrievable breakdown / irreconcilable differences)",
    "no-fault-or-fault": "No-fault or fault — petitioner may choose between no-fault and enumerated fault grounds",
    "no-fault-with-separation-required": "No-fault with mandatory separation period before filing",
    "covenant-option": "Covenant marriage option available — alternative legal status with stricter divorce requirements",
  };
  const aidLabel = {
    "robust": "Robust — strong combined LSC + state IOLTA + filing-fee-surcharge funding base",
    "moderate": "Moderate — typical LSC + state IOLTA funding tier",
    "limited": "Limited — modest funding base relative to unmet civil legal need",
  };
  const items = [
    `<li><strong>Bar admission pathway:</strong> ${escapeHtml(barLabel[state.bar_admission_status] || state.bar_admission_status)}</li>`,
    `<li><strong>Bar organization type:</strong> ${escapeHtml(orgLabel[state.bar_organization_type] || state.bar_organization_type)}</li>`,
    `<li><strong>UPL enforcement intensity:</strong> ${escapeHtml(uplLabel[state.upl_enforcement_intensity] || state.upl_enforcement_intensity)}</li>`,
    `<li><strong>Divorce grounds available:</strong> ${escapeHtml(groundsLabel[state.divorce_grounds_dominant] || state.divorce_grounds_dominant)}</li>`,
    `<li><strong>Divorce residency requirement:</strong> ${state.divorce_residency_days === 0 ? "No statutory minimum (bona fide residency at filing)" : `${state.divorce_residency_days} days`}</li>`,
    `<li><strong>Personal injury statute of limitations:</strong> ${state.personal_injury_sol_years} year${state.personal_injury_sol_years === 1 ? "" : "s"}</li>`,
    `<li><strong>Civil legal aid funding tier:</strong> ${escapeHtml(aidLabel[state.legal_aid_funding_tier] || state.legal_aid_funding_tier)}</li>`,
  ];
  return `      <ul class="state-fact-list">
        ${items.join("\n        ")}
      </ul>`;
}

function licenseAndPermitHTML(state) {
  const statusLabel = {
    required: "Statewide license required",
    registration: "Statewide registration required (no exam)",
    none: "No statewide trade license",
    "municipal-only": "No statewide license — municipal credentials only",
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

function moreStatesHTML(currentSlug, allStates, vConf) {
  const others = Object.entries(allStates)
    .filter(([k]) => !k.startsWith("_"))
    .map(([_, v]) => v)
    .filter((s) => s.slug !== currentSlug)
    .sort((a, b) => a.name.localeCompare(b.name));
  const links = others
    .map((s) => `        <li><a href="/${s.slug}${vConf.fileSuffix}">${escapeHtml(s.name)}</a></li>`)
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

  const introHero = vConf.introHero(state, vConf);

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
        <a href="${escapeHtml(vConf.citiesDirHref)}">${escapeHtml(vConf.citiesDirLabel)}</a> &rsaquo;
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
        <h2>${escapeHtml(vConf.climateSectionHeading(state.name))}</h2>
${vConf.climateFactsHTML(state)}
      </section>

      <section class="section">
        <h2>${escapeHtml(vConf.licensingSectionHeading(state.name))}</h2>
${licenseAndPermitHTML(state)}
      </section>
    </div>

    <section class="section">
      <h2>${escapeHtml(vConf.costsVarySectionHeading(state.name, vConf))}</h2>
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
${moreStatesHTML(state.slug, allStates, vConf)}
    </section>

    <p class="footer-note">
      Pricing ranges reflect ${escapeHtml(state.name)} market labor (${escapeHtml(vConf.wageSourceLabel)} ${"$" + Number(state[vConf.wageField]).toFixed(2)}/hr) and Woogoro regional cost modeling.
      For the most localized estimate, see your nearest city page above.
    </p>
  <!-- TP-INTERNAL-TOOLS-BLOCK -->
<section class="tp-tools-block" style="margin:32px 0;padding:24px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;">
  <h3 style="margin:0 0 12px;font-size:18px;color:#1e293b;">More Woogoro tools for your area</h3>
  <p style="margin:0 0 16px;font-size:14px;color:#64748b;">Free pricing tools that work anywhere in your area and across the US.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
    <a href="/auto-repair.html" style="display:block;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;font-size:14px;">Auto repair pricing &rarr;<div style="font-weight:400;color:#64748b;font-size:12px;margin-top:2px;">98 repairs, BLS-backed labor rates</div></a>
    <a href="/find-contractors.html" style="display:block;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;font-size:14px;">Find contractors &rarr;<div style="font-weight:400;color:#64748b;font-size:12px;margin-top:2px;">Vetted local pros</div></a>
    <a href="${escapeHtml(vConf.estimatorHref)}" style="display:block;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;font-size:14px;">${escapeHtml(vConf.estimatorLinkLabel)} &rarr;<div style="font-weight:400;color:#64748b;font-size:12px;margin-top:2px;">${escapeHtml(vConf.estimatorLinkSubtitle)}</div></a>
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
    <a href="${escapeHtml(vConf.estimatorHref)}">${escapeHtml(vConf.estimatorLinkLabel)}</a>
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
