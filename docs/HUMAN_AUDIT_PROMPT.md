# Human-Style Audit Prompt

Reusable prompt for asking Claude to walk a single vertical path end-to-end as a real user would. Designed to NOT be skippable with mechanical text assertions.

## How to invoke

Paste this into Claude with the vertical and path filled in:

> Run the HUMAN_AUDIT_PROMPT for **{vertical}** **{estimate | analyze | compare}**

Example: `Run the HUMAN_AUDIT_PROMPT for hvac analyze`

## The contract

For every path Claude audits, it MUST:

1. **Goto the URL.** Take a fullPage screenshot. Read it via the Read tool. List every interactive element visible (buttons, links, form fields, file inputs). Flag anything visually off:
   - Oversized images / mascots
   - Clipped or cut-off text
   - Wrong copy (typos, "[object Object]", `$undefined`, `NaN`, mismatched vertical names)
   - Broken layout (overlapping elements, off-canvas content)
   - Mixed messages (e.g., page says "free" but also shows price)
   - Color contrast issues / hard-to-read text

2. **Take the OBVIOUS first action a user would take.** For analyze: upload the vertical-matching fixture. For estimate: fill in plausible inputs. For compare: upload 2 vertical-matching fixtures and click the Compare button. Take a screenshot AFTER the action. Read it. Compare to step 1: did the transition feel right? Did the expected state appear? Anything weird?

3. **If a result/verdict appears: read every word of it.** Specifically:
   - Does the verdict match the input fixture? (e.g., $19,000 quote should not produce "looks low" if the local average is $15,000)
   - Are numbers in a reasonable range for the vertical?
   - Are placeholders unresolved? (undefined, NaN, $0, "Loading…", `{{templateVar}}`, ellipses-only text)
   - Does the copy address the actual fixture content or is it generic?
   - Are CTAs (Pro upsell, share, save PDF) present and visually correct?

4. **Click EVERY CTA / button / link on the result page.** For each:
   - Take a screenshot of where you ended up
   - Read the destination
   - Note: is this where a user would expect to land? Anything broken, dead, or unexpected?
   - Return to the result page (back, or re-run the upload) before the next click

5. **Try ONE unhappy-path variation:**
   - Hit back, then forward — does the state restore correctly?
   - Refresh mid-analysis — does it gracefully resume or restart?
   - Click the primary submit button twice rapidly — any double-render or duplicate state?
   - Leave a required field empty and submit — does validation fire correctly?

6. **Produce a flat findings list at the end.** For each finding:
   - **Severity**: blocker / high / medium / low / cosmetic
   - **URL**: where it happens
   - **Action**: what you did to trigger it
   - **Observed**: what you saw that didn't make sense
   - **Expected**: what should have happened

## Hard rules for the auditor (Claude)

- **DO NOT use mechanical text-assertion shortcuts.** Every screenshot must be read with the Read tool, not just regex-matched against page text.
- **DO NOT skip screenshots to save time.** Every state transition gets a fresh fullPage screenshot.
- **DO NOT batch verticals.** One path, one vertical, end-to-end, THEN move on. Per-vertical findings list.
- **DO NOT declare "PASS" without describing specifically what you saw.** "Verdict rendered correctly" is not enough — quote the actual verdict text and explain why it makes sense.
- **Budget: ~10 minutes per path.** If you finish in 2 minutes, you skipped something. The Read calls + reasoning take real time.

## Available fixtures

Located in `test/receipt/ocr-cache/fixtures/`:

| Vertical | Fixture | Real total |
|---|---|---|
| Roofing | `roofing-gaf-quote.jpeg` | $16,765.79 |
| Roofing | `roofing-scope-doc.png` | (scope-only doc) |
| HVAC | `hvac-clean-invoice.jpeg` | $610.00 |
| HVAC | `hvac-coil-quote.jpeg` | (coil quote) |
| Auto | `auto-equinox-quote.jpeg` | $586.00 |
| Auto | `auto-honda-paper-photo.jpeg` | (Honda repair) |
| Auto | `auto-paper-photo.jpeg` | (paper photo) |
| Auto | `audi-screenshot.jpg` | (Audi quote) |

For verticals without fixtures: use roofing fixture as a NEGATIVE test (must trigger hard-reject).

## URL map

| Vertical | Estimate | Analyze | Compare |
|---|---|---|---|
| roofing | /roofing-quote-analyzer.html?mode=estimator | /roofing-quote-analyzer.html | /compare-roofing-quotes.html |
| hvac | /hvac-estimate.html | /hvac-quote-analyzer.html | /compare-hvac-quotes.html |
| plumbing | /plumbing-estimate.html | /plumbing-quote-analyzer.html | /compare-plumbing-quotes.html |
| electrical | /electrical-estimate.html | /electrical-quote-analyzer.html | /compare-electrical-quotes.html |
| windows | /window-estimate.html | /window-quote-analyzer.html | /compare-windows-quotes.html |
| siding | /siding-estimate.html | /siding-quote-analyzer.html | /compare-siding-quotes.html |
| insulation | /insulation-estimate.html | /insulation-quote-analyzer.html | /compare-insulation-quotes.html |
| painting | /painting-estimate.html | /painting-quote-analyzer.html | /compare-painting-quotes.html |
| fencing | /fencing-estimate.html | /fencing-quote-analyzer.html | /compare-fencing-quotes.html |
| concrete | /concrete-estimate.html | /concrete-quote-analyzer.html | /compare-concrete-quotes.html |
| landscaping | /landscaping-estimate.html | /landscaping-quote-analyzer.html | /compare-landscaping-quotes.html |
| garage_door | /garage-door-estimate.html | /garage-door-quote-analyzer.html | /compare-garage-door-quotes.html |
| solar | /solar-estimate.html | /solar-quote-analyzer.html | /compare-solar-quotes.html |
| foundation | /foundation-estimate.html | /foundation-quote-analyzer.html | /compare-foundation-quotes.html |
| kitchen | /kitchen-estimate.html | /kitchen-quote-analyzer.html | /compare-kitchen-quotes.html |
| gutters | /gutters-estimate.html | /gutters-quote-analyzer.html | /compare-gutters-quotes.html |
| moving | /moving-estimate.html | /moving-quote-analyzer.html | /compare-moving-quotes.html |
| auto_repair | /auto-estimate.html | /auto-repair.html | /compare-auto-quotes.html |
| medical | /medical-estimate.html | /medical-bill-analyzer.html | /compare-medical-quotes.html |
| legal | /legal-estimate.html | /legal-fee-analyzer.html | /compare-legal-quotes.html |
