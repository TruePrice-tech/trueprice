# Moving Test Results

Run: 2026-04-07 14:53:14
Endpoint: https://truepricehq.com/api/moving-estimate
Samples tested: 8

**Counter at start:** 3876
**Counter at end:** 3883
**Counter delta:** +7 (expected +7)

**Parse success:** 8/8
**Detected price:** 7/8

## 01-atlanta-dc-3k-estimate.jpeg

- Total: $3070.58
- Time: 7.3s
- redFlags: 7
  - No company name or USDOT number provided — cannot verify legitimacy of carrier
  - No pickup or delivery cities/states specified — origin and destination locations are unknown
  - Quote explicitly states 'current price is a only a quote' and 'price is subject to change due to various circumstances' — not a binding estimate
- lineItems: 7

## 02-thoughts-on-quote.jpeg

- Total: $6563
- Time: 9.9s
- companyName: MVM
- deliveryCity: Toledo
- deliveryState: OH
- redFlags: 9
  - No USDOT number or licensing information provided
  - No cancellation policy or terms and conditions stated
  - Pickup city not specified - only origin reference is 'FTW shop'
- lineItems: 7

## 03-two-men-truck-doubled.jpg

- Total: $22715.02
- Time: 5.6s
- companyName: Two Men and a Truck
- redFlags: 8
  - No USDOT number visible on estimate
  - No specific pickup or delivery time windows provided
  - No cancellation policy or terms and conditions included
- lineItems: 2

## 04-allied-socal-denver-18k.jpeg

- Total: $17541.88
- Time: 7.4s
- companyName: Allied
- pickupCity: Denver
- pickupState: CO
- deliveryCity: Englewood
- deliveryState: CO
- redFlags: 8
  - USDOT number not visible in document
  - No specific pickup or delivery date/window provided
  - No specific pickup or delivery time windows specified
- lineItems: 8

## 05-brightside-quote.jpeg

- Total: $2030.25
- Time: 6.8s
- redFlags: 10
  - No company name provided on the estimate
  - No USDOT number visible on the quote
  - No pickup or delivery city/state information provided
- lineItems: 8

## 06-united-vs-mayflower.jpeg

- Total: $28016.08
- Time: 6.3s
- companyName: United Van Lines
- redFlags: 8
  - No USDOT number visible on estimate
  - No pickup city/state or delivery city/state specified
  - No cancellation policy provided
- lineItems: 9

## 07-mayflower-quote.jpeg

- Total: $7022.89
- Time: 7.2s
- companyName: Mayflower
- redFlags: 8
  - USDOT number not provided on quote
  - Pickup and unloading locations are redacted/obscured
  - No detailed breakdown of pricing per service component visible
- lineItems: 8

## 08-fl-md-2-kids-3-pets.jpeg

- Total: $None
- Time: 4.3s
- pickupCity: Pensacola
- pickupState: FL
- deliveryCity: Silver Spring
- deliveryState: MD
- redFlags: 10
  - This is a Google Maps route estimate, not an actual moving company quote
  - No actual pricing information provided
  - No company name or USDOT number present

