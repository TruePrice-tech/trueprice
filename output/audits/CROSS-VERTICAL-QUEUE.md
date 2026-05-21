# Cross-vertical issue queue (for after all 19 individual audits)

These findings cannot be fixed under the per-vertical-only rule because they live in shared modules / shared layout / require coordinated changes across multiple verticals.

Process: complete all 19 individual vertical audits first; then do a single coordinated cross-vertical sweep that touches shared modules with full regression coverage.

---

## Open cross-vertical findings

### CV-1: Compare reject CTA routes to single-quote analyzer instead of compare
- **Source:** GD audit 2026-04-29 (originally GD-CMP-2)
- **URL pattern:** /compare-{vertical}-quotes.html
- **Observed:** When wrong-vertical reject fires on a compare page, the CTA "Analyze as X instead" routes to `/X-quote-analyzer.html?path=quote` (single-quote) — but the user wanted to compare quotes.
- **Expected:** Route to `/compare-X-quotes.html` for the correct vertical.
- **Files involved:** `js/vertical-detect.js` (needs `compareUrl` field on each vertical entry), `js/wrong-vertical-guard.js` (needs to choose between url/compareUrl based on context), all 19 compare-X-quotes.html files (need to pass context flag).
- **Severity:** MOD — UX inconsistency, not a blocker.

### CV-2: Multi-vertical wrong-vertical detection only shows top-scoring
- **Source:** GD audit 2026-04-29 (originally GD-CMP-3)
- **URL pattern:** /compare-{vertical}-quotes.html when 2+ uploaded quotes are different wrong verticals
- **Observed:** If user uploads 2 different wrong-vertical quotes (e.g., roof + HVAC) to GD compare, reject screen only mentions the higher-scoring vertical.
- **Expected:** Could enumerate ("Quote 1 looks like a roofing quote. Quote 2 looks like an HVAC quote.") for transparency.
- **Files involved:** `js/wrong-vertical-guard.js` (per-quote detection vs combined-text detection)
- **Severity:** LOW — UX transparency.

### CV-3: Site-wide header missing About + Contact links
- **Source:** GD audit 2026-04-29 (originally H-1)
- **URL pattern:** Every page on the site
- **Observed:** Primary nav has only "Guides" + "Methodology". About and Contact are reachable from footer only.
- **Expected:** Primary nav includes About + Contact for accessibility + trust.
- **Files involved:** Every HTML page's `<header class="site-header">` block. ~thousands of pages (city-cost pages + analyzer + compare + estimate per vertical).
- **Severity:** LOW — cosmetic / discoverability. Mitigated by footer access.

### CV-4: Shared wrong-vertical reject mixes title-case and sentence-case
- **Source:** GD audit 2026-04-29 (caught during GD-2 re-test)
- **URL pattern:** Every analyze + compare page that uses shared `wrong-vertical-guard.js`
- **Observed:** Reject screen H1 uses sentence case ("Garage door quote") via `nounFor()`, but the score-line uses title case ("Garage Door keywords") via `capitalize()`.
- **Expected:** Pick one style and apply consistently.
- **Files involved:** `js/wrong-vertical-guard.js` line 132 (score-line `capitalize(currentVertical)`).
- **Severity:** LOW — cosmetic.

### CV-8: SEO-hide blanket selector also hides trust banner on reject
- **Source:** Kitchen REDO 2026-04-30 (caught by careful baseline read of reject screenshot)
- **Observed:** Per-vertical inline guards on GD/Foundation/Insulation/Gutters/Kitchen analyzers AND post-render hooks on compare pages of those + Auto + Moving use `document.querySelectorAll(".tp-pdf-noprint")` to hide SEO content on reject. The selector also catches the body-level trust banner ("✓ Free · No email · No phone · No signup · We never sell or share your data").
- **Impact:** When a user hits a wrong-vertical reject, the trust banner — exactly the reassurance they need at that moment ("am I on a legit site?") — disappears. Customer-trust regression.
- **Fix:** Change selector from `.tp-pdf-noprint` → `#main .tp-pdf-noprint` everywhere. Trust banner is body-level (sibling of header + main), stays visible. SEO sections inside main still hide.
- **Status:** Kitchen analyzer + compare fixed in commit `7b013630dc`. Same fix needed on: GD/Foundation/Insulation/Gutters analyzers + compare-{gd,foundation,insulation,gutters,auto,moving}-quotes.html + moving-quote-analyzer.html. Apply during each vertical's REDO at full depth.

### CV-7: Inconsistent bold-tag wrapping between shared module and inline guards
- **Source:** Kitchen compare audit 2026-04-29
- **Observed:** Shared `js/wrong-vertical-guard.js` bolds the *entire* detected noun phrase including "quote": `"looks like a **roofing quote**."` Per-vertical inline guards (GD analyze, Foundation analyze, Kitchen analyze) bold only the noun: `"looks like a **roofing** quote."`
- **Impact:** Different formatting between analyze reject and compare reject for the same vertical. Users hitting both will notice. Minor visual inconsistency.
- **Files involved:** `js/wrong-vertical-guard.js` line 128, OR each per-vertical inline guard.
- **Severity:** LOW — cosmetic only.

### CV-6: Shared price-confirm.js high-confidence short-circuit bypasses wrong-vertical hard-reject
- **Source:** Foundation audit 2026-04-29 (also retroactively explains GD-3 root cause)
- **URL pattern:** Every analyzer page that calls `renderPriceConfirmation`
- **Observed:** `js/price-confirm.js:14-18` does:
  ```js
  if (price && price > 0 && _conf === "high") {
    onConfirm(price);
    return;
  }
  ```
  This bypasses the wrong-vertical detection logic that runs later in the function. So if a vertical's parser extracts a clean price with `"high"` confidence from a quote actually for a different vertical (rare but possible — e.g., a roofing quote with a clean total $ that the foundation parser happens to read confidently), the user gets sent straight into a confused verdict instead of a reject screen.
- **Current mitigation:** GD and Foundation analyzers have inline pre-confirm wrong-vertical guards that catch this case per-vertical. Need to add identical inline guards to all 17 remaining vertical analyzers — OR fix the shared module to do hard-reject before the high-confidence short-circuit.
- **Files involved:** `js/price-confirm.js` (move hard-reject check before short-circuit), or inline patches in each vertical's analyzer HTML.
- **Severity:** MOD — silent vulnerability that would only manifest in narrow conditions but contradicts the "never produce a confident verdict from wrong-vertical document" trust requirement.

### CV-5: Auto-repair analyze landing structure differs from other verticals
- **Source:** GD audit 2026-04-29 (originally GD-CTA-NOTE-1)
- **URL pattern:** /auto-repair.html
- **Observed:** Roofing/HVAC/etc. analyzers use a single-purpose page with H1 "Is your X quote fair?" and an upload zone. Auto-repair uses a 3-tab hub (I Need an Estimate / I Have a Quote / Compare 2-3 Quotes). Functional but structurally different.
- **Expected:** Either match other vertical analyzers' single-purpose structure OR document the deliberate divergence.
- **Files involved:** auto-repair.html (would be addressed in auto-repair audit).
- **Severity:** LOW — cross-vertical UX consistency.

---

## After all 19 individual audits complete

Plan a 4-6 hour cross-vertical sweep:
1. Add `compareUrl` to all 20 entries in `js/vertical-detect.js`
2. Update shared `js/wrong-vertical-guard.js` to use compareUrl when called from compare-page context (new `mode` parameter)
3. Update all 19 compare-X-quotes.html files to pass `mode: "compare"` to the guard
4. Pick H1 vs score-line case style and apply consistently in the shared module
5. Add About + Contact to site-wide header (touches every page; could be done via build-time injection)
6. Optional: enumerate per-slot wrong-vertical detection on compare reject screens
7. Re-run all 19 vertical audits' Step 4 (CTA verification) as regression check
