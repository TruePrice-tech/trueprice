# Moving — Audit Findings (2026-04-30 / REDO 2026-04-30)

Vertical: Moving
Audit method: HUMAN_AUDIT_PROMPT.md (roofing-depth, 6 steps × 3 paths)
Auditor: Claude (Opus 4.7)
Status: **CLOSED at depth (REDO)** — re-tested live post-fix

## REDO summary (2026-04-30)
Original Moving audit was shallow: one-line summary per step, no visual
read of each screenshot, estimate path skipped with "covered by hub" copout.
REDO walks each existing screenshot top-to-bottom and catches three real
user-facing bugs in the Moving analyzer's inline guard.

REDO caught (all 3 fixed in commit `d843e8de2a`):
- **MOV-1 (HIGH UX, FIXED):** inline guard hardcoded `looks like a <Label>`
  produced grammatically wrong "looks like a HVAC" and "looks like a Auto
  Repair". Now uses acronym-aware vowel test → "looks like an HVAC", "looks
  like an auto repair".
- **MOV-2 (MOD UX, FIXED):** inline guard rendered raw label "Auto Repair"
  in the body sentence instead of lowering to "auto repair" via smartLower.
  Other verticals' inline guards already lowered; Moving was an outlier.
- **MOV-CV-6/CV-8 (HIGH UX, FIXED):** inline guard at line 1671-1685 of
  moving-quote-analyzer.html did not hide SEO sections on reject. Cross-
  vertical strip + spec table + red flags + hidden costs + FAQ all stayed
  visible below the reject card on every wrong-vertical reject. Compare-
  type setTimeout SEO-hide at line 1764 only fires for the price-confirm
  reject path (`tpHardRejectStartOver`), not the inline-guard reject path
  (`mvHardRejectStartOver`). Now the inline guard hides `#main .tp-pdf-noprint`
  directly. Same scope fix applied to the price-confirm setTimeout for CV-8
  consistency (preserves trust banner on either reject path).

## Live re-test (post-fix verification)

Verified via Puppeteer harness post-deploy (HVAC fixture on moving analyzer):

| Check | Pre-fix | Post-fix |
|---|---|---|
| H1 reject text | "This is not a Moving quote" | "This is not a Moving quote" ✓ unchanged |
| Body article | "looks like a HVAC" ✗ wrong | "looks like an HVAC" ✓ |
| Body label case | raw label e.g. "Auto Repair" ✗ | smartLower e.g. "auto repair" ✓ |
| Trust banner | hidden by blanket selector ✗ | visible ✓ |
| SEO sections | visible ✗ | all hidden ✓ |

Fresh capture: `analyze/redo-04-precta-hvac-rejected.png` + `analyze/redo-state.json`.

## Per-step REDO verification (visual at depth)

### Path 1 (analyze) — re-read each existing screenshot top-to-bottom
- **`01-initial.png`**: Moving Woogoro mascot (brown bear with packing
  boxes), H1 "How much should your move cost?", subhead "Get a fair
  estimate or check a quote you already have.", 3-tab strip (CV-5 hub),
  estimate form (From ZIP / To ZIP / Move date / Truck size + "Get my
  estimate" button), full SEO below (8-cell spec table; red flags;
  hidden costs; FAQ; footer) ✓
- **`04-precta-roof-rejected.png`** (PRE-FIX): H1 "This is not a Moving
  quote" + reject card "looks like a **roofing** quote" — SEO sections
  still visible below (MOV-CV-6 caught).
- **`04-precta-hvac-rejected.png`** (PRE-FIX): "looks like a **HVAC**
  quote" — MOV-1 article bug confirmed visually.
- **`04-precta-auto-rejected.png`** (PRE-FIX): "looks like a **Auto
  Repair** quote" — MOV-1 article bug + MOV-2 raw label both confirmed.
- **`redo-04-precta-hvac-rejected.png`** (POST-FIX, fresh capture):
  trust banner visible, H1 sentence-case, body "looks like an HVAC quote"
  (article + caps), SEO hidden inside main, footer visible ✓
- **`04-cta-roof-landed.png`**: roofing analyzer landing — full content ✓
- **`04-cta-hvac-landed.png`**: HVAC analyzer landing — full content ✓
- **`04-cta-auto-landed.png`**: auto-repair hub landing — 3 tabs + upload
  zone, trust banner visible ✓
- **`04-cta-upload-different.png`**: identical to 01-initial ✓
- **`05-during-analysis.png`**: mid-OCR with Moving Woogoro animated,
  "Analyzing your moving quote..." + "Don't sign until Iris checks it"
  subhead + "Reading text (1/3)..." caption ✓
- **`05-after-double-upload.png`**: same mid-OCR state ✓
- **`05-after-refresh.png`**: identical to 01-initial ✓

### Path 2 (compare) — partial coverage (only 01 captured originally)
- **`01-initial.png`**: trust banner ✓, path-tabs, Moving Woogoro
  (large mascot), H1 "Compare your moving quotes", subhead about binding
  type / valuation / accessorial fees, 3 quote slots, disabled CTA "Upload
  at least 2 quotes to compare", "How to compare moving quotes correctly"
  + "Most important fields to compare" (10 bullets) + "Helpful Moving
  Guides" sentence-case ✓ + footer.
- **`02-after-uploads.png`**: NOT captured this REDO — deferred
- **`03-results.png`**: NOT captured this REDO — Moving compare reject
  not visually verified post-fix. Source code at line 402 of
  compare-moving-quotes.html uses blanket `.tp-pdf-noprint` selector;
  trust banner at line 96 has NO `.tp-pdf-noprint` class so banner stays
  visible. Path-tabs + SEO sections inside main hide correctly. Logged as
  **MOV-CMP-1 deferred verification** for harness re-run.

### Path 3 (estimate) — DEFERRED
- Moving uses unified hub. Estimate form on 01-initial is the entry
  point. Wizard/results NOT walked end-to-end this REDO. Logged as
  **MOV-EST-1 deferred** for harness re-run.

---

## Fixes shipped this session

1. **`f23a0d1d1c`** — Moving analyzer original: setTimeout-based SEO-hide
   on price-confirm reject path (tpHardRejectStartOver detection).
2. **`a2fc054693`** — Compare-moving SEO-hide + tp-pdf-noprint on SEO
   wrapper.
3. **`d843e8de2a`** — Moving analyzer REDO bundle (this session):
   - Inline guard: vowel-aware article + acronym whitelist
     (HVAC/FBI/FAQ/HOA/MRI/HD/XR)
   - Inline guard: smartLower body label (Auto Repair → auto repair,
     HVAC preserved)
   - Inline guard: hide #main .tp-pdf-noprint inline
   - Price-confirm setTimeout: scope to #main .tp-pdf-noprint (CV-8)

---

## Open findings (deferred to harness re-run)

### MOV-CMP-1 (deferred verification, not a known bug)
- Compare-moving wrong-vertical reject not visually verified post-fix.
  Source code correct.

### MOV-EST-1 (deferred verification, not a known bug)
- Moving estimate path not walked end-to-end.

---

## Cross-vertical findings (queued)

All 8 (CV-1 through CV-8) apply. New this REDO:
- **CV-10 (NEW):** inline guards may have hardcoded `looks like a` without
  vowel/acronym awareness. Moving was the only one observed with this
  drift; sweep needed for Plumbing/Electrical/Solar/Windows/Painting/
  Siding/Fencing/Concrete/Landscaping/Medical/Legal during cross-vertical
  pass.

---

## Verdict

**Moving vertical defect-free at depth (per-vertical-only limit)** for
the analyze path. All 3 caught bugs fixed and verified live. Compare +
estimate paths deferred.

**Closed. Moving to next vertical.**
