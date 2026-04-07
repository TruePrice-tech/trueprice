# Solar Test Results

Run: 2026-04-07 14:46:55
Endpoint: https://truepricehq.com/api/solar-estimate
Samples tested: 10

**Counter at start:** 3872
**Counter at end:** 3874
**Counter delta:** +2 (expected +2)

**Parse success:** 8/10
**Detected price:** 2/10

## 01-solar-overtakes-and-wind-nuclear-as-the-number-one.jpeg

- Total: $None
- Time: 5.2s
- redFlags: 7
  - This is not a solar panel installation quote - it is a chart showing historical and projected global clean power generation sources from 1985-2025
  - No pricing information available
  - No system specifications provided

## 02-parents-signed-up-for-solar-in-pa.jpg

- Total: $132664.66
- Time: 8.7s
- redFlags: 11
  - Cost per watt of $6.83 is significantly above market average ($2.50-$4.00), suggesting overpricing or inclusion of undisclosed services
  - No equipment breakdown provided - panel brand, model, inverter type, and specifications completely absent
  - No labor rate or installation cost itemization disclosed

## 03-first-bill-with-solar-not-too-bad.jpg

- Total: $None
- Time: 5.9s
- redFlags: 8
  - This is NOT a solar quote - this is a PG&E energy bill statement showing a credit balance of -$318.95 with no payment due
  - Document shows Net Energy Metering (NEM2) account summary, not an installation quote or estimate
  - No solar system specifications, pricing, equipment details, or installation scope provided

## 04-thinking-of-buying-10kw-solar-from-china.jpeg

- Total: $4875
- Time: 11.8s
- stateCode: MX
- redFlags: 10
  - No installation labor costs included - quote only covers materials and international shipping
  - No mention of building or electrical permits for grid interconnection
  - No roof structural assessment documented despite roof mounting installation
- lineItems: 8

## 05-giant-solar-farm-in-china.png

SKIPPED: too_large

## 06-virginian-balcony-solar.png

- Total: $None
- Time: 5.3s
- redFlags: 9
  - No pricing information visible in image
  - No equipment specifications or brands identified
  - No system size (kW) stated

## 07-41kw-flat-roof-system.jpg

- Total: $None
- Time: 6.3s
- redFlags: 12
  - No pricing information visible in the image
  - No system size specifications provided
  - No panel brand, model, or count details

## 08-over-panelling-captures-more-power-than-you-might.jpeg

FAIL: None — <urlopen error [WinError 10054] An existing connection was forcibly closed by the remote host>

## 09-17-calls-i-quoted-four-places-for-solar-sunrun-was.jpg

- Total: $None
- Time: 4.8s
- redFlags: 8
  - This is a phone call history, not a solar panel installation quote
  - No pricing information available
  - No system specifications provided

## 10-100th-duck-curve-day-marks-new-england-solar-power.jpeg

- Total: $None
- Time: 4.9s
- redFlags: 7
  - This is not a solar panel installation quote - it is a grid demand analysis chart showing BTM (Behind-the-Meter) PV performance data for November 25
  - No pricing information provided
  - No equipment specifications provided

