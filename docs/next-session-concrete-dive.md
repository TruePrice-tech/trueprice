# Next-session prompt: concrete deep test re-dive

Paste the block below into the next Claude Code session.

---

deep test concrete

**Context (read first):**

The concrete fixture-truth harness reports 27 failures across 6 of 7 fixtures
in `test/concrete/fixture-ground-truth.baseline.json` (refreshed
2026-05-04T02:09Z). My latest run matched the baseline exactly (no deltas) —
so these are pre-existing known-fails, NOT new regressions. But concrete
shipped clean on 2026-04-27 (`project_concrete_dive_followups` memory:
"empty queue, walk-verified") so they regressed at some point.

**Primary symptom — same across f1/f2/f3/f4/f5/f6:** every API-derived field
returns null:

```
contractor: null
stateCode: null
apiPsiRating: null
apiSquareFootage: null
apiJobType: null
```

The harness error message reads `"no API response (forceAI?)"` but **forceAI
IS already set** in [concrete-quote-analyzer.html:792](concrete-quote-analyzer.html#L792)
inside `processFile`'s `TP_Engine.analyzeQuote(...)` call. So the
regex-fast-path is NOT the cause. Don't waste time mirroring LND-1/MV-1 here.

**Likely root causes to check (in order):**

1. **API response shape drift.** Did `api/concrete-estimate.js` change its
   output keys recently? Diff the response shape vs what
   [concrete-quote-analyzer.html](concrete-quote-analyzer.html) reads off
   `engineResult.aiData` around lines ~795-820 in `processFile`.
2. **TP_Engine.analyzeQuote not threading aiData through.** Check
   [js/analyzer-engine.js](js/analyzer-engine.js) — search for `aiData` and
   verify it's populated from the API response and surfaced on the engine
   result, even when regex-parser also succeeds.
3. **Abuse-guard / rate-limiting.** 7 fixtures in quick succession may be
   hitting `api/_abuse-guard.js` thresholds during test runs. Look at
   recent Vercel logs around the last harness timestamp; if rate-limited,
   the harness needs a per-fixture delay or an abuse-guard test-mode bypass.

**Independent failures to fix while you're here (3 distinct bugs):**

- f1: `thicknessInches: expected 5, got 4` — OCR-drift on thickness extraction
- f1, f4: `concreteType: expected /patio/, got "Stamped Concrete"` — stamp
  pattern detection beating patio detection
- f3, f6: `scopeExcluded:sealing: expected NOT "Included", got "included"` —
  sealing exclusion logic flipped

**Run procedure (per `feedback_deep_test_command` memory):**

```
node test/concrete/fixture-ground-truth.test.js
```

Don't refresh the baseline until ALL fixtures clear. Per
`feedback_one_vertical_at_a_time`, walk-fix-verify per vertical, never batch
across verticals. 0% regression target.

**Things FLYWHEEL-1 (commit `02b30a0dc33`) did NOT touch and are safe to
ignore:**

- The concrete analyzer's API call plumbing (concrete-quote-analyzer.html
  `processFile` lines ~786-820)
- `api/concrete-estimate.js` core logic (only the import surface of
  `_flywheel-read.js` was extended; the call site is unchanged)
- `js/analyzer-engine.js` (untouched)

So if you find regressions there, they predate the flywheel work.

**Reference memories worth re-reading:**

- `project_concrete_dive_followups` — last clean state of concrete
- `feedback_deep_test_command` — canonical 9-step procedure
- `feedback_one_vertical_at_a_time` — no batching across verticals
- `feedback_read_fixtures_first` — Read tool on each fixture image before
  running through parser
