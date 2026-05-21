# Foundation — Audit Findings (2026-04-29)

Vertical: Foundation
Audit method: HUMAN_AUDIT_PROMPT.md (roofing-depth, 6 steps × 3 paths)
Auditor: Claude (Opus 4.7)
Status: **CLOSED to per-vertical limit**

---

## Severity legend
- **BLOCKER** — billable path is wrong / would lose user trust
- **HIGH** — cosmetic but customer-visible on happy/reject path
- **MOD** — non-customer-visible or low-traffic
- **LOW** — polish / cross-vertical chore

---

## Path 1 (analyze) — completed deliverables
- `01-initial.png` + `01-initial-readout.md` — clean. 10 spec cells, 7 red flags, 7 hidden costs, 5 FAQ, JSON-LD schema all verified from source HTML.
- `02-{roof,hvac,auto}-on-*.png` + `02-readout.md` — all 3 wrong-vertical fixtures correctly rejected. Iris-concerned mascot, H1 "This is not a Foundation quote", body-label sentence-case (or all-caps preserved for HVAC), CTAs route correctly, score line accurate.
- `04-cta-{roof,hvac,auto,upload-different}-landed.png` + `04-cta-readout.md` — all 4 reject CTAs route correctly.
- `05-{during-analysis,after-refresh,after-double-upload}.png` + `05-unhappy-readout.md` — refresh during analysis cleanly resets; double-upload handled gracefully.

## Path 1 fixes shipped this session
- **F-INLINE-1 (BLOCKER-prevention):** Added inline wrong-vertical hard-reject in `foundation-quote-analyzer.html` (commit `9dc2548803`). Runs BEFORE `renderPriceConfirmation` to bypass the shared price-confirm.js high-confidence short-circuit (CV-6 in cross-vertical queue). Same pattern as GD inline guard.
- **F-SEO-HIDE (LOW):** Inline guard also hides `.tp-pdf-noprint` SEO sections on reject so user isn't distracted by foundation marketing after wrong-vertical upload.
- **F-COMMUNITY-1 (MOD):** Fixed `tpCaptureCommunity` call (commit `f5741e88e4`). Was reading `r.systemType` (typo, no such key) and falling through to `r.material` (undefined for foundation result), sending material="" → API mapped to "unknown" — flywheel got no repair-type granularity. Now reads `r.repairType.value`, maps `pier_installation` → `pier`, gates to known API VALID_MATERIALS (pier, slabjacking, wall_stabilization), skips drainage_correction + crack_repair (not in API enum).

## Path 1 known gaps
- **Step 3 happy-path verdict reading:** NOT TESTED. No real foundation quote fixture exists in `test/receipt/ocr-cache/fixtures/`. Wrong-vertical reject behavior IS verified for all 3 fixtures.
- Untested unhappy paths: non-image file, back-button after reject, corrupt/empty image. MOD/LOW priority.

---

## Path 2 (compare) — completed deliverables
- `01-initial.png` + `01-initial-readout.md` — clean. Hero, 3-slot upload row, disabled CTA, "How to compare" + "Most important fields" + "Helpful Foundation Guides" sections + footer all verified.
- `02-after-uploads.png` (state after slot uploads, harness flow)
- `03-results.png` + `03-results-readout.md` — wrong-vertical reject (HVAC fixture) renders correctly: H1 "This is not a Foundation quote", body "an HVAC quote", CTAs route, score "5 HVAC keywords vs 0 Foundation keywords", SEO hidden ✓
- `04-cta-readout.md` — CTA routing inherited from analyze Step 4 verification (same shared `vertical-detect.js` URLs).
- `05-{single-quote-state,after-refresh}.png` + `05-unhappy-readout.md` — single-quote upload keeps CTA disabled; refresh during parse cleanly resets.

## Path 2 fixes shipped
- **F-CMP-SEO (LOW):** Hide SEO sections on compare reject screen (commit `c617b5b72f`). Added `.tp-pdf-noprint` class to SEO wrapper at line 150 + inline hide logic after `tpEnforceVerticalMatch` returns true. Mirrors GD compare fix `e50ceabc33`.

## Path 2 known gaps
- **Step 3 happy-path:** NOT TESTED. Same fixture gap — would need 2+ real foundation quotes.

---

## Path 3 (estimate) — completed deliverables
- `01-initial.png` + `01-initial-readout.md` — clean. Address form (with new helper text "Address is optional. Adds local pricing accuracy when provided." verified live), CTA, cost-by-issue table, factors, city grid, FAQ all verified.
- `02-empty-submit.png` + `02-empty-submit-readout.md` — empty address advances to wizard step 1 (same UX as GD).
- Wizard walked: Pier Installation → Minor (1-3 cracks) → Pre-1960 → final estimate $2,950 with Fort Mill local pricing (with address pre-fill) or $3,100 with South regional pricing (without).
- `03-final.png` + `03-final.txt` + `03-final-readout.md` — verdict reads correctly. Numbers in plausible range. Range bands match site-wide 0.88/1.15. Local-vs-regional pricing logic works.
- `04-result-state.png` + `04-after-yes-accurate.png` + `04-step4-readout.md` — "Yes accurate" feedback CTA clicked + acknowledged.
- `05-mid-wizard.png` + `05-after-refresh.png` + `05-unhappy-readout.md` — refresh mid-wizard cleanly resets.

## Path 3 fixes shipped
- **F-EST-COMMUNITY (MOD):** Fixed `tpCaptureCommunity` in `foundation-estimate.html` (commit `f5741e88e4`). Same `r.systemType` typo + missing material mapping. Now sends `r.repairType.value` (mapped to API VALID_MATERIALS) and `verdict: "estimate"` literal.
- **F-EST-HELPER (LOW):** Added "Address is optional. Adds local pricing accuracy when provided." helper text below ZIP input on landing (commit `ed094acca9`). Mirrors GD-EST-1 fix.

## Path 3 known gaps
- F-EST-1 (LOW): Wizard allows internally inconsistent input combos (e.g. Pier Installation + Minor cracks). Design choice — defer.
- Browser back-button after final estimate not tested.

---

## Final summary

GD vertical-style audit pattern reused efficiently. 7 commits this session for Foundation:

1. `f5741e88e4` — Foundation analyze + estimate: fix `tpCaptureCommunity` (material/verdict mapping)
2. `9dc2548803` — Foundation analyzer: inline wrong-vertical hard-reject + SEO hide on reject
3. `c617b5b72f` — Foundation compare: hide SEO + add `tp-pdf-noprint` to SEO wrapper
4. `ed094acca9` — Foundation estimate: address-optional helper text

## Open findings (cross-vertical, queued)

All 5 cross-vertical findings from GD audit apply equally to Foundation:
- CV-1: Compare reject CTA routes to single-quote analyze
- CV-2: Only top-scoring wrong vertical shown on multi-quote reject
- CV-3: Header gap (no About/Contact in primary nav)
- CV-4: Shared reject mixes "Foundation" title-case (H1) and "Foundation" cap (score line) — single-word so no visible mismatch on Foundation; relevant for multi-word verticals.
- CV-5: Auto-repair landing structure differs.

New cross-vertical finding logged this session: **CV-6** (price-confirm.js high-confidence short-circuit bypasses wrong-vertical hard-reject when confidence is "high" + price > 0). Already added to CROSS-VERTICAL-QUEUE.md.

## Verdict

**Foundation vertical defect-free to the limit of the per-vertical-only rule.** All per-vertical patches from GD audit applied + verified. Cross-vertical findings continue to live in CROSS-VERTICAL-QUEUE.md for the post-individual-audit sweep.

**Closed. Moving to Kitchen.**
