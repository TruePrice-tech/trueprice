# HVAC Red Flags and Estimator UX Research

## Part 1 — Red flags in HVAC quotes and installs

The DOE has found that 70-90% of residential HVAC systems have at least one performance-affecting fault, and when duct leakage is included, fault prevalence approaches 100%. Most of these faults trace back to one or more of the red flags below — every TruePrice HVAC verdict should screen for them.

### Sizing and design red flags

1. **No Manual J load calculation performed.** This is the #1 red flag. ACCA Manual J is the only legitimate way to size residential HVAC equipment. "Rule of thumb" sizing (X sq ft per ton) is wrong roughly 90% of the time and is the root cause of most short-cycling, humidity, and energy-bill complaints. If "Manual J" is not on the proposal, walk away.

2. **Oversizing the equipment ("bigger is better" myth).** Manual S caps cooling at 115% of calculated load, heat pumps at 125%, heating at 140%. An oversized AC short-cycles, never running long enough to dehumidify, raising energy use 15-30% and creating clammy, uncomfortable rooms. Common pattern: a 4-ton condenser slapped on a 2.5-ton duct system because the salesperson upsized.

3. **Undersizing.** Less common but happens when a contractor low-balls a bid. The system runs continuously, can't hit setpoint on design days, premature compressor failure.

4. **Skipping the duct inspection / no static pressure test.** Replacing a tired 3-ton on leaky undersized ducts just transfers the problem. A pro takes static pressure readings before and after, measures airflow at registers, and either re-sizes the ducts or adjusts the bid.

5. **No Manual D duct design when ductwork is touched.** Same problem on the supply side.

6. **No load calculation, no Manual S equipment selection** — these are paired with Manual J and rarely shown to the homeowner.

### Sales tactics red flags

7. **"Free" furnace tune-up that becomes a $5,000-$15,000 emergency replacement pitch.** Classic loss-leader bait. Cracked heat exchanger "found" with no photo evidence, system "red-tagged" as a CO hazard, pressure to sign tonight.

8. **Today-only / sign-tonight pricing.** Any "this discount expires when I leave the driveway" tactic. Legitimate quotes are good for 30 days minimum.

9. **In-home commissioned sales rep with iPad presentation, no technician on site.** Indicates franchise/consolidator markup model.

10. **Bait and switch on equipment tier.** Quoted Trane XV20i, installed XR16. Always require model numbers AND serial numbers in writing, plus the AHRI matched-system certificate number.

11. **Refusing to itemize the proposal.** A real proposal lists equipment models, line set, pad, disconnect, permit, haul-off, thermostat, refrigerant, labor, and warranty terms separately.

12. **Verbal-only warranty claims.** Get the parts, labor, and unit-replacement warranty terms in writing AND confirm registration with the manufacturer (see #18).

### Installation and commissioning red flags

13. **Refrigerant scams.** Three patterns: (a) Charging by gauges only without weighing in or doing superheat/subcooling — over/undercharge guaranteed; (b) still topping off R-22 systems in 2026 (R-22 production banned 2020, virgin stock illegal — should be reclaimed only); (c) charging R-410A into a system being marketed as a new 2026 install when it should be R-454B or R-32 (post-Jan 1 2025 manufacturing ban).

14. **Incomplete commissioning.** A real startup includes: static pressure test (supply and return), airflow measurement (CFM at coil), superheat AND subcooling per manufacturer charging chart, refrigerant weighed in to manufacturer spec, temperature split across the coil (Δt), evacuation to <500 microns with a micron gauge (not a needle gauge), and a written commissioning report. MeasureQuick's data shows a properly commissioned system delivers ~90% of rated capacity vs ~57% for a "startup-only" install.

15. **Missing AHRI matched-system certificate.** The outdoor condenser, indoor coil, and air handler must be a tested-matched combination. Without the AHRI cert: no manufacturer warranty, no rebate eligibility, no tax credit eligibility.

16. **Contractor not NATE certified.** NATE is the industry's voluntary technical credential. Not legally required, but absence is a yellow flag — and required by some manufacturer Authorized Dealer programs.

17. **No Manufacturer Authorized Dealer status.** Trane Comfort Specialist, Carrier Factory Authorized Dealer, Lennox Premier Dealer, etc. Without it, the manufacturer can refuse warranty claims for "improper installation."

18. **No equipment registration with manufacturer within 60 days.** Every major brand cuts the parts warranty from 10 years to 5 years if the unit isn't registered. Contractor should register on your behalf and email confirmation.

### Permit, electrical, and scope-of-work red flags

19. **Skipping the permit.** "We don't pull permits for swap-outs" is illegal in nearly every jurisdiction. No permit means no inspection, no record, and a problem at home sale.

20. **Skipping the inspection.** Even when permitted, some contractors never schedule the final inspection.

21. **Pad / composite platform not included.**
22. **Refrigerant line set not replaced or flushed** when going from R-410A to R-454B/R-32, or from R-22 to anything (mineral oil contamination kills new compressors).
23. **Electrical disconnect / whip not included** — code-required at outdoor unit.
24. **Old equipment haul-off as a "surprise" $200-$400 add-on at the end.**
25. **No condensate safety switch / float switch** in attic installs (code in many jurisdictions).
26. **Flex duct used for trunk lines** instead of branches — bad practice.
27. **Plenum and supply boots not sealed with mastic** — uses tape only, will fail in 2 years.

## Part 2 — HVAC estimator UX competitive scan

### HomeAdvisor / Angi HVAC cost calculators
- Form: ZIP, project type (install/repair/replace), system type, square footage, free-text. 5-7 fields.
- Result: Single national average + low/high range. No itemization. No brand or tier breakdown. Hard CTA to "match with pros."
- Strength: Brand familiarity, fast.
- Weakness: Lead-gen wrapper, not an estimator. No transparency, output is generic, no red flag screening.

### Modernize HVAC
- Form: ZIP → service type → home size → timeline → contact. 8-10 fields with hard contact gate at the end.
- Result: Almost no actual estimate; redirects to lead matching.
- Weakness: Pure lead capture; users frequently complain about call-spam after submission.

### HomeBuddy
- Form: 9-step funnel: project type, system type, age, fuel, urgency, ZIP, contact. Cartoon UI.
- Result: "Pros in your area" — no price shown until after contact submission.
- Weakness: Same issue. UI is friendly but it's a lead funnel.

### Sears Home Services
- Form: ZIP + service type, then schedule a free in-home consultation.
- Result: No estimate online at all. Routes to in-home sales appointment.
- Weakness: Worst possible UX for users who want a number — they want the appointment.

### One Hour Heating & Air
- Form: ZIP, then phone-first. No online estimator.
- Weakness: Forces phone call. Quote happens in-home with commissioned rep.

### Trane.com find-a-dealer + Trane Pricing Guide
- Form: ZIP → dealer list. Pricing guide is a static page with 3-ton ranges by tier (XR/XL/XV).
- Result: Static price ranges by series; no personalization.
- Strength: Honest tier breakdown, manufacturer-credible.
- Weakness: No personalization, no SEER2 picker, no rebate stacking.

### Carrier dealer locator
- Form: ZIP only.
- Result: Dealer list. Cost guide page has generic ranges and a "factors that affect cost" article.
- Strength: Brand authority. Weakness: zero personalization.

### Daikin home estimate
- Form: Multi-step: ZIP, system type, current fuel, square footage, contact. Connects to local Daikin Comfort Pro.
- Strength: Lists rebates by ZIP. Weakness: Lead form, no price until contact.

### Rheem home estimate
- Form: ZIP → contractor locator. No estimator.

### ConsumerReports HVAC buying guide
- Format: Editorial buying guide with brand reliability rankings (paid).
- Strength: Genuine independent reliability data and brand rankings from member surveys.
- Weakness: Behind paywall, no estimate output, no personalization.

### This Old House HVAC
- Format: Editorial cost articles with national averages and "what affects cost" sections, plus reviews of national chains (ARS, etc.).
- Strength: Trust, content depth.
- Weakness: No interactive estimator, content-only.

### Common patterns observed
- Every major competitor is either a (1) lead-gen funnel that hides price behind a contact gate, (2) static editorial article with national averages, or (3) manufacturer dealer locator. **Nobody combines a real personalized estimate with a verdict on a homeowner's actual quote.** That is TruePrice's wedge.
- None ask for or use the AHRI matched-system number, the Manual J value, or the model numbers — i.e., none catch the actual red flags.
- None show rebate stacking (federal + state + utility) personalized to ZIP and household income.
- None compare quoted price against regional fair-price band by tier.

## Part 3 — Synthesis: TruePrice HVAC estimator spec

### 5 required inputs (any more and dropoff spikes)
1. **ZIP code** — drives regional multiplier, climate zone (heating vs cooling load mix), utility rebate dataset, R-454B vs R-410A inventory rules.
2. **Home square footage** (with optional "I don't know" → median for ZIP).
3. **Project type** — Replace existing AC / Replace AC + furnace / New heat pump / Add ductless mini-split / New construction.
4. **Current system age + fuel** (electric, gas, oil, propane, heat pump) — drives replace vs upgrade logic, fuel-switch rebates.
5. **Tier preference** — Budget / Mid / Premium (with plain-English descriptions: "Builder grade, 10-yr life" / "Two-stage, quieter, ~15-yr life" / "Variable-speed inverter, quietest, ~20-yr life, max efficiency").

### 7 optional inputs (improve precision; never gate on them)
1. Number of stories and basement/slab/crawl
2. Existing ductwork condition (good / leaky / none / unknown)
3. Number of zones desired
4. Heat pump cold-climate need (climate zone 5+)
5. Smart thermostat included? (Y/N)
6. Indoor air quality add-ons (UV, MERV13, dehumidifier, ERV)
7. Household income bracket (only used to compute HEEHRA rebate eligibility — display "used only for rebate matching, never stored")

### 8 result components (the page they actually see)
1. **Fair-price band** — low / fair / high range for their exact spec, broken out by tier so they can see what tier swap would do.
2. **Itemized "what's in this number"** — equipment, line set, pad, electrical, permit, haul-off, thermostat, labor, commissioning. Mirrors a legit proposal so they can compare line-by-line.
3. **Brand options at this tier** — 3-4 brand picks with model series, AHRI-style match, warranty terms, ballpark price each.
4. **Rebate and tax credit stack** — federal 25C status (expired for 2026 installs but show 25D geothermal still active), HEEHRA eligibility based on income/AMI, top 3 utility rebates for their ZIP with dollar amounts and links.
5. **Red-flag checklist** — interactive checklist they take to the in-home appointment: "Does the proposal include Manual J? AHRI cert number? Model numbers? Permit? 10-yr registered warranty?" Each item links to a one-paragraph explainer.
6. **Quote analyzer (the killer feature)** — paste / upload their actual contractor proposal, OCR the line items and model numbers, and show: (a) is the price in band, (b) is the AHRI match valid, (c) what's missing from the scope, (d) what's overpriced.
7. **Three local independents** ranked by NATE certification, manufacturer authorized dealer status, and verified review score — explicitly excluding the franchise consolidators by default with a toggle.
8. **Total cost of ownership calculator** — 15-yr energy cost at their ZIP electric+gas rates for each tier, so the "is the inverter worth it?" question gets answered with their actual utility rates not generic SEER math.

### 3 differentiators vs every competitor
1. **Quote analyzer with red-flag screen.** Nobody else lets a homeowner paste their actual proposal and get a sanity check + red flag report. This is the wedge.
2. **Personalized rebate stack with HEEHRA income-AMI math.** Competitors hand-wave at "rebates available" — TruePrice computes the actual stacked dollar number for their ZIP and income bracket.
3. **Franchise-vs-local price delta surfaced explicitly.** TruePrice shows "your One Hour Heating quote of $14,200 is $3,800 over the local-independent fair band of $9,500-$10,500 for the same equipment." Nobody else dares.

Sources:
- [Procalcs Oversized HVAC Red Flags](https://procalcs.net/blog/load-calculations/oversized-hvac-system-red-flags/)
- [ACCA Manual J vs Rules of Thumb](https://hvac-blog.acca.org/manual-j-load-calculations-vs-rules-thumb/)
- [GreenBuildingAdvisor Manual J](https://www.greenbuildingadvisor.com/article/manual-j-load-calculations-vs-rules-of-thumb)
- [MeasureQuick Commissioning vs Startup](https://measurequick.com/hvac-commissioning-vs-startup-the-difference-between-57-and-90-capacity/)
- [SolarTech Heat Load Calculation Guide](https://solartechonline.com/blog/hvac-heat-load-calculation-guide/)
- [PV HVAC Manual J Walkthrough](https://www.pvhvac.com/blog/what-to-expect-during-a-manual-j-load-calculation/)
- [NREL Accurate Load Calculations](https://docs.nrel.gov/docs/fy11osti/51603.pdf)
- [This Old House ARS Review](https://www.thisoldhouse.com/heating-cooling/ars-rescue-rooter-review)
- [Modernize ARS Review](https://modernize.com/plumbing/best-plumbing-companies/ars-rescue-rooter)
- [Trane Pricing Guide](https://www.trane.com/residential/en/pricing/pricing-guide/)
