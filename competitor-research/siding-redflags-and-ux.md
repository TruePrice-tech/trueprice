# Siding Red Flags and Estimator UX Research

Sources: BBB complaint data (search "siding"), Reddit r/HomeImprovement, r/Construction, r/Roofing siding threads, Contractor Talk forums, JLC Online, James Hardie installation manuals, EPA RRP rule, NAHB best practices, AG complaint roundups for door-to-door siding scams. Plus a UX teardown of the major estimator sites.

## Part 1 - Red flags on a siding quote

### Catastrophic / structural flags

**1. House wrap omitted or "existing wrap will remain"**
The single most common cause of post-install rot. New siding without a fresh weather-resistive barrier traps wind-driven rain at every penetration. If the existing wrap is staying, the contractor must justify it in writing (age, condition photos) AND re-tape every seam. On full tear-off jobs, new wrap is non-negotiable. This is the #1 thing to look for.

**2. Insulation backing not specified, especially vinyl over wood lap**
Vinyl installed directly over old wood lap with no foam backing creates a hollow, irregular cavity. Fasteners punch through wood, water condenses on the back of vinyl, wood rots silently. The fix is either (a) tear off the wood, or (b) fanfold underlayment plus full house wrap. A quote that just says "install vinyl over existing" is a future rot claim.

**3. Vinyl over wood without removing the wood at all**
Closely related but worth its own line. Common cheap-out. Looks fine for 3-5 years. The trapped moisture eventually rots the sheathing. If the homeowner wants vinyl over wood, the contractor must (1) confirm the wood is sound, (2) install a drainage plane, (3) use furring strips for a rainscreen on anything over fiberboard. Real Hardie installs always require tear-off.

**4. Rotted sheathing not addressed (no allowance, no per-sheet rate)**
Every quote should include a per-sheet rate for replacing OSB/plywood sheathing once siding is off (typical $75-150 per 4x8 sheet installed). If there is no line item, the homeowner gets a change-order ambush mid-job.

**5. Window flashing not redone**
Pulling siding without re-flashing windows is the second most common rot source after wrap omission. Modern best practice: peel-and-stick flashing tape (Vycor, Protecto Wrap, Grace) on jambs and head, sloped sill pan, integrated with the new house wrap. If the quote does not mention window flashing, ask.

**6. Trim wrap not included**
Aluminum coil-stock wrap on existing wood window/door trim is a frequent "by others" line that the homeowner does not catch. Bare wood trim next to brand new siding looks awful and rots within 2-3 years.

**7. Hidden capping cost (aluminum coil wrap)**
Same problem - capping/wrapping fascia, frieze board, rake board, and corner boards is sometimes itemized and sometimes lumped. If the per-foot capping price is not shown, assume it will get up-charged.

### Health / regulatory flags

**8. Lead paint testing skipped on pre-1978 homes**
EPA RRP (Renovation, Repair and Painting) rule applies. Contractor must be RRP certified and use lead-safe work practices on any pre-1978 home where painted surfaces are disturbed. If the contractor cannot show their RRP firm certification number, walk. Fines are $37,000+ per violation - they will pass that to you.

**9. Asbestos testing skipped on cement-asbestos siding (1940s-1980s)**
The flat or wood-grained "shingle" siding from this era is often cement-asbestos. Disturbing it without abatement is a federal violation in most states. A reputable contractor will require a sample test ($25-75) before quoting tear-off. Anyone offering to "just rip it off" is opening you to liability and air-quality risk.

**10. Permit not pulled**
Most jurisdictions require a permit on full re-side, especially when sheathing or wrap is touched. "Permits aren't needed for siding" is almost always wrong. Homeowner is liable if a permit was required and not obtained - it surfaces at sale via the inspection.

### Sales tactic flags

**11. "Today only" pricing / signed-tonight discount**
Universal in the in-home siding sales playbook (Power, Long, Champion, Erie, West Shore, Sears partners). The "discount" is built into the artificially inflated rack price. Real contractors will hold a quote for 30 days minimum.

**12. Door-to-door pitch**
Storm-chasers and out-of-state crews. Especially after hailstorms. Federal Cooling-Off Rule gives 3 business days to cancel any door-to-door contract over $25 - sales reps frequently "forget" to disclose this. AG offices in TX, OK, KS, MO, IA, NE see hundreds of these complaints annually.

**13. Excessive deposits**
Industry norm: 10-30% deposit. Some states cap by law (CA: 10% or $1,000, whichever is less; MD: 33%; MA: 33%). Anything over 50% upfront is a flag. "We need it to order materials" is suspect for vinyl/Hardie which suppliers stock.

**14. "Free siding when you buy windows" / pricing inversion**
Classic in-home bundling. The "free" item is priced into the other line. Always demand line-item pricing.

**15. Cash only / no written contract**
Self-explanatory. No contract = no warranty, no recourse, no permit history.

**16. Subcontractor handoff after deposit**
Big national brands and box stores subcontract install. Find out who is actually showing up - get the sub's company name in writing before signing.

### Warranty / quality flags

**17. Color match warranty fine print**
Vinyl and ColorPlus Hardie warranties limit color-match obligations on repairs. After ~5 years, fade means a replaced panel will not match. Read the warranty language - some brands explicitly disclaim color match.

**18. Hardie installer not Elite Preferred**
Factory warranty on a Hardie install by a non-program contractor is the basic 30-year limited material warranty only. Elite Preferred installs unlock extended labor coverage and prioritized claims. Not a dealbreaker for a trusted local installer, but the homeowner should know.

**19. Manufacturer warranty registration not done**
Most vinyl and fiber cement warranties require registration within 30-60 days of install for full coverage transferability. Contractors routinely skip this. Homeowner should get a written confirmation that the warranty has been registered with the serial/lot numbers.

**20. Panel thickness not specified on vinyl**
".040" vs ".042" vs ".044" vs ".046" - the thinner panels oilcan, dent, and fade. If the quote says "premium vinyl" but no mil thickness, it is almost certainly the cheapest line.

**21. Fastener spec not on the quote**
Hardie requires specific blind-nail patterns and corrosion-resistant fasteners (hot-dipped galvanized or stainless in coastal). Vinyl requires roofing nails with 3/8" head, hung not driven tight. Steel siding requires gasketed screws. A real installer will spec the fastener; a hack will not.

## Part 2 - Estimator UX research (competitors)

Looked at the siding cost-estimator flows on HomeAdvisor/Angi, Fixr, Forbes Home, Bob Vila, Modernize, Networx, Thumbtack, HomeGuide.com, Remodeling Calculator, James Hardie's own estimator, and LP SmartSide's calculator.

### Patterns observed

**Lead-gen calculators (Angi/HomeAdvisor, Modernize, Networx, Thumbtack)**
- Ask 2-4 throwaway questions (zip, project type, timeline) and immediately jump to a lead form. No actual estimate.
- "Estimate" displayed is a giant range (e.g. $5,000-$45,000) that is useless.
- The whole flow is optimized to pass the lead to 3-4 subscribed contractors. Homeowner becomes a phone-spam target for weeks.
- UX: clean, mobile-first, fast. Conversion-optimized but anti-consumer.

**Editorial calculators (Forbes Home, Bob Vila, This Old House, HomeGuide.com, Fixr)**
- Long article-format pages with embedded simple calculators (sqft x material multiplier).
- Material selector, sometimes a region dropdown.
- No tear-off / wrap / sheathing inputs. Outputs a single big number.
- Designed for SEO traffic, not for actual quote validation. Educational but shallow.

**Manufacturer calculators (James Hardie ProCalc, LP SmartSide estimator)**
- Material-only, no labor.
- Ask wall-by-wall measurements which 95% of homeowners cannot supply.
- Output is a sqft and box count, not dollars.
- Geared to contractors, not consumers.

**Remodeling Calculator / specialized**
- More detailed: lets user pick material grade, complexity (1/2/3 stories, gables, dormers), waste factor, region.
- Still no red-flag detection, no quote-vs-estimate comparison.

### What nobody does well

1. **Validates an actual quote** the homeowner already has. Every site assumes you are at the "researching cost" stage.
2. **Itemizes line by line** with normal/high/low ranges next to each line.
3. **Detects missing line items** (no house wrap shown? flag it. No sheathing allowance? flag it.).
4. **Brand/tier aware** - none of them know that Mastic Quest is .046 and Mastic Carvedwood is .044.
5. **Surfaces the national vs local pricing premium** (~30% for Power/Sears/Long).
6. **Hardie Elite Preferred lookup** - the actual factory directory exists but is buried.
7. **Lead paint / asbestos / permit checklist** for the homeowner's house age and zip.
8. **Photo-based intake** - homeowner uploads phone photos of current siding, the tool detects condition, material, square footage from window/door scale references.

### Mobile UX baseline

All major estimators are mobile-first (60-75% of traffic per SimilarWeb), single-column, sticky CTA. Form fields use native pickers. Image uploads are rare on cost calculators - only the lead-gen sites support photo upload, and only as a "send to contractor" feature, not analyzed.

## Part 3 - Synthesis: Woogoro siding estimator should

1. **Start from a quote, not from scratch.** Primary flow is "upload your siding quote PDF/photo, we'll grade it." Secondary flow is the traditional sqft + material estimator for people who don't have a quote yet.

2. **Line-item parser.** Pull out: tear-off, wrap, sheathing allowance, insulation, panels (material + brand + thickness if visible), trim/coil wrap, soffit/fascia, windows flashing, permits, deposit %, total. For each found line, give a green/yellow/red vs the regional band. For each missing line, give an explicit warning.

3. **Brand and tier aware.** Hardcode the major vinyl brand lines with their actual mil thickness, the Hardie product lines (HardiePlank/Shingle/Panel/Artisan + ColorPlus vs primed), LP SmartSide variants, the major stucco systems, and stone veneer brands.

4. **Red flag detector.** Run the 21 red flags from Part 1 as a checklist. Output a "scorecard" with each flag green/yellow/red plus a one-line plain English explanation.

5. **House age + zip lookup.** If house was built pre-1978, surface RRP lead rule warning. If pre-1980 and existing material reads "cement shingle," surface asbestos warning. Pull the local jurisdiction permit requirement (or default to "permit likely required, confirm with city"). Detect HOA-likely zip codes and prompt for HOA approval status.

6. **National vs local benchmark.** When the quote total is more than 1.25x the regional band, surface the "this looks like a national/in-home-sales price - shop a local independent" message with a CTA to compare.

7. **Hardie Elite Preferred lookup.** If the quote material is Hardie, prompt for the contractor name, link to the Hardie Elite Preferred directory, and adjust the warranty language in the output accordingly.

8. **Photo capture.** Standard Woogoro dual-path - "estimate" path lets the user snap a few phone photos of two elevations, gable count, story count, and we estimate sqft via reference object scaling (window dimensions).

9. **Disclaimers.** Always show: estimate not a guarantee, regional variance, material brand assumptions, lead/asbestos disclaimers, link to EPA RRP page.

10. **Contractor handoff (optional, opt-in only).** If the homeowner wants three real bids, route through Woogoro's vetted contractor network with the existing standards. Never auto-share without consent.
