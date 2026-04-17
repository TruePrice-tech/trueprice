# Kitchen Remodel Red Flags + Estimator UX Reference

For Woogoro kitchen vertical. Part 1: things to flag in a contractor quote. Part 2: best-in-class estimator UX teardown. Part 3: synthesis spec for our build.

---

## PART 1 — Red Flags in a Kitchen Quote

### A. Spec vagueness (the #1 source of cost overruns)

1. **Cabinet brand omitted.** Quote says "wood cabinets" or "custom cabinets" with no manufacturer or model line. A Hampton Bay box and a KraftMaid box can both be called "wood cabinets" but cost 3x apart. Always require: brand, door style, box construction (particleboard vs plywood), drawer glide type (soft-close metal undermount is the standard), finish.

2. **No appliance model numbers.** "Bosch dishwasher" can be a $700 100-series or a $1,500 800-series. Quote must list make + full model number for each appliance.

3. **Vague countertop spec.** "Stone countertop" or "quartz" with no color/brand/slab grade. Cambria Brittanicca quartz ≠ MSI Q quartz. Slab grade (Level 1 vs Level 5) on granite swings price 3x. Require: brand, color name, thickness (2cm vs 3cm), edge profile.

4. **"Tile" with no SKU.** $4/sf builder tile vs $30/sf designer tile both quoted as "tile."

5. **Faucet/fixture brand only, no model.** Moen has $80 faucets and $800 faucets.

### B. Allowance traps

6. **No allowances disclosed at all.** Most kitchens have allowance line items for hardware, tile, faucets, lighting, knobs. If absent, you'll get "stuck" with whatever the contractor picks (cheapest) or hit with overage charges.

7. **Unrealistically low allowances** (the classic scam). Examples seen in the wild:
   - $1,600 lighting allowance for a 200 sqft kitchen (real cost: $3k-$5k)
   - $2,200 plumbing fixture allowance (real cost: $1.5k-$4k for sink+faucet+pot filler)
   - $15/sf tile allowance when homeowner clearly wants designer tile
   - $50/sf countertop allowance in a market where quartz starts at $70/sf
   You hit the showroom, fall in love with anything, and trigger thousands in change orders.

8. **Allowances not capped or itemized.** Even when present, contract should list each line, the unit (per sf, per fixture), and require contractor to source at the allowance price.

### C. Contract structure red flags

9. **Excessive deposit.** >33% before any work starts is a red flag. >50% is a major red flag. Standard schedule: 10% deposit, 25% on demo start, milestones thereafter, 10% on substantial completion held until punch list closed.

10. **No payment schedule tied to milestones.** "Pay as we go" is unenforceable.

11. **Demo cost lumped into materials.** Demo is labor; if it's hidden in the materials column the markup is hidden too.

12. **Plumbing/electrical labor not itemized.** Should be a separate sub-trade line with rough-in and finish stages.

13. **Change order pricing not disclosed up front.** Contract should specify hourly rate or markup % for change orders, written approval required, no verbal change orders.

14. **No timeline with milestones.** A real schedule lists demo, rough-in, inspection, drywall, cabinet delivery (lead time!), countertop template (after cabinets), countertop install, appliance delivery, finish trades, final inspection. Vague "6-8 weeks" means nothing.

15. **No warranty terms.** Industry standard: 1-year workmanship warranty minimum, manufacturer warranties pass through.

16. **No lien waivers addressed.** Without conditional/unconditional lien waivers from subs and suppliers, an unpaid sub can lien YOUR house even if you paid the GC.

### D. Permit and compliance red flags

17. **Permit not pulled / "We can do it without a permit."** Catastrophic. Triggers when home is sold (inspection fail, retroactive permits with fines), insurance won't cover related damage, future sale disclosure issues.

18. **No lead paint testing on pre-1978 homes.** EPA RRP rule requires this; contractor must be RRP certified. Fines up to $37,500/violation. (See regulations doc.)

19. **Asbestos testing skipped on pre-1980 vinyl flooring or popcorn ceilings.** Removal without testing is a federal/state violation in most states; releases hazardous fibers.

20. **Structural changes (load-bearing wall removal) without engineering letter.** No structural engineer stamp = code violation, insurance void, dangerous.

21. **HOA/condo board approval skipped.** Co-op boards in NYC, Chicago, DC routinely require alteration agreements, insurance, working hours, and elevator protection. Skipping = stop-work order.

### E. Contractor-side red flags

22. **Not insured for the size of project**, or insurance certificate not provided. GL minimum $1M/$2M; workers comp; auto. Ask for COI naming you as additional insured.

23. **Subcontractor handoff confusion.** Is this a GC managing subs, a design-build firm with in-house crew, or are you hiring trades direct? Each has very different liability and price implications. Be wary if it changes mid-project.

24. **"Today only" pricing / pressure to sign.** Power Home Remodeling, Granite Transformations, and franchise sales reps frequently use this. Legitimate contractors give you 30-day quotes.

25. **Free design that becomes "you must use us."** Home Depot, IKEA, Lowe's, and many local shops will design free if you commit to buying cabinets/install from them. The design is portable in some shops, locked in others. Ask up front.

26. **Lowball bid with omitted scope.** Compare bids line-by-line. The "cheap" bid is often missing demo, electrical upgrade, drywall repair, paint, cleanup, hauling, or appliance install — and those come back as change orders that exceed the savings.

27. **Lien history.** Pull contractor's name in your county recorder's office for prior liens from suppliers/subs; pattern indicates payment problems.

28. **No physical address or shell LLC.** A PO box and a brand-new LLC = walk away.

29. **No reviews / fake reviews / refusal to provide references.** Real contractors have a 2-5 yr Google trail and offer 3+ recent local references.

30. **"Cash discount" or no contract.** No paper trail, no recourse, no insurance backing. Walk away.

---

## PART 2 — Best-in-Class Kitchen Estimator UX (teardowns)

### HomeAdvisor Kitchen Cost Calculator
- **Required:** ZIP, kitchen size category (small/medium/large), remodel scope (minor/major/upscale)
- **Result:** Single average $ + low/high range for the ZIP
- **Trust signals:** "Based on X actual jobs in your area," "true cost" branding
- **Steal:** Localized averages from real job database; range over single number; CTA to get matched with pros
- **Weakness:** Vague categories, no spec inputs, the lead capture is the product

### Angi (formerly Angie's List) Kitchen Cost Guide
- **Required:** None to read; ZIP for matching
- **Format:** Long-form article with embedded calculators by size, by material, by region
- **Trust signals:** Editor bylines, "expertly reviewed by," lots of stat citations
- **Steal:** SEO-rich long-form structure with embedded micro-calculators (cabinet only, countertop only, appliance only); deep internal linking
- **Weakness:** Article-first, calculator second; generic numbers

### Houzz Real Cost Finder
- **Required:** ZIP, project type, basic scope questions
- **Format:** Survey results from real Houzz user projects in that area
- **Trust signals:** Sample size displayed ("based on 1,247 projects"), Houzz brand
- **Steal:** Real project data > calculated estimate; show n=
- **Weakness:** Login wall after first result

### IKEA Kitchen Planner
- **Required:** Room dimensions, layout type, then drag-and-drop cabinet placement
- **Format:** 3D visual planner; auto-generates parts list with prices
- **Trust signals:** Real SKUs and real prices; "what you see is what you buy"
- **Steal:** SKU-level precision; visual layout = engagement; outputs a real shopping list
- **Weakness:** IKEA-only; steep learning curve; only the cabinets, not the full project

### Home Depot Kitchen Services
- **Required:** ZIP + scope, then schedule a free in-home consult
- **Format:** Lead-cap funnel disguised as estimator
- **Trust signals:** Home Depot brand, free design service, financing
- **Steal:** Tier-card visual ("Refresh / Refresh+/ Renew / Replace"); pricing transparency on cabinet brands
- **Weakness:** No real number until consult

### KraftMaid Cost Estimator
- **Required:** Door style, wood, finish, kitchen size
- **Format:** Outputs a cabinet-only estimate range
- **Trust signals:** Manufacturer-direct
- **Steal:** Material/finish driven pricing surface; shows how each upgrade affects price live
- **Weakness:** Cabinets only; nudges to local KraftMaid dealer

### Sweeten.com (NYC marketplace)
- **Required:** Project type, size, scope, budget range, location, timeline, contact
- **Format:** Long survey → match with vetted GCs → bid comparison
- **Trust signals:** Vetted contractor network, NYC focus, real project case studies with full $ disclosure
- **Steal:** Project case studies with photos + actual final cost + line-item breakdown; bid template tools; contractor vetting badge
- **Weakness:** Lead-gen only, no instant estimate

### Block Renovation (NYC, Brooklyn, Bay Area, LA)
- **Required:** Address, scope, photos
- **Format:** Fixed-price quote model — they manage end-to-end and stand behind the price
- **Trust signals:** "Fixed-price guarantee," published case studies with $ totals
- **Steal:** Fixed-price guarantee positioning; photo-driven scope capture; published ranges by neighborhood
- **Weakness:** Limited to a few cities; long sales cycle

### HomeBuddy.com
- **Required:** ZIP → progressive 6-question funnel → contact
- **Format:** Pure lead-gen, no estimate ever shown
- **Steal:** Progressive disclosure (1 question at a time, mobile-friendly); fast time-to-first-question
- **Weakness:** No actual estimate; user feels misled

### Modernize.com
- **Required:** Same lead-gen funnel
- **Format:** Match-with-pros
- **Steal:** Trust badges, "free no-obligation," BBB
- **Weakness:** Same as HomeBuddy

### Bobbii / Punch List
- **Required:** Scope, photos, address
- **Format:** AI-assisted scoping from photos → quote
- **Steal:** Photo-driven AI scope; instant ballpark
- **Weakness:** Limited geography

### Forbes Home Kitchen Cost
- **Format:** SEO-optimized cost article with tier tables, brand callouts, expert quotes
- **Steal:** Authority signals (expert reviewers, "Forbes Advisor"); brand-specific cost tables
- **Weakness:** No interactive estimator; pure content

### Bob Vila / This Old House
- **Format:** Long-form expert article + cost ranges
- **Steal:** Brand authority, named expert authors, video integration
- **Weakness:** Static; no estimator

### Common patterns across best-in-class:
1. **ZIP first, always** (regional pricing impossible without it)
2. **Scope tier cards** (Refresh / Mid / Upscale / Luxury) with clear "what's included"
3. **Progressive disclosure** — never one giant form
4. **Range outputs, not point estimates**
5. **Trust signals** — real project counts, expert review, brand logos
6. **Visual selectors** for cabinet brand, countertop material, appliance tier
7. **Photo upload** to refine accuracy
8. **PDF/email export** of the estimate
9. **Allowance education** — top sites explain the trap explicitly
10. **Itemized output** — cabinets / counters / appliances / labor / permits broken out

---

## PART 3 — Synthesis: Spec for Woogoro Kitchen Estimator

### 5 Required Fields (must be in front of every estimate)
1. **ZIP code** (regional multiplier)
2. **Kitchen size** in sqft OR linear feet of cabinets (toggle; default to picker showing common sizes: 80, 120, 150, 200, 250, 300+ sqft)
3. **Remodel tier** (Refresh / Mid / Upscale / Luxury) — visual tier cards with photos and "what's included"
4. **Layout change?** (None / Minor (no walls moved) / Major (walls moved or island added) / Structural (load-bearing))
5. **Cabinet preference** (Stock / Semi-custom / Custom / Reface only / Keep existing)

### 7 Optional Refinements (each tightens the range)
1. **Countertop material** (laminate / butcher block / quartz / granite / quartzite / marble / other)
2. **Appliance tier** (keep existing / builder / mid / premium / luxury / ultra-luxury) with brand examples
3. **Flooring** (keep / LVP / tile / hardwood / other)
4. **Backsplash** (none / subway / glass mosaic / stone / slab)
5. **Lighting scope** (keep / refresh fixtures / full electrical with recessed + under-cabinet + pendants)
6. **Home age** (pre-1978 → triggers lead testing line; pre-1980 → asbestos line)
7. **Photo upload** (current kitchen + inspiration) — used for spec refinement and red-flag scoring vs uploaded contractor quotes

### 8 Result Components (the output must show all 8)
1. **Total range** (low / mid / high) in big type with ZIP-aware regional adjustment shown
2. **Per-sqft equivalent** for sanity check
3. **Itemized line items** matching Section 5 of the pricing doc: cabinets, counters, appliances, labor, flooring, backsplash, lighting, plumbing fixtures, hardware, paint, designer, permits, contingency
4. **Material vs labor split** pie/bar
5. **Timeline** (typical 4-6 weeks refresh, 8-12 mid, 12-20 upscale, 20-40 luxury)
6. **Permit + compliance flags** (lead paint, asbestos, structural, HOA) with $ adders
7. **Local contractor matchup CTA** + sample 2-3 vetted contractors with reviews
8. **Quote analyzer CTA** — "Got a contractor quote? Upload it and we'll flag issues" — feeds the dual funnel

### 3 Differentiators vs all competitors above
1. **The Quote Analyzer** — every other site is either a calculator OR a lead-gen funnel. None of them analyze a real contractor quote against the 30 red flags above and produce a verdict. This is the moat.
2. **Spec-level pricing transparency** — show actual cabinet brand $/LF, actual countertop brand $/sf, actual appliance model MSRPs from our pricing doc, not handwave ranges. Click any line item to see the source brands and prices.
3. **Allowance trap detector** — explicitly check uploaded quotes for allowance line items, compare against realistic local costs, and flag low allowances by name ("Your $1,600 lighting allowance is ~50% below the $3,000-$5,000 typical for a kitchen this size in [ZIP]").

---

## Sources

- Tasting Table kitchen contractor red flags
- Building Advisor allowances in construction contracts
- Lally Construction change order scam
- Mazz Construction kitchen scams guide
- NAR home improvement scam signs
- Sweeten kitchen permit and renovation guides
- Block Renovation cost breakdown and case studies
- IKEA Kitchen Planner
- HomeAdvisor / Angi calculators
- Houzz Real Cost Finder
- KraftMaid budgeting
- Forbes Home / Bob Vila kitchen guides
