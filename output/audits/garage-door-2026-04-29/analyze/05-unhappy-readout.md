# 05-unhappy readout — Unhappy paths (Step 5 of HUMAN_AUDIT_PROMPT)

URL: https://woogoro.com/garage-door-quote-analyzer.html
Captured: 2026-04-29 ~20:50

## Test A — Refresh during analysis

**Setup:** Upload roof fixture, wait 5s (mid-OCR), reload page.

- **05-during-analysis.png** — confirms page is in `Analyzing your garage door quote...` state with progress bar at ~10%, "Reading text from image..." caption. Standard mid-analysis state. (Same loading state we saw on the broken-cache harness, but here it's transient as expected.)
- **05-after-refresh.png** — clean GD initial state restored. Iris-in-hard-hat mascot, H1 "Is your garage door quote fair?", "Analyze a quote" CTA, file input present, full SEO content below. **Identical to 01-initial.png.**
- Harness state check: `isInitial: true, hasFileInput: true, isStuckOnAnalyzing: false`. **PASS.**

**Verdict:** Refresh during analysis is handled gracefully. No stuck loader, no orphaned state. The page state is purely client-side so reload simply re-renders fresh.

## Test B — Rapid second upload (double-upload race)

**Setup:** Upload roof fixture, wait 2s, attempt second upload of same fixture before first completes.

- **05-after-double-upload.png** — final state is the standard reject screen (since fixture is roof on GD analyzer): H1 "This is not a Garage Door quote", body "looks like a roofing quote", primary "Analyze as Roofing instead", outline "Upload a different file".
- Harness state check: `outcome: "rendered"`. The reject screen rendered correctly within the polling window. No duplicate reject screens stacked, no half-rendered output, no "two analyses running" race.

**Verdict:** Double-upload is handled. The analyzer presumably either queues or replaces the in-flight job. End state is correct. **PASS.**

## Verdict for Step 5

Both unhappy paths produce a clean state. No new findings.

## Untested unhappy paths (deferred for time)

- Upload non-image file (e.g., text or executable) — test next session if scope allows.
- Back-button after reject — same.
- Upload corrupt / 0-byte image — same.
- Upload extreme image (very small or very large) — same.

These are MOD/LOW priority and not blockers. They're queued as nice-to-haves for a follow-up sweep.
