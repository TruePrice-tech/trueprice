# Medical Test Quotes

Real public quote/bill screenshots scraped from Reddit for end-to-end testing of the medical analyzer.

These are run through the live `/api/medical-bill-estimate` endpoint to verify OCR + parser accuracy and to feed the unified calibration flywheel.

All quotes were posted publicly on Reddit by their authors. PII visible in originals (customer names, phones, addresses) is left as-is when the original poster published it that way; where it was redacted in the original, it stays redacted. If you (the original poster) want a sample removed, email hello@woogoro.com.

## Fixture curation (2026-04-20)

The set was pruned from 10 fixtures to 5 after a human review. The 5 dropped fixtures were:
- **01** — patient-portal dashboard with only claim-row totals, no services or CPT codes
- **03** — not present on disk (manifest entry was orphaned)
- **06** — social-media meme collage with a bear sticker overlay, not a parseable bill
- **07** — mobile-app screenshot with the service description blacked out by the poster
- **09** — not present on disk (manifest entry was orphaned)

Each remaining fixture now has a `groundTruth` block in `manifest.json` so the test harness can score parser accuracy against known values rather than just counting non-null extractions.

## Samples

- **02-2000-hospital-bill-for-a-10-minute-visit-to-er-the.jpeg** — Real ER bill, CPT 99283, $3,737 charges, $1,725 balance. ([source](https://reddit.com/r/MedicalBill/comments/1k6b49r/2000_hospital_bill_for_a_10_minute_visit_to_er/))
- **04-need-advice-doctor-trying-to-double-bill-for-the-s.jpeg** — Itemized X-ray + office-visit bill, CPTs 72050/72080/72114/99205/99244, $988 encounter total. ([source](https://reddit.com/r/MedicalBill/comments/1m96gf0/need_advice_doctor_trying_to_double_bill_for_the/))
- **05-just-got-the-bill-doctor-waited-to-send-stuff-unti.jpeg** — Surgery EOB, CPTs 30520/30140/30465/20912, $11,250 billed, $3,100 patient responsibility. ([source](https://reddit.com/r/HealthInsurance/comments/1qej9m0/just_got_the_bill_doctor_waited_to_send_stuff/))
- **08-outrageous-surprise-2300-bill-for-in-office-ultras.jpg** — Ultrasound EOB, CPTs 58340/76831, $2,725 billed, $2,326.94 patient balance. ([source](https://reddit.com/r/MedicalBill/comments/stcwy6/outrageous_surprise_2300_bill_for_in_office/))
- **10-what-a-9-day-hospital-stay-costs-for-an-infected-g.jpeg** — Blue Card PPO 11-claim aggregate summary, $121,348.72 billed, $1,097.23 patient paid. Edge case: summary view, not a single itemized bill. ([source](https://reddit.com/r/HealthInsurance/comments/1ly6mbb/what_a_9_day_hospital_stay_costs_for_an_infected/))
