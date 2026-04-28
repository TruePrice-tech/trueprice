# Eyes-on Walk

Walks each vertical's three paths (estimate / analyze / compare) the same way Lane walks them in deep-dive sessions: real fixtures, Lane's address, puppeteer clicks, screenshot every step. The difference: every screenshot batch goes through Claude vision so the **qualitative** stuff a human reviewer would catch — oversized mascots, duplicate images, ranges too wide, missing buttons, copy mismatches with the user's selections, rainbow on a non-Iris mascot, undefined / NaN / $0 — gets surfaced automatically.

## Why this exists

Past dive sessions kept finding 5-20 bugs per vertical because cross-vertical changes (negation guards, scope detection, parsed.city deletion) regressed verticals nobody re-walked. Code-level tests don't catch visual / qualitative regressions. This is the protection layer.

## How it runs

**Tier 1 — commit-time, only when shared code changes.** A pre-push hook runs `check-triggers.js`. If any file in `triggers.json` was touched, it walks the affected verticals before the push. Cost: only fires when you actually edit shared infra.

**Tier 2 — nightly rotation.** GitHub Action `.github/workflows/nightly-eyes-on.yml` picks 2 verticals per night via day-of-month rotation. Full 20-vertical sweep every 10 days. Drift gets caught within a 2-week window even when no one touched shared code.

Both run on **GitHub Actions free tier**, not Vercel cron — Vercel function timeouts (60s) and the existing 8-cron quota make it the wrong host. Anthropic API cost is the only variable: ~$0.30-0.60/night for 2 verticals via Sonnet vision = ~$15/month.

## SEO contract gate (added 2026-04-28)

Same harness, second check. Runs on every push to main (and PRs) via `.github/workflows/seo-gate.yml`. ~30 sec, no puppeteer, no Claude vision — just `fetch` + regex parse against per-template contracts.

Catches the regressions that bit roofing flagship sub-metros: missing canonical, broken JSON-LD, lost OG tags, title/description length drift, accidental `noindex` flips on indexable pages, accidental indexable flips on tool pages.

Five contract templates in `lib/seo-contracts.js`:
- `hub` — vertical hub / cost guide (e.g. `/hvac-cost.html`, `/legal-cost-guide.html`)
- `metroCity` — flagship + non-flagship metro pages (e.g. `/charlotte-nc-roof-cost.html`, `/abilene-tx-foundation-cost.html`)
- `subMetro` — neighborhood pages (e.g. `/ballantyne-charlotte-roof-cost.html`)
- `blog` — blog posts under `/blog/`
- `calculator` — interactive tool pages (e.g. `/legal-billing-calculator.html`)
- `toolNoindex` — estimate / analyzer / compare pages, asserts they STAY noindex

Each contract checks: title length band, description length band, exactly one `<h1>`, canonical points to self, JSON-LD blocks parse + carry expected `@type`, OG tags present, internal-link count above floor, skip-link present, indexability matches policy.

Run locally:
```bash
node scripts/eyes-on-walk/run.js seo                     # check all sample URLs
BASE=http://localhost:3000 node scripts/eyes-on-walk/run.js seo
```

Adding a new sample URL: edit `runners/seo.js` (one of `HUB_URLS` / `METRO_URLS` / `SUBMETRO_URLS` / `CALCULATOR_URLS` / `TOOL_NOINDEX_URLS`).

Adding a new template type: edit `lib/seo-contracts.js`, add a new entry to `TEMPLATES` with a `urlMatches` predicate + the contract fields.

## Local run

```bash
# One vertical
node scripts/eyes-on-walk/run.js fencing

# Today's rotation pair
node scripts/eyes-on-walk/run.js --rotation

# Tier-1 (figure out from current branch diff)
node scripts/eyes-on-walk/run.js --triggered $(node scripts/eyes-on-walk/check-triggers.js)

# Local dev: show the browser
WALK_HEADLESS=false BASE=http://localhost:3000 node scripts/eyes-on-walk/run.js fencing
```

Output lands in `output/eyes-on-<vertical>-<YYYY-MM-DD>/` with `FINDINGS.md`, screenshots, console logs, result-page text dumps.

## Required env

- `ANTHROPIC_API_KEY` — for vision calls (already a repo secret)
- `BASE` — defaults to `https://woogoro.com`; override for local
- `NTFY_TOPIC` — optional; pings phone if any HIGH issue
- `EYES_MODEL` — optional; defaults to `claude-sonnet-4-6`. Use Haiku for cheaper drift checks (`claude-haiku-4-5-20251001`).

## Adding a new vertical runner

Each vertical has its own selectors, question flow, and fixture conventions, so runners are bespoke (mirroring `scripts/<vertical>-walk.js`). To onboard:

1. Copy `runners/fencing.js` to `runners/<vertical>.js`.
2. Update `VERTICAL`, `RESULT_SELECTOR`, `ESTIMATE_PERMUTATIONS`, the URLs, and any vertical-specific selectors (option container IDs, file-input IDs).
3. Confirm `test-quotes/<vertical>-images/manifest.json` exists and the files it lists are on disk.
4. Add the import to `RUNNERS` in `run.js`.
5. Smoke test: `node scripts/eyes-on-walk/run.js <vertical>`.

The pilot is `fencing`. Onboarding the other 19 happens incrementally — each one takes ~20 min (mostly selector verification).

## What the vision pass flags

Per `lib/eyes.js` system prompt:

- **High:** undefined / NaN / $0, range >2x wide, oversized mascot, rainbow on a non-Iris mascot, duplicate images, missing standard CTAs (Save PDF / Share / Get Quotes / Start Over), copy mismatched to user selections, numeric inconsistency across screenshots in the same path
- **Medium:** layout breakage, wrong-vertical fixture not deflected, mismatched confidence labels, "Not stated" for visible OCR data, scope checklist ignoring user's explicit answer
- **Low:** broken / placeholder copy, off-season tips in wrong season, stale dates

Tuning: edit `SYSTEM_PROMPT` in `lib/eyes.js`. Findings stay in their `output/eyes-on-…/FINDINGS.md` for diffing across runs.

## Cost ceiling

- GitHub Actions: ~30 min × ~30 runs/month = 900 min, well under the 2000-min/month free tier for private repos.
- Anthropic API: ~30 screenshots × 2 verticals × 30 runs = 1,800 calls/month, ~50K tokens each = ~90M tokens/month input. Sonnet 4.6 vision: ~$13/month input + ~$2/month output ≈ **$15/month**.
- Vercel: zero impact. Lives outside Vercel cron.
- Resend: 1 email/day, well under free tier.

If cost ever climbs (e.g. running tier-1 on every push to main), switch `EYES_MODEL` to Haiku 4.5 (~5x cheaper) or batch all paths of a vertical into one Claude call.

## Limitations & gaps

- One pilot runner (fencing) only — the other 19 verticals need to be onboarded one at a time.
- No mobile-viewport walk yet — desktop 1280×900 only. Mobile is on the queue.
- The vision pass is non-deterministic; the same screenshot may yield different flags across runs. Mitigated by tight system prompt + JSON output, but expect noise.
- Doesn't click every result-footer CTA (Save PDF, Share, contractor-review, Start Over) — only screenshots the result page. Click-through testing of CTAs is a separate gap that already shows up in deep-dive followup memos.
