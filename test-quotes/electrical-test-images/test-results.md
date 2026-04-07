# Electrical Test Results

Run: 2026-04-07 16:55:04
Endpoint: https://truepricehq.com/api/electrical-estimate
Samples tested: 13

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +7)

**Parse success:** 13/13
**Detected price:** 7/13

## 01-what-are-your-guys-thoughts-on-this.jpeg

- Total: $None
- Time: 5.4s
- redFlags: 7
  - This is not an electrical quote or estimate - it is a motivational quote attributed to NVIDIA CEO Jensen Huang about career opportunities in skilled trades
  - No pricing information present
  - No labor rates or service details provided

## 02-not-getting-quotes-to-replace-this-panel-what-is-s.jpg

- Total: $None
- Time: 7.3s
- redFlags: 8
  - This is a Siemens load center/breaker panel specification sheet, not an actual quote with pricing
  - No total price provided
  - No labor costs itemized

## 03-my-electrician-gave-me-a-fantastic-quote-for-new-m.jpg

- Total: $10
- Time: 6.0s
- redFlags: 8
  - Unlicensed/handyman work - described as casual text conversation, not professional quote
  - No labor rate disclosed - only fixture cost of $10 mentioned, unclear if labor is included
  - No parts itemization - fixture type and specifications not detailed
- lineItems: 1

## 04-nj-usapurchasing-home-with-double-taps-in-main-ele.png

- Total: $None
- Time: 8.1s
- redFlags: 9
  - Image shows electrical panel interior with double-tap wiring configuration highlighted - double-tapping (two breakers in one slot) is a serious code violation under NEC that creates fire and safety hazards
  - No pricing information visible in either image
  - No estimate or quote details provided - only instructional images of a problem condition

## 05-gave-a-quote-to-a-long-time-commercial-customer.png

- Total: $None
- Time: 6.3s
- redFlags: 8
  - No pricing information provided - this is not a formal estimate
  - Unlicensed electrician mentioned ('bootleg electrician') - safety and code compliance concern
  - Electrician refusing to provide line-by-line estimate as requested

## 06-another-contractor-beat-my-price.jpg

- Total: $20635
- Time: 5.1s
- redFlags: 8
  - No breakdown of labor vs. materials provided - quote lacks transparency
  - No warranty mentioned for workmanship or parts
  - No itemized line items for individual components or labor tasks

## 07-did-i-lowball-myself-on-this-side-job.jpeg

- Total: $4588.94
- Time: 16.9s
- redFlags: 7
  - No permit mentioned for panel upgrade and electrical service work - required for most jurisdictions
  - Licensed electrician status not explicitly stated
  - No warranty mentioned for workmanship or parts despite $4,588.94 total cost
- lineItems: 23

## 08-did-my-first-residential-job-on-my-own-panel-swaps.jpg

- Total: $None
- Time: 6.2s
- redFlags: 9
  - This is a photograph of an electrical panel, not a quote or estimate document
  - No pricing information visible
  - No labor rates or costs disclosed

## 09-can-someone-explain-to-me-how-this-saves-you-money.jpg

- Total: $600
- Time: 5.3s
- redFlags: 9
  - This is a government tax credit promotion, not a contractor quote - no actual pricing for the panel upgrade itself
  - No labor costs, material costs, or total installation price provided
  - No licensed electrician information disclosed
- lineItems: 1

## 10-as-an-electrical-estimator-ive-seen-many-ugly-pane.jpg

- Total: $None
- Time: 8.3s
- redFlags: 10
  - This is a photograph of deteriorated electrical infrastructure, not a quote or estimate
  - Visible knob-and-tube wiring present (cream/tan colored cloth-insulated wires) - major fire hazard and code violation
  - Extremely old fuse panel visible on left side, indicating outdated electrical system requiring replacement

## comparison-panel-01-low.png

- Total: $1660
- Time: 0.3s
- city: Spartanburg
- stateCode: SC
- redFlags: 4
  - NEC code compliance not explicitly mentioned for this major panel upgrade work
  - Cleanup and site restoration not mentioned in scope
  - Warranty is limited to 1 year; parts warranty duration not specified separately
- lineItems: 7

## comparison-panel-02-mid.png

- Total: $3425
- Time: 0.3s
- city: Spartanburg
- stateCode: SC
- redFlags: 4
  - Four line items ($245, $185, $295) lack description - unclear what materials are included
  - Wire gauge/type not specified for service upgrade work
  - NEC code compliance not explicitly mentioned for a major panel upgrade
- lineItems: 10

## comparison-panel-03-high.png

- Total: $8798
- Time: 0.3s
- city: Boiling Springs
- stateCode: SC
- redFlags: 5
  - NEC code compliance not explicitly mentioned despite major panel upgrade work
  - Span smart panel system listed as 'optional' but included in quote at $1,895 - unclear if customer actually wants this premium feature
  - Labor cost breakdown shows 3 electricians for 16 hours but no explanation for why 3 technicians are necessary for this scope
- lineItems: 9

