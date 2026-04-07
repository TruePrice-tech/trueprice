# Auto Test Results

Run: 2026-04-07 16:47:21
Endpoint: https://truepricehq.com/api/auto-repair-estimate
Samples tested: 10

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +2)

**Parse success:** 9/10
**Detected price:** 2/10

## 01-to-the-pos-technician-who-quoted-this-poor-lady-a.jpg

- Total: $None
- Time: 4.5s

## 02-just-had-this-show-up-was-initially-quoted-2-hours.jpeg

- Total: $None
- Time: 6.7s

## 03-wrote-an-estimate-for-this-beauty-of-german-engine.jpg

- Total: $None
- Time: 3.7s

## 04-your-hitch-install-quote-was-too-high-so-my-friend.jpeg

FAIL: 413 — Request Entity Too Large

FUNCTION_PAYLOAD_TOO_LARGE

iad1::858hb-1775594762844-a355833e3cb5


## 05-just-rolled-outta-my-driveway-stealership-quoted-o.jpg

- Total: $None
- Time: 5.7s

## 06-defrost-stopped-working-shop-want-1100-cad-to-fix.jpg

- Total: $None
- Time: 4.1s

## 07-our-estimate-was-just-under-4900-this-is-just-ridi.jpeg

- Total: $232.39
- Time: 12.1s
- redFlags: 7
  - Parts are not itemized - $324.08 in parts listed without identifying specific components or part names, making it impossible to verify necessity or pricing
  - Parts type not specified - no indication whether parts are OEM, aftermarket, or remanufactured
  - $120.00 miscellaneous charge lacks description - vague category without breakdown of what services or materials are included

## 08-cs-3-honda-dealerships-quoted-a-new-cylinder-block.jpg

- Total: $None
- Time: 4.1s
- redFlags: 3
  - Image shows only engine/spark plug in focus with blurred background - no actual quote document or pricing information is visible
  - Unable to extract any pricing data, shop name, vehicle information, or repair details from the provided image
  - This appears to be a generic mechanic shop photo, not a repair quote

## 09-am-i-crazy-or-is-this-quote.jpg

- Total: $5557.45
- Time: 11.9s
- redFlags: 8
  - No labor rate disclosed - impossible to verify if labor is overpriced
  - No labor hours listed per repair - cannot assess whether quoted work is reasonable
  - Parts type not specified (OEM vs aftermarket) - Audi OEM parts at dealer typically cost 20-40% more than aftermarket alternatives

## 10-top-two-pictures-are-from-our-estimate-2-months-ag.jpeg

- Total: $None
- Time: 7.2s
- stateCode: WI
- redFlags: 7
  - Images show vehicle damage/collision repairs but NO written quote with itemized repairs, labor rates, parts costs, or total price is visible - cannot verify legitimacy of any estimate
  - Multiple photos of the same vehicle (bumper, full front view, undercarriage damage) suggest collision damage, yet no repair line items, labor breakdown, or parts list is provided
  - Wisconsin license plate visible but no shop name, address, phone, or formal quote header - appears to be informal documentation only

