# Flagship Research Playbook

**Purpose:** repeatable, vertical-agnostic process for building a hand-curated "flagship" SEO city-vertical page that's grounded in real query data and real local facts — not templated guesswork. First instance: [chattanooga-tn-painting-cost.html](../chattanooga-tn-painting-cost.html), shipped 2026-05-20.

This is the playbook for the **SEO experiment** Lane initiated 2026-05-20: can a single hand-curated page outperform the templated bulk pages on a specific (city, vertical) target? Don't use it for: low-traffic verticals where the page won't be read by humans, or speculative new geographies. Use it for: established verticals where templated pages already exist but aren't ranking, OR new flagship metros.

---

## When to use this playbook

- You're picking ONE (city, vertical) to hand-curate as an SEO test.
- The page exists already (templated) or is about to be created.
- You're OK with a 4-6 hour authoring + research investment per page.
- Cadence: 1/week max. Faster degrades quality. The point is per-page craft.

**Don't use this for:** mass-injecting content across all cities. See [feedback_no_mass_inject_city_pages.md](../memory/feedback_no_mass_inject_city_pages.md).

---

## Required setup (one-time per environment)

| Item | What | How |
|---|---|---|
| Census ACS API key | For [scripts/audit-city-data-vs-acs.js](../scripts/audit-city-data-vs-acs.js) | Free; register at https://api.census.gov/data/key_signup.html. **Click the activation link in the email** (the page itself only sends; the email activates). Set `CENSUS_API_KEY` env var. |
| GSC access | For real-query ground truth | Add `woogoro.com` property at https://search.google.com/search-console. Verify ownership. |
| Local Node | All scripts | Node 18+ already required by the repo. |
| File-state guard | Protects hand-curated pages from build-pipeline overwrite | [scripts/_handwritten-guard.js](../scripts/_handwritten-guard.js) is already wired. No action needed. |

---

## The 7 stages

### Stage 1 — Audit the current page state

Before researching anything new, read what's already on the page. You're hunting for:

- **Title / H1 mismatch with real queries** — does the title match how users actually search?
- **Conflicting numbers within the page** — e.g., three different price ranges in different sections.
- **Broken markup** — duplicate FAQs, orphaned text, escaped-template-variable leftovers (`%var%`).
- **Templated paragraphs that pretend to be local** — the dead giveaway: every city's "local context" reads the same except for the city name.
- **Missing sub-verticals** the autocomplete data will reveal in stage 4 (e.g., for painting: cabinet, deck/fence are usually missing).
- **Calculator/analyzer placement** — is the tool buried below the fold or behind a CTA?

Output: a punch list of structural issues. Most should be fixed in the rewrite. Easy bugs (broken FAQs) worth shipping as a standalone fix before the rewrite lands.

### Stage 2 — GSC ground-truth pull

Real users tell you what they're searching for. Pull GSC data **before** anything else.

```
1. search.google.com/search-console → property woogoro.com
2. Performance → Date: Last 3 months
3. Add filter: Page = *<vertical>* (or specific page URLs)
4. Queries tab → Export → CSV
5. Save somewhere in the repo (e.g., data/gsc-<vertical>-pilot.csv) for diffing later
```

**What to do with the data:**

- If total impressions < 50 over 3 months: the vertical has a **distribution problem**, not a content problem. A better page won't move the needle alone. Note this as a context.
- Look at the **phrasing pattern** of the queries that DID surface. Real users often search differently than you'd expect (e.g., painting users search `exterior painting [city]`, NOT `painting cost [city]`).
- Zero queries containing "cost" / "price" / "estimate" → your current "cost" framing is optimizing for queries that don't exist.

**Don't skip this stage.** Most of the Chattanooga insights came from reading 9 real queries instead of 9,000 imagined ones.

### Stage 3 — Autocomplete harvest

GSC tells you what users already search where your page surfaces. Autocomplete tells you the **fuller universe** of phrasings users could be entering — including ones your page is missing entirely.

**Template:** [scripts/keyword-research/harvest-chattanooga-painting-pilot.js](../scripts/keyword-research/harvest-chattanooga-painting-pilot.js)

To run for a new (city, vertical):

1. Copy the template to `scripts/keyword-research/harvest-<city>-<vertical>-pilot.js`
2. Replace the `SEEDS` array with city + vertical seeds (~25-30 phrases). Include:
   - Direct cost intent: `<vertical> cost <city>`, `<vertical> prices <city>`
   - Contractor intent: `<vertical> contractors <city>`, `best <vertical> <city>`, `near me <city>`
   - Sub-vertical intent: specific to your vertical (e.g., for painting: cabinet, deck, fence, exterior, interior, commercial)
   - Quote intent (the moat): `<vertical> quote <city>`, `<vertical> estimate <city>`, `is <vertical> quote fair <city>`
   - Neighborhoods: 3-5 named neighborhoods or suburbs of the city
3. Run: `node scripts/keyword-research/harvest-<city>-<vertical>-pilot.js`
4. Output: `scripts/keyword-research/output/<city>-<vertical>-pilot.json`

Runtime: ~10-15 min for 30 seeds × 27 letter expansions × 2 engines. Bing returns ~99% of completions; Google rate-limits heavily but the small slice it returns is high-signal.

### Stage 4 — Cluster + intent analysis

Raw autocomplete data is noisy. Cluster by intent + geo to surface the dominant query patterns.

**Template:** [scripts/keyword-research/analyze-chattanooga-painting-pilot.js](../scripts/keyword-research/analyze-chattanooga-painting-pilot.js)

The script applies:
- **14 intent regexes** (cost, contractor, project-type sub-verticals, brand, prep-repair, how-to, timing, comparison, faq, etc.). Vertical-agnostic.
- **5 geo buckets** (target city, other-city-same-state, neighboring-state, other-city, no-geo). Adapt the regex if your city has named neighborhoods (Chattanooga: Lookout Mountain, Northshore, Hixson, Red Bank).

To run for a new city: copy the analyzer to `scripts/keyword-research/analyze-<city>-<vertical>-pilot.js`, update the geo regex if needed, run.

Output: `scripts/keyword-research/output/<city>-<vertical>-pilot-clusters.json` — a ranked phrase list per intent cluster.

**Most important output**: which intent cluster dominates. For Chattanooga painting it was **contractor-trust** (BBB, license, reviews, ratings, warranty) at >70% of top phrases — NOT cost. **This determines the page's framing.**

### Stage 5 — Audit city data vs. Census ACS

The repo's [data/city-cost-multipliers.json](../data/city-cost-multipliers.json) and [data/city-context.json](../data/city-context.json) have ~739 curated cities. As of 2026-05-20, **388 had stale population and 528 had stale avgHomeAge** before the audit was run. Before drafting, refresh.

```bash
export CENSUS_API_KEY=<your-key>
node scripts/audit-city-data-vs-acs.js --report           # dry run: emit report only
node scripts/audit-city-data-vs-acs.js --patch            # apply fixes with backups
```

Thresholds: population off by >5%, avgHomeAge off by >5 years. Adjust in the script if needed.

Backups: auto-created with `.bak-<YYYY-MM-DD>` suffix in `data/`.

**Re-run after major refreshes** (every 6-12 months when Census ACS releases a new 5-year vintage).

### Stage 6 — Draft via section recipe

Map intent clusters → page sections. The Chattanooga page is the reference: [chattanooga-tn-painting-cost.html](../chattanooga-tn-painting-cost.html).

**The skeleton:**

| Section | Maps to | Notes |
|---|---|---|
| Title / H1 | Top-frequency query pattern (NOT assumed) | Use the actual phrasing from GSC + autocomplete. For painting: "Exterior Painting in [City]" not "Painting Cost in [City]". |
| Above-the-fold panel | The moat (your analyzer/tool) | 3-step preview + 2 CTAs to the existing analyzer. **This is the differentiator.** Without it, you're just another cost-guide page. |
| Real price table (multiple tiers) | Cost intent | Computed from `<vertical>-pricing-model.json` × `city-cost-multipliers.json[<City>|<ST>]`. **One range, consistent throughout the page.** No conflicting numbers in different sections. |
| How to verify a contractor | Trust intent (if dominant) | State license + lookup URL · BBB regional office + lookup URL · COI guidance · 5 red flags. These are real .gov / .org links, verified to work. |
| Scope checklist | "What should a quote include" | Pull from `<vertical>-pricing-model.json.scopeItems`. |
| Each missed sub-vertical | Sub-vertical intent clusters | E.g., for painting: cabinet ($X-$Y), deck/fence (per sqft/linear-ft), interior (per room). |
| Local tips | how-to / climate / preparation intent | Pull real local facts: climate zone, humidity pattern, lead-paint percentage (median build year), pollen seasons. Tie to specific neighborhoods. |
| Local context dashboard | Trust + local-knowledge signal | 4-stat grid: population, median home build year, pre-1940 housing %, cost multiplier. All from `city-cost-multipliers.json` + `city-context.json` + Census ACS. |
| Permits + code | Practical question | Real permit office URL + phone + email. Verify each link actually works. |
| Contractor market | Contractor-trust intent | Reference the BBB-listed accredited contractors **without naming specific companies** (legal/competitive risk). Cite the BBB category page instead. |
| 15-20 FAQs | All clusters | Most existing pages have 3-5. Competitors have 15-30. Match competitor depth. |
| Nearby cities + other verticals | Internal linking | Already templated; keep. |

### Stage 7 — Protect from rebuild

Add the marker to the file's `<head>`:

```html
<!-- HANDWRITTEN-PROTECTED: do not regenerate. Edit by hand only. -->
```

[scripts/_handwritten-guard.js](../scripts/_handwritten-guard.js) monkey-patches `fs.writeFileSync` and silently no-ops any write to a protected file — but **only if the guard module is loaded into the Node runtime**.

**Three builder categories with different safety:**

| Builder | Vertical(s) | Protection |
|---|---|---|
| `build-flagship-*.js` (e.g., `build-flagship-painting.js`) | Curated 40-metro flagships per vertical | ✅ Already requires the guard at the top of the file. Safe to run as `node scripts/build-flagship-painting.js`. |
| `build-*-pages.js` (e.g., `build-painting-pages.js`) | Bulk per-vertical (14 verticals: concrete, electrical, fencing, foundation, garage-door, gutters, hvac, insulation, kitchen, landscaping, painting, plumbing, siding, solar, window — **NOT roofing**) | ⚠ Does NOT require the guard. Running directly **WILL overwrite protected files**. |
| `build-site.js` | **Roofing** (the original site builder; generic `city-page-template.html`). Generates `*-roof-cost.html` city pages + state pages + material pages + material-city pages + `sitemap.xml` + `all-cities.html`. | ⚠ Same as bulk builders — does not require the guard. |

**Safe invocation pattern for bulk builders:** use Node's `-r` flag to preload the guard before the builder runs:

```bash
node -r ./scripts/_handwritten-guard.js scripts/build-painting-pages.js
```

This loads the guard's monkey-patch into the runtime before the builder calls `fs.writeFileSync`. You'll see `[handwritten-guard] REFUSED write to <file>` log lines for each protected file the builder tried to overwrite.

**Test by running a builder once**: e.g., `node -r ./scripts/_handwritten-guard.js scripts/build-painting-pages.js` and confirm the protected page is NOT modified (compare md5sum before/after). Without the `-r`, the protected file IS overwritten.

**Long-term improvement (not done as of 2026-05-20):** add `require("./_handwritten-guard.js")` to the top of each `build-*-pages.js` script so the safety isn't optional. Until then, the `-r` flag is mandatory whenever running a bulk builder against a repo with HANDWRITTEN-PROTECTED files.

---

## Drafting workflow (save → review → ship)

1. Write the draft to **`output/drafts/<city>-<st>-<vertical>-cost.html`**, not the live path. `output/` isn't served and isn't in the sitemap.
2. Open it locally (run `python -m http.server 8000` from repo root, navigate to the path).
3. Self-review checklist:
   - [ ] No fabricated claims. Every assertion has a source. (See "verification rule" below.)
   - [ ] No conflicting prices/numbers within the page.
   - [ ] Real local-government links verified (open each in a browser).
   - [ ] No specific competitor business names (use category links instead).
   - [ ] HANDWRITTEN-PROTECTED marker in `<head>`.
   - [ ] All schemas (Article, Service, BreadcrumbList, FAQPage, Place, HowTo) updated with new content.
4. Get a second pair of eyes (Lane, ideally in browser).
5. When approved: `cp <live-file> <live-file>.bak-<YYYY-MM-DD>` then `cp output/drafts/<file> <live-file>`.
6. Verify the live file still has the marker and key data points.

---

## Verification rule (the hard one)

**Every load-bearing factual claim must have a verified source.** This is non-negotiable — see Lane's 2026-05-20 pushback ("you clearly have not done your homework") on draft v1, which had:
- Wrong BBB region name (`Tri-Cities` → actually `Southeast TN & NW Georgia`)
- Made-up neighborhood claim (East Brainerd as pre-1978 — it's a newer suburb)
- Wrong stored population (172K vs actual 183K)
- Wrong stored avgHomeAge (32 vs actual 49)
- Fabricated stat ("COI forgery is the most common Chattanooga complaint pattern" — no evidence)

**The fix process:** for every fact stated as truth on the page, ask: "what URL or repo file backs this up?" If none, do one of:
- Look it up (WebSearch / WebFetch / direct .gov)
- Soften to industry-general framing ("an industry-wide pattern")
- Remove

**Authoritative source priority:**
1. `.gov` (Census ACS, BLS OEWS, local permit office, state licensing board)
2. `.org` (BBB regional pages, EPA RRP)
3. Repo-internal data files (city-cost-multipliers, city-context — verified by stage 5 audit)
4. Real local industry content (local painters' blog posts — useful for climate/season specifics)
5. Aggregator content (HomeGuide, Thumbtack) — accept for direction, but don't cite as primary

---

## Measurement plan (after launch)

Without measurement, the experiment is just decoration. Before launching the page, commit to:

1. **GSC baseline screenshot** — capture impressions/clicks/avg position for the page (and its sibling templated pages) BEFORE shipping. Save in `data/gsc-baselines/<city>-<vertical>-<date>.png`.
2. **Target query list** — 20-30 specific queries from your cluster analysis that the page is designed to surface for. Save in `data/flagship-targets/<city>-<vertical>.json`.
3. **6-week and 12-week checkpoints** — calendar reminders. Re-pull GSC + position-tracking. Compare to baseline.
4. **Kill criteria** (define in advance):
   - 6 weeks: < +10 monthly impressions = below trajectory; reassess
   - 12 weeks: < +50 monthly impressions OR zero queries surfaced for the trust-cluster = the bet didn't work; revert to templated, document lessons

---

## Brutally honest expected outcome

**One hand-curated page WILL NOT beat Angi/HA/TT on competitive head terms.** DA gap is 50+ points; closing that needs links + brand signals, not content.

What you CAN realistically win:
- Long-tail trust-cluster queries (`<city> <vertical> bbb`, `<city> <vertical> license`, `verify <vertical> contractor <city>`)
- Tool-intent queries the analyzer answers (`is <vertical> quote fair <city>`, `<vertical> price check <city>`)
- The meta-query that combines them: `how to verify a <vertical> contractor in <city>` — almost nobody serves this well

Realistic ramp: 0 → 10-50 monthly impressions in 6-8 weeks, with click-through gated on the analyzer being above the fold.

**One page per week ≠ "build authority."** Authority is backlinks + brand search + user signals. 52 pages/year × 0 backlinks each = 52 invisible pages. Pair page launches with at least one outreach / link-earning activity per page or accept that scale alone won't move you.

---

## Anti-patterns to avoid

| Anti-pattern | Why it bites | What to do instead |
|---|---|---|
| Drafting from generic templates without per-city research | Lane's pushback 2026-05-20; you'll cite the wrong BBB region, wrong neighborhoods, wrong permit office | Stage 1+5 required before any drafting |
| Citing facts you can't verify | Erodes trust; risks legal exposure on red-flag claims | "Verification rule" above |
| Naming specific competitor businesses on the page | Legal/competitive risk; free traffic to competitors; brittle (companies move) | Link to BBB category pages instead |
| Auto-running scripts on cron | Violates [feedback-no-paid-services-in-automation](../memory/feedback_no_paid_services_in_automation.md) | All scripts are manual one-offs |
| Not flagging conflicting prices within a page | Quality-rater red flag; users notice | One canonical price range from the pricing model, used consistently |
| Skipping the HANDWRITTEN-PROTECTED marker | Next bulk-build run overwrites your work | Always include the marker; test that the marker is recognized |
| Shipping without a measurement plan | You can't tell if it worked | Commit to GSC baseline + checkpoint dates BEFORE shipping |

---

## Index of templates and tools

| Stage | Asset | Purpose |
|---|---|---|
| 1 | (manual) | Page audit / claim verification |
| 2 | (manual GSC export) | Real-query ground truth |
| 3 | [scripts/keyword-research/harvest-chattanooga-painting-pilot.js](../scripts/keyword-research/harvest-chattanooga-painting-pilot.js) | Autocomplete harvester (Bing + Google) |
| 4 | [scripts/keyword-research/analyze-chattanooga-painting-pilot.js](../scripts/keyword-research/analyze-chattanooga-painting-pilot.js) | Cluster + intent analyzer |
| 5 | [scripts/audit-city-data-vs-acs.js](../scripts/audit-city-data-vs-acs.js) | Census ACS audit + patch |
| 6 | [chattanooga-tn-painting-cost.html](../chattanooga-tn-painting-cost.html) | Section-recipe reference implementation |
| 7 | [scripts/_handwritten-guard.js](../scripts/_handwritten-guard.js) | Rebuild protection (already wired) |

When the scripts get parameterized (post-Chattanooga), they'll move to `scripts/flagship-research/` with `--city=<C> --vertical=<V>` CLI args. Until then, copy-and-edit the templates above.

---

## Memory references

- [project_flagship_research_model_2026_05_20.md](../memory/project_flagship_research_model_2026_05_20.md) — the model's project-state memo
- [feedback_no_mass_inject_city_pages.md](../memory/feedback_no_mass_inject_city_pages.md) — hard rule against bulk-injecting changes; flagship pages are hand-curated only
- [feedback_no_paid_services_in_automation.md](../memory/feedback_no_paid_services_in_automation.md) — all scripts here are manual one-offs by design
- [feedback_personally_review_every_fixture.md](../memory/feedback_personally_review_every_fixture.md) — every load-bearing claim verified

---

## Changelog

- **2026-05-20** — playbook v1 written after shipping the Chattanooga painting flagship. Reflects the audit-script addition (stage 5) that came out of Lane's "do your homework" pushback on draft v1.
