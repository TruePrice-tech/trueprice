# Woogoro Roadmap

Living document. Updated 2026-04-29 with the monetization plan from the Pro pre-launch session. Bug-fix and per-vertical work tracked in memory file `project_unshipped_queue_2026_04_28.md`; this file is for monetization, growth, and strategic milestones.

## Now (this weekend)

- **Day 5: Flip Pro tier to live mode.** `STRIPE_SECRET_KEY` → `sk_live_`, swap webhook to live `whsec_`, swap to live `STRIPE_PRO_PRICE_ID`. Run one self-purchase + immediate refund to verify. Re-run `scripts/pro-tier-walk.js` against live env. Per `project_pro_tier_ship_status_2026_04_28.md` Day 5 checklist.
- **Vertical-by-vertical human walkthrough** in progress. Roofing first. Goal: solid end-to-end experience across all 20 before Stripe goes live, so we don't ship known regressions onto a billable surface.

## Months 1-3 post-launch (Pro live, low traffic)

Don't model material Pro revenue. Cold traffic with zero brand recognition will pull 0.1-0.3% conversion. Focus is data collection, not revenue.

- **Watch refund rate obsessively.** <2% green, 2-5% yellow, >5% red, >10% emergency rollback.
- **Track conversion by vertical.** Confirm the prediction that medical/legal/solar/roofing pull 2-4x vs small-job verticals.
- **Keep building the SEO asset.** Weekly blog cadence (`project_blog_cadence.md`). Daily handwriting on non-flagship city pages until 100% unique (`project_daily_handwrite_plan.md`).
- **HARO/Connectively backlink work** continues per existing kit (`/haro-pitch-kit.md`). One pitch per weekday minimum.

## Month 3-6 (post-launch, conversion data lands)

- **Per-vertical Pro pricing test.** Bump medical/legal to $29-39. Drop small-job verticals (garage door, brake-job auto repair) to $9 or remove the upsell entirely. Decision driven by the 90-day vertical conversion mix, not guesswork.
- **CTA framing iteration.** "Negotiation Kit" landed 2026-04-29 in [js/pro-tier.js:545-562](js/pro-tier.js#L545-L562). If conversion data points to a different frame ("Action Pack", "Before You Sign Kit", "Contractor Playbook"), test it. Don't iterate before 90 days of baseline data.
- **Pro Annual $49/yr tier** for power users (real-estate investors, contractors checking competitive bids). Behind a flag until churn admin is acceptable.

## Month 6-12 (traffic compounding, secondary monetization activates)

- **Tip jar / "thanks Iris" $5 button** on result pages once daily users cross ~500. Asymmetric: costs nothing to add, captures a goodwill segment that wouldn't have bought Pro. Don't model as primary revenue.
- **Verified Pro $49 one-time** for contractors. Manual reference call from Lane, "Pro Verified" badge displays on directory + city pages. Gates: E&O insurance shipped (per `project_contractor_directory_gates.md`), at least 2K daily users so the badge has visible exposure value. Recurring subscription tier comes later, after Verified Pro evidence accumulates.
- **Aggregate data product spec.** Start cataloging what fields we'd need to anonymize for a B2B data feed. State consumer-affairs offices, homeowners-insurance underwriters (replacement-cost data is genuinely scarce), trade associations. Don't cold-pitch — say yes to warm intros only. Sales cycle 6-18 months but recurring once in.
- **White-label analyzer widget** for industry blogs (NerdWallet, Family Handyman, This Old House). Treat as SEO/backlink investment, not direct revenue. Embed a stripped-down free analyzer on partner sites that links back. Compounds the Pro revenue downstream.

## Month 12-24 (subscription tier becomes possible)

- **Contractor directory premium tier ($69-99/mo).** Only realistic after ~50+ Verified Pro signups have generated organic case-study evidence ("I got 3 jobs from Woogoro this month"). Without that evidence, contractors won't pay. With it, they will. Free basic listings stay forever; paid adds depth (photo gallery, custom description, certifications, dashboard analytics). **Ranking algorithm identical for free and paid** — pay-for-position is banned per `project_monetization_goals.md`.
- **Newsletter sponsorship** when subscriber list crosses ~5K engaged. $500-1,500 per send. Sponsor selection has to be brand-aligned; trust-fragile.
- **Aggregate data licensing first contracts.** Target 1-3 deals at $1-5K/mo recurring. Insurance underwriter pilots most likely first.

## Hard not-to-do (unchanged, never relax)

- Display ads, lead-gen marketplaces, selling user data, sponsored rankings, deceptive "verified" badges, pop-ups / exit-intent / scroll-mats, "subscribe to see results" gates, aggressive retargeting pixels, Reddit posting (Lane permabanned).
- Per `feedback_no_contractor_tools.md`: no contractor-side SaaS. Jobber/Housecall own that lane.
- Per `feedback_no_google.md`: don't expand Google paid services. Free Google tools Lane picks are fine.

## Dependencies and gates

| Milestone | Gate |
|---|---|
| Pro live this weekend | Day 5 ship + Stripe live mode flip |
| Per-vertical pricing test | 90 days of conversion data |
| Tip jar | 500+ daily users |
| Verified Pro $49 | E&O insurance + 2K daily users |
| Aggregate data licensing | First warm intro |
| Contractor directory subscription | E&O + 5K daily users + ~50 Verified Pro proof points |
| Newsletter sponsorship | 5K engaged subscribers |

## What success looks like by month

- **Month 3:** 200-500 daily users, 1-3 Pro purchases per week, $50-200/mo Pro revenue, refund rate <5%.
- **Month 12:** 1,000-3,000 daily users, $2-8K/mo Pro revenue, first Verified Pro signups, first warm B2B inbound.
- **Month 24:** 5,000-15,000 daily users, $10-30K/mo combined revenue (Pro + contractor + data licensing), durable organic traffic across 20 verticals.
- **Month 36:** 15,000+ daily users, $30-60K/mo combined revenue, real shot at the $50K/mo target.

These are realistic-case projections, not optimistic. See "Honest assessment" section below for what could go wrong.

## Honest assessment (2026-04-29)

**Will the site gain traffic on a bootstrap budget?** Yes. The infrastructure is in place. SEO compounds. Content production rate is sustainable solo.

**Will it hit $50K/mo?** ~10% probability within 36 months. Most likely outcome is $5-15K/mo within 24 months — a real but small business, not a unicorn.

**Why it works:**
- $225/mo burn means infinite runway if Lane has any outside income
- Content + flywheel data + no-data-sale posture is a real moat
- Bootstrap is the actual advantage; VC-backed competitors can't match the burn rate or the trust posture

**Why it might not:**
- Google AI Overviews suppress click-through rates ~30-50% on the cost-guide / blog content layer (informational queries). The analyzer, compare, and Pro conversion layers are largely protected because tool-based queries cannot be answered by a summary. Net effect: ~20-35% discovery-layer traffic suppression, NOT existential. Pushes the timeline back ~6-12 months and clips the ceiling ~30%.
- Angi/HomeAdvisor and NerdWallet/Bankrate have 10-20 year backlink moats
- No paid acquisition runway means pure organic, which is slow
- No-display-ads constraint means revenue per visitor is much lower than typical content sites (Woogoro ~$5-15 RPM via Pro vs NerdWallet's $50-100 RPM via affiliate + ads)
- Solo operator concentration risk (burnout, illness, motivation dip)
- Reddit ban closes a real distribution channel for this content category

**Counterintuitive AI-Overview upside:** when users get an AI summary they can't verify, the next instinct is often to look for a credible first-party tool to confirm. "Free analyzer, no data sale, real flywheel from real quotes" is a better landing experience than affiliate-laden cost-guide competitors. The trust moat gets MORE valuable in an AI-Overview world, not less, on the conversion layer.

**Translation:** the path to $5-15K/mo is realistic and probably 18-24 months out. The path to $50K/mo requires either a traffic breakout that's not yet visible in current data, or a new monetization path that compounds faster than ad-free SEO. Plan for the realistic case; treat the breakout case as upside.
