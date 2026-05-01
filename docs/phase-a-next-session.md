# Phase A — next session orientation

**Read this first thing in any new session that's continuing Phase A work.** This file is the single source of truth for "where we are and what to do next." Updated at end of every session.

## What is Phase A
Goal: index all ~12K city-cost pages without regressing the ≥80% Google uniqueness floor.

Source of truth: [`full-city-page-indexing-plan.md`](full-city-page-indexing-plan.md). Read that file in full before starting any new Phase A work.

Locked decisions (do not re-litigate):
1. **A.3 mass-edit widget:** APPROVED with ≥80% gate
2. **A.1 indexability:** `index,follow` on 20 vertical-cities pages
3. **Roof Option 2 + roof-cities.html:** ship both
4. **Hub rollout:** HALTED (pivot to Phase A)

## Current state (updated 2026-05-01)

### Phase A.1 — vertical-cities directory pages (20 total)
| # | Vertical | Page | Status | Commit |
|---|---|---|---|---|
| 1 | foundation | foundation-cities.html | ✅ pilot shipped | ed7ec75c769 |
| 2 | hvac | hvac-cities.html | ⏳ | — |
| 3 | plumbing | plumbing-cities.html | ⏳ | — |
| 4 | electrical | electrical-cities.html | ⏳ | — |
| 5 | siding | siding-cities.html | ⏳ | — |
| 6 | gutter | gutter-cities.html | ⏳ | — |
| 7 | fencing | fencing-cities.html | ⏳ | — |
| 8 | concrete | concrete-cities.html | ⏳ | — |
| 9 | roof | roof-cities.html | ⏳ (highest priority — solves 120-orphan problem) | — |
| 10 | insulation | insulation-cities.html | ⏳ | — |
| 11 | landscaping | landscaping-cities.html | ⏳ | — |
| 12 | painting | painting-cities.html | ⏳ | — |
| 13 | garage-door | garage-door-cities.html | ⏳ | — |
| 14 | window | window-cities.html | ⏳ | — |
| 15 | auto-repair | auto-repair-cities.html | ⏳ | — |
| 16 | legal | legal-cities.html | ⏳ | — |
| 17 | medical | medical-cities.html | ⏳ | — |
| 18 | moving | moving-cities.html | ⏳ | — |
| 19 | kitchen | kitchen-cities.html | 🚫 (no city pages) | — |
| 20 | solar | solar-cities.html | 🚫 (contamination cleanup blocker) | — |

### Phase A.2 — state-vertical hub pages: not started
### Phase A.3 — neighbor cross-links: not started
### Phase A.4 — sitemap restructure: not started

## Per-session workflow (follow exactly)

### Pre-flight (~10 min)
1. `cat docs/phase-a-next-session.md` (this file)
2. `cat docs/full-city-page-indexing-plan.md` (the locked plan)
3. Run baseline uniqueness audit on the verticals you'll touch:
   - `node scripts/audit-uniqueness-google.js [vertical]`
   - Capture pre-state in your session notes (will compare post-commit)
4. Verify previous session's commits still pass: `node scripts/audit-hub-section-uniqueness.js` should still exit 0

### Loop (1 unit = 1 vertical-cities page; ~45 min each)
For each unit in this session (max 4 units, max 6 hrs total):
1. Pick the next ⏳ vertical from the table above (highest priority first: roof when you reach A.1 #9)
2. Build the page following the template in this doc (see "Template" below)
3. **Run gates BEFORE committing:**
   - `bash scripts/precommit-phase-a.sh [vertical]` — must exit 0
4. If gates pass: commit + push, update this file's table with commit SHA + status ✅
5. If any gate fails: HALT immediately, write failure note in `## Halt log` section, do NOT improvise

### Post-flight (~5 min)
1. Update this file (status, next vertical, any notes)
2. Commit the updated handoff doc separately
3. Post a short summary in conversation: what shipped, what's next, any concerns

## Template — vertical-cities page

Every Phase A.1 page follows this structure. The intro paragraph is the ONLY varying-prose part — the rest is a deterministic state-grouped link list.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>All cities with [Vertical] cost data | Woogoro</title>
<meta name="description" content="[Vertical-specific 140-char summary]" />
<link rel="canonical" href="https://woogoro.com/[vertical]-cities.html" />
<meta name="robots" content="index,follow" />
<link rel="stylesheet" href="/css/woogoro.min.css" />
</head>
<body>
<a href="#main" class="skip-link">Skip to main content</a>
<!-- Standard header markup (copy from any cost-guide hub) -->

<main id="main" class="container">
<h1>All cities with [Vertical] cost data</h1>

<p><!-- HAND-WRITTEN INTRO, vertical-specific. ~80-150 words. Pull a real differentiating fact about how [vertical] pricing varies by region. NEVER copy/paste between vertical-cities pages. --></p>

<p><a href="/[vertical]-cost.html">[Vertical] cost overview</a> · <a href="/[vertical]-replacement-cost-guide.html">Cost guide</a> · <a href="/all-cities.html">All cities (cross-vertical)</a></p>

<!-- For each state alphabetically: -->
<section class="section">
<h2>[State Name]</h2>
<ul class="city-link-list">
<li><a href="/[city-slug]-[state-slug]-[vertical]-cost.html">[City Name]</a></li>
<!-- ... all same-vertical city pages in that state, alphabetical ... -->
</ul>
</section>
</main>

<!-- Standard footer (copy from any cost-guide hub) -->
</body>
</html>
```

### Pricing data source per vertical (do NOT invent data)
- Use `ls *-[vertical]-cost.html` to enumerate city pages
- Group by state slug (last 2 chars before `-[vertical]-cost.html`)
- Sort cities alphabetically within state
- Sort states alphabetically

## Hard halt conditions (do not improvise)

- Any vertical's NF or FS uniqueness drops below 80% → HALT
- Any vertical's score drops >2 points from baseline → HALT
- Hub-section similarity audit exits non-zero → HALT
- New page type/vertical with structure not in plan → HALT
- 2 consecutive commits fail any gate → HALT
- You notice yourself batching steps or skipping pre-flight → HALT

When halted: append entry to ## Halt log section below, post conversation message to Lane, **wait for direction.** Do not auto-improvise a workaround.

## Halt log

(empty — no halts in Phase A yet)

## Session log

### Session 1 — 2026-05-01
- Locked the plan, locked the 4 decisions, halted the in-flight hub rollout
- Built `scripts/precommit-phase-a.sh` gate-enforcement script
- Shipped pilot: foundation-cities.html
- Status: pilot ship-and-audit complete. Pattern works. Hand off to next session.

## Pacing rules

- **Max 4 units per session** (one unit = one vertical-cities page in A.1, or one batch of 50 state-vertical pages in A.2)
- **Max 6 hours per session**
- **Re-read this file every 5 commits within a session**
- **End session with explicit handoff:** update this file, commit it, post conversation summary

## What's NOT in scope this phase

- Backlinks (separate workstream)
- Per-city content depth (Phase B)
- Solar contamination cleanup (separate workstream — A.1 solar entry blocked until that ships)
- Wrong-vertical city page cleanup (separate)
- Hub-link rollout completion (HALTED)
