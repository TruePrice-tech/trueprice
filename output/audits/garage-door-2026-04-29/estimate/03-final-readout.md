# 03-final readout — GD estimate happy-path verdict (Step 3 of HUMAN_AUDIT_PROMPT)

URL: https://woogoro.com/garage-door-estimate.html (after wizard walk)
Captured: 2026-04-29 (latest run via estimate-wizard step)

## Wizard inputs walked

- Step 1: "Single Car Door"
- Step 2: "Basic Steel"
- Step 3: "Yes (adds $350-$500)" — context implies opener inclusion question
- Address from harness: 123 Maple St, Fort Mill, SC 29710

## Final estimate verdict (read every word)

**Header:** "Your Garage Door Estimate" / "WOOGORO GARAGE DOOR VERDICT" / green check

### Numbers
- **Estimated cost: $1,550**
- **Expected range: $1,350 – $1,800**

Range width: $450 = ~29% of midpoint. Standard 0.88/1.15 band check: $1,550 × 0.88 = $1,364 (close to $1,350); $1,550 × 1.15 = $1,783 (close to $1,800). **Range bands consistent with site-wide convention** (per `project_estimate_range_bands.md`).

### Project Details
- Service type: **"Single Car (8x7)"** — *flag below*
- Material: Basic Steel
- Opener: Included
- Pricing: **"Fort Mill local pricing"** — local pricing engaged correctly

### What This Estimate Includes (8 checkmark bullets)
- Old door removal and disposal
- Tracks and hardware
- Torsion/extension springs
- Garage door opener
- Remote controls
- Weatherstripping and seals
- Safety sensors and auto-reverse
- Warranty (parts + labor)

### Disclaimer
"Estimate assumes standard installation. Custom framing, electrical work, or structural modifications may add cost." — clear and honest.

### Next Steps (4 items)
1. Ask if quote includes removal and disposal
2. Confirm new tracks/hardware
3. Verify warranty covers parts AND labor
4. Ask about insulation R-value if energy efficiency matters

### Ways to Save (6 items)
- Manufacturer rebates (Clopay, Wayne Dalton, Amarr, CHI: $50-$200 off)
- Bundle door + opener install (crew-day discount $100-$200 off)
- Off-season scheduling (late fall/winter 10-15% lower)
- Insulated R-12+ utility rebates (dsireusa.org)
- Smart openers may qualify for insurance discounts
- Cash discount 3-5%

### Safety Reminders (3 items)
- Never DIY spring replacement
- Ensure safety sensors and auto-reverse per federal req
- Wind load rating for hurricane zones

### Bottom row
- Feedback: "Yes accurate" / "My quote was higher" / "My quote was lower"
- Was this helpful: 👍 👎
- Got a real quote? Share it anonymously — price-confirm form (location: "Help neighbors in Fort Mill, SC get fair prices")
- Email notify "if garage door prices change in Fort Mill, SC"
- Back/Save PDF/Share link/Home

### Below verdict
Full SEO content from landing page repeated (cost table, factors, city grid, FAQ).

## Number sanity check

- Steel single-layer (per page table): $700-$1,500
- Basic opener (per page table): $300-$600
- Total expected: $1,000-$2,100
- **Shown midpoint: $1,550** — plausible center of that range. ✓

Estimate produces sensible numbers for the chosen wizard inputs, with proper local-pricing flag and standard estimate-range-band math.

## Findings

### GD-EST-2 (MOD): Wizard "Single Car" defaults to 8x7, but page's own cost table says 9x7 is standard
- **Severity:** MOD (data inconsistency, customer-visible)
- **URL:** /garage-door-estimate.html
- **Observed:** Final estimate label says "Single Car (8x7)". The page's own cost-by-type explainer text states: *"A standard 9x7 single-car steel garage door installed runs $700–$1,800."* and *"Custom widths (8x7 narrow single, 18x8 oversized double) typically cost 20–40% more than standard sizes due to special-order pricing and adjusted hardware."* So 8x7 is explicitly called out as a *custom narrow* size.
- **Expected:** "Single Car Door" wizard option should default to **9x7** (standard size), not 8x7 (custom narrow).
- **Status:** **OPEN** — to be fixed by changing the wizard's default size mapping for "Single Car Door" to 9x7. Per per-vertical-only rule, this fix applies only to GD; will need to investigate `garage-door-estimate.html` source for the size mapping.
- **Impact:** Customer may compare $1,550 to a 9x7 contractor quote and decide it's high (since 8x7 custom should cost 20-40% more, the comparison would be apples-to-oranges).

### GD-EST-3 (LOW): Compact 3-question wizard skips size choice
- **Severity:** LOW (UX simplicity vs. accuracy trade-off)
- **Observed:** Wizard has only 3 steps (Service type, Material, Opener?). No explicit size option (8x7 vs 9x7 vs 10x7), no insulation R-value question, no smart-opener-tier question. The default size is implied by the service-type pick.
- **Expected:** Either keep 3 steps (current — sacrifice precision for simplicity, document this trade-off), OR add granular sub-questions for size + insulation + opener tier.
- **Status:** **DEFERRED** — design choice, not bug. Logged for product roadmap. Related to GD-EST-2 (the 8x7 default would be fixed by either adding size choice or hard-coding 9x7).

## Verdict

GD estimate happy-path produces a sensible, well-formatted, info-rich verdict. Numbers are in plausible range. One MOD finding (GD-EST-2) about the size default mismatching the page's own cost table.

**Step 3 of HUMAN_AUDIT_PROMPT for GD estimate:** PASS with one MOD finding to fix.
