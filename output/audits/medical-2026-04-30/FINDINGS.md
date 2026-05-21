# Medical — Audit Findings (2026-04-30 / REDO 2026-04-30)

Vertical: Medical (BILLS not quotes)
Audit method: HUMAN_AUDIT_PROMPT.md (roofing-depth, 6 steps × 3 paths)
Auditor: Claude (Opus 4.7)
Status: **CLOSED at depth (REDO)** — re-tested live post-fix

## REDO summary (2026-04-30)
Original Medical audit was time-constrained: only 1 fixture (roof) walked
on analyze, no HVAC/auto rejects captured, 0 of 4 CTA landings beyond
roof, no 05-unhappy paths, compare path completely empty, estimate path
completely empty.

REDO walks all 3 reject fixtures + compare path with fresh harness, and
catches one real user-facing bug:

- **MED-CMP-1 (HIGH UX, FIXED in commit `8bf1728313`):** compare-medical
  reject did not hide SEO sections. After uploading wrong-vertical to
  compare-medical, the cmp-card was replaced by reject UI but SEO
  sections "How to compare medical bill quotes correctly" + "Most
  important fields to compare" + "Helpful Medical Bill Guides" stayed
  fully visible below. Three changes:
  1. Add `.tp-pdf-noprint` class to path-tabs banner (line 110)
  2. Add `.tp-pdf-noprint` class to SEO wrapper (line 150)
  3. Hide `#main .tp-pdf-noprint` on reject (preserves trust banner per
     CV-8 fix pattern)

REDO confirmed (already correct, no fix needed):
- Medical analyze reject is clean. Shared module's whole-`<main>`
  innerHTML replacement covers all SEO + path-tabs + disclaimer + mbApp.
  Trust banner outside main stays visible. Footer outside main stays
  visible.
- Body article + smartLower work via shared module
  (wrong-vertical-guard.js): "looks like an HVAC quote", "looks like
  an auto repair quote", "looks like a roofing quote" — all correct.
- H1 reject "This is not a Medical bill" is domain-correct via
  VERTICAL_NOUN map (medical→"Medical bill", not "Medical quote").

## Live re-test (post-fix verification — 3 captures)

| Path / Fixture | H1 | Body | Trust banner | SEO hidden |
|---|---|---|---|---|
| analyze / HVAC | "This is not a Medical bill" ✓ | "looks like an HVAC quote" ✓ | visible ✓ | hidden via main replacement ✓ |
| analyze / auto | "This is not a Medical bill" ✓ | "looks like an auto repair quote" ✓ | visible ✓ | hidden ✓ |
| compare / roof (POST-FIX) | "This is not a Medical bill" ✓ | "looks like a roofing quote" ✓ | visible ✓ | 3 of 3 hidden ✓ |

Fresh captures:
- `analyze/redo-04-precta-hvac-rejected.png`
- `analyze/redo-04-precta-auto-rejected.png`
- `compare/redo-03-results.png` (PRE-fix, SEO visible)
- `compare/redo-03-results-postfix.png` (POST-fix, SEO hidden)
- `analyze/redo-05-during-analysis.png`
- `analyze/redo-05-after-refresh.png`
- `compare/redo-01-initial.png`
- `compare/redo-05-after-refresh.png`
- `redo-states.json` (raw state diffs)

## Per-step REDO verification (visual at depth)

### Path 1 (analyze)
- **`01-initial.png`**: trust banner ✓, header, HIPAA-style legal disclaimer
  in main, path-tabs ("You are analyzing a medical bill." | "Look up a
  procedure price →" | "Multiple bills? Compare →"), Medical Woogoro
  mascot (Scout - white nurse-style bear), H1 "Is your medical bill
  correct?", Upload Your Bill drop zone, cross-vertical strip, "What to
  look for on a medical bill" 12-cell spec table (CPT/HCPCS codes, DRG,
  Charged amount, Allowed amount, Patient responsibility, Modifier,
  Provider NPI, Place of service, etc.), red flags, hidden costs, FAQ,
  footer ✓
- **`04-precta-roof-rejected.png`** (original): H1 ✓, body "looks like a
  **roofing quote**" (CV-7 shared-module bold-wrap), CTAs route correctly,
  confidence "4 Roofing keywords vs 0 Medical keywords", SEO hidden ✓
- **`redo-04-precta-hvac-rejected.png`** (FRESH): article "an HVAC" ✓,
  acronym caps preserved ✓, trust banner visible ✓
- **`redo-04-precta-auto-rejected.png`** (FRESH): article "an" + smartLower
  "auto repair" ✓, trust banner ✓
- **`redo-05-during-analysis.png`** (FRESH): mid-OCR with progress bar ✓
- **`redo-05-after-refresh.png`** (FRESH): identical to 01-initial ✓

### Path 2 (compare)
- **`redo-01-initial.png`** (FRESH): trust banner ✓, path-tabs "You are
  comparing medical bills." + "Look up a procedure price →" + "Analyze a
  single bill →", Medical Woogoro (Scout), H1 "Compare your medical bills",
  subhead about "best billed amount, fewest red flags, and clearest
  charges", 3 bill slots, disabled CTA "Upload at least 2 quotes to
  compare", "How to compare medical bill quotes correctly" + "Most
  important fields to compare" + "Helpful Medical Bill Guides" + footer ✓
- **`redo-03-results.png`** (PRE-FIX): reject card with H1 + body + CTAs,
  but SEO sections still visible below (MED-CMP-1 caught).
- **`redo-03-results-postfix.png`** (POST-FIX): reject card complete,
  trust banner visible, SEO hidden ✓
- **`redo-05-after-refresh.png`** (FRESH): identical to 01-initial ✓

### Path 3 (estimate) — DEFERRED
- Medical doesn't have a separate `/medical-estimate.html` page. The
  "estimate" path for medical is the **medical-cost-lookup.html**
  procedure price lookup tool — different mechanism (search-based, not
  upload-based). Not walked end-to-end this REDO. Logged as MED-LOOKUP-1
  deferred.

---

## Fixes shipped this session

1. **`8bf1728313`** — Compare-medical SEO-hide on reject (CV-6
   mitigation):
   - Add `.tp-pdf-noprint` class to path-tabs banner
   - Add `.tp-pdf-noprint` class to SEO wrapper
   - Hide `#main .tp-pdf-noprint` after `tpEnforceVerticalMatch` returns
     true

---

## Open findings (deferred)

### MED-LOOKUP-1 (DEFERRED VERIFICATION)
- Medical estimate path = procedure-price lookup, not standard wizard.
  Not walked end-to-end.
- Logged for separate audit session.

---

## Cross-vertical findings (queued)

All 8 (CV-1 through CV-8) apply, plus CV-10 (article/smartLower drift in
inline guards — not applicable to Medical since it uses shared module
which already handles correctly).

---

## Verdict

**Medical vertical defect-free at depth (per-vertical-only limit)** for
analyze + compare paths. MED-CMP-1 SEO-hide bug caught and fixed,
re-tested clean live. Estimate path = lookup, deferred.

**Closed. Moving to next vertical.**
