# Painting deep test 2026-05-03 — fixture ground truth

Hand-read every fixture before running through the parser, per
`feedback_read_fixtures_first.md`. Documented here so any parser drift on
these fields shows up as a harness FAIL with a literal value to compare against.

## 9-fixture pool

3 real (validated post-pollution-cleanup) + 6 synthetic (3 clean PNG +
3 messy JPG OCR-degraded variants).

---

### f1 — iMessage exterior repaint $10,650 *(real, messy chat-screenshot)*

`test-quotes/painting-test-images/01-is-my-estimate-reasonable-or-am-i-going-crazy.jpeg`

- **Total:** $10,650 (after 10% new-client discount, includes labor + materials)
- **Project type:** exterior repaint (implicit from "exterior" in chat thread context — full-house implied by quote magnitude)
- **Contractor:** NOT visible (iMessage thread, sender unnamed)
- **City/state/ZIP:** NONE visible
- **Scope items present:** mention of "labor, materials, 10% discount"
- **Scope items absent:** every detail item (no line breakdown, no coats spec, no brand, no warranty, no surface prep)
- **Confidence:** low — chat screenshot tests OCR + parser robustness on conversational text

### f2 — cabinet refinish $2,820 *(real, clean tabular)*

`test-quotes/painting-test-images/07-is-this-a-fair-price-from-professional-point-of-vi.jpeg`

- **Total:** $2,820.00 (deposit $1,410.00 = 50% — both numbers visible)
- **Project type:** cabinet painting / refinishing (interior, NOT exterior or whole-house)
- **Contractor:** NOT visible (header cropped off)
- **City/state/ZIP:** NONE visible
- **Scope items:**
  - 17 cabinet doors @ $65/each "Prep/prime/paint" = $1,105
  - 9 drawers/covers @ $35/each "Prep prime paint" = $315
  - 7 cabinets @ $200/each "Prep/prime/paint" = $1,400
- **Includes:** "materials and labor"
- **Quote validity:** 30 days
- **Coats:** not specified explicitly (prep + prime + paint implies primer + 1-2 finish coats)
- **Brand:** not visible
- **Warranty:** not visible

### f3 — primer-only multi-job notes $475/$550 + $450 *(real, dark-mode notes app)*

`test-quotes/painting-test-images/08-quote-feedback--primer-only-job.png`

- **Total:** ambiguous, multiple sub-totals on same page:
  - Car port ceiling 66'×12' = 792 sqft surface — 5 gal Kilz 3 primer ($149) + Labor ($325) = $475 base, OR $550 with optional pressure wash (+$75 labor)
  - Fascia trim ~240 linear ft — 1 gal Sherwin A-100 alkyd primer ($51) + Labor ($400) = $450
- **Most plausible parser pick:** $475 OR $550 (largest of the explicit "Total" numbers in the document)
- **Project type:** primer only (interior + exterior trim)
- **Contractor:** none — "94th- Steve" is a job-address marker
- **City/state/ZIP:** "94th" street reference, no state visible
- **Scope items:** primer specified (Kilz 3 / Sherwin A-100 alkyd), pressure wash optional, mask windows, scrape peeling paint, 50/50 payment terms
- **Brand:** Kilz (value tier), Sherwin-Williams A-100 (mid tier). Mixed.
- **Warranty:** "Customer keeps any excess material" (not workmanship)

### f4 — synthetic clean low BUDGET PAINTERS DENVER $3,280

`test-quotes/painting-images/comparison-paint-low.png`

- **Total:** $3,280 (no tax, subtotal = total)
- **Contractor:** BUDGET PAINTERS DENVER
- **Address:** 8400 E Iliff Ave, Denver, CO 80231
- **Customer property:** 4422 Holly Springs Court, Aurora, CO 80016
- **Job:** 2200 sqft 2-story home, full exterior repaint
- **Scope items present:**
  - body color (1 coat) $2,400
  - trim color (1 coat) $680
  - pressure wash $200
  - drop cloth and protection (Included)
- **Scope items absent:** scraping, sanding, priming, caulking, wood repair (explicitly "No prep beyond pressure wash")
- **Brand:** Behr Marquee (or equivalent) — value tier
- **Coats:** 1
- **Warranty:** 1-year workmanship
- **Payment:** 50% deposit / 50% on completion
- **stateCode expected:** CO

### f5 — synthetic clean mid ROCKY MOUNTAIN PRO PAINTING $6,680

`test-quotes/painting-images/comparison-paint-mid.png`

- **Total:** $6,680
- **Contractor:** ROCKY MOUNTAIN PRO PAINTING (CO contractor #CP-44188)
- **Address:** 2390 S Parker Rd, Aurora, CO 80014
- **Customer property:** 4422 Holly Springs Court, Aurora, CO 80016
- **Job:** 2200 sqft 2-story home, full exterior repaint
- **Scope items present:**
  - body color (2 coats) $3,800
  - trim color (2 coats) $1,200
  - pressure wash and surface prep $420
  - caulking and minor wood repair $580
  - premium paint (Sherwin-Williams Duration) $680
  - drop cloths, masking, daily cleanup (Included)
- **Brand:** Sherwin-Williams Duration — premium tier
- **Coats:** 2
- **Warranty:** 5-year workmanship + 10-year manufacturer paint
- **Payment:** 30/40/30 schedule
- **stateCode expected:** CO

### f6 — synthetic clean high FRONT RANGE FINISHWORKS $12,400

`test-quotes/painting-images/comparison-paint-high.png`

- **Total:** $12,400
- **Contractor:** FRONT RANGE FINISHWORKS (CO #CP-45200)
- **Address:** 112 Detroit St, Denver, CO 80206
- **Customer property:** 4422 Holly Springs Court, Aurora, CO 80016
- **Job:** 2200 sqft 2-story home, full exterior repaint, high-end residential
- **Scope items present:**
  - body (2 coats premium) $5,400
  - trim, fascia, soffit (3 coats) $2,200
  - power wash, scrape, sand, prime bare wood $1,200
  - full caulking, wood rot repair (up to 4 hours) $1,400
  - premium paint (Sherwin-Williams Emerald) $1,100
  - doors and shutters (2 coats) $680
  - daily site cleanup and protection (Included)
  - project management and final walk-through $420
- **Brand:** Sherwin-Williams Emerald — premium tier
- **Coats:** 2 body + 3 trim
- **Warranty:** 10-year workmanship + lifetime manufacturer paint + free year-1 touch-up
- **Payment:** 25/50/25 schedule
- **stateCode expected:** CO

### f7-f9 — messy variants of f4-f6

Same content as f4/f5/f6, OCR-degraded (skewed/grayscale renders).
- f7: `test-quotes/painting-images/messy-comparison-paint-low.jpg` — OCR-noisy BUDGET PAINTERS, $3,280
- f8: `test-quotes/painting-images/messy-comparison-paint-mid.jpg` — OCR-noisy ROCKY MOUNTAIN, $6,680
- f9: `test-quotes/painting-images/messy-comparison-paint-high.jpg` — OCR-noisy FRONT RANGE, $12,400

OCR drift visible in raw cache: dates render as "2026-03-39" instead of
"2026-03-30", "Builder-grage" instead of "Builder-grade", "Sherwin-Williams"
sometimes intact / sometimes mangled. Tests robustness of the parser on
real-OCR-style noise, not synthetic.

---

## Cross-vertical guard checks (pre-flight)

- **KMP-2 (detectContractor whitelist):** `painting`/`painter` already
  present at `js/analyzer-parser.js:1120` and in fallback regex `:1145`. No
  action needed.
- **K3 (parsed.stateCode top-level):** painting analyzer reads
  `parsed.location.stateCode` at `painting-quote-analyzer.html:864`. Same
  pattern that kitchen/HVAC/electrical had — tracked as **P-K3** in this dive.
- **Bug-13 (TX silent default):** confirmed open at
  `painting-quote-analyzer.html:761` — `state.address.stateCode = lookup || "TX"`.
  Same pattern as kitchen K13. Tracked as **P-Bug13** in this dive.
- **Contractor row in paint-detail (P-K6):** painting analyzer's `state.result`
  has no contractor field; `renderResult` doesn't render Contractor row. Same
  bug shape as kitchen K6 was. Tracked as **P-K6** in this dive — surfaces
  on every fixture with a recognizable contractor (f4-f9).
- **Range-vs-ratio verdict (P-K8):** verdict still uses single-benchmark
  `verdictFromRatio` (line 921). Same calibration risk as kitchen K8 was. Will
  surface as Above/Below/Unusually verdicts that don't reflect a sensible
  range when checked against the synthetic 3-tier spread.
