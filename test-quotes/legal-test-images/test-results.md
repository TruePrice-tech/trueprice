# Legal Test Results

Run: 2026-04-07 17:01:50
Endpoint: https://truepricehq.com/api/legal-fee-estimate
Samples tested: 11

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +11)

**Parse success:** 11/11
**Detected price:** 11/11

## 01-estate-planning-flat-fee.png

- Total: $1250
- Time: 0.5s
- city: Asheville
- stateCode: NC
- redFlags: 7
  - No termination clause or withdrawal provisions stated
  - No conflict of interest check mentioned
  - No expense policy or out-of-pocket cost handling defined
- lineItems: 2

## 02-hourly-retainer-litigation.png

- Total: $15000
- Time: 0.3s
- city: Charlotte
- stateCode: NC
- redFlags: 11
  - No scope of work or case description provided
  - No termination clause specified
  - No expense policy or cost allocation detailed
- lineItems: 5

## 03-contingency-personal-injury.png

- Total: $16665
- Time: 0.4s
- city: Houston
- stateCode: TX
- redFlags: 8
  - No termination clause specified
  - No communication or reporting policy defined
  - No conflict of interest check mentioned
- lineItems: 4

## 04-llc-formation-flat-fee.png

- Total: $850
- Time: 0.3s
- city: Austin
- stateCode: TX
- redFlags: 6
  - No termination clause or conditions for ending engagement
  - No conflict of interest check mentioned
  - No communication or progress reporting policy defined
- lineItems: 8

## 05-divorce-hourly-retainer.png

- Total: $7500
- Time: 0.3s
- city: Atlanta
- stateCode: GA
- redFlags: 6
  - Billing increment not specified (could default to 6-min, 10-min, or 15-min)
  - No expense policy disclosed (travel, court costs, filing fees not addressed)
  - Broad fee range ($8,000–$25,000) provides limited cost predictability
- lineItems: 4

## 06-criminal-defense-flat-fee.png

- Total: $3500
- Time: 0.3s
- city: Mobile
- stateCode: AL
- redFlags: 10
  - Non-refundable flat fee ('earned upon receipt') may conflict with Alabama Rules of Professional Conduct
  - No termination clause or conditions under which client may discharge attorney
  - No communication policy or response time expectations
- lineItems: 4

## 07-real-estate-closing-flat-fee.png

- Total: $895
- Time: 0.3s
- city: Raleigh
- stateCode: NC
- redFlags: 6
  - No termination clause provided
  - No conflict-of-interest check mentioned
  - No communication policy outlined
- lineItems: 5

## 08-bankruptcy-ch7-flat-fee.png

- Total: $1495
- Time: 0.3s
- city: Phoenix
- stateCode: AZ
- redFlags: 7
  - Payment plan option B costs $1,500 total (more than flat fee of $1,495), potentially confusing to client
  - No termination clause or conditions under which fees may be refunded
  - No communication policy or response time guarantees specified
- lineItems: 4

## comparison-pi-01-firm-a-low.png

- Total: $16500
- Time: 0.6s
- city: Charlotte
- stateCode: NC
- redFlags: 7
  - No termination clause or conditions for ending representation
  - Client bears all case expenses with no firm advancement; estimated $1,200-$2,500 out-of-pocket
  - No communication policy or frequency of updates defined
- lineItems: 2

## comparison-pi-02-firm-b-mid.png

- Total: $17500
- Time: 0.3s
- city: Charlotte
- stateCode: NC
- redFlags: 8
  - No termination clause specified
  - No conflict-of-interest check documented
  - No dispute resolution mechanism for fee disagreements
- lineItems: 4

## comparison-pi-03-firm-c-high.png

- Total: $500
- Time: 0.3s
- city: Charlotte
- stateCode: NC
- redFlags: 7
  - No termination clause specified
  - No conflict of interest check mentioned
  - No communication protocol or billing dispute resolution process defined
- lineItems: 4

