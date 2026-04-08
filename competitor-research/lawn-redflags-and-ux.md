# Landscaping / Lawn Install — Red Flags & Estimator UX Research

Compiled 2026-04-07 for the TruePrice landscaping vertical. Sources cited inline; live web searches against BBB, ISA, ICPI, NALP, irrigation pros, and major estimator pages.

---

## PART 1 — Red Flags on Landscaping Quotes

### 1. Door-to-door "we're working in the neighborhood" pitch
- **Looks like:** Unsolicited knock, truck with no logo or out-of-state plates, "we have leftover material from a job down the street," "free assessment today only." Spikes after storms.
- **Why it's a problem:** BBB and AARP repeatedly flag this as the #1 vector for tree-service and driveway-sealing fraud against seniors. Legitimate arborists and landscapers do not canvass door-to-door — especially not after ice/wind events.
- **Homeowner action:** Close the door, get the company name, look them up on BBB.org and the state contractor license board. Never sign or pay same-day.
- **Scan pattern:** `/working in (the |your )?(neighborhood|area)|leftover (material|asphalt|mulch|sealcoat)|today only|same.?day (start|discount)|storm (damage|special)/i`

### 2. Tree topping recommended
- **Looks like:** Quote line items like "top tree to reduce height," "cut back canopy by X feet," "round over," "hatrack."
- **Why it's a problem:** ANSI A300 / ISA standards explicitly prohibit topping. It is arboricultural malpractice — kills the tree slowly, creates hazard regrowth, voids any reputable warranty. Anyone proposing it is unqualified, full stop.
- **Homeowner action:** Disqualify the bidder. Hire an ISA Certified Arborist for proper crown reduction or removal.
- **Scan pattern:** `/\b(top(ping)?|topped|hat[- ]?rack(ing)?|round[- ]?over|head(ing)? back|stub(bing)? cut)\b/i` (filter out "topsoil," "top dressing")

### 3. Climbing spikes used on a live tree being pruned (not removed)
- **Looks like:** Mention of "spikes," "spurs," "gaffs" on a pruning job. Photos showing climber wearing them while pruning.
- **Why it's a problem:** ANSI A300 forbids spikes on pruning jobs — they puncture the cambium and invite decay and disease. Allowed only when the tree is being removed.
- **Scan pattern:** `/(climbing )?(spikes|spurs|gaffs)/i` in any quote that does not also contain `removal`.

### 4. No ISA certification, no proof of insurance for tree work
- **Looks like:** Quote silent on credentials, or vague "fully insured" with no certificate of insurance (COI), no policy #, no ISA cert #.
- **Why it's a problem:** Uninsured climber falling on your property = your homeowners policy. A real arborist will name you as additional insured on request.
- **Scan pattern:** Flag if quote contains tree work and lacks `/(ISA|certified arborist|TCIA|COI|certificate of insurance|workers.?comp|general liability|policy ?#)/i`.

### 5. Cash only / large upfront deposit
- **Looks like:** "Cash discount," "50% down to schedule," check made out to a person not a company.
- **Why it's a problem:** BBB rule of thumb: deposits over ~33% of project value are a red flag. Many states cap residential deposits by statute (CA: 10% or $1,000, whichever is less). Cash leaves no paper trail for chargebacks.
- **Scan pattern:** `/(cash only|cash discount|payable to [A-Z][a-z]+ [A-Z][a-z]+\b)/i` and a deposit-percentage parser: `/(\d{1,3})\s*%\s*(deposit|down|to (start|schedule))/i` flag if >33.

### 6. No written scope / "estimate" with no firm cap
- **Looks like:** A single dollar figure with no line items, no plant list, no square footage, no "not to exceed."
- **Why it's a problem:** Multiple irrigation pros report ~70%+ of failed installs came from quotes with no line-item breakdown. With no cap, the final invoice routinely lands 30–80% over the verbal "estimate."
- **Scan pattern:** Flag if total > $2,000 and no line items detected (no `\$\d+` appearing more than 2x), or if word `estimate` appears without `not to exceed|fixed price|firm price|guaranteed price`.

### 7. Sod install — soil prep / grade / starter fert / watering schedule missing
- **Looks like:** "Install X sq ft of sod — $Y." No mention of tilling depth, soil amendment, leveling, starter fertilizer, or a written first-30-days watering schedule.
- **Why it's a problem:** Sod laid on compacted, unprepped soil dies in weeks and voids any plant warranty. NALP best practice: 4–6" of tilled and amended soil + starter fert + irrigation on the day of install.
- **Scan pattern:** Quote contains `sod` but is missing all of `/(till|amend|topsoil|grade|level|starter (fert|fertilizer)|water(ing)? schedule)/i`.

### 8. Sprinkler install — no zone count, no head-to-head coverage, no controller, no rain sensor, no backflow
- **Looks like:** "Install irrigation system — $X." No zone count, no head model/spacing, no smart controller, no rain sensor (required by law in FL, NJ, MN, parts of TX), no backflow preventer (required by code almost everywhere).
- **Why it's a problem:** Without head-to-head spacing, you get permanent brown spots. Without backflow, you can contaminate the potable supply (code violation). Without a rain sensor in mandatory states, you fail inspection.
- **Scan pattern:** Quote mentions `irrigation|sprinkler` and lacks all of `/(zone|station)s?\b.*\d+|head.to.head|smart controller|wifi controller|rain sensor|backflow|RPZ|PVB|winterize|winterization)/i`.

### 9. Hardscape / paver — base depth, geotextile, edge restraint, compaction, drainage missing
- **Looks like:** "Install paver patio — $Y/sf." No base depth callout, no geotextile, no plate compactor passes, no edge restraint, no slope-away-from-house.
- **Why it's a problem:** ICPI/CMHA Tech Spec 2: pedestrian patios need 4" compacted base minimum, driveways 6", colder climates +2–4". Missing edge restraint = pavers spread within one season. Missing geotextile over weak subgrade = pumping and settlement. Missing slope = water against the foundation.
- **Scan pattern:** Quote mentions `paver|patio|walkway|driveway` and lacks `/(\d+\s*("|in(ch)?|")?\s*(compacted )?base|road base|class ?ii|geotextile|fabric|edge restraint|paver edge|compact(or|ed|ion)|slope|drain)/i`.

### 10. Retaining wall over 4 ft with no engineering / no permit
- **Looks like:** "Build 5 ft retaining wall, $X." No mention of engineered drawings, geogrid, drainage rock + perforated pipe, or permit.
- **Why it's a problem:** Almost every jurisdiction requires a stamped engineer drawing and a permit for walls > 4 ft (some > 3 ft). Failure = the wall blows out in 1–3 freeze cycles and the homeowner owns the liability.
- **Scan pattern:** `/(retaining wall|seg(mental)? wall).{0,80}(\d+(\.\d+)?)\s?(ft|feet|')/i` — if the captured height ≥ 4 and quote lacks `engineer|stamped|geogrid|permit|drainage`, flag.

### 11. Plant warranty fine print
- **Looks like:** "1-year warranty — voided if not watered as instructed / if any pest damage / if homeowner mulches incorrectly." Or simply "no warranty on plant material."
- **Why it's a problem:** NALP standard is 1-year on plant material installed by the contractor, with reasonable maintenance by homeowner. "Void on any pest" or "void on any drought" gives the contractor a 100% out.
- **Scan pattern:** `/(no (plant )?warranty|warranty (void|excluded).{0,80}(water|pest|drought|mulch|fertiliz))/i`.

### 12. Pesticide / herbicide application without state license
- **Looks like:** Quote includes "weed and feed," "Roundup application," "grub control," "pre-emergent" but the company isn't a licensed pesticide applicator in your state.
- **Why it's a problem:** Almost every state requires a separate Commercial Pesticide Applicator license for chemical apps — independent of the landscape installer license. Unlicensed application is a misdemeanor and can poison kids/pets/wells.
- **Scan pattern:** `/(pesticide|herbicide|pre.?emergent|round.?up|glyphosate|grub control|weed.?and.?feed|fungicide)/i` with no `applicator (license|cert)|state cert(ified|ification) #`.

### 13. "Free design" with IP grab
- **Looks like:** "Free design with install" plus contract clause: "All design documents remain property of [contractor]; homeowner may not use plans with another installer."
- **Why it's a problem:** Locks you to one bidder. NALP recommends design fees be itemized and licensed/transferable to the homeowner.
- **Scan pattern:** `/(design.{0,40}(remain|property of|may not).{0,40}(use|share|other))/i`.

### 14. Working during a drought / against water restrictions
- **Looks like:** Sod or thirsty-plant install scheduled during a Stage 2+ drought, in CA/AZ/NV/CO/TX, with no mention of local watering ordinance or waiver.
- **Why it's a problem:** Plants die before establishment, warranty voids, homeowner gets fined. CA/NV cash-for-grass rebates explicitly disqualify new turf installs in many districts.
- **Scan pattern:** ZIP-based — if ZIP is in a current drought zone and quote contains `sod|turf|fescue|kentucky blue` and lacks `drought|restriction|waiver|native|xeriscape`, flag.

### 15. Subcontracting tree/heavy work to uninsured day labor
- **Looks like:** Bidder admits the climbers are "guys I bring in." No COI for the sub.
- **Why it's a problem:** Homeowner is on the hook for the injured worker. Insist on subs being named on the COI.
- **Scan pattern:** Manual flag — TruePrice should prompt the user "Is the bidder subcontracting tree work? Get the sub's COI."

### 16. Pre-payment for materials before delivery
- **Looks like:** "Pay for plants up front so we can order them."
- **Why it's a problem:** Classic disappearance scam. Reputable nurseries extend trade credit; the contractor should not need your money to order plants.
- **Scan pattern:** `/(pay|payment).{0,40}(material|plants|sod|pavers).{0,40}(before|prior to|order)/i`.

### 17. No permit in HOA / historic / shoreline / wetland districts
- **Looks like:** Tree removal in a tree-protection city (Atlanta, Portland, Seattle, most of FL coast), retaining wall near wetland, hardscape exceeding lot impervious-surface limit — none mentioned in quote.
- **Why it's a problem:** Homeowner gets the fine, not the contractor. Cities like Atlanta charge $500/inch DBH for unpermitted tree removal.
- **Scan pattern:** Quote contains `tree removal|stump|wall|patio|driveway|expand` and lacks `/permit|HOA|approval|jurisdiction/i` — soft flag, ask user to verify.

### 18. Irrigation install without backflow + winterization plan (cold climates)
- **Looks like:** No RPZ/PVB, no winterization quote.
- **Scan pattern:** see #8.

### 19. Vague "fully licensed and insured" with no numbers
- **Scan pattern:** Phrase `licensed and insured` present, but no `lic ?#|license ?#|policy ?#` digits within 80 chars.

### 20. Unrealistically low bid
- **Looks like:** Bid is >25% below the median of other bids on the same scope.
- **Why it's a problem:** Either the scope is missing pieces (and change orders will eat the savings), or labor is uninsured/undocumented, or materials are substituted down a grade.
- **TruePrice action:** This is exactly where the comparison engine shines — flag bids more than 1.5 standard deviations below peers and explain *why* it's suspicious, not just *that* it's low.

---

## PART 2 — Best-in-Class Landscaping Estimator UX (Pattern Survey)

Survey of estimator pages and the patterns that recur on the highest-converting / most useful ones. I pulled live results from HomeAdvisor, Angi, HomeGuide, Belgard, Hunter, Rain Bird, TruGreen, LawnStarter, Sunday, BrightView, and Houzz; below is the synthesis.

### A. HomeAdvisor — `/cost/landscape/install-landscaping/`
- **Inputs:** ZIP, project type (install / maintain / design), square footage, scope checkboxes (sod, plants, hardscape, irrigation, lighting, trees).
- **Result:** Range ($X–$Y), national average, "what drives cost" cards, then a lead-gen form.
- **Trust signals:** "2025 Data," sample quotes, pro headshots.
- **UX red flag:** Result is just a range, no breakdown. Lead form is the actual product.
- **Steal:** The "what drives cost" expandable cards that explain *why* the range is wide.

### B. Angi — landscaping cost guide
- **Inputs:** ZIP, scope, sq ft.
- **Result:** Tiered ranges (basic / mid / high-end), per-sq-ft, cost-by-scope tables.
- **Trust:** Editor bylines, last-updated date, expert reviewer.
- **UX red flag:** Same — content marketing front for a lead form.
- **Steal:** Tiered "basic / mid / premium" buckets — homeowners self-select their tier and the math gets sharper.

### C. HomeGuide — `homeguide.com/costs/landscaping-costs`
- **Inputs:** None (it's an article), but includes inline calculators per sub-scope.
- **Result:** Tables broken out by sub-vertical: sod, mulch, trees, pavers, irrigation.
- **Steal:** The sub-vertical table-per-scope is the cleanest mental model — TruePrice should mirror it (one estimator with sub-scope toggles).

### D. Belgard paver cost estimator (manufacturer)
- **Inputs:** Paver line, sq ft, ZIP.
- **Result:** Material cost only, then "find a pro."
- **Steal:** Live material price as a separate line from labor — homeowners *love* knowing what the rocks cost vs the install.

### E. Hunter Industries / Rain Bird sprinkler design tools
- **Inputs:** Lot drawing tool, water pressure, GPM, zone count target.
- **Result:** Zone diagram, head schedule, parts list.
- **Trust:** Manufacturer authority, free PDF output.
- **Steal:** A "minimum zone count for your sq ft" calculator — if a quote has fewer zones than the math allows, flag it.

### F. LawnStarter — recurring lawn maintenance marketplace
- **Inputs:** ZIP → address → lot size auto-pulled → frequency → instant price.
- **Trust:** Verified pros, instant booking, satisfaction guarantee.
- **Steal:** Auto-pulled lot size from the address — kills the "what's your sq ft" friction (most homeowners don't know).

### G. Sunday Lawn (sundaylawn.com)
- **Inputs:** Address only. They look up your lot, soil type, climate, weather history and quote a custom annual treatment plan.
- **Steal:** Address-as-only-input is the gold standard. Use ZIP + parcel data + climate zone + drought status server-side.

### H. TruGreen
- **Inputs:** Address, lawn size estimate, services interested in.
- **Steal:** "Free lawn analysis" framing — soft entry, not a price commitment.

### I. BrightView
- **Inputs:** Commercial-only contact form, no public estimator.
- **Skip.**

### J. Houzz landscape cost calculator
- **Inputs:** ZIP, scope, sq ft, "design complexity" slider.
- **Steal:** Complexity slider as a single qualitative input — much less intimidating than 12 fields.

### Recurring patterns across the best
1. **Address > ZIP > nothing.** Address auto-fills lot size, climate zone, drought status, watering ordinance, rebate eligibility.
2. **Sub-scope toggle.** Homeowners pick which of {sod, sprinkler, trees, hardscape, plants/beds, lighting} they need. Math diverges sharply by sub-scope.
3. **Tiered output (basic / mid / premium).** Single number = unbelievable. Range = useless. Three tiers with what each includes = actionable.
4. **Material vs labor split.** Big trust win. Almost no estimator does this well — it's a wide-open differentiator.
5. **DIY-vs-pro toggle.** Lawn is the *one* home vertical where DIY is real and frequent — sod, mulch, plant install, drip irrigation are all common DIY. Pages that ignore DIY look condescending.
6. **Drought / climate awareness.** Almost no national estimator localizes for drought stage. Massive differentiator in CA/AZ/NV/CO/TX.
7. **Rebate awareness.** Cash-for-grass, WaterSense, smart-controller rebates. Sunday and a few local CA pros do this; nobody national does.

---

## PART 3 — Synthesis: TruePrice Lawn Estimator Spec

### Required fields (4)
1. **Address** (auto-pulls lot size, climate zone, USDA hardiness zone, current drought stage, local watering ordinance, rebate programs).
2. **Sub-scope checkboxes** — at least one of: Sod / reseed, Sprinkler install, Trees (plant / prune / remove), Hardscape (patio / walkway / wall), Plant beds & mulch, Outdoor lighting.
3. **Approximate area** for the selected sub-scope (sq ft for sod/hardscape, # heads or zones for sprinkler, # / DBH for trees). Pre-filled from parcel data when possible.
4. **Tier** — Basic / Mid / Premium (controls material grade and design complexity).

### Optional refinements (accordion, 5–7)
1. Soil condition (compacted clay / sandy / loam / unknown) — affects base prep and amendment cost.
2. Slope / grade work needed (flat / mild / steep / retaining wall needed).
3. Existing irrigation? (none / partial / full system to extend).
4. Tree work specifics — count, approximate DBH, ISA cert required toggle (default ON).
5. HOA / historic / wetland district? (triggers permit warning).
6. Drought / water-restriction override (auto-detected, but user can confirm).
7. DIY-vs-pro per sub-scope (mulch & beds = DIY-friendly, sprinkler & retaining wall = hire it).

### Result components after submission (8)
1. **Three-tier price band** (Basic / Mid / Premium), each with material+labor split.
2. **Sub-scope breakdown** — what each line of the project should cost.
3. **Red-flag scanner** for an uploaded competitor quote, running all 20 patterns from Part 1.
4. **Climate / drought callout** — "You're in CA Stage 2 — new fescue sod is a bad idea right now; here are 3 native alternatives + the local cash-for-grass rebate."
5. **Permit / HOA warning** if scope triggers it (retaining wall > 4ft, tree removal in protected city, impervious surface > limit).
6. **DIY-vs-pro recommendation per sub-scope** with realistic time + tool cost.
7. **Rebate finder** — WaterSense smart controller, cash-for-grass, native plant rebates, by ZIP.
8. **Questions to ask the bidder** — auto-generated checklist tied to which red flags weren't addressed in their quote (e.g., "Quote doesn't mention base depth — ask for the spec in inches and confirm it meets ICPI 4"/6" minimum.").

### Three most differentiated features (the moat)
1. **Address-driven climate + drought + rebate intelligence.** No competitor does this nationally. Sunday does it for fertilizer; nobody does it for install.
2. **Quote-upload red-flag scanner** with the 20 patterns above. Nobody is doing this in landscaping. This is the *thing* TruePrice does that no one else does.
3. **DIY-vs-pro per sub-scope, with honest time/tool/risk math.** Lawn is the one vertical where DIY is real for half the line items. Treating homeowners like grown-ups builds trust the lead-gen mills can't match.

### The DIY-vs-pro callout (critical for this vertical)
Lawn is unique. For each sub-scope, default recommendation:

| Sub-scope | DIY realistic? | TruePrice default |
|---|---|---|
| Mulch refresh / bed cleanup | Yes, very | DIY |
| Plant install (under 15 plants) | Yes | DIY or pro |
| Sod install (under 1,000 sf) | Yes, hard but doable | Coin flip |
| Sod install (over 1,000 sf) | No | Pro |
| Drip irrigation (beds) | Yes | DIY |
| Lawn sprinkler system | No (backflow, pressure, code) | Pro |
| Tree pruning under 15 ft from ground | Yes (with care) | DIY |
| Any climbing tree work | No, never | ISA-certified pro only |
| Tree removal | No | Insured pro only |
| Paver patio | Hard but doable | Pro for >150 sf |
| Retaining wall < 3 ft | Yes | DIY |
| Retaining wall > 4 ft | No (engineering required) | Engineer + pro |
| Outdoor low-voltage lighting | Yes | DIY |
| Line-voltage lighting | No (electrician) | Pro |

The DIY column is the vertical's signature trust move. Every other estimator pretends DIY doesn't exist because they sell leads. TruePrice doesn't, so it can be honest.

---

## Sources

- [Choosing a Qualified Arborist — New England ISA](https://newenglandisa.org/find-an-arborist/choosing-a-qualified-arborist)
- [ISA Rocky Mountain Chapter — Hiring an Arborist](https://isarmc.org/Hiring_an_Arborist)
- [Tips for Hiring an Arborist — Portland.gov](https://www.portland.gov/trees/tree-care-and-resources/tips-hiring-arborist)
- [BBB warns of tree removal scams after ice storm — WSMV](https://www.wsmv.com/2026/01/29/bbb-warns-tree-removal-hvac-plumbing-scams-following-historic-ice-storm/)
- [BBB Guide to Door-to-Door Sales](https://www.gilmermirror.com/2026/04/03/what-to-know-before-you-open-the-door-bbbs-guide-to-door-to-door-sales-2/)
- [Door-to-door tree-service scams — Summit Daily](https://www.summitdaily.com/news/door-to-door-tree-service-scams/)
- [Tree Removal Scams — TrustDALE](https://trustdale.com/blog/tree-removal-scams-hidden-risks-and-how-to-protect-yourself)
- [ICPI Tech Spec 2 (paver base, geotextile, edge restraint)](https://www.lampus.com/files/products/990_Tech_Spec_2.pdf)
- [ICPI Tech Spec 18 — Permeable ICP](https://www.cambridgepavers.com/dfiles/ICPI_Technical_Specification_18.pdf)
- [CMHA Guide Spec PAV-GSP-016-21](https://www.masonryandhardscapes.org/wp-content/uploads/2024/03/PAV-GSP-016-21-US.pdf)
- [NALP overview / Landscape Industry Certified](https://www.landscapeprofessionals.org/LP/Careers/LP/Careers_NALP.aspx)
- [Angi — How to Hire a Landscaper](https://www.angi.com/articles/7-questions-ask-hiring-landscaper.htm)
- [Sprinkler quote red flags — Ask Bob Carr](https://www.askbobcarr.com/blog/the-red-flags-i-show-every-homeowner-before-they-sign-a-contract/)
- [What your sprinkler quote includes (and doesn't) — TLC Inc.](https://www.tlcincorporated.com/what-your-sprinkler-quote-includes-and-what-it-doesnt/)
- [How many sprinklers per zone / head-to-head coverage — Commercial Lawn Irrigation](https://www.commerciallawnirrigation.com/blog-posts/how-many-sprinklers-per-zone)
- [Red flags for sprinkler systems — S&D Outdoors](https://sanddoutdoors.com/red-flags-sprinkler-irrigation-systems-rockville/)
- [HomeAdvisor — Cost to Install Landscaping (2025)](https://www.homeadvisor.com/cost/landscape/install-landscaping/)
- [HomeGuide — Landscaping Costs (2026)](https://homeguide.com/costs/landscaping-costs)
