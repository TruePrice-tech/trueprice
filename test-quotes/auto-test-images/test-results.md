# Auto Test Results

Run: 2026-04-07 14:39:15
Endpoint: https://truepricehq.com/api/auto-repair-estimate
Samples tested: 10

**Counter at start:** 3868
**Counter at end:** 3868
**Counter delta:** +0 (expected +0)

**Parse success:** 9/10
**Detected price:** 0/10

## 01-this-is-how-were-gonna-start-our-day-huh.jpg

- Total: $None
- Time: 6.5s
- redFlags: 6
  - This is a PRE-WORKORDER document with no pricing, labor hours, or parts breakdown provided - customer estimate is blank and not yet calculated
  - Repair description is vague ('no driveability acceleration between 115-122mph') with no diagnostic findings or root cause identified
  - No labor rate, hourly estimate, or parts costs are disclosed on this preliminary quote

## 02-to-the-pos-technician-who-quoted-this-poor-lady-a.jpg

- Total: $None
- Time: 3.7s
- redFlags: 3
  - Image shows only a disconnected electrical connector with wiring harness - no actual repair quote document or pricing information is visible
  - Cannot determine any repair details, labor costs, parts costs, or total pricing from this image
  - No shop information, vehicle details, or service description available for analysis

## 03-maybe-not-the-right-tool-for-the-job-customer-stat.jpg

- Total: $None
- Time: 3.5s

## 04-just-had-this-show-up-was-initially-quoted-2-hours.jpeg

- Total: $None
- Time: 5.0s
- redFlags: 4
  - This is not a formal quote - it appears to be a humorous meme/image showing a damaged junction box with sarcastic text. No actual pricing, labor rate, warranty terms, or professional quote details are present.
  - The caption 'Advise customer to go fuck themselves' indicates this is a joke post, not a legitimate repair estimate.
  - No shop information, contact details, vehicle details, or any professional quote documentation visible.

## 05-wrote-an-estimate-for-this-beauty-of-german-engine.jpg

- Total: $None
- Time: 2.6s

## 06-when-the-tech-is-having-a-wonderful-day.jpg

- Total: $None
- Time: 5.0s
- redFlags: 7
  - No dollar amounts provided - quote lacks pricing entirely
  - No shop name or contact information visible
  - Parts type not specified (OEM vs aftermarket)

## 07-i-dont-understand.jpeg

- Total: $None
- Time: 4.6s
- redFlags: 6
  - No pricing information provided - this appears to be a complaint/note entry screen, not a completed quote
  - No labor rate disclosed
  - No parts cost specified or parts type identified (OEM vs aftermarket)

## 08-your-hitch-install-quote-was-too-high-so-my-friend.jpeg

FAIL: 413 — Request Entity Too Large

FUNCTION_PAYLOAD_TOO_LARGE

iad1::trkwb-1775587138535-a424dc02587b


## 09-just-rolled-outta-my-driveway-stealership-quoted-o.jpg

- Total: $None
- Time: 3.0s

## 10-defrost-stopped-working-shop-want-1100-cad-to-fix.jpg

- Total: $None
- Time: 5.1s
- redFlags: 4
  - No repair quote document visible - image shows only an open vehicle hood with removed dash/interior components and a disconnected electrical connector in hand
  - Cannot determine if this is mid-repair documentation, a vehicle awaiting diagnosis, or a completed repair photo with no accompanying invoice or estimate
  - No shop name, labor rate, parts pricing, warranty terms, or any quote details present in the image

