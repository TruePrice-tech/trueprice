# Hub city-link rollout — ledger

Goal: 18 hub guides wired to ~30 city pages each, so 10K "Discovered, currently not indexed" pages become indexable.

Rules: [hub-link-rollout-rules.md](hub-link-rollout-rules.md). Hard gates: city/flagship uniqueness ≥80%, hub-pair similarity <35%.

## Progress

| date | hub | cities linked | hub-pair sim% | city uniq pre (NF/FS) | city uniq post (NF/FS) | commit | status |
|---|---|---|---|---|---|---|---|
| 2026-05-01 | foundation-repair-cost-guide | 30 | n/a (1 hub) | 86 / 90 | 86 / 90 | d7463b2913 | OK |
| 2026-05-01 | hvac-replacement-cost-guide | 30 | 11.2% | 84 / 89 | 84 / 89 | 6458b83cd1 | OK |
| 2026-05-01 | plumbing-cost-guide | 30 | 13.5% (max) | 83 / 91 | 83 / 91 | 1ed22921d3 | OK |
| 2026-05-01 | electrical-cost-guide | 30 | 18.5% (max, vs plumbing) | 84 / 90 | 84 / 90 | aa41f9c8eb | OK |
| 2026-05-01 | siding-cost-guide | 30 | 14.5% (max, vs plumbing) | 86 / 89 | 86 / 89 | c87a6e8e9f | OK |
| 2026-05-01 | gutter-installation-cost-guide | 30 | 12.5% (max, vs siding) | 83 / 88 | 83 / 88 | fb4ac9e68a | OK |
| 2026-05-01 | fencing-cost-guide | 30 | 17.9% (max, vs siding) | 85 / 89 | 85 / 89 | c820a93e75 | OK |
| 2026-05-01 | concrete-cost-guide | 30 | 14.3% (max, vs foundation) | 83 / 88 | 83 / 88 | e6d472fe96 | OK |

## Working set (18 hubs)

Done = ✅, In progress = 🟡, Pending = ⏳, Blocked = 🚫

| Hub | City pages | Status |
|---|---|---|
| auto-repair-cost-guide | 48 | ⏳ |
| concrete-cost-guide | 740 | ✅ |
| electrical-cost-guide | 740 | ✅ |
| fencing-cost-guide | 742 | ✅ |
| foundation-repair-cost-guide | 740 | ✅ |
| garage-door-cost-guide | 740 | ⏳ |
| gutter-installation-cost-guide | 740 | ✅ |
| hvac-replacement-cost-guide | 740 | ✅ |
| insulation-cost-guide | 741 | ⏳ |
| landscaping-cost-guide | 740 | ⏳ |
| legal-cost-guide | 48 | ⏳ |
| medical-cost-guide | 48 | ⏳ |
| moving-cost-guide | 48 | ⏳ |
| painting-cost-guide | 740 | ⏳ |
| plumbing-cost-guide | 742 | ✅ |
| roof-cost-calculator | 856 | ⏳ |
| siding-cost-guide | 740 | ✅ |
| window-replacement-cost-guide | 740 | ⏳ |

## Excluded

| Hub | Reason |
|---|---|
| solar-installation-cost-guide | 633/741 city pages contaminated with roofing content; blocked until cleanup |
| kitchen-remodel-cost-guide | No city pages exist |
| guides.html | Multi-vertical; revisit after the 18 |

## Halt log

(empty — no halts yet)
