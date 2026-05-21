# Fixture ground truth — read by hand before running through parser

## roofing-gaf-quote.jpeg (positive fixture)

**What's in the document (I read it visually):**

| Field | Ground truth |
|---|---|
| Title | "GAF Timberline HDZ Shingle Overlay (Title 24 Complaint)" — note: "Complaint" looks like a typo for "Compliant" |
| Total | $16,765.79 (subtotal $16,765.79 + tax $0 = total $16,765.79) |
| Currency | USD |
| Quote subtotal | $16,765.79 |
| Tax | not shown (line says "Tax" elsewhere?) — actually, no separate tax line |
| Customer | (redacted in the screenshot) |
| Property address | not visible in the document |
| City | not in document |
| State | not in document |
| ZIP | not in document |
| Roof size (sq ft) | NOT IN DOCUMENT |
| Brand | GAF |
| Model | Timberline HDZ (Cool Roof variant) |
| Material tier | Architectural shingles, premium tier (HDZ Cool Roof) |
| Contractor name | Green Ladder Roofing |
| Workmanship warranty | 10 years |
| Manufacturer warranty | GAF Lifetime System Plus (lifetime, accessory, 50yr up-front coverage period, cost of installation labor included) |
| Warranty caveat | "*ONLY AVAILABLE TO GAF CERTIFIED ROOFING CONTRACTORS*" |
| Layer assumption | "based on the assumption of 1 layer — if your roof has more than one layer we will not be able to perform this installation per city code" |

**Scope items in document (unambiguously present):**
- Edge Metal Trim ("Furnish and Install New Edge Metal Trim") → drip edge / edge flashing
- High Rise Caps ("On Hip and Ridge install Premium High Rise Caps") → ridge cap
- Debris haul-away ("Remove and haul away all debris caused by roofing") → disposal
- City Permits ("City Permits to be pulled by Green Ladder Roofing and reimbursed by client after purchase") → permits
- GAF Timberline HDZ Cool Roof Shingles
- Composition shingles per manufacturer specs
- Inspect wood members for deficiencies

**Scope items NOT in document:**
- Tear off (not itemized — but "1 layer" assumption implies remove-and-replace, just no line item)
- Underlayment
- Ice & water shield
- Ventilation (intake / exhaust)
- Ridge vent (only ridge CAP is mentioned)
- Starter strip
- Step / pipe / chimney flashing (only edge metal is mentioned)

**Scope items conditionally addressed (allowance only, NOT in base price):**
- Decking ("replace wood substrate as necessary at additional cost to the owner") — this IS addressed but the user pays extra if needed

**Other notes:**
- "Color to be determined by owner and submitted in writing prior to commencement of work" appears 2x — this is the source of the false-positive city detect "Submitted, IN" before the fix
- "Completion Report To Be Sent To Owner Prior To Requesting Final Invoice" at bottom

---

## Parser output vs ground truth (post-fix)

| Item | Ground truth | Parser output | Verdict |
|---|---|---|---|
| Total | $16,765.79 | $16,766 (rounded) | ✓ Pass (rounding acceptable) |
| City | none | empty (post-fix) | ✓ Pass (was Submitted, IN — fixed) |
| State | none | empty (post-fix) | ✓ Pass |
| Drip edge | present | ✓ Drip edge | ✓ Pass |
| Ridge cap | present | ✓ Ridge cap | ✓ Pass |
| Disposal | present | ✓ Disposal | ✓ Pass |
| Permit | present | ✓ Permit | ✓ Pass |
| Tear off | NOT itemized | ? Tear off (not found) | ✓ Pass |
| Underlayment | NOT in document | ? Underlayment (not found) | ✓ Pass |
| Flashing | only edge metal (no penetration flashing) | ? Flashing (not found) | ✓ Pass (debatable — drip edge IS a flashing variant) |
| Ice & water shield | NOT in document | ? Ice & water shield | ✓ Pass |
| Ventilation | NOT in document | ? Ventilation | ✓ Pass |
| Ridge vent | NOT in document (only ridge cap) | ? Ridge vent | ✓ Pass |
| Starter strip | NOT in document | ? Starter strip | ✓ Pass |
| Decking | conditional allowance | ? Decking (not found) | ✗ **Miss** — saying "not found" is misleading; should be "△ allowance only" |
| Brand | GAF Timberline HDZ | (need to verify in result text) | TBD |
| Architectural shingles | premium tier | "architectural shingles" | ✓ Pass (could be more specific to "premium architectural") |
| Workmanship warranty | 10 years | 10 years | ✓ Pass |
| Manufacturer warranty | GAF Lifetime System Plus | (need to verify) | TBD |

**Net parser accuracy on this fixture: ~14/15 = 93%**, with 1 nuance miss on Decking (allowance vs not-found).

---

## auto-equinox-quote.jpeg (negative fixture for roofing analyzer)

**What's in the document:**

| Field | Ground truth |
|---|---|
| Vehicle | 2014 Chevrolet Equinox |
| Item 1 | MCA 5CB50540 — MasterPro Control Arms Control Arm And Ball Joint Assembly — $193.19 × 1 |
| Item 2 | MCA 5CB50545 — MasterPro Control Arms Control Arm And Ball Joint Assembly — $193.19 × 1 |
| Item 3 | LABOR — CONTROL ARM (Remove & Replace) — $115/hr × 1.4 = $161.00 |
| Parts subtotal | $386.38 |
| Labor | $161.00 |
| Tax | $38.32 |
| Total | $585.70 |

This is unambiguously an auto repair quote. Should NEVER be analyzed as roofing.

**Parser behavior on roofing analyzer (unhappy path):**
- Pre-fix: parser proceeded as if this were roofing, extracted $2,014 as quote total (misreading the year "2014"), produced a confidently-wrong analysis flow
- Post-fix: hard-reject screen renders within ~50 seconds. "This is not a Roofing quote / The document you uploaded looks like an auto repair quote / Detection confidence: 7 Auto Repair keywords vs 0 Roofing keywords"
