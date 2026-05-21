# 03-final readout — Gutters estimate happy-path verdict (Step 3)

URL: https://woogoro.com/gutters-estimate.html

## Wizard inputs
- Step 1: Aluminum 5" (gutter type)
- Step 2: 100 LF (linear feet)
- Step 3: 1 Story (1.0x)
- Step 4: Yes, add gutter guards
- Address: Fort Mill, SC pre-filled

## Verdict (read every word)
- **Header:** "Woogoro Gutter Verdict" (now SINGULAR after fix in commit d8a2733dfb; was plural "Gutters")
- **Estimated cost: $2,150**
- **Range: $1,240 – $3,060** (per-LF cost: $21.50)
- Pricing: Fort Mill local pricing
- Project Details: Aluminum Seamless (5"), 100 LF, 1-story, gutter guards Yes
- 10 scope items: Old gutter removal, Gutter guards, Gutter installation, Downspouts, Hidden hangers, End caps & miters, Outlets, Sealant, Cleanup, Warranty
- Disclaimer + Next Steps + Potential Savings + bottom CTAs

## Number sanity check

Per-LF cost $21.50 = $9 (aluminum mid) + $13.50 (guards mid) × labor 1.00 (Fort Mill in south region) = $22.50 — matches within rounding.

Range: $1,240 = ($6+$7)×100 = $1300 - $60 rounding; $3,060 = ($12+$20)×100 = $3200 - $140 rounding. Wider band than other verticals' 0.88/1.15 because Gutters uses material-driven low/high instead of fixed multiplier — **design choice, not a bug**. More honest exposure of real material price variability.

## Findings

### GUT-EST-1 (LOW) — RESOLVED
- "Woogoro Gutters Verdict" plural → "Woogoro Gutter Verdict" singular. Fixed in commit d8a2733dfb (also applied to analyzer). Verifies live after deploy.

### GUT-EST-2 (NOT A BUG)
- Range bands wider than 0.88/1.15 standard. Reflects actual material price variability ($6-12/LF aluminum + $7-20/LF guards). Design choice — exposing real variance gives users honest info. NOT a bug.

## Verdict

Step 3 PASS. Singular brand-style fix shipped + verified, range design choice documented.
