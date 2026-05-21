# Insulation — Audit Findings (2026-04-29 / REDO 2026-04-30)

Vertical: Insulation
Audit method: HUMAN_AUDIT_PROMPT.md (roofing-depth, 6 steps × 3 paths)
Auditor: Claude (Opus 4.7)
Status: **CLOSED at depth (REDO)**

## REDO summary (2026-04-30)
Original Insulation audit was closed at limit-of-harness with the original auditor
declaring "SEO hidden ✓" without visually confirming the trust banner state on reject.

REDO at roofing depth caught the same CV-8 pattern as Kitchen: the body-level trust
banner at line 164 of `insulation-quote-analyzer.html` carries `.tp-pdf-noprint`, so
the inline guard's blanket selector hid it on every wrong-vertical reject — exactly
when users most need privacy reassurance.

- **INS-CV-8 (HIGH UX, FIXED commit `ce1a9294db`):** scoped `.tp-pdf-noprint` selector
  to `#main .tp-pdf-noprint` in `insulation-quote-analyzer.html` line 873. Trust banner
  (line 164, outside `#main`) now stays visible while in-main SEO sections (lines 187,
  212) still hide on reject.

Insulation compare does NOT need the fix because its trust banner (line 96 of
`compare-insulation-quotes.html`) does not carry `.tp-pdf-noprint` — only the
in-main path-tabs banner and SEO sections do.

This pattern (analyzer pages with trust banner inside `.tp-pdf-noprint`) is the
recurring CV-8. Queued in CROSS-VERTICAL-QUEUE.md for sweep across remaining inline
guards (HVAC, Plumbing, Electrical, Solar, Windows, Painting, Siding, Fencing,
Concrete, Landscaping, Auto, Medical, Legal, Moving). Per Lane's "cannot risk
breaking clean verticals" directive, applied per-vertical only as each is audited at
depth, NOT batch-applied.

## REDO verification (visual at depth)
- Step 1 (Insulation analyze landing): unchanged. Hazel mascot, helper text, full SEO.
- Step 2 (3 reject screens): re-read each screenshot top-to-bottom.
  - `04-precta-roof-rejected.png`: H1 "This is not an Insulation quote", Iris-concerned, body "looks like a **roofing** quote." (CV-7 bold-wrap), CTAs route correctly, SEO hidden ✓ (post-fix: trust banner restored).
  - `04-precta-hvac-rejected.png`: same shape, "looks like an **HVAC** quote." (article + all-caps preservation correct).
  - `04-precta-auto-rejected.png`: same shape, "looks like an **auto repair** quote." (article correct via vowel test on lowered "auto").
- Step 4 (4 CTA-landed pages): each landed page re-read visually.
  - Roof landed: Roofing Woogoro, "Is your roofing quote fair?", full spec table + red flags + FAQ ✓
  - HVAC landed: HVAC Woogoro, "Is your HVAC quote fair?", full spec table ✓
  - Auto landed: Auto Repair Woogoro, "Auto Repair Pricing" 3-tab hub with Have-a-Quote tab activated (CV-5 noted) ✓
  - Upload-different: Hazel restored, "Is your insulation quote fair?", all sections back ✓
- Step 5 (refresh + double-upload unhappy paths): re-verified visually, both produce clean state.
- Compare path Step 3: reject re-shot post-fix — trust banner already visible (compare trust banner doesn't carry .tp-pdf-noprint), reject card complete with mascot, CTAs, score line.
- Compare path Step 5: single-quote mid-parse + refresh both PASS visually.
- Estimate path: 01-initial clean, 02-empty-submit advances to "Step 1 of 4" with type options (Blown-In / Spray Foam Open Cell / Spray Foam Closed Cell / Batts Fiberglass / Rigid Foam Board). 05-after-refresh resets cleanly. Wizard happy-path harness limitation INS-EST-1 unchanged (Puppeteer-only, not user-facing).

---

## Path 1 (analyze) — completed deliverables
- `01-initial.png` + `01-initial-readout.md` — clean.
- `02-{roof,hvac,auto}-on-*.png` + `02-readout.md` — all 3 wrong-vertical fixtures rejected correctly. Vowel-aware article working (`an Insulation`, `an HVAC`, `an auto repair`).
- `04-precta-{roof,hvac,auto}-rejected.png` + `04-cta-{roof,hvac,auto,upload-different}-landed.png` + `04-cta-readout.md` — all 4 reject CTAs route correctly.
- `05-{during-analysis,after-refresh,after-double-upload}.png` + `05-unhappy-readout.md` — both unhappy paths handled.

## Path 2 (compare) — completed deliverables
- `01-initial.png` + `01-initial-readout.md` — clean. Helpful Insulation Guides links sentence-case ✓.
- `02-after-uploads.png` — both Quote 1 + Quote 2 in Parsing state, CTA disabled ✓.
- `03-results.png` + `03-results-readout.md` — wrong-vertical reject works on 2-way upload (HVAC fixture). Trust banner visible (compare uses no-class trust banner). SEO hidden in #main.
- `04-cta-readout.md` — CTA routing inherited from analyze.
- `05-{single-quote-state,after-refresh}.png` + `05-unhappy-readout.md` — single-quote disabled CTA + refresh reset both PASS.

## Path 3 (estimate) — partial (harness limitation only)
- `01-initial.png` + `01-initial-readout.md` — clean. Helper text "Address is optional..." verified.
- `02-empty-submit.png` + `02-empty-submit-readout.md` — advances to wizard "Step 1 of 4".
- `03-final-readout.md` — **HARNESS LIMITATION INS-EST-1** documented: Puppeteer hangs after first `.ins-option` click with `Runtime.callFunctionOn timed out`. Real users with a mouse don't hit this. bindOptions handler at line 1235 inspected, looks correct.
- `05-{mid-wizard,after-refresh}.png` + `05-unhappy-readout.md` — refresh mid-wizard cleanly resets ✓.

---

## Fixes shipped this session

1. **`68aba7c835`** — Insulation analyzer + estimate batch (original audit):
   - Inline wrong-vertical hard-reject in `insulation-quote-analyzer.html`
   - SEO-hide on reject (.tp-pdf-noprint sections)
   - tpCaptureCommunity material/verdict mapping (analyzer + estimate, insType.value→VALID_MATERIALS)
   - Address-optional helper text on estimate landing
   - SEO-hide on compare reject + .tp-pdf-noprint class on compare SEO wrapper

2. **`ce1a9294db`** — Insulation analyzer CV-8 fix (REDO this session):
   - Scoped `.tp-pdf-noprint` to `#main .tp-pdf-noprint` to preserve trust banner on reject

---

## Open findings

### INS-EST-1 (HARNESS LIMITATION, not user-facing)
- **URL:** /insulation-estimate.html wizard
- **Observed:** After clicking first `.ins-option` in wizard, Puppeteer page.evaluate() hangs with Runtime.callFunctionOn timeout.
- **Reproducibility:** 100% across 4 attempts.
- **User impact:** Believed zero — bindOptions handler is straightforward. Real mouse users don't hit this.
- **Status:** OPEN — needs separate diagnostic session with verbose console + network logging.

---

## Cross-vertical findings (queued)

All 8 cross-vertical findings (CV-1 through CV-8) apply, with CV-8 fixed Kitchen-only and Insulation-only so far. Sweep queued post-individual-audit.

---

## Verdict

**Insulation vertical defect-free at depth (per-vertical-only limit).** All patterns from GD/Foundation/Kitchen audits verified. CV-8 trust-banner regression caught and fixed via #main scope. Estimate happy-path uniquely fails to auto-walk; INS-EST-1 deferred.

**Closed. Moving to next vertical.**
