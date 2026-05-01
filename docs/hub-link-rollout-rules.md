# Hub city-link rollout — hard rules

**Goal:** Add a city-link section to each of 18 hub guides so the 10K "Discovered, currently not indexed" pages get internal PageRank flow and become indexable.

**Working set (18 hubs):**
auto-repair, concrete, electrical, fencing, foundation-repair, garage-door, gutter-installation, hvac-replacement, insulation, landscaping, legal, medical, moving, painting, plumbing, roof-cost-calculator, siding, window-replacement, solar-installation (DEFERRED — see below)

**Excluded:**
- `kitchen-remodel-cost-guide.html` — no city pages exist
- `solar-installation-cost-guide.html` — 633 city pages contaminated with roofing content; blocked until cleanup
- `guides.html` — multi-vertical, lower priority; revisit after the 18

---

## Hard gates (commit BLOCKED if any fail)

Run before every hub commit. If any fails, halt and write a memory note. Do not improvise.

1. **City + flagship uniqueness ≥80%** for the vertical being edited.
   - `node scripts/audit-uniqueness-google.js <vertical>` must show **both NF and FS composite ≥80%**.
   - Hard rule per Lane (2026-05-01): "all page uniqueness by google standards must be over 80% or that is a hard fail."
   - City pages aren't being modified, so this should be unchanged from baseline. If it drops, something unexpected happened — HALT.

2. **Pairwise hub similarity <35%** across all hub city-link sections.
   - `node scripts/audit-hub-section-uniqueness.js`
   - If any pair exceeds 35% → exits 1 → cannot commit.

3. **JSON-LD blocks parse.**
   - Every `<script type="application/ld+json">` block in the edited hub must still parse.
   - Manual check: extract each block, `node -e "JSON.parse(...)"`.

4. **No accidental city-page modifications.**
   - `git status` after edit must show ONLY the hub file changed (and rollout docs).

---

## Per-hub editing rules (re-read at start of every hub)

The new section must be inserted between the START and END markers below, placed BEFORE the FAQ section in the hub. Each hub MUST vary on every dimension below — no two hubs may share more than 35% normalized text.

### Required structural markers (every hub)

```html
<!-- HUB-CITY-LINKS:START -->
<section class="section">
... new content ...
</section>
<!-- HUB-CITY-LINKS:END -->
```

### Six dimensions that MUST vary per hub

| # | Dimension | Examples of variation |
|---|---|---|
| 1 | `<h2>` heading text | "Where you live changes the price", "City-by-city pricing reality", "Foundation costs in 30 metros", "What [vertical] really costs in your city", etc. — never reuse a phrase |
| 2 | Intro paragraph (1-3 sentences) | Lead with a different angle: cost driver (climate, code, labor market), local-quirk (permits, HOA, soil type), or methodology note. Never start with "Here are prices for..." |
| 3 | Table column 3 framing | Options: "vs national median", "climate driver", "permit complexity", "soil/site factor", "labor market note", "rebate availability". Pick one that fits the vertical; no two hubs use the same column-3 frame |
| 4 | Table position | Some BEFORE the FAQ, some AFTER the cost-breakdown table, some near the page bottom. Pick by what fits the existing hub flow; vary the placement |
| 5 | Closing line / CTA tie-in | Different sentence each time. Some link to analyzer, some to estimate, some omit a CTA |
| 6 | Intro length | Vary 1-sentence vs 3-sentence intros. Don't write the same length every time |

### Banned phrases (never reuse across hubs)

This list grows as the rollout progresses. Re-read before each hub.

- (none yet — populate as drift is detected)

### Per-vertical pricing data sources

For each hub, pull per-city pricing from (in order of preference):

1. The vertical's existing landing page (`hvac-cost.html`, `electrical-cost.html`, etc.) if it exists — copy the price table over and rework the framing.
2. The actual flagship city pages (e.g., `atlanta-ga-foundation-cost.html`) for verticals with no landing page — read 30 cities, extract price ranges from their hero/intro sections.
3. The build-flagship-*.js data files in `scripts/` if neither HTML source has clean data.

Never invent prices. If a city's price isn't sourced from real data, skip that city.

---

## Hard stop conditions (HALT + memory note, do not ask)

- 2 consecutive hubs fail similarity audit → HALT
- Any vertical's city or flagship uniqueness drops below 80% → HALT
- Any vertical's score drops by >2 points from its baseline (even if still ≥80%) → HALT  
- Any JSON-LD validation fails on any hub → HALT
- Any hub has a structure I haven't seen before (custom widgets, embedded apps, non-standard sectioning) → HALT

When halted: write a memory note describing the failure, update the ledger with `status: HALTED`, stop work, do not improvise a workaround.

---

## Pacing (per Lane's drift rule)

- **4 hubs max per session.**
- After 4 hubs, halt for the day. Schedule next batch for ≥1 day later via `/schedule`.
- Re-read THIS file at the start of every hub.
- Re-read this file in full every 5 hubs even within a session.

## Per-hub workflow (the actual loop)

1. `cat docs/hub-link-rollout-rules.md` — re-read rules
2. Read the hub HTML in full (find FAQ position, custom widgets, JSON-LD)
3. Source per-city pricing data
4. Hand-write the section: heading, intro, table, closing — varying all 6 dimensions vs prior hubs
5. Insert between START/END markers, before FAQ
6. Run `node scripts/audit-hub-section-uniqueness.js` — must pass
7. Run `node scripts/audit-uniqueness-google.js <vertical>` — must show ≥80% NF + FS, no >2pt drop
8. Manually validate JSON-LD blocks parse
9. `git diff` — verify ONLY hub file changed
10. Commit with message: `SEO: wire <vertical> hub to <N> city pages for indexability`
11. Push (triggers IndexNow auto-fire per existing CI)
12. Append row to `docs/hub-indexing-rollout.md`
