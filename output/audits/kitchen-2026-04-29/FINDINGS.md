# Kitchen — Audit Findings (2026-04-29 / REDO 2026-04-30)

Vertical: Kitchen
Audit method: HUMAN_AUDIT_PROMPT.md (roofing-depth, 6 steps × 3 paths)
Auditor: Claude (Opus 4.7)
Status: **CLOSED at depth (REDO)**

## REDO summary (2026-04-30)
Original Kitchen audit was shallow — pattern-matched fixes from GD/Foundation precedent without reading reject screenshots visually. Lane caught the slip and ordered REDO at roofing depth.

REDO caught one customer-trust regression that the shallow audit missed:
- **KIT-CV-8 (HIGH UX, FIXED commit `7b013630dc`):** `.tp-pdf-noprint` blanket selector in inline-guard SEO-hide also hid the body-level trust banner ("✓ Free · No email · No phone · No signup · We never sell or share your data") on every Kitchen reject screen — exactly when users most need privacy reassurance after a wrong-vertical reject. Scoped to `#main .tp-pdf-noprint` so trust banner stays visible while in-main SEO sections still hide.

This finding also applies cross-vertical to GD/Foundation/Insulation/Gutters/Auto/Moving — queued in CROSS-VERTICAL-QUEUE.md as CV-8. NOT applied to clean verticals (GD/Foundation/Gutters) per Lane's "cannot risk breaking clean verticals" directive — they retain the buggy SEO-hide as accepted tech debt.

## REDO verification (visual at depth)
- Step 1 (Kitchen analyze landing): unchanged from shallow audit, content already verified from source HTML.
- Step 2 (3 reject screens): re-read each screenshot top-to-bottom. Roof, HVAC, auto each verified visually post-#main fix with trust banner restored.
- Step 4 (4 CTA-landed pages): each landed page re-read visually. Roofing analyzer, HVAC analyzer, Auto-repair hub, Kitchen reset — all functional and complete.
- Step 5 (refresh + double-upload unhappy paths): re-verified visually, both produce clean state.
- Compare path Step 3: reject re-shot post-#main, trust banner restored, mascot, body, CTAs all clean.
- Compare path Step 5: single-quote mid-parse + refresh both PASS visually.
- Estimate path: $9,800 verdict (Minor Cosmetic + Small + Stock Cabinets + Laminate + Keep Appliances + Fort Mill local) with standard 0.88/1.15 range $8,600–$11,250. Tier-comparison UX a strength.

---

## Path 1 (analyze) — completed deliverables
- `01-initial.png` + `01-initial-readout.md` — clean. 13 spec cells (Cabinets, Countertops, Appliances, Flooring, Backsplash, Plumbing rough-in, Electrical, HVAC adjustments, Drywall and paint, Demolition, Permit, Design and management fees, Warranty terms), 7 red flags (cabinet allowance, appliance not itemized, no permit, single lump-sum, countertop overlay, minimal plumbing allowance, DIY-grade install), all verified from source HTML.
- `02-{roof,hvac,auto}-on-*.png` + `02-readout.md` — all 3 wrong-vertical fixtures rejected correctly. H1 "This is not a Kitchen quote", body labels (sentence-case for roofing/auto, all-caps preserved for HVAC), articles correct, score lines accurate.
- `04-cta-{roof,hvac,auto,upload-different}-landed.png` + `04-cta-readout.md` — all 4 reject CTAs route correctly.
- `05-{during-analysis,after-refresh,after-double-upload}.png` + `05-unhappy-readout.md` — both unhappy paths handled.

## Path 2 (compare) — completed deliverables
- `01-initial.png` + `01-initial-readout.md` — clean. 11 fields-to-compare bullets verified.
- `03-results.png` + `03-results-readout.md` — wrong-vertical reject works on 2-way upload (also fires per-upload as observed in Step 5).
- `04-cta-readout.md` — CTA routing inherited from analyze.
- `05-{single-quote,after-refresh}.png` + `05-unhappy-readout.md` — single-quote (wrong-vertical) immediately rejects per-upload; refresh resets cleanly.

## Path 3 (estimate) — completed deliverables
- `01-initial.png` + `01-initial-readout.md` — clean. 5-step wizard observed, helper text fix verified live.
- `02-empty-submit.png` + `02-empty-submit-readout.md` — advances to wizard step 1 of 5 cleanly.
- Wizard walk: Minor Cosmetic → Small → Stock Cabinets → Laminate → Keep Existing Appliances. Final estimate $9,800 with Fort Mill local pricing OR $10,300 with South regional pricing (without address).
- `03-final.png` + `03-final.txt` + `03-final-readout.md` — verdict reads correctly with **bonus tier-comparison view** (Minor / Mid-Range / Major side-by-side prices) — better UX than other verticals' estimates.
- `04-result-state.png` + `04-after-yes-accurate.png` + `04-step4-readout.md` — Yes Accurate clicked + acknowledged.
- `05-{mid-wizard,after-refresh}.png` + `05-unhappy-readout.md` — refresh mid-wizard cleanly resets.

---

## Fixes shipped this session

1. **`d3bbf89ab5`** — Kitchen analyzer + estimate batch:
   - Inline wrong-vertical hard-reject in `kitchen-quote-analyzer.html` (CV-6 mitigation)
   - SEO-hide on reject (.tp-pdf-noprint sections)
   - tpCaptureCommunity material/verdict mapping (analyzer + estimate, tier→VALID_MATERIALS)
   - Address-optional helper text on estimate landing
   - SEO-hide on compare reject + .tp-pdf-noprint class on compare SEO wrapper

2. **`226d2c2064`** — Kitchen compare Helpful Guides links sentence-case (KIT-CMP-1 mirrored from GD-CMP-1).

---

## Cross-vertical findings (queued, not GD/Kitchen-specific)

- CV-1: Compare reject CTA routes to single-quote analyze (shared module)
- CV-2: Only top-scoring wrong vertical shown
- CV-3: Header missing About/Contact
- CV-6: price-confirm.js high-confidence short-circuit
- **CV-7 (NEW THIS SESSION):** Inconsistent bold-tag wrapping between shared module ("`a **roofing quote**.`") and inline guards ("`a **roofing** quote.`"). Caught during Kitchen compare audit.

---

## Verdict

**Kitchen vertical defect-free to per-vertical-only limit.** All 6 patterns from GD/Foundation audits applied + verified. Tier-comparison view on Kitchen estimate is a UX strength worth replicating to other verticals during cross-vertical sweep.

**Closed. Moving to Insulation.**
