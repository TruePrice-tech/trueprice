# Hvac Test Results

Run: 2026-04-07 16:50:04
Endpoint: https://truepricehq.com/api/hvac-estimate
Samples tested: 10

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +3)

**Parse success:** 7/10
**Detected price:** 3/10

## 01-estimator-said-the-capacitor-would-be-700-not-incl.jpeg

SKIPPED: too_large

## 02-confession-ive-been-faking-it-kind-of-and-making-3.jpeg

FAIL: 413 — Request Entity Too Large

FUNCTION_PAYLOAD_TOO_LARGE

iad1::srtdn-1775594890307-1f9b72af85f4


## 03-just-got-quoted-33k-for-ac-and-heater-in-austin-fo.jpeg

FAIL: 413 — Request Entity Too Large

FUNCTION_PAYLOAD_TOO_LARGE

iad1::kz9gn-1775594901400-09cd969ef47e


## 04-is-this-reasonable.jpeg

- Total: $610
- Time: 8.2s
- systemType: central_ac
- redFlags: 4
  - R-22 (Freon) refrigerant used - this refrigerant is being phased out and is extremely expensive; consider upgrade to R410A or R454B system
  - No warranty terms stated for any work performed
  - No labor rates or breakdown disclosed between labor and materials
- lineItems: 2

## 05-tech-quoted-my-dad-9000-to-replace-their-boiler.jpeg

- Total: $None
- Time: 7.0s
- systemType: gas_furnace
- brand: Johnny's
- redFlags: 8
  - This is an interior photograph of a boiler/furnace installation with no visible pricing information or itemized quote
  - No total price, labor costs, or equipment costs are visible or extractable from the image
  - Only visible text includes safety warnings and the installer name 'Johnny's JPH' with phone number 269-125

## 06-called-for-a-tune-up-got-a-13000-quote.jpeg

- Total: $None
- Time: 8.5s
- systemType: gas_furnace
- brand: Carrier
- redFlags: 7
  - No pricing information visible on the quote
  - No itemized scope of work provided
  - No warranty terms disclosed

## 07-had-a-leak-in-the-coil-of-my-air-handler-is-this-r.jpeg

- Total: $3810
- Time: 10.8s
- systemType: central_ac
- redFlags: 9
  - No labor cost breakdown provided - cannot verify fair labor pricing
  - Labor costs are bundled and unclear; individual task labor rates not disclosed
  - No Manual J load calculation mentioned for a system repair
- lineItems: 14

## 08-700-1200-for-a-blower-motor.jpeg

- Total: $None
- Time: 9.8s
- brand: GE
- redFlags: 6
  - This image shows only a motor nameplate label, not an HVAC system quote or estimate
  - No pricing information is visible
  - No scope of work or proposal details are present
- lineItems: 1

## 09-every-quote-10-total-ive-gotten-for-a-heat-pump-in.png

- Total: $None
- Time: 8.3s
- redFlags: 9
  - Document appears to be a comparison quote/bid sheet rather than a detailed proposal—lacks itemized labor costs and equipment specifications
  - No Manual J load calculation mentioned for system sizing
  - No permit inclusion stated
- lineItems: 9

## 10-8k-for-mitsubishi-mini-split-leak-detection-just-t.png

- Total: $7943.56
- Time: 9.4s
- redFlags: 6
  - No itemized pricing breakdown provided - cannot verify labor rates or material costs
  - Refrigerant recovery and recharge explicitly excluded from quote; additional cost will be billed separately
  - Three-day timeline for leak search only is exceptionally long and may indicate inefficient diagnostic approach
- lineItems: 5

