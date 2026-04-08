# Hvac Test Results

Run: 2026-04-08 12:16:01
Endpoint: https://truepricehq.com/api/hvac-estimate
Samples tested: 16

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +9)

**Parse success:** 13/16
**Detected price:** 9/16

## 01-estimator-said-the-capacitor-would-be-700-not-incl.jpeg

SKIPPED: too_large

## 02-confession-ive-been-faking-it-kind-of-and-making-3.jpeg

FAIL: 413 — Request Entity Too Large

FUNCTION_PAYLOAD_TOO_LARGE

iad1::bnm2v-1775664896001-d74d647ab563


## 03-just-got-quoted-33k-for-ac-and-heater-in-austin-fo.jpeg

FAIL: 413 — Request Entity Too Large

FUNCTION_PAYLOAD_TOO_LARGE

iad1::nh5nd-1775664902645-70746cdc86f1


## 04-is-this-reasonable.jpeg

- Total: $610
- Time: 0.6s
- systemType: central_ac
- redFlags: 4
  - R-22 (Freon) refrigerant used - this refrigerant is being phased out and is extremely expensive; consider upgrade to R410A or R454B system
  - No warranty terms stated for any work performed
  - No labor rates or breakdown disclosed between labor and materials
- lineItems: 2

## 05-tech-quoted-my-dad-9000-to-replace-their-boiler.jpeg

- Total: $None
- Time: 0.7s
- systemType: gas_furnace
- brand: Johnny's
- redFlags: 8
  - This is an interior photograph of a boiler/furnace installation with no visible pricing information or itemized quote
  - No total price, labor costs, or equipment costs are visible or extractable from the image
  - Only visible text includes safety warnings and the installer name 'Johnny's JPH' with phone number 269-125

## 06-called-for-a-tune-up-got-a-13000-quote.jpeg

- Total: $None
- Time: 0.8s
- systemType: gas_furnace
- brand: Carrier
- redFlags: 7
  - No pricing information visible on the quote
  - No itemized scope of work provided
  - No warranty terms disclosed

## 07-had-a-leak-in-the-coil-of-my-air-handler-is-this-r.jpeg

- Total: $3810
- Time: 0.4s
- systemType: central_ac
- redFlags: 9
  - No labor cost breakdown provided - cannot verify fair labor pricing
  - Labor costs are bundled and unclear; individual task labor rates not disclosed
  - No Manual J load calculation mentioned for a system repair
- lineItems: 14

## 08-700-1200-for-a-blower-motor.jpeg

- Total: $None
- Time: 1.4s
- brand: GE
- redFlags: 6
  - This image shows only a motor nameplate label, not an HVAC system quote or estimate
  - No pricing information is visible
  - No scope of work or proposal details are present
- lineItems: 1

## 09-every-quote-10-total-ive-gotten-for-a-heat-pump-in.png

- Total: $None
- Time: 0.3s
- redFlags: 9
  - Document appears to be a comparison quote/bid sheet rather than a detailed proposal—lacks itemized labor costs and equipment specifications
  - No Manual J load calculation mentioned for system sizing
  - No permit inclusion stated
- lineItems: 9

## 10-8k-for-mitsubishi-mini-split-leak-detection-just-t.png

- Total: $7943.56
- Time: 0.6s
- redFlags: 6
  - No itemized pricing breakdown provided - cannot verify labor rates or material costs
  - Refrigerant recovery and recharge explicitly excluded from quote; additional cost will be billed separately
  - Three-day timeline for leak search only is exceptionally long and may indicate inefficient diagnostic approach
- lineItems: 5

## comparison-ac-01-low.png

- Total: $3456
- Time: 0.3s
- systemType: central_ac
- brand: Goodman
- city: Atlanta
- stateCode: GA
- redFlags: 6
  - No Manual J load calculation mentioned for the replacement - proper sizing validation not documented
  - Refrigerant lineset cost not itemized separately - unclear pricing transparency
  - Labor warranty limited to 1 year only - industry standard is typically 2-5 years
- lineItems: 8

## comparison-ac-02-mid.png

- Total: $6620
- Time: 0.3s
- systemType: central_ac
- brand: Carrier
- city: Atlanta
- stateCode: GA
- redFlags: 5
  - No Manual J load calculation mentioned for system replacement
  - Evaporator coil listed as 'recommended upgrade' rather than required—suggests potential upsell without full justification
  - IAQ package included in labor line item is not itemized or detailed
- lineItems: 8

## comparison-ac-03-high.png

- Total: $13457
- Time: 0.3s
- systemType: central_ac
- brand: Trane
- city: Atlanta
- stateCode: GA
- redFlags: 4
  - No Manual J load calculation mentioned despite being a full system upgrade with new evaporator coil
  - Home square footage not provided, making it impossible to verify proper system sizing
  - Old equipment removal/disposal not explicitly itemized
- lineItems: 9

## messy-comparison-ac-01-low.jpg

- Total: $3456
- Time: 0.2s
- systemType: central_ac
- brand: Goodman
- city: Atlanta
- stateCode: GA
- redFlags: 6
  - SEER2 rating of 14.3 is below the 2023 federal minimum of 15 SEER/13 SEER2 for new equipment
  - No Manual J load calculation mentioned for condenser replacement
  - Quote is condenser-only replacement with no mention of air handler condition or compatibility verification
- lineItems: 8

## messy-comparison-ac-02-mid.jpg

- Total: $6620
- Time: 0.3s
- systemType: central_ac
- brand: Carrier
- city: Atlanta
- stateCode: GA
- redFlags: 6
  - No Manual J load calculation mentioned - critical for proper sizing verification
  - Evaporator coil upgrade presented as 'recommended' rather than mandatory, suggesting potential upsell pressure
  - Home square footage not provided - cannot verify appropriateness of 3-ton system
- lineItems: 8

## messy-comparison-ac-03-high.jpg

- Total: $13457
- Time: 0.4s
- systemType: central_ac
- brand: Trane
- city: Atlanta
- stateCode: GA
- redFlags: 5
  - No Manual J load calculation mentioned for full system upgrade
  - Home square footage not provided, cannot verify tonnage appropriateness
  - Ductwork inspection or modification not explicitly mentioned despite full system replacement
- lineItems: 10

