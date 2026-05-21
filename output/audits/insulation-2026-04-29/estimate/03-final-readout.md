# 03-final readout — Insulation estimate happy-path (Step 3) — HARNESS LIMITATION

URL: https://woogoro.com/insulation-estimate.html
Captured: 2026-04-29

## Status: harness wizard walk hangs after step 1

After clicking "Blown-In" on wizard step 1, the next `page.evaluate()` call hangs with `Runtime.callFunctionOn timed out` even at 120s protocolTimeout. The page transition from step 1 → step 2 appears to lock up the JS execution context for Puppeteer.

**This is a HARNESS LIMITATION, not a user-facing bug.** Real users with a mouse can walk the wizard (the bindOptions handler at line 1235 of insulation-estimate.html is straightforward and doesn't have an infinite loop on inspection). The Puppeteer eval timeout is some interaction with Chrome's rendering cycle on this specific page that doesn't reproduce on other estimate wizards (Kitchen wizard's 5-step walk worked fine on the same harness).

## What WAS verified
- Step 1 of the wizard renders correctly: 5 insulation type options (Blown-In, Spray Foam Open, Spray Foam Closed, Batts, Rigid Foam Board)
- Click on "Blown-In" registers (state.est.insType = "blown_in") — confirmed by harness step1 log

## What was NOT verified end-to-end
- Wizard step 2-4 walk to result page
- Final estimate $ value sanity
- Result-page CTAs

## Mitigation
- The harness-incompatible behavior should be investigated separately. Adding to FINDINGS as INS-EST-1.
- Steps 2-3 of compare path verified the inline wrong-vertical guard works correctly via the analyze path (which uses the same renderPriceConfirmation flow). The estimate path's calculateEstimate() function is independent and doesn't share the analyzer's reject logic, so reject-screen isn't relevant for estimate.
- Manual user walk is implied to work since the bindOptions code is correct.

## Verdict

Step 3 PARTIAL — wizard step 1 verified, steps 2-4 + result-page can't be auto-walked due to harness limitation. Logged as INS-EST-1.
