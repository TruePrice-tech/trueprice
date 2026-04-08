# Auto Test Results

Run: 2026-04-08 12:13:16
Endpoint: https://truepricehq.com/api/auto-repair-estimate
Samples tested: 16

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +8)

**Parse success:** 15/16
**Detected price:** 8/16

## 01-to-the-pos-technician-who-quoted-this-poor-lady-a.jpg

- Total: $None
- Time: 1.1s

## 02-just-had-this-show-up-was-initially-quoted-2-hours.jpeg

- Total: $None
- Time: 0.8s

## 03-wrote-an-estimate-for-this-beauty-of-german-engine.jpg

- Total: $None
- Time: 0.3s

## 04-your-hitch-install-quote-was-too-high-so-my-friend.jpeg

FAIL: 413 — Request Entity Too Large

FUNCTION_PAYLOAD_TOO_LARGE

iad1::htn24-1775664745561-4a8be62ff345


## 05-just-rolled-outta-my-driveway-stealership-quoted-o.jpg

- Total: $None
- Time: 0.6s

## 06-defrost-stopped-working-shop-want-1100-cad-to-fix.jpg

- Total: $None
- Time: 0.7s

## 07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg

- Total: $232.39
- Time: 1.2s
- redFlags: 7
  - Parts are not itemized - $324.08 in parts listed without identifying specific components or part names, making it impossible to verify necessity or pricing
  - Parts type not specified - no indication whether parts are OEM, aftermarket, or remanufactured
  - $120.00 miscellaneous charge lacks description - vague category without breakdown of what services or materials are included

## 08-cs-3-honda-dealerships-quoted-a-new-cylinder-block.jpg

- Total: $None
- Time: 0.3s
- redFlags: 3
  - Image shows only engine/spark plug in focus with blurred background - no actual quote document or pricing information is visible
  - Unable to extract any pricing data, shop name, vehicle information, or repair details from the provided image
  - This appears to be a generic mechanic shop photo, not a repair quote

## 09-am-i-crazy-or-is-this-quote.jpg

- Total: $5557.45
- Time: 0.3s
- redFlags: 8
  - No labor rate disclosed - impossible to verify if labor is overpriced
  - No labor hours listed per repair - cannot assess whether quoted work is reasonable
  - Parts type not specified (OEM vs aftermarket) - Audi OEM parts at dealer typically cost 20-40% more than aftermarket alternatives

## 10-top-two-pictures-are-from-our-estimate-2-months-ag.jpeg

- Total: $None
- Time: 0.5s
- stateCode: WI
- redFlags: 7
  - Images show vehicle damage/collision repairs but NO written quote with itemized repairs, labor rates, parts costs, or total price is visible - cannot verify legitimacy of any estimate
  - Multiple photos of the same vehicle (bumper, full front view, undercarriage damage) suggest collision damage, yet no repair line items, labor breakdown, or parts list is provided
  - Wisconsin license plate visible but no shop name, address, phone, or formal quote header - appears to be informal documentation only

## comparison-brake-01-shop-a-low.png

- Total: $327.6
- Time: 0.3s
- city: Charlotte
- stateCode: NC
- redFlags: 2
  - Warranty duration specified as 24,000 miles/24 months, but no clarity on whether this covers only parts, labor, or both under all conditions
  - Shop supplies charged at 3% ($9.20) with no itemization of what these supplies entail

## comparison-brake-02-shop-b-mid.png

- Total: $633
- Time: 0.3s
- city: Charlotte
- stateCode: NC
- redFlags: 4
  - Brake fluid flush marked 'recommended' but not clearly justified - adds $89 to estimate and may be unnecessary without fluid condition assessment
  - Shop supplies fee of $24.50 (3.9% of subtotal) is reasonable but no breakdown provided on what constitutes 'shop supplies'
  - Warranty stated as '12 month / 12,000 mile' but no distinction between parts warranty vs. labor warranty duration

## comparison-brake-03-shop-c-high.png

- Total: $1031.6
- Time: 0.3s
- city: Charlotte
- stateCode: NC
- redFlags: 4
  - Labor hours not itemized per repair component - 2.4 hours quoted as lump sum for entire brake service (pads, rotors, fluid, hardware); typical front brake pad/rotor replacement is 1.0-1.5 hours, suggesting possible labor padding
  - Brake fluid replacement appears as line item but not clearly stated as flush or full system replacement; scope of fluid service unclear
  - No warranty duration specified for parts or labor despite Honda factory warranty mentioned (warranty refers to manufacturer coverage, not dealership service warranty)

## messy-comparison-brake-01-shop-a-low.jpg

- Total: $327.6
- Time: 0.2s
- city: Charlotte
- stateCode: NC
- redFlags: 3
  - Warranty duration stated as '24,000 mile / 24 month' but no clarity on coverage scope (parts only vs. parts and labor)
  - Shop supplies fee of 3% ($9.20) is reasonable, but no itemization of what supplies are included
  - No mention of old brake fluid inspection or whether brake fluid flush is recommended despite brake system work

## messy-comparison-brake-02-shop-b-mid.jpg

- Total: $633
- Time: 0.2s
- city: Charlotte
- stateCode: NC
- redFlags: 4
  - Brake fluid flush marked as 'recommended' rather than required -- appears to be an upsell that increases total by $89 (14% of parts cost) and should only be performed if brake fluid condition warrants it
  - Warranty terms stated as '12 month/12,000 mile' but unclear whether this applies to parts only or includes labor; typical independent shops offer 12-month/12,000-mile on parts and 30-90 days on labor
  - Shop supplies charged at $24.50 (4.3% of subtotal) with no breakdown of what supplies are included

## messy-comparison-brake-03-shop-c-high.jpg

- Total: $1031.6
- Time: 0.3s
- city: Charlotte
- stateCode: NC
- redFlags: 4
  - Labor hours not itemized per repair - all 2.4 hours lumped into front brake service with no breakdown between pad replacement, rotor replacement, and hardware installation
  - Brake fluid replacement ($42) appears added without explicit justification - quote states 'per inspection findings' for brake service but does not clarify if fluid was contaminated or merely recommended preventatively
  - Fluid disposal fee not separately itemized - unclear if old brake fluid disposal is included in labor or shop supplies charge

