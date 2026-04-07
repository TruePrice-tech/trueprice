# Legal Test Results

Run: 2026-04-07 15:55:59
Endpoint: https://truepricehq.com/api/legal-fee-estimate
Samples tested: 8

**Counter at start:** 3885
**Counter at end:** 3890
**Counter delta:** +5 (expected +0)

**Parse success:** 8/8
**Detected price:** 0/8

## 01-estate-planning-flat-fee.png

- Total: $None
- Time: 7.6s
- city: Asheville
- stateCode: NC
- redFlags: 9
  - No termination clause or provisions for handling dispute resolution
  - No expense policy disclosed (costs for document filing, copies, etc. may be billed separately)
  - No estimated timeline provided for completion
- lineItems: 4

## 02-hourly-retainer-litigation.png

- Total: $None
- Time: 20.1s
- city: Charlotte
- stateCode: NC
- redFlags: 11
  - Non-contingency arrangement with explicit statement 'Fees are due regardless of outcome' - client bears full financial risk regardless of case result
  - Vague scope of services - no description of what legal services are actually included in retainer
  - No estimated total cost or scope limitations provided to client

## 03-contingency-personal-injury.png

- Total: $None
- Time: 8.3s
- city: Houston
- stateCode: TX
- redFlags: 9
  - No retainer amount specified - client unclear on upfront costs
  - Client responsible for case expenses ($4,500-$8,000 estimated) in addition to contingency fee
  - No explicit termination clause defining how attorney departure or client termination affects fee structure

## 04-llc-formation-flat-fee.png

- Total: $None
- Time: 8.9s
- city: Austin
- stateCode: TX
- redFlags: 7
  - No communication policy or response time expectations defined
  - No termination clause or refund provisions stated
  - Excluded services (multi-member operating agreement, trademark search, foreign qualification) could trigger additional $275/hr charges with no upper limit
- lineItems: 7

## 05-divorce-hourly-retainer.png

- Total: $None
- Time: 8.5s
- city: Atlanta
- stateCode: GA
- redFlags: 7
  - No billing increment specified (6-minute, 10-minute, 15-minute, etc.) - creates potential for overcharging on short tasks
  - Travel time billed at $200/hr (one-way) is unusually high and not clearly limited; no cap on travel expenses
  - Estimated fee range is very broad ($8,000-$25,000), providing minimal predictability for client
- lineItems: 4

## 06-criminal-defense-flat-fee.png

- Total: $None
- Time: 7.7s
- city: Mobile
- stateCode: AL
- redFlags: 8
  - Non-refundable flat fee with limited refund exception only as required by Alabama Rules of Professional Conduct
  - Significant out-of-pocket expenses explicitly excluded from flat fee (appeals, expert witness fees, toxicology re-test, court costs) could substantially increase client's total cost
  - No termination clause or dispute resolution mechanism specified

## 07-real-estate-closing-flat-fee.png

- Total: $None
- Time: 10.8s
- city: Raleigh
- stateCode: NC
- redFlags: 8
  - Flat fee structure with optional survey cost ($400) creates ambiguity about what triggers additional charges
  - Title insurance is estimated at $1,425 but marked 'est.' with no explanation of variables affecting final amount
  - No retainer agreement or non-refundable retainer policy mentioned despite flat fee engagement
- lineItems: 9

## 08-bankruptcy-ch7-flat-fee.png

- Total: $None
- Time: 8.5s
- city: Phoenix
- stateCode: AZ
- redFlags: 7
  - No termination clause or refund policy specified for flat fee
  - Limited scope communication regarding client rights and obligations
  - No conflict of interest check disclosure
- lineItems: 3

