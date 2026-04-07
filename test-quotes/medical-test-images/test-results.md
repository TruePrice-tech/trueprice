# Medical Test Results

Run: 2026-04-07 14:49:54
Endpoint: https://truepricehq.com/api/medical-bill-estimate
Samples tested: 10

**Counter at start:** 3874
**Counter at end:** 3874
**Counter delta:** +0 (expected +0)

**Parse success:** 10/10
**Detected price:** 0/10

## 01-found-out-my-insurance-doesnt-cover-hospital-bills.jpeg

- Total: $None
- Time: 13.9s
- redFlags: 9
  - No itemized claim details provided - only aggregate amounts shown for each 2025 claim without service descriptions, dates, or CPT codes
  - No CPT or HCPCS codes listed - cannot verify if services are medically necessary or appropriately coded
  - No facility or provider name displayed - cannot determine if in-network status or facility type
- lineItems: 4

## 02-what-a-9-day-hospital-stay-costs-for-an-infected-g.jpeg

- Total: $None
- Time: 10.9s
- redFlags: 8
  - No itemized line items provided - only high-level financial summary with 11 claims referenced but no detail
  - Unable to verify CPT codes, procedure descriptions, or dates for individual claims
  - Total billed ($121,348.72) is extremely high relative to insurance payment ($2,452.19), suggesting either significant out-of-network charges, denied claims, or patient responsibility shifted to member

## 03-gave-birth-two-weeks-ago.jpeg

- Total: $None
- Time: 10.7s
- redFlags: 7
  - No itemized breakdown provided - cannot verify individual service charges or identify potential billing errors
  - No CPT/HCPCS codes listed - unable to verify medical necessity or check for upcoding, unbundling, or duplicate billing
  - No facility name or type identified - cannot assess whether services were provided at highest-cost setting

## 04-denied-claim-for-childbirth.jpeg

- Total: $None
- Time: 14.6s
- stateCode: NJ
- redFlags: 9
  - Document is an Explanation of Benefits (EOB), NOT an itemized bill - no line-item details, CPT codes, or service descriptions provided
  - Patient responsibility of $42,929.27 is extremely high with no breakdown of what services generated this charge
  - Note M228 indicates procedure denied as 'not medically necessary' due to early elective delivery benefit exclusion - patient may have grounds to appeal

## 05-denied-claim-for-child-birth-from-three-years-ago.jpeg

- Total: $None
- Time: 14.5s
- redFlags: 9
  - NO ITEMIZED BILL PROVIDED: Only aggregate totals shown ($31,804 charged, $29,554 balance). Cannot verify appropriateness of individual services or costs.
  - NO LINE-ITEM DETAILS: No CPT codes, procedure descriptions, quantity of services, or cost breakdowns visible.
  - NO CLINICAL JUSTIFICATION: Document references services to 'daughter' but lacks clarity on relationship to patient and clinical necessity.

## 06-2000-hospital-bill-for-a-10-minute-visit-to-er-the.jpeg

- Total: $None
- Time: 15.0s
- stateCode: TX
- redFlags: 7
  - Bill is not itemized—only shows total ER visit charge without breakdown of supplies, medications, or procedures
  - CPT code 99283 (ER Level III) is provided, but no supporting detail on what triggered this acuity level or what services were rendered
  - Large patient responsibility ($1,725) on emergency visit raises questions about coverage applicability and No Surprises Act compliance
- lineItems: 1

## 07-daughter-got-3-stitches-removed-at-her-pediatricia.jpeg

- Total: $None
- Time: 20.0s
- redFlags: 9
  - CPT 15853 (suture/staple removal) billed twice on same bill ($3,076 + $32). Duplicate charge or billing error likely.
  - Two office visit codes (99211 and 99213) billed together for same encounter. Only one E/M code should be reported per visit unless separate, documented services. Potential unbundling violation.
  - CPT 15853 procedure code typically includes wound evaluation and is bundled with office visit. Billing both separately may violate NCCI bundling rules.
- lineItems: 4

## 08-need-advice-doctor-trying-to-double-bill-for-the-s.jpeg

- Total: $None
- Time: 17.3s
- stateCode: CA
- redFlags: 5
  - Two E/M codes billed on same date (99205 new visit + 99244 consultation) - potential unbundling violation; these should typically be consolidated into single office visit level
  - CPT 72050 (neck X-ray) paid only $10.09 on $122.75 charge suggesting significant contractual adjustment (~92% discount), possible pricing misalignment
  - CPT 72080 (thoracic X-ray) appears to have $0 insurance payment despite $79.75 charge, reason for denial or non-coverage unclear
- lineItems: 5

## 09-17k-for-bloodwork-ct-scan-and-two-rounds-of-antibi.jpeg

- Total: $None
- Time: 26.4s
- redFlags: 8
  - Duplicate CPT 99285 charge: listed once under 'Emergency Room - General Classification' ($3,961) and again under 'HC ER Level 5 - 99285' ($3,961). Both appear to be for the same emergency visit, potential duplicate billing.
  - Multiple G0378 observation codes with inconsistent billing: $5,500 facility fee + $300 professional fee + $900 for quantity 3. Unclear coding logic; typically observation is billed as hourly rate per unit, not mixed facility/professional splits.
  - Specialty Services charge ($6,700) lacks specific CPT code or service description; 'General Classification' is vague and makes it impossible to verify appropriateness or benchmark against Medicare rates.
- lineItems: 11

## 10-can-someone-explain-this-to-me.jpeg

- Total: $None
- Time: 12.4s
- redFlags: 9
  - No service date provided - cannot verify timeliness of billing or statute of limitations
  - No CPT/HCPCS codes listed - cannot verify appropriateness of charges or identify upcoding
  - No itemized breakdown of services - document shows only aggregate billing summary, not individual procedures
- lineItems: 3

