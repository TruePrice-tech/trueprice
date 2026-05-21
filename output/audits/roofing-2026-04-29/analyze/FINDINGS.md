# Roofing Analyze — Audit Findings (2026-04-29)

URL: https://woogoro.com/roofing-quote-analyzer.html
Fixture: `test/receipt/ocr-cache/fixtures/roofing-gaf-quote.jpeg` ($16,765.79)
Negative fixture: `test/receipt/ocr-cache/fixtures/auto-equinox-quote.jpeg` ($585.70)

## Severity legend
- **BLOCKER** — paying users get a confidently-wrong answer or are blocked entirely
- **HIGH** — visible defect or trust hit on the happy path
- **MED** — UX rough edge but the path completes
- **LOW** — copy / polish

## Findings

### 1. HEADS UP banner showed unrelated geopolitical news at top of page — FIXED
- Severity: HIGH
- URL: site-wide
- Action: load the page
- Observed: yellow/black banner showing "Strait of Hormuz effective closure triggers coordinated US strategic oil reserve release..." at top of every vertical page
- Expected: nothing — banner adds no value for a homeowner buying a roof
- Fix: removed banner injection from `js/tp-analytics.js` + `.min.js` (commit 7cbea8d4dc). Banner JS files and `/api/pricing-events-active` are orphaned but kept for now.

### 2. Wrong-vertical hard-reject did NOT fire on auto fixture — FIXED
- Severity: BLOCKER
- URL: /roofing-quote-analyzer.html
- Action: upload `auto-equinox-quote.jpeg` (a clearly auto-only quote with control arms, ball joint, Chevy Equinox)
- Observed: page proceeded with the analyze flow, treated $585 auto quote as a roofing quote, asked for roof size, ready to produce a confidently-wrong verdict
- Expected: hard-reject screen "This is not a roofing quote — looks like an auto repair quote"
- Root cause: `js/vertical-detect.js` auto regex was missing `control arm`, `ball joint`, and vehicle make/model names. The Equinox fixture scored 0 auto keywords, so roofing's threshold (other ≥3, ≥3× current, current <2) couldn't trip.
- Fix: expanded auto regex to cover suspension parts (control arm, ball joint, tie rod, sway bar, hub, wheel hub, master cylinder, etc.) plus common vehicle makes/models (Chevrolet, Equinox, Silverado, F-150, Camry, Civic, etc.). Equinox text now scores 7 auto hits. Sanity-checked roofing fixture still detects roofing only. Commit 18cc874eee.
- Verified: re-run with fresh browser shows "This is not a Roofing quote" screen, "Detection confidence: 7 Auto Repair keywords vs 0 Roofing keywords".

### 3. Reject copy said "auto quote" instead of "auto repair quote" — FIXED
- Severity: LOW
- URL: /roofing-quote-analyzer.html (any wrong-vertical scenario)
- Action: upload auto fixture, see reject screen
- Observed: "looks like an auto quote"
- Expected: "looks like an auto repair quote" (matches the vertical's user-facing label "Auto Repair")
- Fix: added `auto`, `auto_repair`, `garage-door`, `garage_door` to VERTICAL_NOUN map in `js/wrong-vertical-guard.js` + `.min.js`. Commit d87bbb65c7.

### 4. Result-page CTAs verified working
- Severity: PASS (no defect)
- "Multiple quotes? Compare →" sub-nav link → lands on `/compare-roofing-quotes.html` with hard-hat Iris + 3 quote upload cards. Sub-nav, copy, layout all render correctly.
- "Want a free estimate first? →" sub-nav link → lands on `/roofing-quote-analyzer.html?mode=estimator` showing the address-entry form. Renders correctly.
- "Unlock Pro for $19" → opens Stripe Checkout. Shows "Woogoro LLC sandbox" badge, "Woogoro Pro Report $19.00", description "30 days of Pro access across all Woogoro verticals", 4 payment methods, working Pay button. Test mode confirmed (Day 5 of Pro tier ship plan still owed for live mode).
- "View quote side-by-side" → opens an inline panel rendering the original quote image on the left next to the analysis. Works correctly.

### 5. Decking flagged as "not found" but quote DOES address it — MED
- Severity: MED (parser nuance, not a blocker)
- URL: /roofing-quote-analyzer.html (after upload)
- Action: upload roofing-gaf-quote.jpeg
- Observed: scope checklist marks "? Decking" as "not found in your quote"
- Expected: the quote says "replace wood substrate as necessary at additional cost" — that IS a decking-replacement allowance, just not included in base price. Saying "not found" is misleading; the user thinks decking isn't mentioned at all when really it's a contingent allowance.
- Recommendation: distinguish three states — "✓ included", "△ allowance only (extra cost)", "? not found". For now, leaving as-is since the existing copy ("could add $1,425-$4,600 in change orders") still warns the user, just less precisely.

### 6. Parser misread "2014" (model year) as quote total $2,014 — DEFENSE-IN-DEPTH ONLY
- Severity: HIGH if reach happy path on cross-vertical input, but MITIGATED by hard-reject (#2). User never sees this number now.
- URL: /roofing-quote-analyzer.html
- Action: upload auto-equinox-quote.jpeg (this scenario)
- Observed: pre-fix, page showed "Quote total detected: $2,014". The fixture's actual total is $585.70. Parser picked up "2014" from "2014 Chevrolet Equinox".
- Expected: parser should not promote a 4-digit year-of-make as a dollar total when followed by a vehicle make.
- Status: not fixed in this audit. Reject screen now intercepts before parser output is shown. Logged for future parser hardening.

### 7. SEO content renders below hard-reject screen — KNOWN, QUEUED
- Severity: LOW (mixed-messaging, not trust-breaking)
- URL: /roofing-quote-analyzer.html (after wrong-vertical reject)
- Action: upload non-roofing fixture, see reject screen
- Observed: below the red rejection card, the page continues to show "What to look for in a roofing quote", "Red flags in a roofing quote", FAQ, etc.
- Expected: when reject is shown, hide vertical-specific marketing content
- Per memory: this is a known, queued issue (`feedback_vertical_functionality_sacred.md` open gap #11). Not in scope for this audit.

### 8. Estimate form embedded on analyze page — DESIGN-AS-INTENDED
- Severity: LOW (was an initial concern, but on second look it makes sense)
- URL: /roofing-quote-analyzer.html (initial state)
- Action: load page
- Observed: an "Enter your address / Get my estimate →" form appears below the upload zone on the analyze page initial state
- Initial concern: looked like the analyze page was mixing intents
- Re-evaluation: this is a fallback path for users who don't have a quote yet — still on the analyze page (sub-nav says "You are analyzing a quote") but offering estimate-by-address as an alternative. The sub-nav link "Want a free estimate first? →" goes to the same `?mode=estimator` URL. Internally consistent.

### 9. "Submitted, IN" displayed as city/state in verdict — FIXED
- Severity: HIGH (verdict copy is wrong, even though the math used a default)
- URL: /roofing-quote-analyzer.html (after upload + Re-check with empty city)
- Action: upload `roofing-gaf-quote.jpeg`, enter only roof size 2000 sqft (no address), click Re-check
- Observed: verdict said "in Submitted, IN" — e.g., "Above expected for a 2,000 sq ft roof using architectural shingles in Submitted, IN"
- Root cause: detectLocation regex matched "Submitted in writing" (from quote text "Color to be determined by owner and submitted in writing prior to commencement") as `<city>=Submitted, <state>=IN`. Submitted wasn't in bannedCities and the ZIP follow-up was optional.
- Fix: added Submitted, Sealed, Notified, Listed, Approved, Reviewed, Effective, Determined, Subject, Based, Pursuant, Owner, Buyer, Seller, Contractor, Title, Section to bannedCities + cleanCity strip-list. detectLocation now returns empty city/state for the GAF text. Commit e4b760bf75.
- Verified locally that detectLocation returns `{city: "", stateCode: ""}` on the GAF fixture text.

### 10. "No thanks" button created dead-end on hard-block screen — FIXED
- Severity: HIGH (UX dead end on the analyze path)
- URL: /roofing-quote-analyzer.html (after upload, on price-confirm hard-block screen)
- Action: upload roofing-gaf-quote.jpeg, click "No thanks"
- Observed: the soft-prompt yellow box vanished but the page still showed "Add your roof size for the price verdict — we don't fake a verdict without it" header. User had no path forward to a verdict and no clear acknowledgment of what they had.
- Root cause: renderRoofSizeAccuracyPrompt always rendered both Re-check and No thanks buttons. In the hard-block scenario (no roof size at all), dismissing leaves the same blocking message intact.
- Fix: added `hardBlock` option to renderRoofSizeAccuracyPrompt. When true (the call site that pairs with the hard-block header), the No thanks button is hidden — the only forward action is to enter address or roof size and Re-check. Commit e4b760bf75.

### 11. SEO content shows below hard-reject and below hard-block screens — KNOWN, QUEUED
(See finding #7 above. Same scope.)

## Remaining checks (running)
- Step 2 re-run: verify No thanks button is gone in the price-confirm prompt
- Step 5 re-run: verify city/state no longer says "Submitted, IN"
