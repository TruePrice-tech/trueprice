# Plumbing Test Results

Run: 2026-04-07 14:43:39
Endpoint: https://truepricehq.com/api/plumbing-estimate
Samples tested: 10

**Counter at start:** 3869
**Counter at end:** 3870
**Counter delta:** +1 (expected +1)

**Parse success:** 5/10
**Detected price:** 1/10

## 01-did-i-get-ripped-off.jpeg

FAIL: None — <urlopen error [WinError 10054] An existing connection was forcibly closed by the remote host>

## 02-is-my-house-ruined-do-i-have-any-other-choice.jpeg

FAIL: None — <urlopen error [WinError 10054] An existing connection was forcibly closed by the remote host>

## 03-contractor-says-1800-to-move-water-supply-into-the.jpeg

FAIL: None — <urlopen error [WinError 10054] An existing connection was forcibly closed by the remote host>

## 04-am-i-overreacting.jpeg

- Total: $None
- Time: 8.6s
- redFlags: 7
  - No quote document visible - image shows only installation/equipment, not pricing
  - No labor rate disclosed
  - No warranty information visible

## 05-did-i-get-a-i-dont-want-to-do-this-quote.jpeg

- Total: $None
- Time: 5.6s
- redFlags: 7
  - No quote or pricing document visible - image shows only under-sink plumbing installation with no associated estimate
  - No job type specified - cannot determine scope of work from image alone
  - No material specifications visible for the plumbing components

## 06-is-this-normal.jpeg

FAIL: None — <urlopen error [WinError 10054] An existing connection was forcibly closed by the remote host>

## 07-advice-on-best-method-to-remove-this-blockage-from.jpeg

FAIL: None — <urlopen error [WinError 10054] An existing connection was forcibly closed by the remote host>

## 08-plumber-has-refused-to-quote-to-fix-this-shower-ta.jpeg

- Total: $None
- Time: 4.5s
- redFlags: 6
  - No pricing information visible in the image - only a photograph of a faucet valve with yellow annotations marking 'ON' and 'OFF' positions
  - No actual quote document present - this appears to be an instructional or diagnostic photo rather than a formal estimate
  - No labor rate, parts cost, or total price disclosed

## 09-attack-of-the-midnight-plumbers.jpeg

- Total: $None
- Time: 6.8s
- redFlags: 10
  - No total price provided - this is a text explanation of work performed, not a formal quote
  - No itemized breakdown of labor costs, parts costs, or total charges
  - No labor rate disclosed (hourly or flat rate)

## 10-help-me-understand-the-invoicenote-from-a-plumber.jpeg

- Total: $982.8
- Time: 6.9s
- stateCode: IN
- redFlags: 8
  - Labor rate not disclosed - only total labor cost shown without hourly breakdown
  - Parts cost not itemized - no detail on materials charged
  - Handwritten invoice with limited legibility and detail
- lineItems: 1

