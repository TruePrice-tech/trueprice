// SEO contract runner. Walks a representative URL per template type and runs
// the contract assertion engine. Fast (~30 sec for 25-30 URLs) -- no
// puppeteer, just fetch + regex parse. Reports findings in the same shape
// as the visual-walk runners so lib/findings.js aggregates them seamlessly.
//
// Sample URLs are kept here as data; extend the lists when new flagship
// metros / sub-metros / blog posts ship. The point isn't exhaustive
// coverage -- it's catching template-level regressions, which need only
// 1-3 representatives per template.

const { BASE } = require("../lib/walker");
const { checkUrl } = require("../lib/seo-check");

const VERTICAL = "seo";

// Hubs (vertical-level cost or cost-guide pages).
const HUB_URLS = [
  "/hvac-cost.html",
  "/plumbing-cost-guide.html",
  "/electrical-cost-guide.html",
  "/solar-cost.html",
  "/fence-cost.html",
  "/fencing-cost-guide.html",
  "/gutters-cost.html",
  "/landscaping-cost.html",
  "/medical-cost-guide.html",
  "/legal-cost-guide.html",
  "/moving-cost-guide.html",
  "/auto-repair-cost-guide.html",
  "/garage-door-cost.html",
  "/siding-cost.html",
  "/painting-cost.html",
  "/concrete-cost.html",
  "/insulation-cost.html",
  "/foundation-repair-cost-guide.html",
  "/kitchen-remodel-cost-guide.html",
  "/hvac-replacement-cost-guide.html",
  "/gutter-installation-cost-guide.html",
];

// One flagship metro + one non-flagship metro per a sample of verticals
// (rotation across runs would be ideal but the list stays small enough
// that we just check all sample URLs every run).
const METRO_URLS = [
  "/charlotte-nc-roof-cost.html",
  "/charlotte-nc-fence-cost.html",
  "/charlotte-nc-hvac-cost.html",
  "/atlanta-ga-roof-cost.html",
  "/abilene-tx-roof-cost.html",
  "/abilene-tx-foundation-cost.html",
  "/akron-oh-electrical-cost.html",
];

// Sub-metro / neighborhood pages (the template that broke during the
// roofing flagship corruption -- worth keeping a watch on).
const SUBMETRO_URLS = [
  "/ballantyne-charlotte-roof-cost.html",
];

// Calculators / interactive tools.
const CALCULATOR_URLS = [
  "/legal-billing-calculator.html",
  "/roof-cost-calculator.html",
  "/roof-replacement-cost-calculator.html",
];

// Tool pages: must remain noindex. A regression here would mean a tool
// page accidentally became indexable (duplicate content + low quality
// signal to crawlers).
const TOOL_NOINDEX_URLS = [
  "/roofing-quote-analyzer.html",
  "/fencing-estimate.html",
  "/compare-fencing-quotes.html",
  "/medical-bill-analyzer.html",
];

const ALL_URLS = [
  ...HUB_URLS,
  ...METRO_URLS,
  ...SUBMETRO_URLS,
  ...CALCULATOR_URLS,
  ...TOOL_NOINDEX_URLS,
];

async function run({ outDir }) {
  const fs = require("fs");
  const path = require("path");
  const paths = [];
  const walkErrors = [];
  console.log(`[seo] checking ${ALL_URLS.length} URLs against ${BASE}...`);

  // Run with light parallelism (4 at a time) to keep total time low without
  // hammering the origin.
  const POOL_SIZE = 4;
  let i = 0;
  async function worker() {
    while (i < ALL_URLS.length) {
      const idx = i++;
      const u = ALL_URLS[idx];
      const r = await checkUrl(BASE, u);
      if (r.error) walkErrors.push(`${u}: ${r.error}`);
      // Persist parsed dump for any URL with issues (helps debug later).
      if (r.issues && r.issues.length && r.parsed) {
        const safe = u.replace(/[^a-z0-9]+/gi, "_").slice(0, 80);
        fs.writeFileSync(path.join(outDir, `seo-${safe}.json`), JSON.stringify({ url: r.url, template: r.template, parsed: r.parsed, issues: r.issues }, null, 2));
      }
      paths.push({ walkPath: `seo (${u})`, fixture: r.template, issues: r.issues });
      const sevCounts = (r.issues || []).reduce((acc, x) => ((acc[x.severity] = (acc[x.severity] || 0) + 1), acc), {});
      console.log(`  [${r.template || "no-template"}] ${u} ${r.error ? `ERROR ${r.error}` : `${sevCounts.high || 0}h ${sevCounts.medium || 0}m ${sevCounts.low || 0}l`}`);
    }
  }
  await Promise.all(Array.from({ length: POOL_SIZE }, () => worker()));

  return { vertical: VERTICAL, paths, walkErrors, fixtureErrors: [] };
}

module.exports = { run, VERTICAL };
