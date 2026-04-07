# Moving Test Results

Run: 2026-04-07 17:05:12
Endpoint: https://truepricehq.com/api/moving-estimate
Samples tested: 8

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +7)

**Parse success:** 8/8
**Detected price:** 7/8

## 01-atlanta-dc-3k-estimate.jpeg

- Total: $3070.58
- Time: 0.8s
- redFlags: 10
  - No company name provided on the quote
  - No USDOT number visible on the quote
  - No pickup or delivery city/state information provided
- lineItems: 7

## 02-thoughts-on-quote.jpeg

- Total: $6563
- Time: 8.4s
- companyName: MVM
- pickupCity: Fort Worth
- pickupState: TX
- deliveryCity: Toledo
- deliveryState: OH
- redFlags: 10
  - No USDOT number provided for interstate move
  - No specific move date provided
  - No cancellation policy documented
- lineItems: 8

## 03-two-men-truck-doubled.jpg

- Total: $22715.02
- Time: 6.1s
- companyName: Two Men and a Truck
- redFlags: 8
  - No USDOT number present on quote
  - No pickup or delivery window/date specified
  - No cancellation policy information provided
- lineItems: 3

## 04-allied-socal-denver-18k.jpeg

- Total: $17541.88
- Time: 9.9s
- companyName: Bailey's Moving & Storage
- pickupCity: Englewood
- pickupState: CO
- redFlags: 8
  - USDOT number is missing from the quote
  - No specific pickup or delivery dates provided - only validity period through 7/15/2025
  - Destination city and state are not specified in the quote header
- lineItems: 10

## 05-brightside-quote.jpeg

- Total: $2030.25
- Time: 6.2s
- redFlags: 8
  - No company name provided on estimate
  - No USDOT number visible on quote
  - No pickup or delivery city/address information provided
- lineItems: 7

## 06-united-vs-mayflower.jpeg

- Total: $48764.54
- Time: 12.6s
- companyName: United Van Lines
- redFlags: 11
  - Document contains multiple quotes (United Van Lines and Mayflower visible). Only the first (United Van Lines) was analyzed.
  - No USDOT license number provided.
  - No pickup city, state, or delivery city/state information provided - origin and destination locations are missing.
- lineItems: 21

## 07-mayflower-quote.jpeg

- Total: $7022.89
- Time: 7.5s
- companyName: Mayflower
- redFlags: 11
  - No USDOT number provided on quote
  - Pickup address incomplete - shows only '5910 DUI' with no city or state
  - Delivery address incomplete - shows only 'TBD S' with no city or state
- lineItems: 5

## 08-fl-md-2-kids-3-pets.jpeg

- Total: $None
- Time: 4.4s
- pickupCity: Pensacola
- pickupState: FL
- deliveryCity: Silver Spring
- deliveryState: MD
- redFlags: 11
  - This appears to be a Google Maps route display, not an actual moving company quote
  - No total price provided
  - No company name identified

