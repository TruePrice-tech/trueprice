# Blog Tuesday Queue

Weekly Tuesday cadence starting 2026-04-21. Each post should be data-backed, cite real sources (BLS, PPI, EIA, CPT, NREL, etc.), funnel to a specific analyzer, carry a Person byline (Geoff Lane) for E-E-A-T.

**Workflow each Tuesday:**
1. Pick the top entry from the queue
2. Write 1,200–2,000 words, ~4–8 H2 sections, at least one data table
3. File: `blog-<slug>.html` with Article + BreadcrumbList JSON-LD
4. Add card to `/blog.html`
5. Add entry to `sitemap-blog.xml` with today's lastmod
6. Run `node scripts/indexnow-push.js https://woogoro.com/blog-<slug>.html https://woogoro.com/blog.html`
7. Commit with message `Blog: <slug> (Tuesday post N of N)`
8. Move the entry from queue → shipped list below

---

## Shipped

- **2026-04-21** — [Solar Payback By State in 2026: Why Identical Panels Take 7 Years in California and 18 in Idaho](/blog-solar-payback-by-state-2026.html) → solar analyzer. Data: EIA state electricity + 30% federal credit.
- **2026-04-13** — [What Does Plumbing Actually Cost in Atlanta, GA?](/blog-plumbing-cost-atlanta-2026.html) → plumbing analyzer. Data: 7 real Atlanta quotes.

---

## Queued

### 2026-04-28 — HVAC Regional Variance
**Working title:** "Why an HVAC Replacement in Atlanta Costs $3,000 Less Than in Boston (BLS + PPI data)"
- **Hook:** Same 3-ton 16-SEER system, same brand, wildly different installed prices by metro.
- **Data:** `data/city-cost-multipliers.json` (BLS wages + BEA RPP), `data/material-cost-index.json` (PPI copper/steel/refrigerant).
- **Structure:** Open with Atlanta vs Boston $ delta → decompose into labor, materials, permit, overhead → show 10 metros in a table → actionable "how to tell if your quote is mispriced for your region."
- **Funnel:** HVAC quote analyzer.

### 2026-05-05 — Roofing Scope Gaps
**Working title:** "The 7 Line Items Missing From Every Roofing Quote You've Received"
- **Hook:** Contractors leave out deck replacement, ice-and-water shield, flashing, ventilation upgrades, permit fees, disposal, and warranty terms — each hiding future add-ons.
- **Data:** Analyzer scope-item detection logic + NRCA best-practice list.
- **Structure:** One H2 per missing line item → what it is → typical add-on cost → scripts for asking the contractor.
- **Funnel:** Roofing quote analyzer.

### 2026-05-12 — Medical EOB Reading
**Working title:** "What a Fair Medical Bill Actually Looks Like: 3 Real EOBs, Flagged For Errors"
- **Hook:** We ran three anonymized EOBs (ER visit, ultrasound, surgery) through the analyzer and found Medicare-rate overcharges, unbundling, and a No Surprises Act violation.
- **Data:** `data/medical-cpt-pricing.json` (CPT + Medicare rates), NCCI bundle rules, anonymized real EOBs from `test-quotes/medical-test-images/` with permission note.
- **Structure:** Bill-by-bill walkthrough with redacted screenshots → what we flagged → what the patient should do.
- **Funnel:** Medical bill analyzer.

### 2026-05-19 — Plumbing Scope Decisions
**Working title:** "Whole-House Repipe vs Partial: When Each Actually Makes Sense ($12K vs $3.5K)"
- **Hook:** Plumbers pitch whole-house repipes when a partial would fix the problem, and partials when the problem is systemic. Here's how to tell which you need.
- **Data:** Plumbing analyzer scope logic, `data/city-cost-multipliers.json` for per-region pricing.
- **Structure:** Decision tree (symptoms → pipe age → water quality → budget) → 3 real scenarios → cost comparison.
- **Funnel:** Plumbing quote analyzer.

### 2026-05-26 — Heat Pump Break-Even
**Working title:** "Heat Pump vs Central AC in 2026: The Break-Even Point By State (EIA + HSPF Data)"
- **Hook:** A heat pump pays back in 3 years in Georgia, 14 years in Minnesota. The variable is your winter heating fuel.
- **Data:** `data/state-energy-prices.json` (heatPumpFavorability), DOE HSPF efficiency ratings.
- **Structure:** Top 10 states where heat pumps win → bottom 10 → methodology → quote-reading tips.
- **Funnel:** HVAC analyzer.

### 2026-06-02 — Dealership vs Independent Markup
**Working title:** "Auto Repair Markups at Dealerships: A 2026 Breakdown By Make"
- **Hook:** Dealer labor rates run 35–55% above independent shops for the same job, and parts markup is another 20–40%. Here's what's fair.
- **Data:** `test-quotes/auto-images/` real quotes, auto analyzer labor-rate norms, BLS auto-mechanic wages.
- **Structure:** Make-by-make dealer vs indie comparison → which jobs dealerships are worth paying for (warranty, recalls, software) → which to take elsewhere.
- **Funnel:** Auto repair analyzer.

### 2026-06-09 — Kitchen Remodel ROI
**Working title:** "Kitchen Remodel ROI By Metro: Where You Actually Recoup 80%+"
- **Hook:** National "80% recoup" stats are misleading. Atlanta recoups 68%, San Francisco 95%. Metro matters more than scope.
- **Data:** Remodeling Magazine Cost vs Value Report 2026 + `city-cost-multipliers.json`.
- **Structure:** Top 15 metros by ROI → why coastal markets win → minor refresh ($20K) vs mid-range ($60K) vs high-end ($150K) break-down.
- **Funnel:** Kitchen remodel analyzer.

### 2026-06-16 — Insurance-Claim Roof Markup
**Working title:** "Why Your Insurance-Claim Roofing Quote Is 30% Higher Than a Cash-Pay Quote"
- **Hook:** Contractors know insurance will pay the full Xactimate estimate. Cash-pay customers get quoted against material cost + labor. Same roof, 30% different number.
- **Data:** Xactimate vs BLS wage + PPI material baseline comparison; real quote examples.
- **Structure:** How insurance pricing is built → why supplements inflate totals → what homeowners should ask contractors → when to take the cash-pay route.
- **Funnel:** Roofing quote analyzer + insurance-claim page.

---

## Hygiene

- If a Tuesday is missed, the next Tuesday still runs the next queued topic. Don't double-up (looks spammy to crawlers).
- Don't auto-generate posts with templates. Lane's long-term quality bar requires hand-writing.
- Each post must link to at least one analyzer and at least one existing cost guide for internal-link equity.
- Pull fresh numbers from the data sources each time; the files get refreshed monthly by `scripts/refresh-*.js` crons, so what's in the repo today may shift by the time you publish.
- Re-run the broken-link audit (`node scripts/_audit-broken-links.js`) after shipping if the post adds new internal links.

## Next queue refill

After 2026-06-16 ships, brainstorm the next 8 from gap topics. Good sources for ideas: Reddit threads, HARO queries, Google Trends "home improvement" in your target metros, recent legislative changes (tax credits, building codes).
