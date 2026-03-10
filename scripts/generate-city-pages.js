const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "city-house-size-pricing.json");

const PAGE_YEAR = "2026";
const SITE_NAME = "TruePrice";
const BASE_URL = "https://trueprice-tech.github.io/trueprice";

const RELATED_GUIDES = [
  {
    title: "Architectural shingle roof cost",
    description: "Learn how architectural shingle pricing works and what usually changes it.",
    href: "./architectural-shingle-roof-cost.html"
  },
  {
    title: "Metal roof replacement cost",
    description: "See how metal roof pricing compares to asphalt systems.",
    href: "./metal-roof-replacement-cost.html"
  },
  {
    title: "Roof replacement cost guide",
    description: "Review the broader fundamentals behind fair residential roof pricing.",
    href: "./roof-replacement-cost-guide.html"
  }
];

function loadCityData() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Missing data file: ${DATA_PATH}`);
  }

  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const data = JSON.parse(raw);

  if (!data || typeof data !== "object") {
    throw new Error("City pricing JSON is invalid.");
  }

  return data;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cityDisplay(city, state) {
  return `${city} ${state}`;
}

function pageSlugFromKey(cityKey) {
  return `${cityKey}-roof-cost.html`;
}

function titleFor(city, state) {
  return `Roof Replacement Cost in ${city} ${state} (${PAGE_YEAR}) | ${SITE_NAME}`;
}

function descriptionFor(city, state) {
  return `Average roof replacement cost in ${city} ${state}. Compare pricing by roof material and house size, review local cost factors, and check whether your roofing quote is fair.`;
}

function articleDescriptionFor(city, state) {
  return `Average roof replacement cost in ${city} ${state} with pricing by house size, material, and local quote comparison guidance.`;
}

function pageUrlFor(slug) {
  return `${BASE_URL}/${slug}`;
}

function buildFaqData(city, state) {
  const display = cityDisplay(city, state);

  return [
    {
      question: `How much does a roof replacement cost in ${display}?`,
      answer: `${display} roof replacement pricing depends on size, material, pitch, tear off conditions, flashing, and ventilation scope. Asphalt systems usually cost less than premium or specialty roof systems.`
    },
    {
      question: `Why are roofing quotes in ${display} sometimes far apart?`,
      answer: `Quotes may differ because contractors are offering different materials, underlayment systems, flashing scope, ventilation work, warranty levels, or decking assumptions.`
    },
    {
      question: `Should I choose the cheapest roofing quote in ${display}?`,
      answer: `Not automatically. A cheaper quote may exclude key components or use lower grade materials. The better choice is the quote with the strongest full scope and value for the price.`
    },
    {
      question: `Does house size matter a lot for roofing cost in ${display}?`,
      answer: `Yes. House size strongly affects labor, material quantities, waste, disposal, and accessory needs, making it one of the biggest price drivers.`
    }
  ];
}

function buildOtherCities(cityData, currentKey) {
  return Object.entries(cityData)
    .filter(([key, value]) => key !== currentKey && value && value.city && value.state)
    .sort((a, b) => {
      const aLabel = `${a[1].city} ${a[1].state}`;
      const bLabel = `${b[1].city} ${b[1].state}`;
      return aLabel.localeCompare(bLabel);
    })
    .map(([key, value]) => ({
      href: `./${pageSlugFromKey(key)}`,
      label: `${value.city} ${value.state}`
    }));
}

function buildGuideCards() {
  return RELATED_GUIDES.map((guide) => `
            <div class="guide-card">
              <h3>${escapeHtml(guide.title)}</h3>
              <p>${escapeHtml(guide.description)}</p>
              <a class="card-link" href="${escapeHtml(guide.href)}">Read guide</a>
            </div>
  `).join("");
}

function buildOtherCitiesLinks(cityData, currentKey) {
  return buildOtherCities(cityData, currentKey)
    .map((item) => `<a class="pill-link" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
    .join("");
}

function buildFaqHtml(city, state) {
  return buildFaqData(city, state)
    .map((item) => `
            <div class="faq-item">
              <h3>${escapeHtml(item.question)}</h3>
              <p>${escapeHtml(item.answer)}</p>
            </div>
    `)
    .join("");
}

function buildFaqSchema(city, state) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: buildFaqData(city, state).map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    },
    null,
    2
  );
}

function buildArticleSchema(city, state, slug) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `Roof Replacement Cost in ${city} ${state} (${PAGE_YEAR})`,
      description: articleDescriptionFor(city, state),
      author: {
        "@type": "Organization",
        name: SITE_NAME
      },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": pageUrlFor(slug)
      },
      datePublished: "2026-03-10",
      dateModified: "2026-03-10"
    },
    null,
    2
  );
}

function buildBreadcrumbSchema(city, state, slug) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${BASE_URL}/`
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Roof Replacement Cost by City",
          item: `${BASE_URL}/#city-guides`
        },
        {
          "@type": "ListItem",
          position: 3,
          name: `Roof Replacement Cost in ${city} ${state}`,
          item: pageUrlFor(slug)
        }
      ]
    },
    null,
    2
  );
}

function renderCityPage({ cityKey, city, state, slug, allCityData }) {
  const display = cityDisplay(city, state);
  const description = descriptionFor(city, state);
  const pageUrl = pageUrlFor(slug);

  const guideCards = buildGuideCards();
  const otherCitiesLinks = buildOtherCitiesLinks(allCityData, cityKey);
  const faqHtml = buildFaqHtml(city, state);
  const faqSchema = buildFaqSchema(city, state);
  const articleSchema = buildArticleSchema(city, state, slug);
  const breadcrumbSchema = buildBreadcrumbSchema(city, state, slug);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${escapeHtml(titleFor(city, state))}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  <meta name="robots" content="index,follow" />

  <meta property="og:title" content="${escapeHtml(titleFor(city, state))}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(titleFor(city, state))}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />

  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
      --brand: #0f766e;
      --brand-dark: #115e59;
      --accent: #ecfeff;
      --accent-border: #99f6e4;
      --shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      --radius: 18px;
      --max: 1120px;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.65;
      color: var(--text);
      background: var(--bg);
    }

    a {
      color: var(--brand-dark);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .container {
      width: min(var(--max), calc(100% - 32px));
      margin: 0 auto;
    }

    .site-header {
      background: #0f172a;
      color: #fff;
    }

    .site-header .container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 0;
      flex-wrap: wrap;
    }

    .brand {
      font-size: 1.2rem;
      font-weight: 700;
      color: #fff;
    }

    .nav {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .nav a {
      color: #cbd5e1;
      font-size: 0.95rem;
    }

    .hero {
      padding: 56px 0 28px;
      background: linear-gradient(180deg, #f0fdfa 0%, #f8fafc 100%);
      border-bottom: 1px solid var(--line);
    }

    .hero-grid {
      display: grid;
      grid-template-columns: 1.35fr 0.95fr;
      gap: 24px;
      align-items: start;
    }

    .hero h1 {
      margin: 0 0 14px;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1.15;
    }

    .hero p {
      margin: 0 0 16px;
      color: var(--muted);
      max-width: 760px;
    }

    .hero-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 22px;
    }

    .hero-card h2 {
      margin-top: 0;
      margin-bottom: 10px;
      font-size: 1.15rem;
    }

    .eyebrow {
      display: inline-block;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--brand-dark);
      margin-bottom: 10px;
    }

    .quick-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }

    .stat {
      background: var(--accent);
      border: 1px solid #bae6fd;
      border-radius: 14px;
      padding: 14px;
    }

    .stat strong {
      display: block;
      font-size: 1rem;
      margin-bottom: 4px;
    }

    main {
      padding: 28px 0 64px;
    }

    .content-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 24px;
      align-items: start;
    }

    .content > section,
    .sidebar-card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .content > section {
      padding: 28px;
      margin-bottom: 24px;
    }

    .content h2 {
      margin-top: 0;
      margin-bottom: 14px;
      font-size: 1.6rem;
      line-height: 1.2;
    }

    .content h3 {
      margin-top: 24px;
      margin-bottom: 10px;
      font-size: 1.15rem;
    }

    .content p,
    .content li {
      color: var(--muted);
    }

    .content ul {
      padding-left: 20px;
      margin: 10px 0 0;
    }

    .button-row,
    .link-grid,
    .tool-grid,
    .guide-grid,
    .city-grid {
      display: grid;
      gap: 12px;
    }

    .button-row {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin-top: 18px;
    }

    .btn,
    .pill-link,
    .card-link {
      display: inline-block;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--surface);
      padding: 12px 14px;
      font-weight: 700;
      text-align: center;
    }

    .btn.primary {
      background: var(--brand);
      border-color: var(--brand);
      color: #fff;
    }

    .btn.primary:hover {
      background: var(--brand-dark);
      text-decoration: none;
    }

    .btn.secondary:hover,
    .pill-link:hover,
    .card-link:hover {
      background: #f8fafc;
      text-decoration: none;
    }

    .link-grid {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      margin-top: 14px;
    }

    .tool-grid,
    .guide-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      margin-top: 16px;
    }

    .city-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin-top: 16px;
    }

    .tool-card,
    .guide-card {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      background: #fff;
    }

    .tool-card h3,
    .guide-card h3 {
      margin-top: 0;
      margin-bottom: 8px;
    }

    .pricing-callout {
      background: #f8fafc;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      margin-top: 16px;
    }

    .future-callout {
      background: #f0fdfa;
      border: 1px solid var(--accent-border);
      border-radius: 16px;
      padding: 18px;
      margin-top: 18px;
    }

    .example-box {
      background: #f0fdfa;
      border: 1px solid var(--accent-border);
      border-radius: 16px;
      padding: 18px;
      margin-top: 18px;
    }

    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: 16px;
      margin-top: 18px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
    }

    th,
    td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }

    th {
      background: #f8fafc;
      font-size: 0.95rem;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    .table-note {
      font-size: 0.92rem;
      color: var(--muted);
      margin-top: 12px;
    }

    .faq-item {
      padding: 18px 0;
      border-bottom: 1px solid var(--line);
    }

    .faq-item:first-child {
      padding-top: 0;
    }

    .faq-item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .faq-item h3 {
      margin-top: 0;
      margin-bottom: 8px;
    }

    .sidebar {
      position: sticky;
      top: 20px;
    }

    .sidebar-card {
      padding: 22px;
      margin-bottom: 20px;
    }

    .sidebar-card h2,
    .sidebar-card h3 {
      margin-top: 0;
    }

    .sidebar-card ul {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
    }

    .footer {
      border-top: 1px solid var(--line);
      padding: 28px 0 40px;
      color: var(--muted);
      font-size: 0.95rem;
    }

    @media (max-width: 960px) {
      .hero-grid,
      .content-grid {
        grid-template-columns: 1fr;
      }

      .sidebar {
        position: static;
      }
    }

    @media (max-width: 640px) {
      .container {
        width: min(var(--max), calc(100% - 20px));
      }

      .content > section,
      .sidebar-card,
      .hero-card {
        padding: 20px;
      }

      th,
      td {
        padding: 12px;
      }
    }
  </style>

  <script id="article-schema" type="application/ld+json">
${articleSchema}
  </script>

  <script id="faq-schema" type="application/ld+json">
${faqSchema}
  </script>

  <script id="breadcrumb-schema" type="application/ld+json">
${breadcrumbSchema}
  </script>
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a class="brand" href="./index.html">TruePrice</a>
      <nav class="nav" aria-label="Main navigation">
        <a href="./index.html">Home</a>
        <a href="./roof-replacement-cost-calculator.html">Calculator</a>
        <a href="./roofing-quote-analyzer.html">Quote Analyzer</a>
        <a href="./compare-roofing-quotes.html">Compare Quotes</a>
      </nav>
    </div>
  </header>

  <section class="hero">
    <div class="container hero-grid">
      <div>
        <span class="eyebrow">${escapeHtml(display)} Roofing Pricing Guide</span>
        <h1>Roof Replacement Cost in ${escapeHtml(display)}</h1>
        <p>
          Use this ${escapeHtml(display)} roofing cost guide to understand price ranges by house size, compare quote details more accurately, and spot the main factors that move roof replacement costs up or down.
        </p>
        <div class="button-row">
          <a class="btn primary" href="./roof-replacement-cost-calculator.html">Use Roof Calculator</a>
          <a class="btn secondary" href="./roofing-quote-analyzer.html">Analyze My Quote</a>
          <a class="btn secondary" href="./compare-roofing-quotes.html">Compare Roofing Quotes</a>
        </div>
      </div>

      <aside class="hero-card" aria-label="Quick overview">
        <h2>What affects ${escapeHtml(display)} roof pricing</h2>
        <p>
          In ${escapeHtml(display)}, roofing costs often move with material selection, underlayment specification, labor access, roof pitch, flashing detail, and ventilation or decking corrections.
        </p>
        <div class="quick-stats">
          <div class="stat">
            <strong>Best use</strong>
            <span>See whether your quote aligns with expected local pricing</span>
          </div>
          <div class="stat">
            <strong>Most important input</strong>
            <span>Roof size and roofing material</span>
          </div>
          <div class="stat">
            <strong>Helpful next step</strong>
            <span>Check the ${escapeHtml(display)} house size pricing table below</span>
          </div>
          <div class="stat">
            <strong>Built for</strong>
            <span>Planning, quote review, and side by side comparisons</span>
          </div>
        </div>
      </aside>
    </div>
  </section>

  <main class="container">
    <div class="content-grid">
      <div class="content">
        <section id="pricing-overview">
          <h2>${escapeHtml(display)} roof replacement pricing overview</h2>
          <p>
            ${escapeHtml(display)} roofing quotes can look similar at a glance while differing substantially in what is actually included. Roof replacement price is shaped by size, material, slope, tear off conditions, and the amount of accessory work included in the proposal.
          </p>
          <p>
            That is why TruePrice uses reusable city by house size pricing data. It gives homeowners a cleaner baseline and a more structured way to review whether a contractor quote looks fair.
          </p>

          <div class="pricing-callout">
            <strong>How to use this page:</strong>
            <p>
              Start with the ${escapeHtml(display)} pricing table, identify the house size closest to your home, then compare your quote scope, materials, and complexity against that baseline.
            </p>
          </div>

          <div class="future-callout">
            <strong>Planned enhancement:</strong>
            <p>
              This page structure is designed to support future address based roof size estimation so homeowners can eventually enter an address, estimate roof size automatically, and jump directly into the calculator with better starting inputs.
            </p>
          </div>
        </section>

        <section id="house-size-links">
          <h2>Roof cost by house size in ${escapeHtml(display)}</h2>
          <p>
            Use the quick links below to jump to the reusable pricing section and find the range closest to your home.
          </p>
          <div class="link-grid" id="house-size-links-grid">
            <a class="pill-link" href="#city-pricing-table">Loading sizes...</a>
          </div>
        </section>

        <section id="example-pricing">
          <h2>Example ${escapeHtml(display)} roofing scenario</h2>
          <p id="example-pricing-copy">
            A typical ${escapeHtml(display)} asphalt shingle replacement on a straightforward mid sized home may land near the center of the range if the roof is walkable and the tear off conditions are clean. The same home can move higher if the proposal includes premium shingles, multiple penetrations, chimney work, upgraded flashing, or a larger than expected wood replacement allowance.
          </p>

          <div class="example-box">
            <strong>Example comparison:</strong>
            <p>
              A lower quote may exclude flashing replacement or ventilation adjustments. A higher quote may look expensive at first but offer stronger value if it includes better materials, better warranties, and fewer likely change orders later.
            </p>
          </div>
        </section>

        <section id="cost-factors">
          <h2>Main cost factors in ${escapeHtml(display)}</h2>
          <ul>
            <li><strong>Roof size:</strong> larger roofs require more shingles, underlayment, accessories, labor, and disposal.</li>
            <li><strong>Material selection:</strong> architectural shingles, designer shingles, metal panels, and specialty systems all price differently.</li>
            <li><strong>Roof geometry:</strong> valleys, hips, dormers, penetrations, and steep pitch increase labor intensity.</li>
            <li><strong>Tear off conditions:</strong> old layers, brittle decking, and hidden damage can raise total cost.</li>
            <li><strong>Ventilation and flashing:</strong> ridge vents, intake ventilation, wall flashing, and chimney details affect both price and performance.</li>
            <li><strong>Proposal quality:</strong> not all contractors include the same scope, workmanship warranty, or cleanup detail.</li>
          </ul>
        </section>

        <section id="quote-guidance">
          <h2>How to compare roofing quotes in ${escapeHtml(display)}</h2>
          <p>
            Ignore the urge to compare only the bottom line. Roofing quotes should be compared system against system, not just total against total.
          </p>
          <ul>
            <li>Confirm the exact shingle or roofing system being proposed</li>
            <li>Check whether flashing replacement is partial or full</li>
            <li>Review underlayment and waterproofing details</li>
            <li>Ask how decking replacement is priced and assumed</li>
            <li>Compare ventilation scope and accessory details</li>
            <li>Review workmanship warranty and exclusions carefully</li>
          </ul>
        </section>

        <section id="tools">
          <h2>Use the TruePrice tools</h2>
          <div class="tool-grid">
            <div class="tool-card">
              <h3>Roof replacement calculator</h3>
              <p>Estimate a fair roofing price using roof size and project assumptions.</p>
              <a class="card-link" href="./roof-replacement-cost-calculator.html">Open calculator</a>
            </div>
            <div class="tool-card">
              <h3>Quote analyzer</h3>
              <p>Review a roofing proposal and identify where price or scope may be off.</p>
              <a class="card-link" href="./roofing-quote-analyzer.html">Analyze a quote</a>
            </div>
            <div class="tool-card">
              <h3>Quote comparison tool</h3>
              <p>Compare multiple roofing quotes side by side with a cleaner structure.</p>
              <a class="card-link" href="./compare-roofing-quotes.html">Compare quotes</a>
            </div>
          </div>
        </section>

        <section id="related-guides">
          <h2>Related roofing guides</h2>
          <div class="guide-grid">
${guideCards}
          </div>
        </section>

        <section id="city-pricing-table">
          <h2>${escapeHtml(display)} house size pricing table</h2>
          <p>
            This reusable table loads from the shared city pricing JSON file so the structure remains consistent and easy to maintain.
          </p>

          <div id="pricing-table-container">
            <div class="pricing-callout">
              Loading pricing data...
            </div>
          </div>

          <noscript>
            <div class="pricing-callout">
              JavaScript is required to load the live city pricing table from the shared data file.
            </div>
          </noscript>

          <p class="table-note">
            These ranges are planning level estimates. Actual proposals can move higher or lower depending on roof complexity, product selection, and scope detail.
          </p>
        </section>

        <section id="other-cities">
          <h2>Compare other city roofing costs</h2>
          <div class="city-grid" id="other-cities-grid">
${otherCitiesLinks}
          </div>
        </section>

        <section id="faq">
          <h2>${escapeHtml(display)} roofing cost FAQ</h2>
          <div id="faq-container">
${faqHtml}
          </div>
        </section>
      </div>

      <aside class="sidebar">
        <div class="sidebar-card">
          <h2>${escapeHtml(display)} quick links</h2>
          <ul>
            <li><a href="#pricing-overview">Pricing overview</a></li>
            <li><a href="#city-pricing-table">House size pricing table</a></li>
            <li><a href="#quote-guidance">Quote comparison guidance</a></li>
            <li><a href="#tools">TruePrice tools</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </div>

        <div class="sidebar-card">
          <h3>Best next step</h3>
          <p>
            Start with the calculator, then use the quote analyzer to test whether your contractor scope looks complete.
          </p>
          <a class="btn primary" href="./roof-replacement-cost-calculator.html">Start now</a>
        </div>
      </aside>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      TruePrice helps homeowners estimate fair roofing prices and compare contractor quotes more clearly.
    </div>
  </footer>

  <script>
    const PAGE_CONFIG = {
      cityKey: "${escapeHtml(cityKey)}",
      pageSlug: "${escapeHtml(slug)}",
      pageYear: "${escapeHtml(PAGE_YEAR)}",
      dataUrl: "data/city-house-size-pricing.json"
    };

    function formatCurrency(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return "—";
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(number);
    }

    function formatSizeLabel(size, index, sizes) {
      const current = Number(size);
      const previous = index > 0 ? Number(sizes[index - 1]) : null;

      if (index === 0) {
        return \`Up to \${current.toLocaleString()} sq ft\`;
      }

      return \`\${(previous + 1).toLocaleString()} to \${current.toLocaleString()} sq ft\`;
    }

    function buildHouseSizeLinks(orderedSizes) {
      const container = document.getElementById("house-size-links-grid");
      if (!container || !orderedSizes.length) return;

      container.innerHTML = orderedSizes.map((size, index) => \`
        <a class="pill-link" href="#city-pricing-table">\${formatSizeLabel(size, index, orderedSizes)}</a>
      \`).join("");
    }

    function buildPricingTable(cityData) {
      const sizes = cityData && cityData.sizes ? cityData.sizes : null;

      if (!sizes || typeof sizes !== "object") {
        return \`
          <div class="pricing-callout">
            Pricing data is not available yet.
          </div>
        \`;
      }

      const orderedSizes = Object.keys(sizes)
        .map(Number)
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);

      if (!orderedSizes.length) {
        return \`
          <div class="pricing-callout">
            Pricing data is not available yet.
          </div>
        \`;
      }

      buildHouseSizeLinks(orderedSizes);

      const rows = orderedSizes.map((size, index) => {
        const bucket = sizes[String(size)] || {};
        const low = Number(bucket.low);
        const high = Number(bucket.high);
        const typical = Number.isFinite(low) && Number.isFinite(high)
          ? Math.round((low + high) / 2)
          : null;

        return \`
          <tr>
            <td>\${formatSizeLabel(size, index, orderedSizes)}</td>
            <td>\${Number.isFinite(low) ? formatCurrency(low) : "—"}</td>
            <td>\${typical !== null ? formatCurrency(typical) : "—"}</td>
            <td>\${Number.isFinite(high) ? formatCurrency(high) : "—"}</td>
          </tr>
        \`;
      }).join("");

      return \`
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>House size</th>
                <th>Low estimate</th>
                <th>Typical estimate</th>
                <th>High estimate</th>
              </tr>
            </thead>
            <tbody>
              \${rows}
            </tbody>
          </table>
        </div>
      \`;
    }

    async function loadCityPricing() {
      const container = document.getElementById("pricing-table-container");

      try {
        const response = await fetch(PAGE_CONFIG.dataUrl);
        if (!response.ok) {
          throw new Error(\`Failed to load pricing data: \${response.status}\`);
        }

        const data = await response.json();
        const cityData = data[PAGE_CONFIG.cityKey];

        if (!cityData || !cityData.sizes) {
          throw new Error(\`Missing or invalid city data for \${PAGE_CONFIG.cityKey}\`);
        }

        if (container) {
          container.innerHTML = buildPricingTable(cityData);
        }
      } catch (error) {
        console.error(error);

        if (container) {
          container.innerHTML = \`
            <div class="pricing-callout">
              We could not load pricing data right now. Please try again shortly.
            </div>
          \`;
        }
      }
    }

    loadCityPricing();
  </script>
</body>
</html>
`;
}

function generatePages() {
  const cityData = loadCityData();
  const entries = Object.entries(cityData);

  if (!entries.length) {
    throw new Error("No city data found.");
  }

  const generated = [];

  for (const [cityKey, value] of entries) {
    if (!value || !value.city || !value.state || !value.sizes) {
      throw new Error(`Invalid city record for key: ${cityKey}`);
    }

    const slug = pageSlugFromKey(cityKey);
    const html = renderCityPage({
      cityKey,
      city: value.city,
      state: value.state,
      slug,
      allCityData: cityData
    });

    const outputPath = path.join(ROOT, slug);
    fs.writeFileSync(outputPath, html, "utf8");
    generated.push(slug);
  }

  return generated;
}
function generateSitemap(cityData) {
  const staticPages = [
    "",
    "/roof-replacement-cost-calculator.html",
    "/roofing-quote-analyzer.html",
    "/compare-roofing-quotes.html",
    "/roof-replacement-cost-guide.html",
    "/architectural-shingle-roof-cost.html",
    "/metal-roof-replacement-cost.html"
  ];

  const urls = [];

  staticPages.forEach((page) => {
    urls.push(`${BASE_URL}${page}`);
  });

  Object.keys(cityData).forEach((cityKey) => {
    urls.push(`${BASE_URL}/${cityKey}-roof-cost.html`);
  });

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  sitemap += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  urls.forEach((url) => {
    sitemap += `  <url>\n`;
    sitemap += `    <loc>${url}</loc>\n`;
    sitemap += `  </url>\n`;
  });

  sitemap += `</urlset>\n`;

  const outputPath = path.join(ROOT, "sitemap.xml");
  fs.writeFileSync(outputPath, sitemap, "utf8");
}
try {
  const cityData = loadCityData();
  const generated = generatePages();
  generateSitemap(cityData);

  console.log(`Generated ${generated.length} city pages:`);
  for (const file of generated) {
    console.log(`  - ${file}`);
  }
  console.log("Generated sitemap.xml");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}