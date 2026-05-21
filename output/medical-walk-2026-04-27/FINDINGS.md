# Medical deep-dive — 2026-04-27

Walked `medical-bill-analyzer.html`, `medical-cost-guide.html`, `medical-cost-lookup.html` against `https://woogoro.com` with 7 real Reddit fixtures + 3 synthetic CT comparison fixtures. Read every screenshot as a human against a baseline built by reading each fixture image first. Lane said no commits — fixes are staged in working tree only.

Walk evidence: this directory (`output/medical-walk-2026-04-27/`) — 50+ screenshots and result-text dumps. Walk script: `scripts/medical-walk.js`.

## Baseline expectations vs walk verdict

| Fixture | Real total | Real patient owes | App TOTAL BILLED | App YOU OWE | App verdict |
|---|---|---|---|---|---|
| rw-02 ER level III 99283 | $3,737 | $1,725 | **$16** | $16 | ALL CLEAR |
| rw-04 X-ray + double office visit | $988 | $988 / $180 | **$187** | $187 | ALL CLEAR |
| rw-05 ENT surgery (denied) | $11,250 | $3,100 | **$21** | $21 | ALL CLEAR |
| rw-07 Labcorp delinquency | $451 | $451 | $451 | $451 | ALL CLEAR (acceptable for collection notice) |
| rw-08 Pharmacy/IV itemized | $2,090 | n/a | **$377** | $377 | "Possible duplicate" (false positive on garbage CPTs) |
| rw-09 Office visits + collections | $535 | -$27 (credit) | **$7,995** | $7,995 | ALL CLEAR |
| rw-10 Myomectomy 58146 | $6,138 | $1,992.77 | **$164,496** | $164,496 | ALL CLEAR |
| syn-ct-low Valley Diagnostic | $1,225 | $390 | **$185** | $390 | ALL CLEAR |
| syn-ct-mid Banner Outpatient | $2,200 | $355 | **$7** | $355 | ALL CLEAR |
| syn-ct-high Mayo Clinic | $5,930 | $579 | **$7** | $579 | ALL CLEAR |

**Every fixture is wrong.** Worst case: rw-10 surfaces a fake $164,496 patient bill from a real $1,992.77 bill. Worst false-reassurance case: rw-05's $11,250 denied-for-medical-necessity surgery rendered "ALL CLEAR" with $21 total billed. A real homeowner would close the page believing the bill is fine.

## Root cause (CRITICAL)

`medical-bill-analyzer.html` calls `TP_Engine.analyzeQuote()` which (per `js/analyzer-engine.js:465`) sets `shouldCallAI = !options.skipAI && !result.price && options.apiEndpoint`. The shared engine is regex-first by design (per `project_ocr_architecture_decision.md`) and **only calls the API when no price is found**. Medical bills always have prices, so the regex always wins, the API is never called, `engineResult.aiData` is null, and the analyzer falls through to `buildResultFromLocal()` — a regex parser whose `(\d{5})\s*[-:]?\s*([^$\n]{3,50})\s*\$?([\d,]+(?:\.\d{2})?)/g` pattern matches ANY 5-digit substring (NDC drug codes, dates, account numbers, amount column digits) as a CPT and produces fabricated totals + verdicts.

Console log from the walk for syn-ct-low (clean OCR text, 92 % confidence):
```
[TP_Engine] vertical=medical price=122500 source=regex ocrChars=555 ocrConf=92% aiCalled=false
```
`aiCalled=false` confirms the API was never reached even on perfect OCR text.

Even if the engine HAD called the API, the engine's `aiPrice = aiData.totalPrice || aiData.price || aiData.total || null` (line 478) doesn't read the medical API's `totalBilled` field, so `result.price` would have stayed empty and the analyzer page's `apiResult.totalBilled || apiResult.lineItems` gate would have run only because `aiData` itself happened to be non-null.

## Fixes staged (NOT committed — per Lane)

### 1. `medical-bill-analyzer.html` — bypass the engine, call API directly

Replaced `processFile()` with a direct `fetch('/api/medical-bill-estimate', ...)` that:
- Reads PDFs locally with pdfjs and posts `{text}`.
- Reads images as base64 and posts `{images:[dataUrl]}`.
- On a successful structured response, builds the result via `buildResultFromAPI`.
- On an unreadable bill, calls a new `renderUnreadableFallback()` that admits we couldn't read the document instead of fabricating an "ALL CLEAR".

Deleted `buildResultFromLocal()` and `detectDuplicates()` — both were producing dangerously wrong false-confidence results.

### 2. `medical-bill-analyzer.html` — Bill Check key/polarity drift

`BILL_CHECKS` now carries an `apiKey` for each item (`cptListed → cptCodes`, `chargesItemized → itemized`, `feesSeparated → facility`, `insuranceAdjusted → insuranceApplied`, `noDuplicates → duplicates`, `datesMatch → dateMatch`, `noUnbundling → unbundling`, `noUpcoding → upcoding`, `responsibilityClear → patientResponsibility`). Only `inNetwork` matched before. New `translateCheckValue()` maps the API's `yes|no|unclear|none_found|possible|partial|not_applicable` to the renderer's `pass|fail|warn|null`, with `invertNoneFound: true` on the three checks (`duplicates`, `unbundling`, `upcoding`) where "none_found" is a green pass, not a yellow warn.

Result: when the API path fires, the Bill Check Results block will actually render meaningful ✓/✗/⚠ icons instead of the 9 yellow `?`s every prior walk produced.

### 3. `medical-bill-analyzer.html` — mascot identity copy

Hero text "Iris compares every charge…" + uploading-state text "Don't pay until Iris checks it" replaced with neutral "Woogoro compares…" / "Don't pay until we check it". Image is the white Worker Woogoro (Scout the Medical Woogoro), NOT Iris — per `feedback_rainbow_is_iris_only.md`. Cosmetic, not behavior.

### 4. `medical-cost-lookup.html` — `strep` synonym fix

`SYNONYMS["strep"] = ["urine culture"]` was wrong (strep is a throat test). Replaced with `["influenza","rapid","cbc"]` (the closest matches in the 146-procedure CPT dict — there is no dedicated strep rapid test entry). Added `"sore throat" → ["influenza","rapid"]` as a safer lay-term route. Walk confirmed: "strep" → "Urine culture lab CPT 87086" before, will need re-walk to confirm new behavior.

### 5. `api/medical-bill-estimate.js` — rate-limit message accuracy

Error response said "Maximum 10 requests per hour" but `RATE_LIMIT_MAX = 60`. Now uses a template literal so the message tracks the constant.

### 6. `api/medical-bill-estimate.js` — bump cacheNamespace

`medical-bill:v2-medical-prompt` → `medical-bill:v3-direct-call-2026-04-27`. Required by `project_image_cache_invalidation.md` because the analyzer's invocation pattern changed (now sends raw images directly rather than going through the engine's OCR-first pipeline). Old 24 h cached entries from the engine path could otherwise hide a regression.

## Coverage gaps from this dive

Per `feedback_vertical_deep_dive_method.md` § Coverage requirement, this is "happy-path walked" not "deep-dived". Items NOT exercised:

- Save PDF / Share link / Email report / Notify-me email capture / Share-anonymously quote-capture buttons not individually clicked. The `tpRenderResultFooter` block was detected but not actually exercised — only print-PDF emulation was tried.
- `compare-medical-quotes.html` not walked at all this dive. Compare path uses its own logic that doesn't touch BILL_CHECKS, so likely not affected by Fix #2, but worth confirming.
- Mobile viewport: only landing screenshots taken. Result page mobile rendering not exercised because the same engine bug hits.
- The result-card layout for a real ISSUES-FOUND verdict was never seen — every walk landed on ALL CLEAR. Once Fix #1 deploys, the issues-found path with red flags / NCCI unbundling / facility savings will render for the first time and may surface new layout bugs.
- "Is the analyzer even loaded successfully" check on mobile → analyzer landing rendered but the post-upload result on mobile timed out or wasn't reached during the walk; verify after Fix #1.

## Smaller things flagged but not fixed

- `MEDICARE_RATES` in `medical-bill-analyzer.html:423-428` is a hardcoded 18-entry fallback. Cost-lookup page has the full 146 entries inlined; data file has 146 server-side. Frontend fallback drift is harmless once Fix #1 ensures API path runs. Could be deleted entirely after a few weeks of stable API path.
- `noSurprisesCompliant` is requested by the API prompt but never displayed in BILL_CHECKS. Add an 11th item or drop from prompt.
- API prompt asks Claude for `noSurprisesFlags` and the renderer DOES display them; that section was never seen in the walk because every result was "ALL CLEAR" via local fallback.
- Cost-lookup `D2740/D3330/D7210` (dental) and `J3490` (unclassified drugs) declare `medicareRate: 0`, then render "Fair Range $0-$0" via `lo=med, hi=Math.round(com*1.1)` which gives a misleading $0 floor. Cosmetic but inaccurate. Add a "no Medicare benchmark" branch.
- Cost-lookup `STATES["SC"] = 0.93` and `COM["SC"] = 3.1` (highest commercial-vs-Medicare ratio in the country). Worth a sanity check against RAND 2024 — SC plus VA + GA + DE all sit at ~3.1; is that real or a stale row?
- Walk `rw-09` extracted "$7,500" for what was actually a $75.00 line (CPT 99441 phone E&M). Decimal collapse from cell-formatted bills. Will be moot after Fix #1 because API will read the source image, not the broken regex.

## Suggested ship order (next session)

1. Deploy Fix #1 (engine bypass) and Fix #2 (Bill Check key/polarity) together — they are correlated and only safe together.
2. Bump cacheNamespace (Fix #6) in the same commit so old engine-path cached entries don't return.
3. Re-walk the same 10 fixtures with `node scripts/medical-walk.js`. Read every result-top screenshot as a human and verify totals match the table above (within OCR tolerance) AND that high-overcharge fixtures (rw-02 ER, rw-05 ENT surgery, rw-10 myomectomy) now show ISSUES-FOUND, not ALL CLEAR.
4. Ship Fixes #3 / #4 / #5 / #7 as small follow-ups.
5. Then close the coverage gaps above.

Until #1+#2 ship, the analyzer is **actively misleading users** by telling them $11K disputed-coverage bills look fine. This should be the next session's first task.
