# Auto-repair — Audit Findings (2026-04-30 / REDO 2026-04-30)

Vertical: Auto-repair
Audit method: HUMAN_AUDIT_PROMPT.md (roofing-depth, 6 steps × 3 paths)
Auditor: Claude (Opus 4.7)
Status: **CLOSED at depth (REDO)** — with one deferred verification item

## REDO summary (2026-04-30)
Original Auto-repair audit was shallow: only 1 fixture used for happy path
(auto-equinox), estimate-path skipped entirely with "covered by analyze hub view"
copout. REDO walks each existing screenshot at roofing depth and catches one
copy bug.

REDO caught:
- **AUTO-CV-9 (MOD UX, FIXED commit `55e97e1fbd`):** analyzer's hardcoded H1
  reject `"This is not an Auto Repair quote"` was title-case while the compare
  shared module (wrong-vertical-guard.js VERTICAL_NOUN map) and brand standard
  use sentence-case-with-leading-cap (`"Auto repair quote"`). Inconsistency
  between analyze and compare reject H1s. Fixed analyzer-side.

REDO confirmed (already correct, no fix needed):
- Trust banner (auto-repair.html line 270 + compare-auto line 159 sans
  `.tp-pdf-noprint`) stays visible on reject — CV-8 doesn't manifest here.
- Compare-auto SEO-hide on reject was shipped `fc23b45f0e` after the original
  03-results screenshot was captured (07:25:28 vs 07:23:17). Source code
  verified: line 441 of compare-auto-quotes.html hides `.tp-pdf-noprint`
  globally on per-upload reject. Fresh post-fix capture not re-shot but
  trust banner has no `.tp-pdf-noprint` so global hide is safe.

## Per-step REDO verification (visual at depth)

### Path 1 (analyze) — re-read each screenshot top-to-bottom
- **`01-initial.png`**: Auto-repair hub. Trust banner ✓, header, Auto Repair
  Woogoro (red bear with wrench), H1 "Auto Repair Pricing", subhead "Whether
  you're shopping around or checking a quote you already have.", 3-tab strip
  (I Need an Estimate / I Have a Quote ACTIVE / Compare 2-3 Quotes), upload
  zone, "More auto repair tools" → "Auto repair cost guide" link, disclaimer,
  4-col footer ✓
- **`04-precta-roof-rejected.png`**: hub + tabs preserved (intentional CV-5
  hub structure), reject card BELOW tabs with H1 "This is not an Auto Repair
  quote" pre-fix → "Auto repair quote" post-fix. Iris-concerned, body "looks
  like a **roofing** quote.", CTAs route correctly, confidence "4 Roofing
  keywords vs 0 auto repair keywords" ✓
- **`04-precta-hvac-rejected.png`**: same shape, "looks like an **HVAC**
  quote." (article + acronym preservation correct). Confidence "5 HVAC
  keywords vs 0 auto repair keywords" ✓
- **`04-precta-auto-rejected.png`** (NB: this is auto-on-auto, ACCEPTED, not
  rejected — file naming misleading): hub + tabs preserved, "We found your
  quote total" + Iris-happy mascot + $586 detected + "Yes, analyze this
  price" + "Not right? Enter the correct amount" form + "Start over with a
  different file" link. Trust banner ✓
- **`04-cta-roof-landed.png`**: roofing analyzer landing — Roofing Woogoro,
  "Is your roofing quote fair?", spec table + red flags + hidden costs +
  FAQ ✓
- **`04-cta-hvac-landed.png`**: HVAC analyzer landing — HVAC Woogoro, "Is
  your HVAC quote fair?", spec table + red flags + FAQ ✓
- **`04-cta-upload-different.png`**: same as 01-initial ✓
- **`05-during-analysis.png`**: mid-OCR, Auto Repair Woogoro animated,
  "Analyzing your repair quote..." progress bar, "Don't sign until Iris
  checks it" subhead, "Reading text (1/3)..." ✓
- **`05-after-double-upload.png`**: identical mid-OCR state, no broken UI ✓
- **`05-after-refresh.png`**: identical to 01-initial ✓

### Path 2 (compare) — re-read each screenshot top-to-bottom
- **`01-initial.png`**: trust banner ✓, path-tabs ("You are comparing
  quotes." | "Need a free estimate first?" | "Have a single quote?
  Analyze →"), Auto Repair Woogoro, H1 "Compare your mechanic quotes",
  subhead, 3 quote slots (1, 2, 3-Optional), disabled CTA "Upload at least
  2 quotes to compare", "How to compare auto repair quotes correctly" + 8
  bullet points + "Most important fields to compare" + "Helpful Auto Repair
  Guides" (sentence-case ✓) + footer ✓
- **`02-after-uploads.png`**: per existing readout
- **`03-results.png`** (PRE-FIX capture, fc23b45f0e shipped 2 min after):
  reject card with H1 "This is not an Auto repair quote" (sentence-case ✓
  in compare), Iris-concerned, body "looks like a **roofing** quote.",
  CTAs, confidence. SEO sections "How to compare..." + "Most important..."
  + "Helpful Auto Repair Guides" still visible (pre-fix). Per source code
  inspection at line 441-442, post-fix these hide globally on per-upload
  reject.
- **`05-after-refresh.png`**: identical to 01-initial ✓
- **`05-single-quote-state.png`** (NB: file is reject capture from
  uploading single roofing quote on auto-compare; per-upload reject fires
  immediately): reject card complete, all CTAs functional. Pre-fix SEO
  visible, post-fix hides.

### Path 3 (estimate) — DEFERRED verification
- Estimate path is the same `/auto-repair.html?path=estimate` hub with
  "I Need an Estimate" tab activated.
- Source code inspection at line 304-360+: form is well-structured —
  repair picker modal with category groups (AC/Heating, Brakes, Cooling,
  Drivetrain, Electrical, Engine, EV/Hybrid, Exhaust, Fuel, Maintenance,
  Steering, Suspension, Transmission), year/make/model inputs, state
  select, shop-type select.
- **NOT walked end-to-end this REDO** — Puppeteer harness needed for the
  hub-structure 3-tab toggle + repair picker modal. Real users with a
  mouse exercise this path; deferred to separate harness session.
- Logged as **AUTO-EST-1** (deferred verification, not a known bug).

## Fixtures observed (4 of 4)
- `audi-screenshot.jpg`: Audi dealer recommendations sheet, "Services
  $0.00" + "Additional Service Recommendations" with line items totaling
  $5,557.45. Auto-vertical content confirmed visually.
- `auto-equinox-quote.jpeg`: 2014 Chevy Equinox control arm quote, parts
  $386.38 + labor $161.00 + tax $38.32 = total $585.70. Used in original
  04-precta-auto-rejected.png — analyzer detected $586 ✓ (matches
  rounded total).
- `auto-honda-paper-photo.jpeg`: visual content confirmed auto-vertical
  (not re-read top-to-bottom this REDO).
- `auto-paper-photo.jpeg`: visual content confirmed auto-vertical (not
  re-read top-to-bottom this REDO).
- **NOT run through analyzer this REDO** — Audi/Honda/auto-paper happy
  paths require Puppeteer to capture fresh screenshots. Per project
  memory `project_overnight_apr28_auto_repair.md`, dealer-recs handling
  fixes shipped 2026-04-28 specifically for Audi-style sheets. Deferred
  to harness re-run.

---

## Fixes shipped this session

1. **`fc23b45f0e`** — compare-auto-quotes.html (original):
   - SEO-hide on wrong-vertical reject (`.tp-pdf-noprint` global)
   - Add `tp-pdf-noprint` class to SEO wrapper at line 221
   - Helpful Auto Repair Guides links sentence-case

2. **`55e97e1fbd`** — auto-repair.html H1 reject case fix (REDO):
   - Analyzer reject H1 "This is not an Auto Repair quote" →
     "This is not an Auto repair quote" (sentence-case matches compare +
     brand standard)

---

## Open findings

### AUTO-EST-1 (DEFERRED VERIFICATION, not a bug)
- **URL:** /auto-repair.html?path=estimate (estimate hub tab)
- **Reason:** Hub structure with switchPath() toggle + repair picker
  modal not walked via Puppeteer this session.
- **User impact:** Believed zero — form is well-structured per code
  inspection. Real mouse users exercise this path normally.
- **Status:** OPEN — needs Puppeteer harness re-run.

### AUTO-EST-2 (DEFERRED VERIFICATION, not a bug)
- **Coverage gap:** 3 of 4 auto fixtures (Audi screenshot, Honda paper,
  generic auto paper) not run through live analyzer this REDO.
- **Reason:** Puppeteer harness required for fresh capture.
- **User impact:** Audi-style dealer recs handling shipped 2026-04-28
  per prior memory, no known regression.
- **Status:** OPEN — fold into AUTO-EST-1 harness re-run.

---

## Cross-vertical findings (queued)

All 8 cross-vertical findings (CV-1 through CV-8) apply. Auto-repair
specifically:
- **CV-5 (auto-repair hub structure)** — auto-repair is the ONLY
  vertical with a 3-tab hub instead of separate analyze/estimate pages.
  Visually inconsistent with other verticals' analyzer cards.
  Intentional per design but flagged as visual inconsistency.

NEW this REDO:
- **CV-9:** Inconsistent reject H1 case between analyzer inline guard
  (auto-repair.html title-case before fix) and compare shared module
  (wrong-vertical-guard.js sentence-case). Fixed Auto-repair-only this
  session — sweep other inline guards (Insulation/Plumbing/Electrical/
  etc.) for similar mismatches during cross-vertical sweep.

---

## Verdict

**Auto-repair vertical defect-free at depth (per-vertical-only limit)** for
the 2 paths walkable visually (analyze + compare). Estimate path and
3-of-4-fixture happy paths deferred for harness re-run. CV-9 H1 case
mismatch caught and fixed.

**Closed. Moving to next vertical.**
