# Legal — Audit Findings (2026-04-30, full audit at depth)

Vertical: Legal (Attorney quote/retainer agreements)
Audit method: HUMAN_AUDIT_PROMPT.md (roofing-depth, 6 steps × 3 paths)
Auditor: Claude (Opus 4.7)
Status: **CLOSED at depth (FULL AUDIT)** — re-tested live post-fix

## Summary
Legal had no prior FINDINGS file. Full from-scratch audit at roofing
depth. Caught one CRITICAL bug + one HIGH UX bug. Both fixed and
re-tested clean live.

### CRITICAL: LEG-CMP-1 — wrong-vertical reject not firing on compare-legal
- **Severity:** CRITICAL (defeats Lane's post-Stripe-live mandate that
  wrong-vertical hard-reject must fire on all 20 analyzers)
- **Bug:** `compare-legal-quotes.html` line 494 selected `.cmp-card`,
  but this page uses `.cq-card` for the card class. Selector returned
  null → `if (rootEl && ...)` skipped → tpEnforceVerticalMatch never
  called → ANY wrong-vertical file silently accepted as legal quote
  and parsed via regex price path.
- **How caught:** Inline harness probe override on
  `tpEnforceVerticalMatch` showed `probeCalls: []` — never invoked —
  while TP_Engine logged `vertical=legal price=16765.79 source=regex
  ocrChars=1484` for a roofing fixture. Roofing total $16,765 was
  silently treated as a legal quote.
- **Fix:** commit `7a5b8f587d` — `.cmp-card` → `.cq-card`.
- **Sweep verified:** all other 18 compare pages (all using `.cmp-card`)
  + compare-auto (using `.caq-card`) had matching selector + class.
  Compare-legal was the only mismatch.

### HIGH UX: LEG-CMP-2 — SEO sections visible on compare reject
- **Bug:** After LEG-CMP-1 fix made the reject fire, the cmp/cq-card
  was replaced by reject UI but the SEO sections "How to compare legal
  quotes correctly" + "Most important fields to compare" + "Helpful
  Legal Guides" stayed visible below.
- **Fix:** commit `bd03f67e52` — add `tp-pdf-noprint` class to SEO
  wrapper + hide `#main .tp-pdf-noprint` after tpEnforceVerticalMatch
  returns true. Trust banner outside main stays visible (CV-8 fix
  pattern).

## Live re-test (post-fix)

| Path / Fixture | H1 | Body | Trust banner | SEO hidden |
|---|---|---|---|---|
| analyze / roof | "This is not an Attorney quote" ✓ | "looks like a roofing quote" ✓ | visible ✓ | hidden via main replacement ✓ |
| analyze / HVAC | "This is not an Attorney quote" ✓ | "looks like an HVAC quote" ✓ | visible ✓ | hidden ✓ |
| analyze / auto | "This is not an Attorney quote" ✓ | "looks like an auto repair quote" ✓ | visible ✓ | hidden ✓ |
| compare / roof (POST 2 fixes) | "This is not an Attorney quote" ✓ | "looks like a roofing quote" ✓ | visible ✓ | 3 of 3 hidden ✓ |

Article handling verified: vowel-aware "an Attorney" (uppercase A vowel)
+ acronym-aware "an HVAC" + smartLower "an auto repair" all working
correctly via shared module.

Fresh captures:
- `analyze/redo-04-precta-{roof,hvac,auto}-rejected.png`
- `analyze/redo-05-during-analysis.png`
- `analyze/redo-05-after-refresh.png`
- `compare/redo-01-initial.png`
- `compare/redo-03-results.png` (post-fix)
- `compare/redo-05-after-refresh.png`
- `redo-states.json`

## Per-step verification (visual at depth)

### Path 1 (analyze)
- **`01-initial.png`** (original capture): Legal Woogoro mascot (blue
  cookie-monster style with briefcase + glasses), H1 "Is your attorney
  fee fair?", path-tabs, upload zone, full SEO below ✓
- **`redo-04-precta-roof-rejected.png`**: H1 "This is not an Attorney
  quote" ✓, Iris-concerned, body "looks like a roofing quote" ✓, CTAs
  route correctly, confidence "4 Roofing keywords vs 0 Legal keywords",
  trust banner visible, SEO hidden via main replacement ✓
- **`redo-04-precta-hvac-rejected.png`**: same shape, "looks like an
  HVAC quote" (article + caps preserved) ✓
- **`redo-04-precta-auto-rejected.png`**: "looks like an auto repair
  quote" (article + smartLower) ✓
- **`redo-05-during-analysis.png`**: mid-OCR with progress bar ✓
- **`redo-05-after-refresh.png`**: identical to 01-initial ✓

### Path 2 (compare)
- **`redo-01-initial.png`**: trust banner ✓, path-tabs ("You are
  comparing quotes." | "Need a free estimate first?" | "Have a single
  quote? Analyze →"), Legal Woogoro mascot, H1 "Compare attorney
  quotes", subhead "Upload 2 or 3 retainer agreements or invoices and
  see them side by side.", 3 quote slots (Attorney 1/2/3), disabled
  CTA, "How to compare legal quotes correctly" + "Most important
  fields to compare" + "Helpful Legal Guides" + footer ✓
- **`redo-03-results.png`** (POST-fix): reject card complete with H1,
  mascot, body, CTAs, confidence; SEO hidden inside main; trust banner
  preserved; footer visible ✓
- **`redo-05-after-refresh.png`**: identical to 01-initial ✓

### Path 3 (estimate) — N/A
- Legal does NOT have a separate /legal-estimate.html. The "estimate"
  path for Legal is the analyze flow ("upload your retainer agreement
  to see if the rate is fair"). No additional path to walk.

---

## Fixes shipped this session

1. **`bd03f67e52`** — Compare-legal SEO-hide on reject (CV-6 mitigation)
2. **`7a5b8f587d`** — Compare-legal CRITICAL: `.cmp-card` → `.cq-card`
   selector fix

---

## Cross-vertical findings (queued)

All 8 (CV-1 through CV-8) apply. Plus CV-10 (article/smartLower drift
in inline guards — N/A here, Legal uses shared module).

NEW THIS SESSION:
- **CV-11 (compare card class consistency):** verify all compare pages'
  reject selector matches the actual card class. Sweep done — only
  compare-legal had mismatch, all others (`.cmp-card`/`.caq-card`) are
  consistent.

---

## Verdict

**Legal vertical defect-free at depth (per-vertical-only limit)** for
analyze + compare paths. Both bugs caught and fixed and re-tested clean
live. CRITICAL LEG-CMP-1 was a regression class that defeated Lane's
post-Stripe-live wrong-vertical hard-reject mandate; would have been
shipped without this REDO catching it.

**Closed. Moving to next vertical.**
