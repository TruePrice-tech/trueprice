# Gutters — Audit Findings (2026-04-29 / 04-30)

Vertical: Gutters
Status: **CLOSED to per-vertical limit**

## Path 1 (analyze) — completed
- 01-initial: clean. River the Gutter Woogoro mascot, H1 "Is your gutter quote fair?".
- 02-{roof,hvac,auto}: all 3 wrong-vertical fixtures rejected. **H1 singular "This is not a Gutter quote"** (post-fix, was plural pre-fix). Iris-concerned mascot, body labels correct, score line singular, SEO hidden.
- 04-cta: all 4 CTAs route correctly.
- 05-unhappy: refresh + double-upload PASS.

## Path 2 (compare) — completed
- 01-initial: clean. Helpful Gutter Guides links sentence-case singular ✓.
- 03-results: wrong-vertical reject (HVAC) — H1 singular, sub-paragraph singular, score singular, mascot rendered, SEO hidden. All overrides verified.
- 04-cta: routing inherited.
- 05-unhappy: single-quote per-upload reject + refresh reset both PASS.

## Path 3 (estimate) — completed
- 01-initial: clean. Helper text live.
- 02-empty-submit: PASS (after harness regex fix).
- 03-final: $2,150 (with address) / $2,290 (without). Verdict header now singular "Woogoro Gutter Verdict" (post-fix). All scope, Next Steps, savings rendered.
- 04: Yes Accurate clicked + acknowledged.
- 05: refresh mid-wizard cleanly resets.

## Fixes shipped this session

1. **`1b38e8e575`** — Inline wrong-vertical guard in gutters-quote-analyzer.html (CV-6 mitigation) + SEO hide on reject. Uses singular "Gutter quote" overriding shared module's plural default.
2. **`1b38e8e575`** — gutters-estimate.html tpCaptureCommunity fix (verdict "estimate" literal). Address-optional helper text. Gutters not in API VALID_MATERIALS so material="unknown" intentionally.
3. **`1b38e8e575`** — compare-gutters-quotes.html SEO-hide on reject + .tp-pdf-noprint class on SEO wrapper + post-render H1/score override (Gutters → Gutter).
4. **`a259fb0e5e`** — compare-gutters-quotes.html: also override body sub-line "as a gutters quote" → "as a gutter quote".
5. **`d8a2733dfb`** — Both analyzer + estimate: "Woogoro Gutters Verdict" → "Woogoro Gutter Verdict" (singular brand-style).

## Gutters-specific findings (CAUGHT BY BASELINE-FIRST APPROACH — would have been missed by pattern-match)

- **GUT-1:** Plural "Gutters" in shared reject H1/score (vs singular brand) — fixed via inline guard + post-render override.
- **GUT-CMP-1:** Sub-line "as a gutters quote anyway" plural — fixed via additional post-render override.
- **GUT-EST-1:** Verdict header "Woogoro Gutters Verdict" plural — fixed singular.
- **GUT-EST-2 (NOT A BUG):** Range bands wider than 0.88/1.15 standard — design choice exposing real material price variability, more honest. Documented.

## Cross-vertical findings still apply (CV-1 through CV-7)

Particularly relevant:
- **CV-7 bold-tag wrap** (kit-gutters bold both noun + "quote" word)
- **API VALID_MATERIALS gap:** Gutters has no material entries in the API enum. All gutter quote data captured as "unknown". Add gutter material types post-individual-audit.

## Verdict

Gutters defect-free to per-vertical limit. Singular/plural brand-style fully resolved across all 3 paths. The baseline-first approach caught the plural-vs-singular issue that pattern-matching would have missed.

**Closed. Moving to next vertical.**
