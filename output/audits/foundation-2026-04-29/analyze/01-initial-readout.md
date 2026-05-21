# 01-initial readout — Foundation analyze landing

URL: https://woogoro.com/foundation-quote-analyzer.html
Captured: 2026-04-29 ~21:55

## What I see (top to bottom, content verified against `foundation-quote-analyzer.html` source)

### Banner + header + path tabs
- Banner: "✓ Free · No email · No phone · No signup · We never sell or share your data"
- Header: Woogoros logo (Iris-color-side-silhouette) + nav: Guides, Methodology. (CV-3 applies — no About/Contact in primary nav.)
- Path tabs: "You are analyzing a quote." + "Want a free estimate first? →" + "Multiple quotes? Compare →"

### Hero
- Mascot: **Atlas the Foundation Woogoro** (Foundation worker variant — orange-haired Woogoro in safety gear with hard-hat). Image src `/images/Worker%20Woogoro/Foundation%20worker.png`.
- H1: **"Is your foundation repair quote fair?"**
- Subhead: "Upload your contractor quote. We'll check the price, scope, and red flags in 30 seconds."
- Sub-helper: "New to foundation pricing? Read our **Foundation Repair Cost Guide**" (links to `/foundation-repair-cost-guide.html`)
- Upload card: title "Analyze a Quote", hint "Upload a contractor quote (PDF or image) to check the price", file input (PDF/image accepted), privacy line "Your quote stays private. Processed in your browser, never stored or shared."

### Cross-vertical strip
"Analyze quotes for other services" — 19 chip-style links to other vertical analyzers:
Roofing, HVAC, Plumbing, Electrical, Solar, Windows, Painting, Siding, Fencing, Concrete, Landscaping, Garage Doors, Kitchen, Insulation, Gutters, Auto Repair (highlighted blue), Medical Bills (highlighted teal), Legal Fees (highlighted purple), Moving (highlighted amber). Foundation itself is the current page so not listed (correct).

### "What to look for on a foundation quote" — 10 spec cells
1. **Structural engineer report** — For significant repairs, a licensed PE should evaluate. Independent engineers (not employed by repair co.) give unbiased assessment.
2. **Specific repair method** — Steel push piers, helical, hydraulic, polyurethane foam, wall anchors, carbon fiber straps, slab jacking. Each appropriate for different problems.
3. **Pier count and depth** — Specific number + target depth (typically to bedrock or load-bearing stratum).
4. **Materials used** — Pier type and specs. ECP, Supportworks, Earth Contact Products are quality brands.
5. **Excavation scope** — Depth per pier, backfill method.
6. **Lifting or stabilizing only** — Some repairs stabilize (prevent further movement) without lifting; lifting attempts can cause drywall damage and is riskier.
7. **Waterproofing or drainage** — If issue is water-driven, exterior or interior drainage may be part of complete fix.
8. **Warranty terms** — Lifetime transferable is premium and expected; non-transferable is lower-value at resale.
9. **Permit** — Required for most structural foundation work.
10. **Post-repair monitoring** — Quality contractors include follow-up inspection 6–12 months post-repair.

### "Red flags in a foundation quote" — 7 bullets
1. **Repair without engineer consultation** — Any significant work ($5,000+) should include independent PE assessment.
2. **Non-transferable warranty** — Affects resale value; buyer's lender may require new inspection.
3. **One-size-fits-all repair method** — Different problems need different solutions; pushing steel piers for every issue is sales not engineering.
4. **No pier depth specification** — Piers need to reach bedrock; without spec, contractor may stop at shallow depth that fails within years.
5. **Pressure sales based on "emergency"** — Most foundation issues are slow-moving.
6. **Minor crack pushed to major repair** — Minor vertical cracks under 1/4" in poured concrete are often cosmetic ($300–$800 epoxy fix); $15,000+ underpinning for those = get second opinion.
7. **Interior piers only without exterior** — Some issues require exterior pier placement; interior-only can be insufficient.

### "Common hidden costs and change orders" — 7 bullets
1. Independent structural engineer consultation ($500–$1,500)
2. Permit and inspection fees
3. Interior drywall repair after wall movement ($500–$3,000)
4. Exterior landscaping restoration after excavation
5. Plumbing repairs if pipes moved during lifting
6. Door and window re-alignment after foundation movement
7. Future drainage or waterproofing if not included

### "Frequently asked questions about foundation quotes" — 5 Q&A items (with FAQPage JSON-LD schema)
1. How much does foundation repair cost? — answer details by repair type ($300–$1,500 minor, $3,000–$10,000 bowing wall, $1,500–$3,500 per pier × 6–20 piers, $15,000–$40,000+ major underpinning, $500–$2,500 polyurethane slab jacking)
2. What should be on a legitimate foundation quote? — engineer report, repair method, pier count/depth, materials/brand, excavation scope, lifting vs stabilizing, waterproofing if applicable, warranty, permit, monitoring
3. What are red flags in a foundation quote? — same 7 reds-flags from above
4. Should I get a structural engineer opinion? — yes always for $5,000+; $500–$1,500 independent fee; in-house engineers may favor preferred solutions
5. Is a transferable warranty important? — Very. Adds $5,000–$15,000 home value at resale.

### Footer
4-column standard nav with Get a Price / Browse / Top Trades / About columns.

## JSON-LD schema present
- WebApplication
- BreadcrumbList (Home → Foundation)
- SoftwareApplication
- HowTo (4 steps: upload quote, enter city, review price check, use questions to push back)
- FAQPage (mirrors the 5 FAQ items)

Schema is well-formed and accurate to page content.

## Visual flags

- Mascot Atlas renders cleanly with multiply blend.
- H1 + subhead + CTA hierarchy clear.
- 10 spec cells in 3-column responsive grid (260px min) — well-organized.
- 7 red-flag boxes are pink-bordered, left-accented red — high visual contrast (good for grabbing attention).
- Cross-vertical strip is dense but functional.
- All copy reads as informative and homeowner-focused (not sales-y).
- No placeholders, no $undefined, no broken styles.

## Findings noted

None at Step 1. Foundation analyze landing is content-rich, structurally consistent with other vertical analyzers, and copy is high-quality.

CV-3 (header gap) applies as cross-vertical, already queued.

## Verdict

Foundation analyze landing PASS. Ready for Step 2 (wrong-vertical reject testing).
