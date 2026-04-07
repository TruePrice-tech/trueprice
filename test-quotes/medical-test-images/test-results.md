# Medical Test Results

Run: 2026-04-07 17:01:07
Endpoint: https://truepricehq.com/api/medical-bill-estimate
Samples tested: 13

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +11)

**Parse success:** 12/13
**Detected price:** 11/13

## 01-found-out-my-insurance-doesnt-cover-hospital-bills.jpeg

- Total: $34763.88
- Time: 14.3s
- redFlags: 10
  - CRITICAL: No itemized service descriptions provided - only aggregate claim amounts shown
  - CRITICAL: No CPT or HCPCS codes listed - impossible to verify medical necessity or detect upcoding/unbundling
  - CRITICAL: No service dates provided - cannot verify timeliness of billing or statute of limitations
- lineItems: 4

## 02-2000-hospital-bill-for-a-10-minute-visit-to-er-the.jpeg

- Total: $3737
- Time: 18.1s
- stateCode: TX
- redFlags: 8
  - ER visit billed as single line item with no itemization of services, supplies, or procedures - unable to verify appropriateness of $3,737 charge
  - Massive disparity between billed amount ($3,737) and insurance allowed amount ($1,725) suggests either out-of-network facility or severe facility markup
  - CPT 99283 (ER established patient, low-moderate complexity) should not exceed $1,500-2,000 in-network; $3,737 charge is approximately 187% above typical rate
- lineItems: 1

## 03-please-kindly-read-my-story-before-telling-me-to-p.jpeg

- Total: $None
- Time: 8.4s
- redFlags: 6
  - This is a premium payment collection notice, not a medical bill or EOB - no clinical services or itemized charges present
  - Payment due date September 01, 2025 has already passed as of letter date October 6, 2025
  - Critical deadline of 10/01/2025 for full payment to maintain coverage - patient is in grace period through 01/05/2026

## 04-need-advice-doctor-trying-to-double-bill-for-the-s.jpeg

- Total: $988
- Time: 21.3s
- stateCode: CA
- redFlags: 6
  - Excessive mark-up on imaging services: CPT 72050 charged $122.75 vs allowed amount $10.09 (over 1200% markup)
  - Significant variance between billed and allowed amounts across all imaging codes suggests facility is out-of-network or has extremely high chargemaster rates
  - Multiple BCBS adjustments and credit transfers suggest billing confusion or potential posting errors
- lineItems: 12

## 05-just-got-the-bill-doctor-waited-to-send-stuff-unti.jpeg

- Total: $11250
- Time: 16.9s
- redFlags: 6
  - CPT 30520 denied for medical necessity (QD046) with $3,100 charge — patient responsible for full amount; no pre-authorization documentation visible
  - Insurance paid only $1,691.27 of $6,458.73 allowed amount, indicating significant patient coinsurance obligation across all lines
  - Claim is adjustment (UC code) of prior claim #24357A05609; verify no duplicate billing occurred and confirm adjustment reason
- lineItems: 4

## 06-received-a-new-eob-and-bill-nearly-three-years-aft.png

- Total: $170
- Time: 11.2s
- redFlags: 6
  - EOB processed on 02/19/2026 but service provided on 07/05/2023 - 2.5+ year processing delay is highly unusual and suggests possible claim handling issue
  - Laboratory services billed as single line item with no specific test codes (CPT codes) identified - cannot verify medical necessity or appropriateness of charges
  - Insurance adjustment of $36.73 (21.6% reduction) suggests provider charged above negotiated rates
- lineItems: 1

## 07-help-complicated-medical-bill-conundrum.jpeg

- Total: $451
- Time: 12.3s
- redFlags: 7
  - No itemized breakdown of services provided - unclear what lab tests were performed
  - No CPT codes listed - impossible to verify appropriate billing
  - No total billed amount shown - unable to assess if patient responsibility is proportionate

## 08-itemized-medical-bill.png

FAIL: 502 — error code: 502

## 09-asked-for-itemized-bill.jpg

- Total: $535
- Time: 15.3s
- redFlags: 10
  - Collection agency assignments totaling $371.00 suggest account was sent to collections despite insurance payments and adjustments being processed
  - Patient shows a credit balance of $27.00 (negative due amount), indicating overpayment or excessive adjustments relative to charges
  - Insurance adjustments ($190.00 total) exceed insurance payments ($0.00), suggesting charges were reduced but not fully applied or patient received refund
- lineItems: 3

## 10-help-international-student-with-1990-surgery-bill.jpeg

- Total: $6138
- Time: 16.9s
- redFlags: 6
  - Critical billing issue: Insurance denied coverage citing 'Services do not meet appropriate level of care' (code 12563), resulting in 100% patient responsibility of $1,992.77. This suggests the procedure may have been performed at hospital outpatient facility when an ambulatory surgery center (ASC) would have been appropriate and covered.
  - Facility fee burden: The facility appears to have charged $5,862 for myomectomy (CPT 58146), but insurance allowed amount is only $3,927.80 - a $1,934.20 overcharge on this single service.
  - Lack of itemization: Bill does not break down facility fees vs. professional/surgeon fees; does not detail specific supplies, implants, or anesthesia costs separately.
- lineItems: 2

## comparison-ct-01-low.png

- Total: $1225
- Time: 0.3s
- stateCode: AZ
- redFlags: 5
  - Insurance allowed amount not disclosed on bill - unable to verify if negotiated discount ($185 adjustment) is fair
  - Contrast media ($145) charged separately; verify this is not double-billed within CPT 74177 procedure code
  - Professional fee (radiologist interpretation, CPT 74177-26) fully written off ($185 adjustment) while facility fee retains higher patient responsibility - asymmetric adjustment suggests possible in-network vs out-of-network split billing
- lineItems: 3

## comparison-ct-02-mid.png

- Total: $2200
- Time: 0.3s
- stateCode: AZ
- redFlags: 5
  - Contrast media injection ($325) and drug administration ($135) are billed separately; these services are typically bundled into CPT 74177 and should not be separate line items
  - No CPT codes provided for contrast injection or drug administration; difficult to verify medical necessity or appropriateness
  - Facility charge ($1,495) represents 68% of total billed; CT abdomen/pelvis with contrast typically ranges $800-$1,200 at freestanding imaging centers
- lineItems: 4

## comparison-ct-03-high.png

- Total: $5930
- Time: 0.4s
- stateCode: AZ
- redFlags: 8
  - Hospital facility fee of $3,895.00 represents 65.7% of total billed charges; this is exceptionally high and indicates hospital outpatient markup
  - Billed amount of $5,930.00 is 104.6% above insurance allowed amount of $2,895.00, suggesting significant facility upcharge vs freestanding imaging center rates
  - Contrast media charged at $625.00, which is marked up substantially above typical pharmaceutical cost; no generic alternative documented
- lineItems: 6

