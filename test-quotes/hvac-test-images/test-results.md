# Hvac Test Results

Run: 2026-04-07 14:41:08
Endpoint: https://truepricehq.com/api/hvac-estimate
Samples tested: 10

**Counter at start:** 3868
**Counter at end:** None
**Counter delta:** +None (expected +1)

**Parse success:** 7/10
**Detected price:** 1/10

## 01-new-ac-installed-by-landlord-intake-might-be-too-s.jpeg

- Total: $None
- Time: 4.9s
- redFlags: 3
  - Image shows only ceiling exhaust vent and light fixture with a chocolate box - no actual HVAC quote document visible
  - Cannot extract pricing, equipment specifications, or scope details from photograph
  - No quote documentation present - image appears to be of a residential ceiling/vent installation only

## 02-estimator-said-the-capacitor-would-be-700-not-incl.jpeg

SKIPPED: too_large

## 03-confession-ive-been-faking-it-kind-of-and-making-3.jpeg

FAIL: 413 — Request Entity Too Large

FUNCTION_PAYLOAD_TOO_LARGE

iad1::htpgn-1775587189613-a48d3cd173c4


## 04-just-got-quoted-33k-for-ac-and-heater-in-austin-fo.jpeg

FAIL: 413 — Request Entity Too Large

FUNCTION_PAYLOAD_TOO_LARGE

iad1::zpwkj-1775587193579-a733b39449f8


## 05-i-mean-ya-cant-make-this-stuff-up.jpeg

- Total: $None
- Time: 6.1s
- systemType: full_system
- stateCode: WV
- redFlags: 7
  - No pricing information provided - advertisement only, not a formal quote
  - No equipment specifications (brand, model, SEER/AFUE ratings) listed
  - No warranty terms disclosed

## 06-brilliant-or-stupid-installing-a-water-hose-bypass.jpeg

- Total: $None
- Time: 6.2s
- redFlags: 4
  - Image shows only the evaporator coil and valve assembly - no actual equipment quote or pricing information is visible
  - Yellow warning label visible but quote/estimate document is not readable in this image
  - No pricing, system specifications, or itemization can be extracted from the photograph

## 07-furnace-is-not-field-reparable.jpeg

- Total: $None
- Time: 6.4s
- redFlags: 6
  - Image shows only an air filter (20x24x1), not an HVAC quote or estimate
  - No pricing information visible
  - No equipment specifications provided

## 08-race-to-the-bottom.jpeg

- Total: $3800
- Time: 15.9s
- systemType: mini_split
- brand: Alpine Blue Ridge
- redFlags: 5
  - No warranty terms disclosed (parts or labor duration)
  - No itemized scope of work - unclear what installation labor includes (line set, electrical, drain line, pad installation, etc.)
  - No permit or inspection mentioned for equipment installation
- lineItems: 2

## 09-filters-get-dirty-in-a-week-since-getting-new-hvac.jpg

- Total: $None
- Time: 4.9s
- redFlags: 3
  - This image shows fabric/textile samples with ETL compliance labels, not an HVAC quote. No pricing, equipment specifications, or system details are visible.
  - The handwritten 'Sept 9 2023' label suggests these are material samples dated to that period, not a quote document.
  - No contractor information, customer details, system specifications, or financial terms can be extracted from this image.

## 10-it-happened-to-my-mom.png

- Total: $None
- Time: 6.4s
- redFlags: 6
  - This is not a quote or estimate—it is a complaint/threat email from a customer accusing the company of unethical practices post-acquisition by private equity
  - No pricing information, equipment specifications, or scope of work provided
  - Email contains serious allegations including fraudulent sales tactics ('water softener grifting game'), predatory practices under private equity ownership, and unsolicited upselling

