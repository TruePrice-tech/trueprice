# 03-final readout — Foundation estimate happy-path verdict (Step 3)

URL: https://woogoro.com/foundation-estimate.html (after wizard walk)
Captured: 2026-04-29

## Wizard inputs walked
- Step 1: Pier Installation (first option)
- Step 2: Minor (1-3 cracks) (severity)
- Step 3: Pre-1960 (home age)
- Address: 123 Maple St, Fort Mill, SC 29710 (harness pre-fill)

## Verdict (read every word)

**Header:** "Your Foundation Repair Estimate" / "WOOGORO FOUNDATION VERDICT"

### Numbers
- **Estimated cost: $2,950**
- **Expected range: $2,600 - $3,400**
- Range bands: $2,950 × 0.88 = $2,596, × 1.15 = $3,392 → matches site-wide 0.88/1.15 standard ✓

### Repair Details
- Repair Type: **Pier Installation**
- Pricing: **Fort Mill local pricing** (local pricing engaged correctly with address pre-fill)
- Severity: Minor
- Home Age: Pre-1960

### What This Estimate Includes (8 scope items)
- Structural inspection / engineering report
- Piers (steel push piers or helical piers)
- Pier brackets and hardware
- Excavation and soil work
- Waterproofing / sealant
- Backfill and compaction
- Permits and inspections
- Warranty (transferable / lifetime)

### Disclaimer
"Estimate assumes standard conditions. Extensive excavation, drainage systems, or landscaping restoration may add cost." ✓ honest.

### Next Steps (4 items)
- Get a structural engineer's report before committing
- Ask if warranty is transferable
- Verify pier depth reaches stable, load-bearing soil
- Confirm quote includes permits and post-repair inspections

### Red Flags to Watch For (4 items)
- Contractor skips inspection and jumps to repair plan
- No structural engineer involved in assessment
- Warranty not transferable or excessive exclusions
- High-pressure sales tactics

### Feedback row + Share form + Email notify
Standard suite. CTAs: Yes accurate / Higher / Lower / Was this helpful 👍👎.

### Bottom action row
Back to Foundation / Save as PDF / Share link / Home

## Number sanity check

Per the page's cost-by-issue table, pier installation runs $1,500-$3,500 per pier. The $2,950 estimate for "Minor (1-3 cracks)" + Pre-1960 + Pier Installation maps to ~1 pier at midpoint pricing, plausible for a Pre-1960 home with minor visible damage that warrants pier installation rather than just epoxy injection.

The wizard inputs (Pier Installation + Minor severity) are slightly internally inconsistent — Minor cracks usually call for epoxy injection ($300-$1,500), not full pier installation. The wizard could potentially flag this combo as unusual, but the resulting estimate is still numerically defensible.

## Findings

### F-EST-1 (LOW): Wizard allows internally inconsistent input combos
- **Severity:** LOW (UX, not a defect; produces a defensible number anyway)
- **Observed:** "Minor (1-3 cracks)" severity + "Pier Installation" repair type is an unusual combination — minor cracks typically call for epoxy injection, not full pier installation. The wizard accepts the combo without comment.
- **Expected:** Could surface a friendly nudge ("Pier installation is usually for major issues — for minor cracks, consider crack repair") OR leave as-is (user knows their situation best).
- **Status:** **DEFERRED** — design choice, very low priority.

## Verdict

Foundation estimate happy-path produces a clean, info-rich verdict with sensible numbers. Local pricing engaged. **Step 3 PASS.**
