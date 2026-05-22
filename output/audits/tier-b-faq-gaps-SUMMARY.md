# Phase 1 Complete — Tier B FAQ Gap-List Summary

**Generated:** 2026-05-22
**Scope:** 16 Tier B verticals (~12K city pages)
**Per-vertical artifacts:** `output/audits/tier-b-faq-gaps-<vertical>.json`

## Proposed FAQs per vertical

| Vertical | Current | Proposed | Phase 2 gaps | Unused-rich slots | Notes |
|---|---|---|---|---|---|
| hvac | 3 | 6 | 1 | 2 | 5/6 wire-only |
| roof | 5 | 6 | **0** | 0 | uses rich shared city-context.json |
| plumbing | 3 | 6 | 1 | 2 | waterNote + freezeRisk unused signal |
| electrical | 3 | 6 | 1 | 2 | shares state NEC research w/ HVAC |
| solar | 3 | 6 | 2 | 2 | highest Phase 2 leverage (net metering + incentives) |
| kitchen | 3 | 6 | 1 | 2 | shares state permit research w/ siding/concrete/landscape |
| window | 3 | 6 | 1 | 2 | shares utility rebate research w/ HVAC + insulation |
| siding | 3 | 6 | 1 | 2 | uses hoaPrevalence (currently unused) |
| painting | 3 | 6 | 1 | 2 | EPA RRP × avgHomeAge is the deferrable Q |
| garage-door | 3 | 6 | **0** | 2 | hoaPrevalence covers HOA Q |
| fence | 3 | 6 | 1 | 2 | height/setback Q is highest-value state-fill |
| concrete | 3 | 6 | 1 | 2 | shares state permit research |
| landscaping | 3 | 6 | 1 | 2 | shares state permit research |
| foundation | 3 | 6 | 1 | 2 | engineer-stamp req is highest-value |
| insulation | 3 | 6 | 1 | 2 | shares utility rebate research |
| gutter | 3 | 5 | **0** | 2 | + 1 BUG (wood-gutter FAQ) to fix |

**Totals:** 101 proposed FAQs across 16 verticals (avg 6.3, baseline 3.0). 14 of 16 verticals have at least 1 Phase 2 data gap; 3 verticals (roof, garage-door, gutter) can ship Phase 3 with zero new data.

## Consolidated Phase 2 data-file plan

Most state-level data needs overlap. Consolidating into **6 shared state-data files** (50 entries each = 300 entries total):

| File | Verticals served | Entries | Fields |
|---|---|---|---|
| `data/shared-state-permit-data.json` | kitchen, siding, concrete, landscaping, painting | 50 | IRC adoption year, permit triggers, state contractor licensing body, sales tax on labor |
| `data/shared-state-mech-elec-data.json` | hvac, plumbing, electrical | 50 | IMC/IPC/NEC adoption year, mechanical/plumbing/electrical licensing body, permit workflow |
| `data/utility-rebate-data.json` | hvac, window, insulation | 50 | Top utility rebate programs per state, IRA 25C/45L reminders, weatherization assistance |
| `data/solar-state-data.json` | solar | 50 | Net metering policy, SREC market, state incentives, top utility interconnection norms |
| `data/foundation-state-data.json` | foundation | 50 | Engineer-stamp req, structural permit threshold, warranty terms |
| `data/fence-state-data.json` | fence | 50 | Max height (front/rear), setback rules, permit thresholds |

**Total Phase 2 research scope:** 300 state entries × 3-5 fields = ~1,200 data points. Static research from ICC code adoption tables + state contractor board websites + state DOR/utility regulator pages. **No API spend, no LLM-at-build.** Estimated effort: **15-25 hours one-shot**.

## Verticals that can skip Phase 2

3 verticals are unblocked for Phase 3 immediately:

1. **roof** — uses shared `city-context.json` which is already roof-tailored
2. **garage-door** — `hoaPrevalence` already in `city-context.json`, covers the HOA FAQ
3. **gutter** — 5 FAQs are sufficient; gutters rarely need permits

**Recommendation:** start Phase 3 on these 3 verticals in parallel with Phase 2 data sourcing for the remaining 13.

## Unused-rich slot inventory (across all 15 non-roof verticals)

Both `costDriverNote` and `redFlagNote` exist in every per-vertical context file with 739 entries each, 98-100% per-city distinct, ~500 characters each — and **currently render nowhere on any page**. That's:

- 15 verticals × 2 slots × 739 cities × ~500 chars = **~11.1 million characters of city-distinct content** already paid for, fully dormant.

Phase 3 wires them into every vertical's FAQ. No new content writing needed.

## Bug to fix during Phase 3

**gutter** vertical's current FAQ #3 is `"How long does a wood gutter last?"` with the fence FAQ's cedar/redwood answer pasted in. Wood gutters aren't a real residential product. Replace with `"What gutter material works best for {City}'s rainfall + freeze?"` consuming the existing `materialTip + climateNote` slots.

## Phase 2 priority ranking

If sourcing in priority order (highest impact first):

1. **shared-state-permit-data.json** — unlocks 5 verticals
2. **shared-state-mech-elec-data.json** — unlocks 3 verticals
3. **utility-rebate-data.json** — unlocks 3 verticals
4. **solar-state-data.json** — highest single-vertical value (net metering changes payback math fundamentally)
5. **fence-state-data.json** — high-leverage (buyers genuinely Google this)
6. **foundation-state-data.json** — trust-critical FAQ

## What this means for Phase 5 (≥70% composite floor)

- **High confidence ≥70% FAQ-slice composite** for every vertical post-Phase-3, since 98-100% per-city unique data fills 4-5 of every vertical's 5-6 FAQs.
- **Medium confidence ≥70% full-body composite** — depends on Phase 4 body-depth pass. The FAQ alone lifts FAQ slice but only 1/4 of the full-body weight. Body sections need similar dict-driven expansion.

## Next decision

Three options for execution sequence:

1. **Phase 2 first (research-heavy)**: 15-25h state-data sourcing across 6 files, then unblock all 16 verticals to Phase 3 simultaneously.
2. **Phase 3 first on the 3 unblocked verticals (roof/garage-door/gutter)**: ship + audit + validate the architecture end-to-end before committing to state-data research.
3. **Parallel**: start Phase 3 on the 3 unblocked + start Phase 2 research on the consolidated state files. Lowest wall-clock time to lift the full corpus.

Recommended: **option 2 first**, then **option 3 after the architecture is proven on 1 vertical**. The first Phase 3 build is the riskiest — it locks the contract for `buildFAQ()` + the template placeholder shape. Better to debug that on a vertical with no state-data dependency.
