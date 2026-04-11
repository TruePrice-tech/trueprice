# Messy Real Image Test Results (Apr 11 2026)

40 real Reddit phone photos tested through the live analyzer. Tesseract.js + regex parser only.

## Summary
- **Overall: 40% (16/40)** price extracted correctly
- Clean synthetic images: ~100%
- Plumbing: 40% (4/10) -- 1 false positive removed
- HVAC: 60% (6/10) -- best performer
- Electrical: 50% (5/10)
- Roofing: 10% (1/10) -- 2 false positives removed

## Plumbing (4/10 = 40%)

| # | File | Result | Price | Notes |
|---|---|---|---|---|
| 01 | plumbing--01-did-i-get-ripped-off.jpeg | NO PRICE | - | |
| 02 | plumbing--02-contractor-says-1800-to-move-water-supply-into-the.jpeg | NO PRICE | - | Hint: $1,800 |
| 03 | plumbing--03-did-i-get-a-i-dont-want-to-do-this-quote.jpeg | REJECTED | - | Was $133,553 (false positive, now blocked by $50k plumbing cap) |
| 04 | plumbing--04-is-this-normal.jpeg | FOUND | $5,515 | |
| 05 | plumbing--05-plumber-has-refused-to-quote-to-fix-this-shower-ta.jpeg | NO PRICE | - | Image is of a tap, not an invoice |
| 06 | plumbing--06-help-me-understand-the-invoicenote-from-a-plumber.jpeg | FOUND | $581 | |
| 07 | plumbing--07-my-water-bill-in-the-past-few-months-has-doubled-f.jpg | TIMEOUT | - | Large image, OCR very slow |
| 08 | plumbing--08-4-plumber-quotes---2-say-abs-2-say-pvc--why.jpeg | TIMEOUT | - | Large image, OCR very slow |
| 09 | plumbing--09-is-she-right-is-this-an-absurd-quote.jpg | FOUND | $881 | |
| 10 | plumbing--10-is-this-estimate-crazy-or-am-i.jpeg | FOUND | $6,950 | |

## HVAC (6/10 = 60%)

| # | File | Result | Price | Notes |
|---|---|---|---|---|
| 01 | hvac--01-estimator-said-the-capacitor-would-be-700-not-incl.jpeg | NO PRICE | - | Hint: $700. Image may not be an invoice |
| 02 | hvac--02-confession-ive-been-faking-it-kind-of-and-making-3.jpeg | FOUND | $3,507 | |
| 03 | hvac--03-just-got-quoted-33k-for-ac-and-heater-in-austin-fo.jpeg | FOUND | $5,793 | Hint: $33k (multi-page, only partial visible) |
| 04 | hvac--04-is-this-reasonable.jpeg | NO PRICE | - | |
| 05 | hvac--05-tech-quoted-my-dad-9000-to-replace-their-boiler.jpeg | FOUND | $9,501 | Hint: $9,000. Ratio 1.06x -- accurate |
| 06 | hvac--06-called-for-a-tune-up-got-a-13000-quote.jpeg | NO PRICE | - | Hint: $13,000 |
| 07 | hvac--07-had-a-leak-in-the-coil-of-my-air-handler-is-this-r.jpeg | FOUND | $3,810 | |
| 08 | hvac--08-700-1200-for-a-blower-motor.jpeg | NO PRICE | - | Hint: $700 |
| 09 | hvac--09-every-quote-10-total-ive-gotten-for-a-heat-pump-in.png | FOUND | $30,150 | |
| 10 | hvac--10-8k-for-mitsubishi-mini-split-leak-detection-just-t.png | FOUND | $7,944 | Hint: $8,000. Ratio 0.99x -- very accurate |

## Electrical (5/10 = 50%)

| # | File | Result | Price | Notes |
|---|---|---|---|---|
| 01 | electrical--01-what-are-your-guys-thoughts-on-this.jpeg | NO PRICE | - | Image is of a panel, not an invoice |
| 02 | electrical--02-not-getting-quotes-to-replace-this-panel-what-is-s.jpg | FOUND | $22,000 | |
| 03 | electrical--03-my-electrician-gave-me-a-fantastic-quote-for-new-m.jpg | NO PRICE | - | Image is of work, not an invoice |
| 04 | electrical--04-nj-usapurchasing-home-with-double-taps-in-main-ele.png | NO PRICE | - | Image is of a panel, not an invoice |
| 05 | electrical--05-gave-a-quote-to-a-long-time-commercial-customer.png | NO PRICE | - | |
| 06 | electrical--06-another-contractor-beat-my-price.jpg | FOUND | $20,635 | |
| 07 | electrical--07-did-i-lowball-myself-on-this-side-job.jpeg | FOUND | $4,583 | |
| 08 | electrical--08-did-my-first-residential-job-on-my-own-panel-swaps.jpg | NO PRICE | - | |
| 09 | electrical--09-can-someone-explain-to-me-how-this-saves-you-money.jpg | FOUND | $2,023 | |
| 10 | electrical--10-as-an-electrical-estimator-ive-seen-many-ugly-pane.jpg | FOUND | $2,508 | |

## Roofing (1/10 = 10%)

| # | File | Result | Price | Notes |
|---|---|---|---|---|
| 01 | roofing--01-can-this-be-done-for-8500.png | NO PRICE | - | Hint: $8,500 |
| 02 | roofing--02-is-it-normal-for-roofers-to-remove-shingles-as-par.jpeg | NO PRICE | - | |
| 03 | roofing--03-how-over-priced-is-this-estimate-for-a-metal-roof.jpeg | REJECTED | - | Was $136,375 (false positive, now blocked by $100k roofing cap) |
| 04 | roofing--04-just-got-a-quote-for-105k-for-new-roof.png | NO PRICE | - | |
| 05 | roofing--05-does-this-quote-seem-reasonable-i-know-nothing-abo.jpeg | REJECTED | - | Was $7 (false positive, now blocked by $500 roofing min) |
| 06 | roofing--06-is-decking-gonna-be-ok.jpeg | NO PRICE | - | Image is of decking, not an invoice |
| 07 | roofing--07-2000sqft-home-roof-estimate-is-this-a-decent-price.jpg | FOUND | $10,500 | |
| 08 | roofing--08-tariffs.jpeg | NO PRICE | - | |
| 09 | roofing--09-advice---roofers-quoted-2k-to-fix-their-mistake.jpeg | NO PRICE | - | |
| 10 | roofing--10-7100-later-you-guys-were-right-this-was-the-least.jpeg | NO PRICE | - | Hint: $7,100 |
