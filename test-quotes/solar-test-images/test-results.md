# Solar Test Results

Run: 2026-04-08 12:19:45
Endpoint: https://truepricehq.com/api/solar-estimate
Samples tested: 16

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +12)

**Parse success:** 16/16
**Detected price:** 12/16

## 01-first-bill-with-solar-not-too-bad.jpg

- Total: $None
- Time: 0.6s
- stateCode: CA
- redFlags: 8
  - This is a PG&E utility bill statement, not a solar installation quote
  - No solar equipment pricing information present
  - No system size, panel specifications, or equipment details provided

## 02-17-calls-i-quoted-four-places-for-solar-sunrun-was.jpg

- Total: $None
- Time: 0.4s
- redFlags: 8
  - No quote details visible - only phone call history from Sunrun shown
  - No pricing information provided
  - No system specifications disclosed

## 03-power-bill-is-ridiculous-talk-me-out-of-a-solar-le.jpeg

- Total: $28160
- Time: 0.4s
- redFlags: 8
  - Lease structure means customer does not own the panels after 25 years
  - No warranty information provided for panels, inverter, or workmanship
  - No mention of permits, interconnection, or net metering application

## 04-how-does-my-solar-quote-look-thx-in-advance-nc-duk.jpg

- Total: $31993
- Time: 0.3s
- redFlags: 6
  - No building/electrical permit explicitly mentioned
  - No roof structural assessment documented for rooftop installation
  - Labor costs not itemized or disclosed separately from equipment
- lineItems: 2

## 05-has-any-seen-huge-differences-in-solar-panel-quote.png

- Total: $51938.41
- Time: 1.0s
- city: San Diego
- stateCode: CA
- redFlags: 10
  - No roof structural assessment disclosed despite rooftop installation
  - No building/electrical permit costs itemized or mentioned
  - No warranty terms (panel, inverter, or workmanship) provided in quote
- lineItems: 7

## 06-17600kw-system-with-2-powerwalls-98k-central-flori.png

- Total: $98324.5
- Time: 0.8s
- redFlags: 11
  - This is a lease agreement (Sunnova Easy Own Plan), not a purchase—customer does not own the panels or battery
  - Cost per watt of $5.58 is significantly above market rate (typical range $2.50-$4.00 for full systems)
  - No roof structural assessment documented despite rooftop solar installation
- lineItems: 1

## 07-is-this-a-good-or-bad-solar-quote-im-from-wisconsi.jpeg

- Total: $None
- Time: 0.3s
- redFlags: 13
  - No pricing information visible - this appears to be a 3D visual mockup only, not an actual quote
  - No system size (kW) specified
  - No panel brand, model, or count specified

## 08-a-quote-from-alibabacom-for-solar-panels.jpeg

- Total: $1779.82
- Time: 0.4s
- stateCode: FL
- redFlags: 10
  - This is a wholesale/materials-only quote with no inverter specified
  - No inverter included or specified - critical component missing for functional system
  - No installation labor quoted (only crating/shipping labor)
- lineItems: 3

## 09-just-getting-started-heres-my-first-quote-after-pe.jpg

- Total: $67028.58
- Time: 0.4s
- stateCode: WA
- redFlags: 12
  - Cost per watt of $4.93 is above the $4.00 threshold—significantly higher than typical market rates of $2.50–$3.50/watt
  - No panel brand, model, or specifications disclosed
  - No inverter type or brand specified

## 10-am-i-getting-ripped-off.jpeg

- Total: $None
- Time: 1.4s
- redFlags: 12
  - This is a Sunnova Power Purchase Agreement (PPA), not a purchase quote - customer does not own the solar system
  - No system size in kilowatts disclosed
  - No panel brand, model, or specifications provided
- lineItems: 4

## comparison-solar-01-low.png

- Total: $14940
- Time: 0.3s
- city: Las Vegas
- stateCode: NV
- redFlags: 7
  - No hourly labor rate disclosed; only total labor cost provided
  - No roof structural assessment mentioned despite rooftop installation
  - No estimated annual energy production or offset percentage provided
- lineItems: 6

## comparison-solar-02-mid.png

- Total: $19250
- Time: 0.3s
- city: Las Vegas
- stateCode: NV
- redFlags: 8
  - No roof structural assessment explicitly mentioned despite labor scope including 'structural'
  - No installation timeline provided
  - Labor rate not itemized or transparent (appears bundled)
- lineItems: 7

## comparison-solar-03-high.png

- Total: $32770
- Time: 0.3s
- city: Las Vegas
- stateCode: NV
- redFlags: 7
  - Cost per watt is exactly at the upper threshold of normal ($4.10/watt), driven by premium SunPower panels and Tesla Powerwall; verify this is competitive for your region
  - No roof condition assessment documented; structural engineering is mentioned but specific findings not detailed
  - No estimated annual production or offset percentage provided; customer cannot verify production guarantees
- lineItems: 8

## messy-comparison-solar-01-low.jpg

- Total: $14940
- Time: 0.3s
- city: Las Vegas
- stateCode: NV
- redFlags: 7
  - No roof structural assessment mentioned despite rooftop installation
  - No installation timeline provided
  - No workmanship/labor warranty specified
- lineItems: 6

## messy-comparison-solar-02-mid.jpg

- Total: $19250
- Time: 0.2s
- city: Las Vegas
- stateCode: NV
- redFlags: 6
  - No roof structural assessment mentioned despite roof installation scope
  - No workmanship or installation warranty term specified
  - Installation timeline not provided
- lineItems: 7

## messy-comparison-solar-03-high.jpg

- Total: $32770
- Time: 0.3s
- city: Las Vegas
- stateCode: NV
- redFlags: 8
  - Cost per watt at $4.10 is at the high end of market range; premium brand positioning (SunPower + Tesla) justifies this, but worth comparing to non-premium alternatives
  - No roof condition assessment mentioned despite premium racking and roof attachment costs
  - Inverter type not clearly specified in quote; unclear if AC inverter brand/model detailed
- lineItems: 8

