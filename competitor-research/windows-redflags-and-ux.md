# Windows red flags + estimator UX research

_Compiled 2026-04-07 for Woogoro windows vertical. Sources listed at bottom._

## Part 1: Red flags to detect in uploaded quotes

### Red flag: "Today only" / signature urgency pressure
- **What it looks like**: Salesperson says the quoted price is only valid if the homeowner signs tonight, before they leave. Often framed as a "manager special," "corporate promo ending today," or "this truck-load pricing." BBB and AARP list this as the #1 complaint against Renewal by Andersen, Champion, and Power Home Remodeling reps.
- **Why it's a problem**: Prevents comparison shopping. Legitimate window jobs can be quoted against for 30+ days — manufacturer pricing does not change hourly. The tactic also bypasses the federal 3-day right-of-rescission mental checkpoint.
- **What to do about it**: Refuse to sign in the same visit. Any honest contractor will honor the quote for at least 7-30 days in writing. Federal Cooling-Off Rule (FTC 16 CFR Part 429) gives 3 business days to cancel any door-to-door sale over $25 regardless.
- **Detection regex/phrases**: `/\b(today only|tonight only|expires? (today|tonight|at midnight)|sign (today|tonight|now)|valid (today|for 24 ?hours)|manager[' ]?s? special|truck ?load (pricing|special)|one[- ]time offer|limited time)\b/i`

### Red flag: "Lifetime" warranty with maintenance voids
- **What it looks like**: Big "LIFETIME WARRANTY" on page 1. Page 4 fine print voids it if the homeowner fails to clean tracks quarterly, uses any non-approved cleaner, applies aftermarket tint, or doesn't mail in an annual inspection card.
- **Why it's a problem**: Virtually every homeowner voids these terms within 12 months. Consumer Reports flagged this explicitly in their 2023 window buying guide.
- **What to do about it**: Read full warranty doc before signing. Ask for the warranty PDF by email, not verbally. Confirm in writing that normal household cleaning does not void coverage.
- **Detection regex/phrases**: `/\blifetime (limited )?warranty\b/i` plus presence of `/\b(void(ed)? if|provided that|subject to|must be (cleaned|inspected|maintained)|annual(ly)? (inspected|registered)|approved cleaner|registration (card|required))\b/i`

### Red flag: Limited lifetime that transfers only once (or not at all)
- **What it looks like**: "Transferable lifetime warranty" that, in the fine print, transfers exactly one time with a $50-$250 fee and written notice within 30 days of sale.
- **Why it's a problem**: Homeowners resell within 7 years on average. A one-transfer warranty is effectively a 7-year warranty for most buyers, not lifetime. Reduces resale value.
- **What to do about it**: Ask explicitly "how many times does this transfer, and is there a fee?" Get the answer in writing.
- **Detection regex/phrases**: `/\btransfer(s|able|red)?\b.*\b(one|1|once|single|first)\b/i` and `/\btransfer fee\b/i`

### Red flag: Capping / trim wrap / interior finishing billed separately
- **What it looks like**: Base price covers the window unit + install, but aluminum exterior capping, interior trim, drywall repair, stool/apron replacement, or paint touch-up are separate line items or "as needed" charges assessed after demo.
- **Why it's a problem**: Can add $75-$300 per opening, discovered after walls are open when the homeowner has no leverage to walk away.
- **What to do about it**: Demand all-inclusive quote. Specifically ask: "Does this price include exterior capping, interior trim, drywall repair, and paint?"
- **Detection regex/phrases**: `/\b(as needed|if (required|necessary)|additional|not included|extra)\b.*\b(cap(ping)?|trim|wrap|drywall|stool|apron|paint|finish(ing)?)\b/i` or `/\b(cap(ping)?|trim wrap|drywall repair|interior finish)\b.*\$/i`

### Red flag: Balloon financing / deferred interest traps
- **What it looks like**: "No payments, no interest for 24 months!" At month 25, full retroactive interest at 27.99% APR hits, or a balloon payment equal to 40% of the balance is due.
- **Why it's a problem**: FTC and CFPB have issued alerts. Home improvement financing through GreenSky, Service Finance, and EnerBank are frequent offenders.
- **What to do about it**: Get the Truth-in-Lending disclosure. Confirm whether it is "deferred interest" vs "0% simple." Assume balloon until proven otherwise.
- **Detection regex/phrases**: `/\b(no (payments?|interest) for \d+ months?|deferred interest|same as cash|0% (apr|for \d+))\b/i` and `/\bballoon\b/i`

### Red flag: "Free installation" pricing inversion
- **What it looks like**: "Buy 4 windows, get installation FREE" or "Buy 5, get the 6th free." The per-window price is marked up 30-60% above market to absorb the "free" install.
- **Why it's a problem**: Obscures the true unit cost and makes comparison impossible. Window World and Champion are frequently cited for this.
- **What to do about it**: Ask for a line-item breakdown: window unit cost, installation cost, disposal, permit. Compare unit cost against NFRC-certified product MSRPs.
- **Detection regex/phrases**: `/\b(free install(ation)?|buy \d+ get \d+|installation included (free|at no)|no install(ation)? (cost|charge|fee))\b/i`

### Red flag: Subcontractor handoff after the sale
- **What it looks like**: The branded sales rep ("Renewal by Andersen of Greater X") sells the job. Install is performed by a 1099 subcontracted crew the homeowner has never met, with no brand accountability for workmanship.
- **Why it's a problem**: Warranty disputes become finger-pointing between the brand and the sub. Quality varies wildly.
- **What to do about it**: Ask in writing: "Will the company on this contract perform the installation with W-2 employees, or is it subcontracted?" Get installer license number.
- **Detection regex/phrases**: `/\b(sub[- ]?contract(ed|or)?|authorized installer|independent (contractor|installer)|third[- ]party install)\b/i`

### Red flag: Old-window disposal as a surprise extra
- **What it looks like**: Quote doesn't mention haul-away. Install day comes and crew tells homeowner disposal is $25-$75 per window extra, or leaves the old units stacked in the driveway.
- **Why it's a problem**: Lead paint from pre-1978 windows has EPA RRP disposal requirements. Homeowner can be left with hazardous material on the property.
- **What to do about it**: Confirm "haul-away and EPA-compliant disposal of existing windows" is a line item in the written scope.
- **Detection regex/phrases**: Absence of `/\b(haul[- ]?away|dispose|disposal|removal|debris|clean[- ]?up)\b/i` in the scope section should trigger a warning.

### Red flag: Permit fees not included
- **What it looks like**: Quote says "homeowner responsible for permits" or is silent on permits entirely. Permits for whole-home window replacement run $150-$800 depending on jurisdiction.
- **Why it's a problem**: Unpermitted window work can fail home inspection at resale and in some jurisdictions the homeowner is liable for code compliance, not the contractor.
- **What to do about it**: Scope must say "contractor pulls and pays all required permits."
- **Detection regex/phrases**: `/\b(homeowner|owner)\b.*\b(responsible|provide|obtain|pay)\b.*\bpermit/i` or absence of `/\bpermit(s|ting)?\b/i` in quotes over $3000.

### Red flag: Refusing to put scope in writing
- **What it looks like**: Salesperson verbally promises "yeah, we'll do the trim, don't worry" but refuses to write it on the contract. Contract says "per standard installation" with no definition.
- **Why it's a problem**: Unenforceable. If it's not written, it does not exist.
- **What to do about it**: Every promise goes on the contract or walk away.
- **Detection regex/phrases**: `/\b(standard install(ation)?|per (industry|company) standard|as discussed|per conversation)\b/i` without a specific scope section.

### Red flag: Door-to-door pitch with no website or BBB listing
- **What it looks like**: Unsolicited knock, clipboard, "we're doing a house in the neighborhood and had leftover materials." No functional website, no BBB profile, no state contractor license lookup result.
- **Why it's a problem**: AARP's #1 elder fraud category for home improvement. Deposits taken, work never starts.
- **What to do about it**: Never sign from a door knock. Verify state contractor license, BBB rating, and Google Business Profile before any deposit.
- **Detection regex/phrases**: Hard to detect from quote text alone. Flag if quote lacks `/\b(license ?#|lic\.? ?no\.?|license number|contractor license)\b/i` and lacks a website URL.

### Red flag: Vague product spec — "premium vinyl" with no brand/model
- **What it looks like**: Line item reads "Premium double-hung vinyl replacement window" with no manufacturer, series, or model number.
- **Why it's a problem**: Prevents the homeowner from looking up the actual NFRC rating, warranty terms, or spec sheet. Allows bait-and-switch to a cheaper SKU at install.
- **What to do about it**: Require manufacturer name, series, model number, and glass package on every line item.
- **Detection regex/phrases**: Presence of `/\b(premium|builder[- ]?grade|standard|economy|deluxe) (vinyl|window)\b/i` without any of `/\b(andersen|pella|marvin|simonton|milgard|harvey|jeld[- ]?wen|alside|atrium|ply ?gem|provia|okna|sunrise|soft[- ]?lite|series [a-z0-9]+|model [a-z0-9]+)\b/i`

### Red flag: Missing U-factor and SHGC
- **What it looks like**: No NFRC label data on the quote. Homeowner cannot verify ENERGY STAR eligibility or tax credit qualification.
- **Why it's a problem**: The 25C federal tax credit (30%, up to $600/year for windows) requires ENERGY STAR Most Efficient certification. Without U-factor and SHGC on the quote, the homeowner cannot confirm credit eligibility before buying.
- **What to do about it**: Require NFRC label data: U-factor, SHGC, VT, air leakage.
- **Detection regex/phrases**: Absence of `/\bu[- ]?(factor|value)\b/i` and `/\bshgc\b/i` and `/\bnfrc\b/i` on a window quote.

### Red flag: Install type not specified (pocket vs full-frame)
- **What it looks like**: Quote doesn't say "insert/pocket replacement" vs "full-frame replacement." These are very different jobs: full-frame includes new sill, jamb, exterior trim; pocket reuses existing frame.
- **Why it's a problem**: Price difference is $200-$600 per opening. Homeowner may be paying full-frame prices for a pocket install, or expecting full-frame and getting pocket.
- **What to do about it**: Scope must specify one of: insert/pocket, full-frame, new construction.
- **Detection regex/phrases**: Absence of `/\b(pocket|insert|full[- ]?frame|retrofit|new construction|tear[- ]?out)\b/i` in a window quote.

### Red flag: "Call corporate for special approval" theatre
- **What it looks like**: Salesperson pretends to phone a manager, comes back with a "one-time discount" of 40-50% off an inflated sticker price.
- **Why it's a problem**: The original price was never real. The "discount" is the actual price. BBB complaints against Champion and Renewal by Andersen frequently cite this.
- **What to do about it**: Ignore the sticker. Judge only the final number against 2-3 competing quotes.
- **Detection regex/phrases**: `/\b(regular(ly)? priced? at|msrp|list price|was \$[\d,]+|manager (approval|discount|special)|corporate (approval|discount))\b/i` combined with a strike-through or large discount %.

### Red flag: Excessive deposit (>33%)
- **What it looks like**: Contract requires 50%, 60%, or even 100% deposit before any material is delivered.
- **Why it's a problem**: Industry standard is 10-33% at signing, balance on completion. Large deposits are a leading indicator of abandonment fraud. Several states cap home improvement deposits (Maryland 33%, Maine 33%, others vary).
- **What to do about it**: Cap deposit at one-third. Remainder on substantial completion.
- **Detection regex/phrases**: `/\bdeposit\b.*\b(50|60|70|75|80|90|100) ?%\b/i` or `/\b(half|50 percent|full payment).*\b(deposit|upfront|upon signing)\b/i`

### Red flag: Vague timelines
- **What it looks like**: "We'll get to you in a few weeks" or no install date listed. Window orders actually take 4-12 weeks from manufacturer.
- **Why it's a problem**: No accountability. Deposits sit with the contractor indefinitely.
- **What to do about it**: Contract must state order date, expected manufacturer lead time, and target install date with a not-to-exceed clause.
- **Detection regex/phrases**: Absence of specific date pattern `/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/` in the schedule/timeline section, combined with phrases like `/\b(few weeks|soon|as soon as|tbd|asap|shortly)\b/i`.

### Red flag: Out-of-state company with no local presence
- **What it looks like**: Address on quote is a PO box or another state. No local showroom, local license, or local phone.
- **Why it's a problem**: Warranty service after install becomes impossible. State AG complaints often cite out-of-state storm-chaser operations.
- **What to do about it**: Verify a physical local address, in-state contractor license, and local reviews.
- **Detection regex/phrases**: Compare address state in quote header to homeowner's state. Flag if PO box `/\bp\.?o\.? ?box\b/i` is the only address.

---

## Part 2: Best-in-class estimator UX

### HomeAdvisor (Angi): https://www.homeadvisor.com/cost/windows/install-windows/
- **Required fields**: ZIP, number of windows, window type (double-hung, casement, etc.). No email to see the range.
- **Optional refinements**: Frame material, install type, project scope.
- **Result format**: National average + low/high range, then a "get matched with pros" CTA that is the real conversion goal. Shows cost per window.
- **Trust signals**: "Data from X,XXX projects." Logos of home improvement networks.
- **Red flags in their UX**: The range is the bait. The real page goal is lead capture; the calculator exists to qualify homeowners before forcing them into a contact form. Recommended pro list is pay-to-play.
- **Worth stealing**: The "low / average / high" visual with project-count credibility line.

### Angi cost guide: https://www.angi.com/articles/how-much-does-window-replacement-cost.htm
- **Required fields**: None — it's a cost guide not a live calculator. ZIP optional.
- **Optional refinements**: Static cost tables by window type, material, brand.
- **Result format**: Content-heavy tables, "$X to $Y per window." No personalization.
- **Trust signals**: Editorial voice, "reviewed by" expert byline.
- **Red flags in their UX**: Sticky lead-gen form slides in after scroll.
- **Worth stealing**: The brand-tier comparison table (Pella / Andersen / Milgard / Simonton side-by-side by price tier).

### Modernize: https://modernize.com/windows/cost
- **Required fields**: ZIP, project type, timeline, homeowner status — all required BEFORE showing any estimate.
- **Optional refinements**: None really — it's a lead form dressed as a calculator.
- **Result format**: User is told to expect a call. No real number until contact is shared.
- **Trust signals**: "4.5 stars" badge, BBB logo.
- **Red flags in their UX**: Classic dark-pattern lead-gen calculator. Urgency banners, progress bar to trick sunk cost, no actual estimate until form is submitted.
- **Worth stealing**: Nothing. Document as anti-pattern.

### Hover: https://hover.com/
- **Required fields**: 4-8 photos of the home exterior (uploaded via mobile).
- **Optional refinements**: Homeowner picks materials/products after 3D model generation.
- **Result format**: Full 3D model of the home with exact window dimensions, automatic measurements, itemized material takeoff. Pro-facing tool, not homeowner-facing.
- **Trust signals**: Used by 50k+ contractors. Precise measurements (fractional inch).
- **Red flags in their UX**: Not homeowner accessible — requires contractor account.
- **Worth stealing**: The photo-to-measurement pipeline. Even approximated, a "snap your facade" flow would be differentiating.

### Window Nation: https://www.windownation.com/get-a-quote/
- **Required fields**: Full contact info upfront, address, window count, timeline. No number shown — free in-home estimate only.
- **Optional refinements**: None.
- **Result format**: No online estimate. Lead form only.
- **Trust signals**: "Buy 2 Get 2 Free" promo banner, financing banner.
- **Red flags in their UX**: Pricing inversion promo. No price transparency at all. "Free estimate" is a 90-minute in-home sales pitch.
- **Worth stealing**: Nothing. Anti-pattern reference.

### Renewal by Andersen: https://www.renewalbyandersen.com/get-started
- **Required fields**: Full contact, address, project details, homeowner confirmation. No online price.
- **Optional refinements**: Window types and project scope.
- **Result format**: No number. Schedules a sales consult.
- **Trust signals**: Parent brand credibility, warranty language.
- **Red flags in their UX**: Zero price transparency. Form requires multiple confirmations before submission.
- **Worth stealing**: The visual "window style picker" with illustrations of double-hung, casement, awning, bay, bow, sliding, picture — useful for homeowners who don't know the terms.

### Pella: https://www.pella.com/windows/cost/
- **Required fields**: ZIP to localize.
- **Optional refinements**: Window type picker, material (wood / fiberglass / vinyl).
- **Result format**: "Starting at $X" starting prices per series, no install. Honest that install is extra.
- **Trust signals**: Manufacturer authority. Shows NFRC ratings per product.
- **Red flags in their UX**: Prices exclude install (which is 40-60% of total job).
- **Worth stealing**: The series-tier picker (Pella 250 / 350 / Impervia / Lifestyle / Reserve) with ratings shown inline.

### Consumer Reports window buying guide: https://www.consumerreports.org/home-garden/windows/buying-guide/
- **Required fields**: CR membership to see ratings.
- **Optional refinements**: Filter by type, frame material, price.
- **Result format**: Brand-level ratings by wind resistance, rain resistance, insulation (summer + winter), ease of use. No city-level pricing.
- **Trust signals**: Editorial independence, no-ads, paid subscription.
- **Red flags in their UX**: Paywall.
- **Worth stealing**: Multi-attribute brand rating matrix. Wind + rain + insulation scores per brand.

### Bob Vila: https://www.bobvila.com/articles/window-replacement-cost/
- **Required fields**: None — static cost guide.
- **Optional refinements**: ZIP for regional adjustment.
- **Result format**: National average $750/window installed, range $300-$2100. Breaks down by type, material, brand, regional factors.
- **Trust signals**: Heritage brand, expert bylines.
- **Red flags in their UX**: Affiliate CTAs to lead-gen networks.
- **Worth stealing**: Their "factors that influence cost" checklist — frame material, glass package, size, install type, old window disposal, lead paint, permits, location.

### This Old House: https://www.thisoldhouse.com/windows/reviews/window-replacement-cost
- **Required fields**: None.
- **Optional refinements**: Interactive brand comparison tool.
- **Result format**: Average cost, tiered by material, with a "savings over 20 years" energy calculation.
- **Trust signals**: TOH brand, contractor network.
- **Red flags in their UX**: Lead-gen sticky nav.
- **Worth stealing**: The 20-year energy savings projection. Homeowners respond to lifetime cost framing.

### Forbes Home: https://www.forbes.com/home-improvement/windows/cost-to-replace-windows/
- **Required fields**: ZIP for a "local cost" widget (still static under the hood).
- **Optional refinements**: Window count, type selector.
- **Result format**: Cost range + "get free quotes" CTA to lead network.
- **Trust signals**: Forbes brand, editorial byline.
- **Red flags in their UX**: "Cost calculator" is a skin on a lead form.
- **Worth stealing**: Their "what you'll pay in [City]" localized H2 pattern — good for SEO and trust.

### ENERGY STAR window product finder: https://www.energystar.gov/productfinder/product/certified-residential-windows-doors-skylights/
- **Required fields**: Climate zone (Northern, North-Central, South-Central, Southern).
- **Optional refinements**: Frame type, manufacturer, U-factor, SHGC.
- **Result format**: Filterable list of certified products with exact NFRC ratings.
- **Trust signals**: Federal agency, manufacturer-verified data.
- **Red flags in their UX**: None — it's a government reference tool.
- **Worth stealing**: Climate-zone-aware U-factor/SHGC recommendation. Woogoro can ask for zip, derive climate zone, and tell user the target U-factor for their region.

---

## Synthesis: what Woogoro's windows estimator should ask and show

### Required fields (4-5)
1. **ZIP code** — drives city name in result, climate zone, labor rate, permit cost, tax credit availability.
2. **Number of windows** — primary cost driver.
3. **Window type** — double-hung / casement / slider / picture / bay/bow. Use illustrated picker, don't assume users know terms.
4. **Install type** — pocket/insert vs full-frame. Explain the difference inline with a tooltip.
5. **Frame material** — vinyl / fiberglass / wood / composite / aluminum. Default to vinyl.

### Optional refinements (behind accordion)
1. **Brand tier** — budget (Alside, Atrium) / mid (Simonton, Harvey, ProVia) / premium (Pella, Andersen, Marvin, Milgard).
2. **Glass package** — double-pane low-E / triple-pane / impact-rated.
3. **Grid/grille style** — none / between-glass / simulated divided lite.
4. **Historic district or HOA constraints** — toggle that surfaces a note about approval and spec requirements.
5. **Year home was built** — pre-1978 triggers lead paint RRP disposal line.
6. **Currently have storm windows** — affects removal scope.
7. **Interior trim condition** — good / needs replacement / unknown — sets expectation on finishing cost.

### Result components (6-8)
1. **Per-window cost range** with low/mid/high, labeled "installed, all-in."
2. **Full project total** with the city name in the headline ("Your Rochester, NY window estimate").
3. **Line-item breakdown**: unit cost, install labor, capping/trim, disposal, permit, tax — itemized so nothing is hidden.
4. **ENERGY STAR / NFRC target** for the user's climate zone (e.g. "In your zone, target U-factor <= 0.27 and SHGC <= 0.40").
5. **25C federal tax credit eligibility** — "You may qualify for up to $600 in federal tax credit if windows meet ENERGY STAR Most Efficient."
6. **20-year energy savings projection** using climate zone and current single/double-pane baseline.
7. **Questions-to-ask-the-contractor checklist** — the 10 most important scope items (pocket vs full-frame, brand/model, NFRC ratings, warranty transfer, deposit %, subcontractor, disposal, permit, timeline, right-of-rescission).
8. **Red-flag scan upload** — "Already have a quote? Upload it and we'll scan it for the 18 red flags above."

### 3 most differentiated features
1. **Upload-and-scan red flag detector**. No competitor has this. Runs the regex set from Part 1 against an uploaded PDF/image quote and returns a plain-English warning per hit. This is the moat.
2. **Climate-zone U-factor/SHGC recommendation** tied to 25C tax credit eligibility, with a pre-filled checklist the user can hand to their contractor. Competitors mention ENERGY STAR but none tell the user the specific target numbers for their zip.
3. **City-named, itemized, all-in result** with explicit disposal + permit + capping line items. Every competitor either hides these (lead-gen sites) or ignores them (cost guides). Woogoro's headline number is the only one that matches what will actually be on the final invoice.

---

## Sources
- https://www.bbb.org/ (complaint databases for Renewal by Andersen, Champion, Window World, Power Home Remodeling)
- https://www.consumerreports.org/home-garden/windows/buying-guide/
- https://www.consumer.ftc.gov/articles/hiring-contractor
- https://www.ftc.gov/legal-library/browse/rules/cooling-rule (16 CFR Part 429)
- https://www.consumeraffairs.com/homeowners/window_installation.html
- https://www.reddit.com/r/HomeImprovement/ (search: "window quote red flags", "Renewal by Andersen price", "Window World warranty")
- https://www.reddit.com/r/DIY/
- https://www.angi.com/articles/how-much-does-window-replacement-cost.htm
- https://www.angi.com/articles/home-improvement-scams.htm
- https://www.aarp.org/money/scams-fraud/info-2019/home-improvement.html
- https://www.nfrc.org/ratings/
- https://www.energystar.gov/products/res_windows_doors_skylights/key_product_criteria
- https://www.energystar.gov/productfinder/product/certified-residential-windows-doors-skylights/
- https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit (25C)
- https://www.cfpb.gov/ (deferred interest financing alerts)
- https://www.homeadvisor.com/cost/windows/install-windows/
- https://modernize.com/windows/cost
- https://hover.com/
- https://www.windownation.com/get-a-quote/
- https://www.renewalbyandersen.com/get-started
- https://www.pella.com/windows/cost/
- https://www.bobvila.com/articles/window-replacement-cost/
- https://www.thisoldhouse.com/windows/reviews/window-replacement-cost
- https://www.forbes.com/home-improvement/windows/cost-to-replace-windows/
- https://www.architecturaldigest.com/reviews/windows/window-replacement-cost
- State AG consumer protection alerts: Maryland OAG, New York OAG, California DOJ home improvement fraud pages
