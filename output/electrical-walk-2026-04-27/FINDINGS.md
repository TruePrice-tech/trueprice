# Electrical Deep-Dive Findings — 2026-04-27

**Method:** Per `feedback_vertical_deep_dive_method.md`. Baseline from real fixtures + Lane's address (17064 Laurelmont Ct, Fort Mill SC). Walked live https://woogoro.com.

**Status:** No commits per Lane's instruction. All bugs confirmed by reading rendered output as a human.

**Coverage:** 4 estimate scenarios (panel / EV / generator / whole-house rewire). 7 analyze fixtures. 1 compare run with 3 synthetic panels. Did NOT click Save PDF / Share / Start Over / contractor-review CTAs — those still need exercising before the dive is "done" per Lane's coverage rule.

---

## 🔴 Critical bugs (user-trust-eroding, fix before promoting electrical)

### 1. Analyzer hard-locks every quote into "OVERPRICED" verdict on garbage OCR

**Walk evidence:** [v2-rw-01-result.png](v2-rw-01-result.png), [v2-extra-13-result.png](v2-extra-13-result.png)

A photo of a Cutler-Hammer panel **sticker** (not a quote) renders as `OVERPRICED $21,254 — 659% above $2,800 average` with full Project Details, Scope Review, and Next Steps confidently filled in. A photo of an old basement fuse panel renders as `OVERPRICED $75,055 — 2581% above`. OCR confidence on these was 46% and 29% respectively, but the regex-first path emits a price and the analyzer doesn't second-guess.

**Root cause:**
- `electrical-quote-analyzer.html` `processFile()` accepts whatever `TP_Engine.analyzeQuote` returns from regex extraction with no minimum-confidence gate.
- For the panel sticker, regex grabbed digit clusters from interrupting-capacity ratings and detection helpers latched onto "600A" as amperage.
- Same class as HVAC bug 5 (low-confidence gate) that already shipped 2026-04-27. Pattern needs porting.

**Fix sketch:**
1. Gate regex price acceptance on `ocrConf >= 60%` AND `parsed.confidence !== "low"` AND price < 50K (electrical jobs above 50K should always go to AI).
2. If gated, force AI fallback OR show "We couldn't confidently read this — please enter the total" instead of presenting a verdict.
3. Add "this looks like a panel photo, not a quote" detection: if no `$`, no "total", and OCR text is mostly numbers/short tokens, refuse to grade.

---

### 2. Recessed lights $3,487.53 quote → labeled "Outlet/Switch Replacement, $250 benchmark, 1295% above average / OVERPRICED"

**Walk evidence:** [v2-extra-12-result.png](v2-extra-12-result.png), source fixture `test-quotes/real-world/electrical-extra-12.jpg` (25× 6" halo recessed lights, 250' 14/2 wire, GFI bell box, $3,487.53 total).

`detectElecServiceType()` at `electrical-quote-analyzer.html:602` checks regexes in priority order: whole_house_rewire → ev_charger → generator → circuit_addition → **outlet/switch (matches "GFI/outlet")** → panel_upgrade. The recessed-light quote mentions "GFI bell box" so it falls into `outlet_switch` ($150-$300 base). It never gets a chance to match "recessed/halo/can lights" because that branch doesn't exist.

**Fix sketch:**
1. Add `recessed_lights` branch BEFORE `outlet_switch`: `/\b(recessed|can light|halo|6["”] light|down ?light|trim ring)/i`
2. Add `recessed_lights` to ELEC_PRICING.basePriceByService with per-light scaling (use `recessed_lights_6pack` from the API's pricing JSON: $800-$2,400 for 6 → ~$133-$400 per light).
3. Also missing branches: `light_fixture` (electrical-pricing.json has it in API enum but not on frontend), `gfci_outlet`, `smoke_detector_hardwired`, `subpanel_install`, `service_entrance_replace`. The frontend regex universe is much smaller than the API's `commonJobs` set.

---

### 3. Analyzer never collects user address → SC pricing never applied

**Walk evidence:** Every analyze result page says `PRICING: South regional pricing` instead of `Fort Mill local pricing` (which the estimate page does correctly show).

**Root cause:** `renderAddress()` in `electrical-quote-analyzer.html:666-686` only renders the upload zone — there are NO `addrStreet/City/State/Zip` inputs. The autocomplete code at line 705 and the `btnEstimate` handler at line 747 are dead because their elements don't exist. `handleFile()` at line 771 reads from those (null) elements, so `state.address.stateCode` stays `""`. `getRegionFromState("")` defaults to `"south"` (Texas labor mult 1.00) for every analyze. SC's `southeast` 1.03 mult is never applied. Lane's home in Fort Mill gets generic "south" benchmarks.

**Compound effect:** The benchmark $2,800 we see hardcoded for every panel-upgrade analysis is actually `((1800+3500)/2) × 1.00 (south) × inflation × seasonal` — never picks up SC adjustment.

**Fix sketch:**
1. Either add the same address inputs to the analyzer landing page (matches estimate UX), OR
2. Detect state from OCR text first (parser already does this via `parsed.location`) and fall back to a top-of-page address mini-form when OCR doesn't surface a state.
3. Persist user's state across analyze/estimate/compare via `sessionStorage` so a return user doesn't re-enter.

---

### 4. Estimate result page shows "Federal 30C tax credit: up to $1,000 for residential EV charger" on EVERY job type

**Walk evidence:** All four estimate dumps ([est-panel-05-result.txt](est-panel-05-result.txt), [est-ev-05-result.txt](est-ev-05-result.txt), [est-gen-05-result.txt](est-gen-05-result.txt), [est-rewire-05-result.txt](est-rewire-05-result.txt)) show the **identical** "Potential Savings" block:

> Federal 30C tax credit: up to $1,000 for residential EV charger installations in eligible census tracts...
> Utility rebates: many utilities offer incentives for panel upgrades that support electrification
> Off-peak scheduling: booking during fall or winter can reduce labor costs 5-10%

A homeowner pricing a whole-house rewire or generator install sees a 30C **EV charger** credit pitched as a savings opportunity. That's irrelevant and looks unprofessional.

**Fix sketch:** Make the savings block job-type-aware. Map services to applicable credits:
- panel_upgrade → 25C is EXPIRED 12/31/25 (don't list). HEAR rebate up to $4,000 for income-eligible.
- ev_charger → 30C ($1,000, eligible census tract caveat).
- generator → none from federal (state utility rebates only).
- whole_house_rewire → HEAR up to $2,500 wiring + $4,000 panel income-eligible.

The API's `pricingData.iraPrograms` already has this structure; the estimate page just doesn't read it.

---

### 5. Estimate result "What This Estimate Includes" is hardcoded 8-item checklist regardless of service type

**Walk evidence:** EV charger, generator, whole_house_rewire, and panel upgrade ALL show the same scope:

```
✓ Permits and inspections     ✓ Electrical panel
✓ Circuit breakers             ✓ Wiring / cabling
✓ Grounding system             ✓ Testing and commissioning
✓ Cleanup and patching         ✓ Warranty (parts + labor)
```

For an EV charger: "Electrical panel" isn't part of scope (unless panel upgrade is bundled), and "Cleanup and patching" is barely relevant. For a generator: the actually-important items missing — concrete pad, automatic transfer switch, gas line tie-in coordination, NEC 702 compliance.

**Fix sketch:** Define per-service scope lists. Use the API's `recommendedScopeItems` and per-job `nec_refs` already in `data/electrical-pricing.json`.

---

### 6. "Next Steps" recommends drywall patching for EV chargers and generators

Same hardcoding:

> Ask if the quote includes drywall patching and cleanup after wiring work

Irrelevant for EV charger (exterior/garage), generator (exterior pad). Should mention what *is* relevant per service:
- EV charger → NEC 625.42 continuous-load 125% breaker, charger amp rating, utility rebate eligibility.
- Generator → ATS type, fuel sizing (gas vs propane), permit + Notice of Operation, NEC 702.
- Panel upgrade → NEC 220 load calc, grounding electrode system (two rods + Ufer), Type 2 SPD per NEC 230.67, panel brand spec.

---

### 7. API `jobType` enum drift from `data/electrical-pricing.json` → 6 of 14 jobs return no `expectedRange` / no benchmarks

**Audit evidence:** `api/electrical-estimate.js:154` Claude prompt enum vs `data/electrical-pricing.json` `commonJobs` keys:

| Prompt enum | Pricing JSON key |
|---|---|
| `ev_charger` | `ev_charger_level2` ❌ |
| `generator_install` | `generator_whole_home` ❌ |
| `outlet_install` | `outlet_install_standard` ❌ |
| `ceiling_fan` | `ceiling_fan_install` ❌ |
| `recessed_lights` | `recessed_lights_6pack` ❌ |
| `circuit_breaker` | `circuit_breaker_replace` ❌ |
| `panel_upgrade_100_200` | match ✓ |
| `panel_upgrade_200_400` | match ✓ |
| `whole_house_rewire` | match ✓ |
| `gfci_outlet` | match ✓ |
| `smoke_detector_hardwired` | match ✓ |
| `knob_tube_removal` | match ✓ |

When Claude returns `ev_charger` (per the enum), `pricingData.commonJobs["ev_charger"]` is `undefined` → no `jobLabel`, no `expectedRange`, no `laborHoursBenchmark`, no `partsBenchmark`. EV charger / generator / outlet / ceiling-fan / recessed / breaker analyses all silently lose their benchmark cards.

Also: `redFlagPatterns` `scopedToJobTypes` uses the JSON keys (`ev_charger_level2`, `generator_whole_home`, `service_entrance_replace`, `subpanel_install`) — none of which the prompt emits. So missing-permit, missing-load-calc, generator-no-gas-line red flags **never trigger** for the very job types that need them most.

**Fix sketch:** Pick one — either add a `jobKeyMap` (concrete bug 5 pattern, commit `03059caad5`) OR change the prompt enum to emit the full keys directly. The latter is cleaner.

---

### 8. EXPIRED 25C credit still pushed as `iraApplicable` for any panel upgrade

`api/electrical-estimate.js:438-446`:

```javascript
if (jobType && jobType.startsWith("panel_upgrade")) {
  iraApplicable.push({
    program: "25C Panelboard Credit (EXPIRED Dec 31 2025)",
    amount: "30% up to $600/yr", ...
```

The `metadata.notes` and `iraPrograms.25C.status` already say `EXPIRED`, but the response still labels this credit as "applicable" — just with the parenthetical "EXPIRED" in the program name. A user scanning the JSON or any UI that pulls this field will see a $600 credit dangled. Same class as HVAC's expired-tax-credit fix from this morning.

**Fix sketch:** Remove the 25C and `heat_pump_circuit` 25C blocks entirely (or move them to a separate `iraExpired` field for transparency, never `iraApplicable`).

---

### 9. Compare verdict copy: "$7,138 (430%) more than" reads like overpricing accusation

**Walk evidence:** [cmp-03-results.txt](cmp-03-results.txt) line 9.

> MERIDIAN POWER SOLUTIONS is $7,138 (430%) more than REDDING ELECTRIC. A higher price doesn't always indicate above-market pricing — check the scope and warranty before deciding.

Lane already flagged this exact bias in `project_concrete_dive_followups.md` UX item — same generator. The disclaimer is a band-aid; the right fix is to cite scope coverage:

> MERIDIAN covers EV-ready 60A circuit, smart energy monitoring, AFCI/GFCI throughout, and whole-house surge — REDDING leaves all of those out for $7,138 less.

The compare result already has scope-table data (REDDING 5/9, MERIDIAN 6/9). Verdict copy should reference the diff.

---

## 🟡 Medium-priority bugs

### 10. Frontend `ELEC_PRICING.basePriceByService` ranges drift from `data/electrical-pricing.json`

| Service | Frontend (analyzer + estimate) | API JSON |
|---|---|---|
| panel_upgrade | $1,800 – $3,500 | $1,800 – $4,500 |
| ev_charger | $800 – $2,500 | $900 – $3,000 |
| generator | $3,500 – $12,000 | $6,500 – $18,000 (whole_home) |
| whole_house_rewire | $8,000 – $15,000 | $8,000 – $30,000 |

Generator is worst — frontend understates by 50%. A real $11K Generac install in SC will get verdict "Above Average / Overpriced" on the analyzer using frontend ranges, while the API would call it mid-range.

**Fix sketch:** Either make the frontend `fetch('/data/electrical-pricing.json')` once and use it as source of truth, or hand-sync the ranges in one place (a single `js/electrical-pricing.js` file with both frontend and API consuming).

---

### 11. Frontend uses generic key `panel_upgrade` instead of `panel_upgrade_100_200`

`detectElecServiceType()` returns `panel_upgrade` (no amperage suffix). `ELEC_PRICING.basePriceByService.panel_upgrade` works, but cross-reference to API enrichment is broken. Cleaner if both paths use the same vocabulary.

---

### 12. `detectAmperage()` misreads first 2-3 digit number followed by 'A'

`(\d{2,3})\s*A\b` — for the panel-sticker fixture (rw-01) the function captured "600A" as service amperage from interrupting-rating spec text. For a real quote that mentions "20A breaker" before "200A panel", amperage shows as 20. Should prefer the LARGEST 2-3 digit amp value, OR look for "service" / "main" context.

---

### 13. Default state `"TX"` when address validation fails

`electrical-quote-analyzer.html:761` (also estimate): `state.address.stateCode = lookup || "TX"`. If a user types a valid state name unrecognized by the partial map, they get TX pricing. Better default: leave empty and prompt; or fall back to user IP geo (already wired elsewhere?).

---

### 14. Hardcoded 2,000 sqft + "2000_plus" home age in analyzer

`electrical-quote-analyzer.html:866`: `calcBenchmark(serviceType.value, 2000, "2000_plus", region)`. For panel/ev/gen/outlet jobs, sqft doesn't matter, but for `whole_house_rewire` and `circuit_addition` it scales the basePrice. Lane's 3,200 sqft home would get a smaller rewire benchmark than reality. The analyzer doesn't ask for sqft, so just hardcodes 2,000.

---

### 15. API has no `cacheNamespace`

Every other vertical (concrete, hvac, insulation, plumbing, windows, moving, landscaping, legal-fee) sets `cacheNamespace: "<v>:vN"` so prompt changes invalidate the 24h Redis cache. Electrical doesn't. After any prompt edit, stale results stick for a day.

**Fix:** Add `cacheNamespace: "electrical:v2-deepdive"` (or v2-jobtype if you do the prompt enum fix) to the `runAbuseGuard` call at line 90.

---

### 16. Hand-drawn $4,588 estimate parsed as $1,703 (sub-line MATERIAL COST instead of TOTAL JOB COST)

**Walk evidence:** [ana-messy-07-result.txt](ana-messy-07-result.txt) shows `$1,703`. Fixture has both "TOTAL MATERIAL COST = $1,708.74" and "TOTAL JOB COST = $4,588.74" (highlighted/circled).

Regex grabbed the smaller, sub-totaled material number first. Should prefer "TOTAL JOB COST", "GRAND TOTAL", "TOTAL DUE" before "TOTAL MATERIAL".

---

### 17. $9,432 desc-of-work bill OCR'd as $8,432

**Walk evidence:** [ana-extra-11-result.txt](ana-extra-11-result.txt) shows `$8,432`. Fixture clearly says "Sub-Total $9,432.00 / Total Due $9,432.00".

OCR mis-read "9" as "8" at 91% confidence. The price-confirm flow does let the user correct it ("Not right? Enter the correct amount"), so this is a softer bug — but it lands on a verdict that's wrong-by-$1,000 if user misses the prompt.

---

## 🟢 Low-priority / data hygiene

### 18. Fixture pollution: `test-quotes/real-world/electrical-extra-14.png` is duplicate of `electrical-02.png`

Both are the "I do understand that your estimate is for the whole job" bootleg-electrician text post. Walk used both as separate fixtures.

### 19. `test-quotes/electrical-images/manifest.json` claims 10 fixtures, only 1 exists in dir

Manifest lists 01–10 with `"status":"ok"`, but only `07-did-i-lowball-myself-on-this-side-job.jpeg` actually lives in the directory. The OCR cache `test/electrical/ocr-cache/` has txt files for all 10 from a refresh that ran when the images existed, but the source images are gone. Per `feedback_validate_fixtures_first.md`, manifest should be deleted or the images restored.

### 20. `test-quotes/electrical-images/test-results.md` is stale (2026-04-08, pre-OCR architecture)

Tests were run against `/api/electrical-estimate` directly back when AI was the default. Per `project_ocr_architecture_decision.md` (Tesseract-only as of Apr 2026), this file is misleading. Rename to `test-results-2026-04-08-AI-era.md` or delete.

### 21. Compare share form has no city/state pre-fill

The quote-share form on the compare result asks `WHAT DID YOU PAY? CONTRACTOR (OPTIONAL) CITY STATE` — empty fields. Estimate page already has the address; compare doesn't. Could pre-fill from `sessionStorage` if prior page was estimate.

---

## ⚪ Coverage gaps (didn't exercise this dive)

Per Lane's coverage rule (`feedback_vertical_deep_dive_method.md` § Coverage requirement):

- Did NOT click Save PDF / Share link / Start over / Back-to-Electrical / contractor-review / thumbs feedback / Notify-me email capture buttons on result pages.
- Did NOT test mobile viewport (390×844). Most layout bugs are mobile-specific.
- Did NOT exercise `circuit_addition` or `outlet_switch` estimate scenarios. EV / generator / panel / rewire only.
- Did NOT test the no-price `Enter your quote total` manual entry flow end-to-end (the `rw-03` fixture timed out at that step in v2 walk).
- Did NOT exercise emergency urgency on estimate or pre-1970 home age combinations beyond the rewire scenario.

Mark these explicitly in `project_deep_dive_status.md` so a follow-up session knows what's left.

---

## What I'd ship first if Lane greenlights commits

In priority order — bugs 1, 3, 5, 6, 8 are user-facing trust killers; bugs 2, 4, 7 mislead pricing; the rest are polish:

1. **Bug 1** — low-confidence gate on analyze (matches HVAC pattern).
2. **Bug 7** — fix prompt enum keys (jobKeyMap or expand prompt). One commit.
3. **Bug 4 + Bug 5 + Bug 6** — make estimate result page job-type-aware. One commit.
4. **Bug 8** — strip expired 25C from `iraApplicable`. One commit.
5. **Bug 2** — add recessed_lights / light_fixture branches to `detectElecServiceType` + frontend pricing. One commit.
6. **Bug 3** — add address mini-form to analyzer (or session storage carryover). One commit.
7. **Bug 9** — scope-aware compare verdict copy (concrete bug 4 ported). One commit.
8. **Bug 15** — bump cacheNamespace.
9. **Bugs 10–14, 16, 17** — data/regex polish, batch into 1-2 commits.

After every commit: re-walk the affected scenario(s) before declaring done.
