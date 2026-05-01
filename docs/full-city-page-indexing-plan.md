# Full city-page indexing plan (locked 2026-05-01)

## The problem

12,185 city-cost pages exist. 1,730 indexed. **10,030 stuck in GSC "Discovered, currently not indexed" + 585 in "Crawled, currently not indexed."** The hub-link rollout in [hub-indexing-rollout.md](hub-indexing-rollout.md) only addresses ~30 cities per vertical via hub PageRank — it's the wrong-tier solution for indexing 10K+ pages. This plan addresses the full-tier problem.

## Hard constraints (non-negotiable)

1. **All city + flagship pages must stay ≥80% Google uniqueness composite.** Per Lane 2026-05-01: "must be over 80% or that is a hard fail." Verified with `audit-uniqueness-google.js [vertical]` before every commit.
2. **No mass-injection of templated prose into city pages.** Per [feedback_no_mass_inject_city_pages.md](../memory/feedback_no_mass_inject_city_pages.md). Link-widget injection is a separate question — see Phase A.3 below.
3. **Roof vertical (main vertical) must not regress.** 856 city pages, currently zero broken into "by-state" hubs.
4. **Solar vertical blocked from new internal linking** until 633-page roofing-contamination cleanup ships (separate workstream).
5. **Each new page type ships with its own pre-launch uniqueness audit and rollback plan.**

## Current state diagnosis

### Why pages aren't indexed (root causes, ordered)

1. **Internal-linking depth too thin.** Most city pages have 1–3 inbound links from authority pages. Google's crawl-budget heuristic deprioritizes pages with low internal PageRank flow.
2. **`all-cities.html` cap.** 739 outbound city links, but the site has 12,185 city pages. ~120 roof city pages, ~30+ per other vertical, are completely orphaned from the all-cities directory.
3. **No state-level hub pages.** Google's site-hierarchy detection looks for state-vertical landing pages; we have none.
4. **No same-vertical neighbor cross-links on city pages themselves.** Each city page is a topical island — no PageRank flows between geographically-adjacent cities.
5. **Sitemap is monolithic.** Single sitemap with 12K URLs gives Google no hierarchy signal.

### What's working (do not break)

- 87% NF / 88% FS uniqueness baseline across 20 verticals — GOOD per Google audit.
- Existing vertical landing pages (~38 city links each) for 10 verticals.
- 11 hubs already wired (this rollout, partial value but shipped).
- Sitemap refresh cron + IndexNow auto-fire.

## Architecture: 4 new page types

### Phase A.1 — Per-vertical city directory pages

**Scope:** 20 new pages.

**Examples:** `roof-cities.html`, `hvac-cities.html`, `plumbing-cities.html`, `auto-repair-cities.html`, etc.

**Content per page:**
- H1: "All cities with [vertical] cost data"
- 2–3 sentence intro (vertical-specific)
- State-grouped table or column list of every same-vertical city page (alphabetical states, alphabetical cities within each state)
- Link to vertical landing page + vertical hub-cost-guide at top

**Format constraints (uniqueness-preserving):**
- Each vertical's intro paragraph is hand-written, not templated
- Each vertical's state-grouping rendering is identical structure but data is different (different cities listed, different per-state counts)
- Total per page: 700–856 anchor links + ~150 words of intro prose

**Indexability decision:**
- Default: `index,follow` — these are useful navigation pages users would reference
- Fallback: `noindex,follow` if uniqueness audit between vertical-cities pages exceeds 40% pairwise similarity (their structure is similar by design; only intro differentiates)

**Linked from:**
- `index.html` footer (replaces current single "All cities" link with per-vertical breakouts)
- Each vertical's landing page (`hvac-cost.html`, `fence-cost.html`, etc.)
- Each vertical's hub guide (`hvac-replacement-cost-guide.html`, etc.)
- `all-cities.html` (cross-link from monolithic directory)
- Sitemap

**Effort:** ~2 hrs/page × 20 = **40 hrs**

**Uniqueness risk:** LOW. Link directories are exempt from prose-content scoring. Pre-launch audit verifies intro paragraphs <40% pairwise similar.

**Indexability impact:** every city page gains 1 strong inbound link from an authority page.

---

### Phase A.2 — Per-state-per-vertical hub pages

**Scope:** ~1,000 new pages (50 states × 20 verticals; some verticals fewer if missing state coverage).

**Examples:** `hvac-cost-georgia.html`, `roof-cost-texas.html`, `plumbing-cost-california.html`.

**Content per page (data-driven, real differentiation per state):**
- H1: "[Vertical] cost in [State] (2026)"
- State-specific data section: license board URL, climate zone (IECC), average BLS plumber/electrician/etc. wage for state, dominant rate-of-pay tier, state-level rebates (e.g., Mass Save, NYSERDA Clean Heat)
- Per-state regulatory notes (state-specific code amendments, permit thresholds, contractor licensing tier)
- 15–25 city links in that state
- Per-state pricing table (medians from BLS+BEA per-city data)

**Format constraints (uniqueness-preserving):**
- Templated structure across pages
- Per-state data dictionary makes content genuinely different (rebates, license boards, climate zones, wages all vary)
- Pre-launch audit: pairwise similarity within a vertical (50 state pages of HVAC cost) must be <35%

**Indexability:** `index,follow`. These are substantial state-specific resources.

**Linked from:**
- Phase A.1 vertical-cities pages (state headers link to corresponding state-vertical hub)
- Vertical landing pages (footer state list)
- Sitemap

**Effort:** ~5 hrs scripted build + ~4 hrs template + per-state data dictionary build (12 hrs at scale across all states/verticals) = **~21 hrs**

**Uniqueness risk:** MEDIUM. Templated structure means content has to do all the differentiating work. Pre-launch audit failure → halt that vertical's state pages, hand-edit problem cases.

**Indexability impact:** every city page gains 1 inbound link from its state-vertical hub. Plus state-vertical hubs themselves rank for "[vertical] cost in [state]" queries (currently undercovered SERP).

---

### Phase A.3 — Same-vertical neighbor cross-links on every city page

**Scope:** Mass-edit ~12,000 existing city pages.

**What we're adding:**
- Bottom-of-page widget: "[Vertical] costs in nearby cities: [Athens, GA] · [Macon, GA] · [Augusta, GA] · [Marietta, GA] · [Sandy Springs, GA] · [Roswell, GA] · [Decatur, GA]"
- 5–10 links per city, picked by geographic proximity (haversine distance from same-vertical city pages within ~75 miles)
- Tiny widget — link list, no prose, ~1 sentence of intro at most ("Nearby cities:")

**Format constraints (uniqueness-preserving):**
- NOT prose. Link list with city names.
- One short prefix line: "[Vertical] costs in nearby cities:" (templated but trivially short)
- Doesn't affect Google's prose-uniqueness scoring (template/semantic/info-density metrics)
- Verified: pre-launch run on a 100-city sample, post-edit `audit-uniqueness-google.js` shows ≥80% NF/FS preserved (any drop >2 points = abort)

**Tension with the no-mass-inject rule:**
- The rule per [feedback_no_mass_inject_city_pages.md](../memory/feedback_no_mass_inject_city_pages.md) is "hand-edit each city HTML, page by page. Never run inject scripts across pages."
- This was written because past inject scripts mutated CONTENT in ways that broke uniqueness or introduced wrong-vertical bugs.
- Phase A.3 injects a LINK WIDGET, not content. Argument: this is structurally different from the rule's intent.
- **Decision required from Lane:** confirm that geographic-driven link-widget injection (no prose mutation) is acceptable, OR override and require hand-editing all 12K pages (not feasible at any reasonable timeline).

**Effort if scripted:** ~6 hrs. **Effort if hand-edited:** infeasible (12K pages × 5 min each = 1,000 hrs).

**Uniqueness risk:** LOW (link list, not prose). Pre-launch sample validates.

**Indexability impact:** every city page gains 5–10 inbound links from peer cities. **Largest single-move PageRank circulation in the plan.**

---

### Phase A.4 — Sitemap restructure

**Scope:** Split the monolithic sitemap into per-vertical-per-state submaps.

**Examples:** `sitemap-hvac-georgia.xml`, `sitemap-roof-texas.xml`. Sitemap-index.xml lists all submaps.

**Why:** Google's site-hierarchy detection benefits from segmented sitemaps. Pages discovered via per-vertical-per-state submaps get clearer crawl-priority signals than via a flat 12K-URL list.

**Effort:** ~2 hrs scripted.

**Uniqueness risk:** None (sitemap, not content).

**Indexability impact:** marginal but positive — clearer hierarchy signal to Googlebot.

---

## Phase sequence + dependencies

```
A.1 (vertical-cities, 40 hrs) ──────┐
                                    ├──→ A.3 (neighbor cross-links, 6 hrs)
A.2 (state-vertical hubs, 21 hrs) ──┘                ↓
                                              A.4 (sitemap, 2 hrs)
```

A.1 first because it's discrete (20 new pages, low risk) and unblocks A.2 design (state pages link UP to vertical-cities pages).

A.2 second because state pages need vertical-cities pages to link from.

A.3 last among the page-creation phases because it's the highest-leverage but also touches every existing city page — should ship after A.1+A.2 prove the architecture and uniqueness audit catches drift.

A.4 ships alongside A.3 (or after) — sitemap restructure should reflect the final hierarchy.

---

## Per-phase guardrails (commit-blocking)

| Phase | Pre-launch test | Hard gate |
|---|---|---|
| A.1 | Cross-vertical similarity audit (20 new pages) + hand-spot-check 3 random pages | Pairwise similarity <40% on intro prose; 0 broken links; all 20 valid HTML |
| A.2 | Cross-state similarity audit per vertical (50 state pages × 20 verticals = 1000 pages) | Pairwise similarity <35% within vertical; data dictionary populated for every state |
| A.3 | 100-city sample run + uniqueness re-audit before scaling | ≥80% NF/FS on every vertical post-edit; no >2pt drop from baseline |
| A.4 | XML schema validation; submap URL count matches city-page count | Valid XML; total URLs = 12,185 (or current count) |

If any phase fails its hard gate → halt that phase, write memory note, do not improvise. Same pattern as the rollout.

---

## Success metrics

### After Phase A.1 + A.2 ship (target ~6 weeks)
- Every city page has 3–5 inbound links from authority pages (vs current 1–3)
- GSC "Discovered, currently not indexed": 10,030 → **<5,000**
- GSC "Crawled, currently not indexed": 585 → **<300**
- Indexed page count: 1,730 → **4,000–5,000**
- City uniqueness scores: hold ≥80% on every vertical
- Phase A.1 vertical-cities pages: each ranks for "[vertical] cost by city" type queries

### After Phase A.3 ships (target ~10 weeks total)
- Every city page has 7–12 inbound links (5–10 from neighbors + 1–2 from authority)
- GSC "Discovered, currently not indexed": **<3,000**
- Indexed page count: **6,000–8,000**

### After Phase A.4 + tail of indexing pickup (target ~16 weeks total)
- Indexed page count: **9,000–11,000**
- GSC "Discovered" bucket: near-empty (Google has crawled+ranked everything that's substantial enough)
- Remaining un-indexed pages = thin/duplicate edge cases requiring content investment (separate Phase B work)

---

## What this plan does NOT solve (out of scope)

- **External authority (backlinks)** — separate workstream: HARO pitches ([haro-pitch-kit.md](../haro-pitch-kit.md)), blog cadence ([blog-queue.md](../blog-queue.md)), press mentions
- **Per-city content depth** — some cities will still rank thin. Phase B (content investment) is a separate effort
- **Solar vertical contamination** — 633 city pages need roofing-content cleanup before any new internal linking lands. Separate workstream.
- **Wrong-vertical content on 8,956 city pages** — separate compare-page initiative ([project_next_session_compare.md](../memory/project_next_session_compare.md))
- **Roof orphan recovery beyond 739** — Phase A.1 fixes this but only if the roof-cities directory page is actually built

---

## Effort + sequencing summary

| Phase | Description | Hours | Sessions |
|---|---|---|---|
| A.1 | 20 vertical-cities pages | 40 | 5–6 sessions of 6–8 hrs |
| A.2 | 1000 state-vertical pages (scripted) | 21 | 3 sessions |
| A.3 | Neighbor cross-links (mass-edit, scripted) | 6 | 1 session |
| A.4 | Sitemap restructure | 2 | 0.5 session |
| **Phase A total** | | **69 hrs** | **~10–12 weeks calendar** |

Honest range with normal session slip: **80–100 hours** across 12–16 weeks.

---

## Open questions for Lane (before kickoff)

1. **Phase A.3 mass-edit override:** confirm that geographic-driven link-widget injection on 12K city pages is acceptable, OR specify an alternative. Hand-editing 12K pages is infeasible.
2. **Phase A.1 indexability:** ship vertical-cities pages as `index,follow` (more SEO value, requires uniqueness audit on intro prose) or `noindex,follow` (zero risk, slight SEO loss)?
3. **Roof Option 2 from current rollout:** still want to do `roof-cost-by-material.html` city section, or skip it entirely now that Phase A.1's roof-cities page solves the orphan problem more comprehensively?
4. **Hub rollout completion:** finish remaining 7 hubs (~3 hrs) for completeness, or stop now and pivot fully to Phase A?

---

## Rollback plan per phase

- **A.1:** `git revert` removes the 20 new pages. No impact on existing pages.
- **A.2:** `git revert` removes the 1000 new pages. No impact on existing pages.
- **A.3:** `git revert` strips the neighbor-link widget from city pages. Pages return to pre-edit state. Requires pre-edit git tag for clean revert.
- **A.4:** `git revert` restores monolithic sitemap. No impact on city pages.

Each phase is a discrete commit (or commit series). Each is individually revertible. None of Phase A modifies city-page prose content.

---

## Authority

This plan is locked 2026-05-01. Changes require explicit Lane sign-off and revision in this file.
