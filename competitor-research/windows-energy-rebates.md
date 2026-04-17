# Windows energy savings, rebates, and tax credits (2026)

## Part 1: ENERGY STAR climate zones

ENERGY STAR (Version 7.0, effective Oct 2023 and still current in 2026) divides the US into 4 climate zones for windows, doors, and skylights. Criteria are set by the EPA and published at energystar.gov.

### Zone map

**Northern (N)** — heating-dominated. Low U-factor is the priority; SHGC is unrestricted (higher SHGC actually helps by letting in passive solar heat).
- States (wholly or mostly): AK, ME, NH, VT, MA, NY, MI, MN, WI, ND, SD, MT, ID, WY, most of WA, OR (east of Cascades), northern PA, northern CT, northern IL, northern IA, northern NE, northern UT, northern CO, most of Maine/Vermont/New Hampshire.

**North-Central (NC)** — mixed heating and cooling, heating dominant.
- States: southern PA, NJ, southern CT, southern NY (NYC/LI), OH, IN, southern IL, MO, KS, NE (south), IA (south), most of CO, UT, NV (north), northern CA (Bay Area / inland), WV, northern KY, northern VA, northern DE, MD (north), RI coast.

**South-Central (SC)** — mixed, cooling dominant.
- States: VA (south), NC, TN, AR, OK, northern TX, NM, AZ (north), southern NV (Las Vegas), most of CA (LA/inland/Central Valley), southern KY.

**Southern (S)** — cooling-dominated. Low SHGC is the priority.
- States: FL, GA, AL, MS, LA, southern TX (Houston/Austin/SA/Rio Grande), southern AZ (Phoenix/Tucson), HI, PR, coastal southern CA (San Diego).

Zone boundaries actually follow **counties**, not state lines — large states (CA, TX, AZ, NV, CO, UT, VA, NC) are split across 2 or even 3 zones. The authoritative county-level map is the PDF at energystar.gov: "ENERGY STAR Climate Zones for Windows, Doors, and Skylights" map.

### Maximum U-factor and SHGC by zone (Version 7.0)

| Zone | ENERGY STAR U-factor max | ENERGY STAR SHGC | Most Efficient U-factor max | Most Efficient SHGC |
|---|---|---|---|---|
| Northern | ≤ 0.22 | Any (≥ 0.17 if claiming passive solar "equivalent energy performance" path) | ≤ 0.20 | ≥ 0.20 |
| North-Central | ≤ 0.25 | ≤ 0.40 | ≤ 0.20 | ≤ 0.40 |
| South-Central | ≤ 0.28 | ≤ 0.23 | ≤ 0.20 | ≤ 0.23 |
| Southern | ≤ 0.32 | ≤ 0.23 | ≤ 0.25 | ≤ 0.23 |

Notes:
- U-factor units are Btu/(h·ft²·°F). Lower = better insulation.
- SHGC (Solar Heat Gain Coefficient) ranges 0–1. Lower = blocks more solar heat.
- Visible Transmittance (VT): no hard cap, but ENERGY STAR recommends **VT ≥ 0.40** for good daylighting. Most Efficient rule: Light-to-Solar-Gain ratio (LSG = VT/SHGC) ≥ 1.10 in N-Central/S-Central/Southern.
- Northern zone has an alternative "equivalent energy performance" path: U ≤ 0.26 + SHGC ≥ 0.32, or U ≤ 0.28 + SHGC ≥ 0.42.

### Quick ZIP → zone lookup

Easiest reliable methods, in order of preference:
1. **NFRC/ENERGY STAR ZIP lookup widget** — energystar.gov has a "Find products for your climate zone" tool that accepts ZIP and returns the zone. No public API, but the page is scrapable.
2. **Static ZIP → county → zone CSV**: Build once from (a) HUD USPS ZIP-county crosswalk (free CSV, quarterly) + (b) the ENERGY STAR county-level climate zone list (published as an Excel file alongside the zone map PDF). Result: a ~42k-row ZIP→zone lookup table (~500 KB) shippable as a static JSON in the repo. **This is the recommended approach for Woogoro** — zero API calls, instant lookup, no rate limits.
3. **Approximation by state**: Acceptable fallback for states that are entirely in one zone (FL, GA, AL, MS, LA, HI = Southern; AK, ME, VT, NH, MN, ND, MT = Northern). Fails for CA/TX/AZ/NV/VA/NC where ZIP resolution is mandatory.

Source: https://www.energystar.gov/products/residential_windows_doors_skylights/key_product_criteria

---

## Part 2: Utility rebates (top 20 programs)

Rebates for ENERGY STAR windows are less common than for HVAC/insulation because windows have longer paybacks, but several major utilities and state programs still offer them in 2026. Many window-specific rebates have been folded into broader "whole-home weatherization" or Home Energy Rebate (HOMES/HEAR, IRA-funded) programs rolling out state-by-state through 2026.

| Utility / Program | States | Per-window rebate | Eligibility | Claim method | Active 2026? |
|---|---|---|---|---|---|
| **Mass Save** (Eversource, National Grid, Unitil, Cape Light) | MA | $75/window (triple-pane ENERGY STAR Northern Most Efficient only) | Single-pane replacement only; ENERGY STAR certified; whole-home assessment required | Post-install via Mass Save portal, contractor can file | Yes |
| **NYSERDA EmPower+ / Comfort Home** | NY | Up to $1,000 total for windows as part of weatherization bundle | Income-qualified (EmPower+) or any homeowner (Comfort Home); participating contractor | Through BPI-certified contractor | Yes |
| **Con Edison** | NY (NYC/Westchester) | No standalone window rebate; covered under NY Clean Heat + weatherization | — | — | Window-specific: No |
| **Efficiency Vermont** | VT | $40/window (ENERGY STAR Northern) up to 10 windows | ENERGY STAR certified, replacing single-pane | Mail-in rebate form with receipt | Yes |
| **Efficiency Maine** | ME | $40–$90/window (tiered by U-factor); triple-pane bonus | U ≤ 0.22, registered contractor preferred | Online application + invoice | Yes |
| **Focus on Energy** | WI | $75/window (ENERGY STAR Northern) | Owner-occupied, ENERGY STAR, max 15 windows | Online rebate app, post-install | Yes |
| **Xcel Energy** | CO, MN, NM, WI | CO: $40/window; MN: folded into Home Energy Squad weatherization | ENERGY STAR Northern/N-Central | Online portal, post-install | Yes (CO), partial (MN) |
| **CenterPoint Energy** | MN, AR, IN, OH, TX | MN: $25/window (gas heat home); others: no window rebate | Gas-heated home, ENERGY STAR | Mail-in | Yes (MN only) |
| **DTE Energy** | MI | $50/window (ENERGY STAR Northern) | Single-pane replacement, ENERGY STAR | Online portal | Yes |
| **Consumers Energy** | MI | $15/window (small — mostly symbolic) | ENERGY STAR, gas/electric customer | Online | Yes |
| **PSEG Long Island** | NY | $50/window under Home Comfort program | ENERGY STAR, BPI contractor | Through contractor | Yes |
| **National Grid (Upstate NY)** | NY | Bundled in Comfort Home | — | Contractor | Yes |
| **Eversource CT** | CT | $50/window (ENERGY STAR North-Central/Northern) | Electric heat home; ENERGY STAR certified | Online rebate | Yes |
| **Rhode Island Energy** (formerly National Grid RI) | RI | $50/window | ENERGY STAR, replacing single-pane | Online | Yes |
| **Avista** | WA, ID, OR | $2/sq ft of window (≈ $30–60/window) | ENERGY STAR Northern, electric heat | Mail-in | Yes |
| **Puget Sound Energy** | WA | $50/window (ENERGY STAR Northern, U ≤ 0.22) | Electric heat primary, ENERGY STAR | Online portal | Yes |
| **Energy Trust of Oregon** | OR | $2.25/sq ft (≈ $35–70/window) | ENERGY STAR Northern, Trade Ally contractor | Contractor files | Yes |
| **PG&E** | CA (northern) | No standalone window rebate in 2026 | — | — | No (ended 2019) |
| **SCE / SoCalGas** | CA (southern) | No standalone window rebate | — | — | No |
| **TVA EnergyRight** | TN, AL, KY, MS, GA, NC, VA | No per-window rebate; offered through local power companies as part of home uplift (income-qualified) | — | Via local utility | Limited |
| **Duke Energy** | NC, SC, FL, IN, OH, KY | No standalone window rebate | — | — | No |
| **Ameren IL / IL Home Energy** | IL | $40/window (ENERGY STAR, replacing single-pane) | Gas/electric customer, ENERGY STAR | Online | Yes |
| **ComEd / Nicor Gas Home Energy Rebates** | IL | Bundled in weatherization only | — | Contractor | Partial |

**IRA-funded HOMES & HEAR programs (launching 2025–2026 rollout):** Every state is launching or has launched a federally-funded Home Energy Rebate program under the IRA. Most include windows as an eligible measure when installed as part of a whole-home retrofit that achieves ≥ 20% (HOMES) modeled energy savings. Rebate size varies: **up to $4,000** per home (HOMES) or **$8,000** for low-income households. Windows alone rarely trigger the 20% threshold, so this is typically stacked with insulation/air sealing. Check the state energy office site for current status — as of early 2026, ~30 states have launched, the rest pending.

---

## Part 3: IRA federal tax credit for windows

The **Energy Efficient Home Improvement Credit (Section 25C)**, revamped by the Inflation Reduction Act in Aug 2022, took effect Jan 1, 2023 and is the current credit for window replacements.

- **Credit %**: **30%** of the product cost.
- **Annual cap (windows/skylights)**: **$600 per year** (aggregate across all windows/skylights). This is a sub-cap inside a broader $1,200 annual cap for building envelope improvements.
- **Per-door sub-cap (separate)**: $250/door, $500 total/year — does not affect windows, noted for context.
- **Total annual 25C cap**: $3,200/year ($1,200 envelope + $2,000 heat pumps/biomass).
- **What qualifies**: Windows and skylights that meet **ENERGY STAR Most Efficient** certification for the year of installation. (Not regular ENERGY STAR — it must be the "Most Efficient" tier. This is stricter than pre-IRA and is the single biggest gotcha for homeowners.)
- **What's excluded**: **Labor/installation is NOT eligible** for windows (unlike heat pumps and biomass, where labor IS eligible). Only the product cost of the windows themselves counts. Window frames, glass, and factory-installed hardware count; site-built framing, trim, and install labor do not.
- **New construction vs replacement**: **Replacement only.** The home must be an **existing home** that is the taxpayer's **principal residence** in the US. New construction does NOT qualify. Rentals owned by the taxpayer do NOT qualify (must be owner-occupied). Second homes: partial — qualify for some 25C measures but NOT for the window/door envelope credit per IRS guidance.
- **How to claim**: **IRS Form 5695** (Residential Energy Credits), Part II, filed with Form 1040 for the tax year the windows were placed in service. Keep the **manufacturer's PIN / QM (Qualified Manufacturer) code** — starting in 2025, windows must come from a registered Qualified Manufacturer and the PIN must be entered on Form 5695. Without the PIN the credit is denied.
- **Status in 2026**: **Active.** Credit is available for windows placed in service **Jan 1, 2023 through Dec 31, 2032**.
- **Sunset date**: Dec 31, 2032 under current law. No phase-down scheduled — full 30% / $600 cap applies every year through 2032. (Note: the 2025 budget reconciliation discussions floated early sunset; as of April 2026 no such legislation has been enacted and the credit remains at full value.)
- **Annual, not lifetime**: Unlike the pre-IRA credit (which had a $500 lifetime cap), the $600 windows cap **resets every year**. A homeowner can do 4 windows in 2026, 4 more in 2027, and claim $600 each year.

**State credits that stack on top of the federal 25C:**
- **NY**: No state income tax credit for windows, but NYSERDA rebates stack.
- **MA**: No state tax credit, but Mass Save rebate stacks.
- **MD**: Clean Energy Grant — no windows.
- **MT**: Energy Conservation Installation Credit — up to $500 state credit, includes windows. Stacks with federal.
- **OR**: State residential energy tax credit ended 2017 — does not stack.
- **SC**: Energy-efficient manufactured home credit only — windows in conventional homes do not qualify.
- **AZ**: Solar energy credit only — windows not covered.
- **Most other states**: No stacking state income tax credit. Utility rebate stacking is common; state tax credit stacking is rare.

---

## Synthesis: what Woogoro should surface in the windows estimate result

Based on a user's ZIP code entered at the start of the estimate, the result page should automatically show:

1. **"Your climate zone: [Northern / North-Central / South-Central / Southern]"** — derived from a static ZIP→county→zone JSON shipped in the repo.
2. **"Target these specs for ENERGY STAR Most Efficient":**
   - U-factor ≤ [0.20 / 0.20 / 0.20 / 0.25 based on zone]
   - SHGC [≥ 0.20 for Northern; ≤ 0.40 for NC; ≤ 0.23 for SC/S]
   - "This tier qualifies for the federal tax credit."
3. **"Federal tax credit you qualify for":**
   - 30% of window cost, up to $600/year
   - Requires ENERGY STAR **Most Efficient** certification (not just ENERGY STAR)
   - Product cost only — labor not included
   - Claim via IRS Form 5695 — ask contractor for the manufacturer PIN
   - Available through 2032
   - Show a live calculation: "On your estimated $[X] window cost, you'd save $[min(X*0.30, 600)]"
4. **"Utility rebates in your area"**: ZIP → utility lookup (static table keyed by state + utility service territory) → show applicable programs from the Part 2 table with dollar amount, eligibility bullet, and "Claim via [method]". For states with no program, show: "No utility rebate available in your area — check DSIRE for updates."
5. **"State tax credit"**: Only shown for MT (and any future state added). For all others, suppress this section.
6. **"IRA Home Energy Rebate status"**: One-liner per state based on HOMES/HEAR launch tracker — "Your state's HOMES program is live — windows qualify as part of a whole-home retrofit" or "Launching [month] 2026".
7. **Call-to-action**: "Get quotes from contractors who know these rebates" → quote path with a pre-filled note: "I'm targeting ENERGY STAR Most Efficient ([zone]) for the federal tax credit and [utility] rebate."

Implementation note: All of this is derivable from ZIP alone using 3 static JSON files shipped in the repo (zip→zone, zip→utility, state→rebate programs + state tax credits). Zero external API calls, all load instantly at result-render time.

---

## Sources

- https://www.energystar.gov/products/residential_windows_doors_skylights/key_product_criteria
- https://www.energystar.gov/products/most_efficient/most_efficient_criteria_residential_windows
- https://www.energystar.gov/saveathome/windows_doors (ZIP-based product finder)
- https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit
- https://www.irs.gov/forms-pubs/about-form-5695
- https://www.dsireusa.org/ (canonical state-level incentive database)
- https://www.energystar.gov/rebate-finder
- https://www.masssave.com/residential/rebates-and-incentives/windows
- https://www.nyserda.ny.gov/All-Programs/Comfort-Home-Program
- https://www.efficiencyvermont.com/rebates/list/efficient-windows
- https://www.efficiencymaine.com/at-home/windows/
- https://www.focusonenergy.com/residential
- https://www.xcelenergy.com/programs_and_rebates (CO, MN)
- https://www.dteenergy.com/us/en/residential/save-money-energy/rebates-incentives-programs.html
- https://www.consumersenergy.com/residential/save-money-and-energy/rebates
- https://www.pseg.com/saveenergyandmoney (PSEG LI)
- https://www.eversource.com/content/residential/save-money-energy/energy-efficiency/rebates-incentives (CT)
- https://www.rienergy.com/RI-Home/Energy-Saving-Programs
- https://www.myavista.com/save-energy/rebates
- https://www.pse.com/en/rebates
- https://www.energytrust.org/incentives/
- https://energyright.com/residential/ (TVA)
- https://www.ameren.com/illinois/residential/energy-efficiency
- https://www.energy.gov/scep/home-energy-rebates-programs (IRA HOMES/HEAR state tracker)
- https://www.energy.gov/scep/state-home-energy-rebate-program-status
