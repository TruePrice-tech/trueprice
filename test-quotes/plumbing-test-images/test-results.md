# Plumbing Test Results

Run: 2026-04-07 16:52:57
Endpoint: https://truepricehq.com/api/plumbing-estimate
Samples tested: 13

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +6)

**Parse success:** 12/13
**Detected price:** 6/13

## 01-did-i-get-ripped-off.jpeg

FAIL: 413 — Request Entity Too Large

FUNCTION_PAYLOAD_TOO_LARGE

iad1::q4js4-1775595009243-48b7522f7161


## 02-contractor-says-1800-to-move-water-supply-into-the.jpeg

- Total: $None
- Time: 9.4s
- redFlags: 6
  - No pricing information visible in image - this appears to be a photo of in-progress plumbing work, not a quote
  - No total price, labor rate, or itemized costs provided
  - Material is specified as PEX but no warranty information disclosed

## 03-did-i-get-a-i-dont-want-to-do-this-quote.jpeg

- Total: $None
- Time: 7.7s
- redFlags: 8
  - This is a photograph of under-sink plumbing, not a plumbing quote or estimate
  - No pricing information visible in the image
  - No contractor information or quote details present

## 04-is-this-normal.jpeg

- Total: $None
- Time: 16.8s
- redFlags: 7
  - No pricing information visible in the image - cannot determine cost of repairs
  - No warranty terms mentioned for repairs or parts
  - No labor rate disclosed

## 05-plumber-has-refused-to-quote-to-fix-this-shower-ta.jpeg

- Total: $None
- Time: 6.5s
- redFlags: 6
  - No pricing information visible in image - only a product photo with ON/OFF valve labels
  - No quote document, estimate, or pricing details provided
  - Cannot assess labor rate, parts cost, or total price

## 06-help-me-understand-the-invoicenote-from-a-plumber.jpeg

- Total: $482.8
- Time: 7.5s
- stateCode: IN
- redFlags: 8
  - Labor cost ($568.00) exceeds total invoice amount ($482.80), indicating calculation discrepancy or invoice error
  - Handwritten notes are difficult to read and lack clarity on exact work performed
  - No hourly labor rate disclosed despite significant labor charge
- lineItems: 1

## 07-my-water-bill-in-the-past-few-months-has-doubled-f.jpg

- Total: $None
- Time: 6.1s
- redFlags: 6
  - This is a photograph of a concrete pipe or septic system component, not a plumbing quote or estimate document
  - No pricing information visible
  - No labor rates, materials costs, or service details provided

## 08-4-plumber-quotes---2-say-abs-2-say-pvc--why.jpeg

- Total: $None
- Time: 11.0s
- redFlags: 7
  - Image shows cast iron sewer pipe with visible deterioration and corrosion - patching cast iron is a temporary fix, full replacement recommended
  - No pricing information visible in the image - unable to evaluate cost
  - No warranty information provided

## 09-is-she-right-is-this-an-absurd-quote.jpg

- Total: $2000
- Time: 6.6s
- redFlags: 7
  - No labor rate disclosed - cannot verify if $2,000 is reasonable
  - No itemization of parts versus labor costs
  - No permit requirements mentioned - gas line work typically requires permits and inspection
- lineItems: 1

## 10-is-this-estimate-crazy-or-am-i.jpeg

- Total: $6950
- Time: 9.0s
- redFlags: 7
  - No hourly labor rate disclosed - cannot verify labor cost reasonableness
  - Labor and parts costs not itemized or separated - no transparency on cost breakdown
  - No warranty mentioned for parts (Bradford White tank) or labor
- lineItems: 7

## comparison-wh-01-low.png

- Total: $1380
- Time: 7.3s
- stateCode: CA
- redFlags: 3
  - Labor warranty is only 30 days, which is relatively short for a water heater installation; most reputable plumbers offer 1-year labor warranties
  - No mention of code compliance verification or inspection notation
  - Expansion tank not included (often required by code for closed-loop systems)
- lineItems: 6

## comparison-wh-02-mid.png

- Total: $2553
- Time: 8.0s
- stateCode: CA
- redFlags: 1
  - Expansion tank included but not clearly marked as required vs. optional—could indicate upsell if presented as add-on during sales process
- lineItems: 9

## comparison-wh-03-high.png

- Total: $7571
- Time: 9.1s
- stateCode: CA
- redFlags: 4
  - No specific material specification for gas line or return line piping
  - Recirculation pump system may be over-spec for typical single-family home and drives up cost by $895
  - Smart leak detection sensor appears bundled—unclear if mandatory or optional upsell
- lineItems: 8

