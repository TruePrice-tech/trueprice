# Moving Test Quotes

Real, public moving quote screenshots sourced from Reddit (r/moving, r/Moving)
that we use as fixtures to test the moving quote analyzer end-to-end.

## How these get used

Each sample is run through the moving analyzer's "I have a quote" file-upload
path. The OCR + parser + Claude analyzer extracts line items, detects binding
language, extracts the mover name + USDOT number when present, and produces a
verdict. The results feed the unified flywheel (`cal:*` Redis aggregates),
the global quote counter (`tp:total_quotes`), and the metrics dashboard.

These are real quotes from real people and they ARE valid market data points
once the analyzer extracts them. Treating them as test data and as flywheel
contributions are not in conflict.

## Privacy

All quotes were posted publicly on Reddit by their authors as screenshots
of their own quotes. Most have customer name/address/phone redacted by the
original poster. Where the original showed any PII it has been left intact
because the poster chose to share it; where the original hid PII it stays
hidden. We never store user identity from these images and never link them
back to the original Reddit account.

If you (the original poster) want a sample removed, email
hello@woogoro.com and it will be deleted within 24 hours.

## Samples

| File | Source | What it tests |
|---|---|---|
| 01-atlanta-dc-3k-estimate.jpeg | r/moving "Atlanta to Washington DC (3K estimate)" | Long-distance, line-item extraction (3-man and 2-man crew rates, travel, fuel, equipment, free hour, tax) |
| 02-thoughts-on-quote.jpeg | r/moving "Thoughts on this quote?" | Generic quote, price extraction |
| 03-two-men-truck-doubled.jpg | r/moving "Two men and a truck $5200 to $22k" | Mover-name extraction (Two Men and a Truck), high-price flag, scope items |
| 04-allied-socal-denver-18k.jpeg | r/moving "$18K quote from Allied for SoCal -> Denver" | Allied Van Lines, full-service interstate, valuation/insurance language, binding-price detection |
| 05-brightside-quote.jpeg | r/moving "Have a quote from Brightside, is it safe?" | Less-known mover, scam-detection signal |
| 06-united-vs-mayflower.jpeg | r/moving "Feedback on Quotes - United vs Mayflower" | Multi-quote comparison, two name extractions |
| 07-mayflower-quote.jpeg | r/moving "Mayflower Quote fair?" | Mayflower mover-name extraction |

## Test runs

Each sample is tested in two phases:

1. **Path 1: I Have a Quote (file upload)** — POST the image to
   `/api/moving-estimate` and capture: detected price, line items, binding
   type, mover name, USDOT lookup result, verdict, comparison cards.

2. **Path 2: I Need an Estimate** — manually re-run the same from/to/home-size
   without the image to verify the estimate path produces a comparable benchmark
   for the same route.

Test results are logged in `test-results.md` (regenerated on each test run).
