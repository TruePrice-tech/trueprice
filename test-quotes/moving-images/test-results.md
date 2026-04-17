# Moving Test Results

Run: 2026-04-08 12:26:01
Endpoint: https://woogoro.com/api/moving-estimate
Samples tested: 14

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +13)

**Parse success:** 14/14
**Detected price:** 13/14

## 01-atlanta-dc-3k-estimate.jpeg

- Total: $3070.58
- Time: 9.9s
- redFlags: 10
  - No company name provided — mover identity cannot be verified
  - No USDOT number visible — cannot verify legal licensing for interstate commerce
  - No inventory list or home size specified — cannot assess reasonableness of crew size and hours
- lineItems: 6

## 02-thoughts-on-quote.jpeg

- Total: $6563
- Time: 11.0s
- companyName: MVM
- pickupCity: Fort Worth
- pickupState: TX
- deliveryCity: Toledo
- deliveryState: OH
- redFlags: 8
  - No USDOT number provided for a long-distance interstate move (TX to OH)
  - Line item totals ($6,632.99) exceed stated grand total ($6,563.00) by $69.99 — discrepancy not explained
  - Moving supplies listed twice with different amounts ($100 and $389.99) — unclear which applies or if both are included
- lineItems: 8

## 03-two-men-truck-doubled.jpg

- Total: $22715.02
- Time: 8.3s
- companyName: Two Men and a Truck
- redFlags: 8
  - Unusually high flat fee of $22,640.02 for a 2,751 lb residential move — this appears extremely expensive and warrants immediate clarification on what is included
  - No USDOT number or carrier license information provided
  - No pickup or delivery windows specified — dates and times are missing
- lineItems: 2

## 04-allied-socal-denver-18k.jpeg

- Total: $17541.88
- Time: 11.5s
- companyName: Bailey's Moving & Storage
- pickupCity: Englewood
- pickupState: CO
- redFlags: 7
  - USDOT registration number is missing from the quote — unable to verify the carrier is legally licensed to operate interstate.
  - Destination city and state are not provided, making it impossible to independently verify the distance or assess price reasonableness.
  - No pickup or delivery date windows are specified — timing uncertainty could result in rush fees or storage charges.
- lineItems: 10

## 05-brightside-quote.jpeg

- Total: $2030.25
- Time: 10.6s
- companyName: Relorstinn Notaile
- redFlags: 9
  - USDOT number is missing from the quote — verify carrier legitimacy at FMCSA.dot.gov
  - No pickup or delivery city/state provided; impossible to verify the 899-mile estimate or assess reasonableness
  - Large discount applied (57.58% off tariff) and additional manager discount (-$600) without clear explanation of how discounts were earned
- lineItems: 8

## 06-united-vs-mayflower.jpeg

- Total: $48764.54
- Time: 16.0s
- companyName: United Van Lines
- redFlags: 9
  - Document contains multiple quotes (United Van Lines and Mayflower visible side-by-side). Only the first (United Van Lines at $48,764.54) was analyzed — upload each quote separately for individual analysis.
  - No USDOT number provided for the carrier, which is required by federal law for interstate moves.
  - No pickup city/state or delivery city/state information visible in the extracted text — move origin and destination cannot be verified.
- lineItems: 23

## 07-mayflower-quote.jpeg

- Total: $7022.89
- Time: 10.2s
- companyName: Mayflower
- redFlags: 8
  - No USDOT license number provided on this binding estimate.
  - Pickup city/state not clearly specified—address shows '5910 DUI' which appears incomplete or corrupted.
  - Delivery destination shows only 'TBD S' with no city name, making final destination unclear.
- lineItems: 5

## 08-fl-md-2-kids-3-pets.jpeg

- Total: $None
- Time: 6.4s
- pickupCity: Pensacola
- pickupState: FL
- deliveryCity: Silver Spring
- deliveryState: MD
- redFlags: 9
  - No total price displayed in this document — this appears to be a route/distance estimate only, not a binding quote
  - No company name or mover identified
  - No USDOT number present

## comparison-move-high.png

- Total: $4040
- Time: 0.3s
- companyName: White Glove Relocation Services
- pickupCity: Smyrna
- pickupState: GA
- deliveryCity: Marietta
- deliveryState: GA
- redFlags: 6
  - No cancellation policy or penalty terms disclosed.
  - No specific pickup or delivery window provided.
  - Inventory list not included in quote.
- lineItems: 7

## comparison-move-low.png

- Total: $990
- Time: 0.3s
- companyName: ATL DISCOUNT MOVERS
- pickupCity: Smyrna
- pickupState: GA
- deliveryCity: Marietta
- deliveryState: GA
- redFlags: 7
  - USDOT number not provided — this is a required disclosure for licensed movers in most states.
  - Non-binding hourly estimate — final cost could be significantly higher if move takes longer than 6 hours.
  - No pickup or delivery window specified — customer has no guaranteed time slot.
- lineItems: 4

## comparison-move-mid.png

- Total: $1860
- Time: 0.3s
- companyName: Peach State Movers
- pickupCity: Smyrna
- pickupState: GA
- deliveryCity: Marietta
- deliveryState: GA
- redFlags: 6
  - Non-binding estimate with ±10% variance language — final bill could reach $2,046
  - No pickup or delivery time windows specified
  - No cancellation policy or terms stated
- lineItems: 5

## messy-comparison-move-high.jpg

- Total: $4040
- Time: 0.3s
- companyName: White Glove Relocation Services
- pickupCity: Smyrna
- pickupState: GA
- deliveryCity: Marietta
- deliveryState: GA
- redFlags: 7
  - Line items sum to $3,940 but total shown is $4,040 — $100 discrepancy not explained (possible tax or additional fee not itemized).
  - No cancellation policy or terms and conditions mentioned.
  - No pickup or delivery time windows specified.
- lineItems: 8

## messy-comparison-move-low.jpg

- Total: $990
- Time: 0.2s
- companyName: ATL DISCOUNT MOVERS
- pickupCity: Smyrna
- pickupState: GA
- deliveryCity: Marietta
- deliveryState: GA
- redFlags: 5
  - USDOT number not provided — verify the company is properly licensed and insured before booking.
  - Non-binding hourly estimate — final cost could exceed $990 based on actual time spent; customer has no price protection.
  - Released-value valuation only ($0.60/lb) provides minimal coverage; customer should consider purchasing full-value insurance.
- lineItems: 4

## messy-comparison-move-mid.jpg

- Total: $1860
- Time: 0.2s
- companyName: Peach State Movers
- pickupCity: Smyrna
- pickupState: GA
- deliveryCity: Marietta
- deliveryState: GA
- redFlags: 6
  - Fuel surcharge amount is not clearly itemized in the subtotal—appears to be missing a dollar value.
  - Non-binding estimate with 10% variance clause means final bill could reach $2,046.
  - No cancellation policy, pickup window, or delivery window specified.
- lineItems: 6

