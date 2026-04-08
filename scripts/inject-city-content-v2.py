"""
inject-city-content-v2.py — fix the doorway-page penalty.

Walks data/city-context.json (739 cities) × 16 verticals and rewrites each
matching {city}-{state}-{vertical}-cost.html with substantively unique content
per page, using:
  - data/city-context.json     (per-city: climate, permit, weather, materials,
                                avgHomeAge, hailRisk, snowLoad, hoaPrevalence)
  - data/city-cost-multipliers.json (per-city: laborMult, materialsMult,
                                     population, per-service multipliers)
  - data/hvac-city-context.json + plumbing-city-context.json (per-vertical
                                                              specifics where present)
  - climate-zone-keyed per-vertical guidance tables (this file)

For every page we:
  1. Replace the templated local-grid section with a city+vertical-specific grid
  2. Insert an "About {vertical} in {city}" 4-paragraph section that references
     real labor multipliers, real population, real climate, real permit notes,
     and a vertical-specific tip drawn from the climate zone table

Run:
    python scripts/inject-city-content-v2.py
"""

import os, re, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

with open("data/city-context.json", "r", encoding="utf-8") as f:
    CTX = json.load(f)
with open("data/city-cost-multipliers.json", "r", encoding="utf-8") as f:
    MULT = json.load(f)
HVAC_CTX = {}
PLUMB_CTX = {}
if os.path.exists("data/hvac-city-context.json"):
    with open("data/hvac-city-context.json", "r", encoding="utf-8") as f:
        HVAC_CTX = json.load(f)
if os.path.exists("data/plumbing-city-context.json"):
    with open("data/plumbing-city-context.json", "r", encoding="utf-8") as f:
        PLUMB_CTX = json.load(f)

VERTICALS = {
    "roof": ("roofing", "roofing"),
    "hvac": ("HVAC replacement", "hvac"),
    "plumbing": ("plumbing", "plumbing"),
    "electrical": ("electrical work", "electrical"),
    "gutter": ("gutter installation", "gutters"),
    "window": ("window replacement", "windows"),
    "solar": ("solar panel installation", "solar"),
    "siding": ("siding replacement", "siding"),
    "fence": ("fence installation", "fencing"),
    "landscaping": ("landscaping", "landscaping"),
    "painting": ("exterior painting", "painting"),
    "insulation": ("insulation", "insulation"),
    "concrete": ("concrete work", "concrete"),
    "foundation": ("foundation repair", "foundation"),
    "garage-door": ("garage door replacement", "garage-doors"),
    "kitchen-remodel": ("kitchen remodels", "kitchen"),
}

# Climate-zone-keyed vertical tips. Each tip is a complete sentence the
# generator can drop into a city paragraph. Keyed first by climate zone,
# then by vertical slug.
CLIMATE_TIPS = {
    "hot_humid": {
        "roof": "Algae-resistant shingles with copper or zinc granules pay back fast in this climate; standard 3-tabs streak black within 4-5 years.",
        "hvac": "Variable-speed air handlers matter more here than SEER rating alone — they pull humidity out at part-load, which single-stage systems can't.",
        "plumbing": "Water heaters in slab-on-grade homes here often fail at the pan; require a leak sensor and overflow drain on every install.",
        "electrical": "Surge protection at the panel is worth the $300 add-on; afternoon thunderstorms drive most of the appliance damage claims in this region.",
        "gutter": "Oversize to 6-inch K-style and add a kickout flashing where gutters meet siding — undersized gutters overflow during the heavy summer downpours.",
        "window": "Spec Low-E coatings tuned for solar heat gain (SHGC under 0.30) — this matters more here than U-factor.",
        "solar": "South-facing arrays produce 4.8-5.4 sun-hours per day; net metering rules vary by utility, so confirm before signing.",
        "siding": "Fiber cement and engineered wood handle the humidity better than vinyl, which warps under direct south-facing sun.",
        "fence": "Pressure-treated pine rated for ground contact (UC4A) is the local standard; cedar rots in 5-7 years here.",
        "landscaping": "Native and drought-tolerant species (yaupon, muhly grass, lantana) cut irrigation costs and survive both flood and drought.",
        "painting": "Use 100% acrylic latex with mildewcide; oil-based paints fail within 2-3 years on south and west exposures.",
        "insulation": "Attic radiant barriers cut cooling load 8-12% in this climate; spray foam in vented attics traps moisture if not done right.",
        "concrete": "Slabs need vapor barriers under them and air-entrained mix for the freeze events that do happen; expansive clay adds movement risk.",
        "foundation": "Pier-and-beam homes need regular drainage maintenance; slab homes need plumbing leak detection because slab leaks are the #1 cause of foundation movement here.",
        "garage-door": "Specify wind-rated doors (DASMA 110 minimum, 130+ in coastal counties) — most insurance carriers now require it.",
        "kitchen-remodel": "Plan ventilation for high humidity: range hoods should vent outside, not recirculate, to prevent moisture buildup.",
    },
    "hot_dry": {
        "roof": "Tile and stone-coated steel last 40-50 years in this climate; UV degrades asphalt shingles 30% faster than the national average.",
        "hvac": "High-SEER (16+) heat pumps work well year-round here; gas furnaces are usually overkill given mild winters.",
        "plumbing": "Hard water is the dominant pricing factor — water softeners and tankless heaters with descaling kits are standard.",
        "electrical": "Solar-ready panels (200A minimum, with provisions for backfeed) are worth the upgrade given the strong solar economics.",
        "gutter": "Many homes here skip gutters entirely or use only over front doors; the dry climate limits the value of full perimeter gutters.",
        "window": "Spec triple-pane windows on west exposures with the lowest SHGC available (0.20-0.25); afternoon solar gain is the dominant load.",
        "solar": "Among the best solar climates in the country: 5.5-6.5 sun-hours/day. Payback typically 5-7 years before incentives.",
        "siding": "Stucco and fiber cement dominate; vinyl and wood degrade quickly under high UV.",
        "fence": "Block walls and metal fencing outlast wood by decades in this climate; budget 20-30% more upfront for 3x the lifespan.",
        "landscaping": "Xeriscaping with native desert plants saves 40-60% on water bills; many local utilities offer turf removal rebates.",
        "painting": "Use elastomeric or 100% acrylic with high UV resistance; standard paints fade within 3 years on south exposures.",
        "insulation": "Radiant barriers and reflective roof coatings outperform added attic insulation in this climate; cooling load is the priority.",
        "concrete": "Hot-weather concrete placement requires retarders and curing compounds; pours after 10am in summer fail without them.",
        "foundation": "Expansive clay soils common here cause heave and settlement; regular foundation watering during droughts prevents the worst movement.",
        "garage-door": "UV-resistant finishes matter; standard painted steel doors fade within 5 years on south and west exposures.",
        "kitchen-remodel": "Tile and stone counters dominate; engineered quartz handles the heat better than natural stone in sun-exposed kitchens.",
    },
    "mixed_humid": {
        "roof": "Architectural asphalt shingles (30-year minimum) are the regional standard; ice-and-water shield at eaves prevents the freeze-thaw leaks.",
        "hvac": "Heat pumps with gas furnace backup (dual-fuel) are increasingly popular; they handle the swing seasons efficiently.",
        "plumbing": "Frost-line depths run 24-36 inches; require freeze-protected outdoor spigots and proper pipe insulation in unheated spaces.",
        "electrical": "Whole-home generators are common after the 2021 derecho events; transfer switches add $1,500-2,500 to install cost.",
        "gutter": "Standard 5-inch K-style works for most homes; add gutter guards where overhanging trees drop heavy seasonal debris.",
        "window": "Look for U-factor under 0.30 and SHGC around 0.30 — this region needs balanced performance for both heating and cooling.",
        "solar": "4.5-5.0 sun-hours/day average; payback runs 8-12 years depending on net metering rules and electricity rates.",
        "siding": "Fiber cement, vinyl, and engineered wood all perform well here; choose based on aesthetic preference rather than climate fitness.",
        "fence": "Cedar and pressure-treated pine both work; expect 15-20 year lifespan with annual sealing.",
        "landscaping": "Mix native perennials with structured plantings; avoid high-water exotics that struggle in summer humidity.",
        "painting": "100% acrylic latex with mildew-resistant primer is the regional standard; budget for repaint every 7-10 years.",
        "insulation": "Attic R-49 minimum; air sealing the attic floor matters more than added depth in older homes here.",
        "concrete": "Air-entrained mix is mandatory for freeze-thaw resistance; expansion joints every 10-12 feet on driveways and walks.",
        "foundation": "Most homes have basements or crawlspaces; sump pumps and perimeter drains are standard, not optional.",
        "garage-door": "Insulated doors (R-12+) cut heating loss in attached garages with living space above; most carriers offer rebates.",
        "kitchen-remodel": "Soft-close cabinets, quartz counters, and induction cooktops are the current regional standard for mid-range remodels.",
    },
    "mixed_dry": {
        "roof": "Tile, metal, and architectural shingles all perform well; UV is the limiting factor on shingles, with 20-25 year typical service life.",
        "hvac": "Heat pumps work efficiently year-round; cold-climate models extend the range for the rare deep freezes.",
        "plumbing": "Hard water is common; whole-house softeners and tankless heaters with descaling routines are standard.",
        "electrical": "Solar-ready panels and EV charger circuits are increasingly common in new construction.",
        "gutter": "Smaller gutters (5-inch) handle most rain events; ice-and-water shield matters more than gutter capacity here.",
        "window": "Triple-pane on north and west exposures; standard double-pane Low-E elsewhere.",
        "solar": "5.0-5.5 sun-hours/day; among the better solar climates outside the desert SW.",
        "siding": "Stucco, fiber cement, and engineered wood all work; vinyl is acceptable but UV fades it faster than humid regions.",
        "fence": "Cedar, vinyl, and metal all common; expect 20-25 year lifespan on quality materials.",
        "landscaping": "Drought-tolerant natives are the smart choice; many utilities offer turf-removal rebates.",
        "painting": "100% acrylic with high-UV pigments; budget repaint every 8-10 years on south and west exposures.",
        "insulation": "Attic R-49+ and air sealing matter equally for the heating-dominant winters.",
        "concrete": "Air-entrained mix for freeze resistance; cure properly in dry conditions to prevent surface cracking.",
        "foundation": "Variable soils — verify with a geotechnical report on any major foundation work.",
        "garage-door": "Insulation matters for attached garages with bedrooms above; R-13 minimum is the regional norm.",
        "kitchen-remodel": "Standard mid-range finishes apply; nothing climate-specific drives material choices.",
    },
    "cold": {
        "roof": "Architectural shingles plus ice-and-water shield 6 feet up from the eaves is the regional standard; ice dams are the #1 cause of leaks here.",
        "hvac": "Gas furnaces (96%+ AFUE) remain the dominant heat source; heat pumps need cold-climate certification (NEEP listed) to work below 5°F.",
        "plumbing": "Frost-line depths run 36-48 inches; freeze-protected spigots, pipe insulation in attics and crawlspaces, and shutoff valves on every outdoor line are mandatory.",
        "electrical": "Whole-home generators are increasingly common; budget $5,000-8,000 installed for a 14-22kW propane or natural gas unit.",
        "gutter": "Heated gutter cables ($400-800 installed) prevent ice dams on north-facing eaves; heated downspouts where snow loads are heavy.",
        "window": "U-factor under 0.27 is worth the upgrade here; argon-filled triple-pane windows pay back in 7-10 years given winter heating bills.",
        "solar": "3.8-4.5 sun-hours/day; payback runs 10-14 years, with snow shedding a key factor for low-pitch arrays.",
        "siding": "Fiber cement and insulated vinyl handle freeze-thaw best; wood requires aggressive maintenance.",
        "fence": "Cedar, vinyl, and metal all work; set posts below the local frost line (36-48 inches) to prevent heaving.",
        "landscaping": "Cold-hardy natives and zone-appropriate perennials; avoid exotics rated for warmer zones.",
        "painting": "100% acrylic latex; paint between May and September to allow proper curing before first frost.",
        "insulation": "Attic R-60 and wall R-21+ are increasingly standard for new builds; air sealing matters as much as insulation depth.",
        "concrete": "Air-entrained mix (5-7%) is mandatory; sealers extend service life on driveways exposed to road salt.",
        "foundation": "Most homes have full basements; perimeter drainage, sump pumps, and crack monitoring are standard maintenance items.",
        "garage-door": "Insulated doors (R-13 minimum, R-18+ preferred) cut heating costs and prevent freeze damage to garage plumbing.",
        "kitchen-remodel": "Standard mid-range finishes; ventilation routing matters where exterior walls have insulation that can't be easily breached.",
    },
    "very_cold": {
        "roof": "Standing-seam metal lasts 50+ years and sheds snow naturally; architectural shingles need ice-and-water shield 6+ feet from eaves and on all valleys.",
        "hvac": "Cold-climate heat pumps now work to -15°F, but most homes still spec a gas furnace (96%+ AFUE) or dual-fuel for true reliability in deep cold.",
        "plumbing": "Frost-line depths run 48-72 inches; PEX is the dominant interior material for its freeze tolerance; require heat tape on any exposed pipes.",
        "electrical": "Whole-home generators are nearly standard given multi-day winter outages; budget $7,000-12,000 installed.",
        "gutter": "Heated gutter systems ($600-1,200 installed) and ice-and-water shield 6+ feet up the roof are essential to prevent ice damming.",
        "window": "Triple-pane with low U-factor (0.20-0.25) and thermally broken frames; this is one of the few climates where the upgrade pays back in under 8 years.",
        "solar": "3.5-4.2 sun-hours/day; consider snow shedding angle (35°+) and heated panels in heavy snow regions.",
        "siding": "Fiber cement and insulated vinyl handle the freeze-thaw cycles best; standard vinyl can crack in deep cold.",
        "fence": "Set posts 48-60 inches deep below frost line; cedar and metal both work.",
        "landscaping": "Stick to USDA zone-appropriate plantings; spring planting after last frost is critical for survival.",
        "painting": "Paint only during the brief warm season (June-August) to allow full curing before fall.",
        "insulation": "Attic R-60+ and wall R-21+ are the regional minimum; spray foam crawlspaces to prevent frozen pipes.",
        "concrete": "Air-entrained mix and proper curing blankets are mandatory; salt damage shortens driveway lifespan, so use sealer.",
        "foundation": "Frost-protected shallow foundations or full basements 8+ feet deep; insulation below grade is standard.",
        "garage-door": "Insulated doors (R-18+) and weather seals; uninsulated doors cause garage freeze damage every year.",
        "kitchen-remodel": "Standard finishes; ventilation routing matters where exterior walls are heavily insulated.",
    },
    "marine": {
        "roof": "Moss-resistant shingles or metal are worth the upgrade; the constant moisture grows moss on standard asphalt within 3-5 years.",
        "hvac": "Heat pumps dominate this mild climate; gas furnaces are often overkill given the moderate winter heating loads.",
        "plumbing": "Freeze risk is low but not zero in the colder pockets; standard interior plumbing works without special freeze protection.",
        "electrical": "Standard 200A panels are typical; surge protection is less critical here than in lightning-prone regions.",
        "gutter": "Oversize to 6-inch with leaf guards; the constant rain plus heavy tree debris overwhelms standard 5-inch gutters.",
        "window": "Standard double-pane Low-E works well; the mild climate doesn't justify triple-pane in most homes.",
        "solar": "3.5-4.0 sun-hours/day — among the lowest in the lower 48; payback runs 12-16 years and depends heavily on net metering.",
        "siding": "Fiber cement and pre-finished cedar dominate; standard vinyl absorbs moisture and warps.",
        "fence": "Cedar is the local favorite; pressure-treated pine works but rots faster in the constant moisture.",
        "landscaping": "Native rhododendrons, ferns, and conifers thrive; avoid drought-tolerant plants that rot in the wet winters.",
        "painting": "100% acrylic with mildewcide; oil-based paints fail within 3-4 years given the constant moisture.",
        "insulation": "Vapor barriers and proper venting matter more than R-value alone; trapped moisture is the dominant failure mode.",
        "concrete": "Sealers prevent moss and algae growth; standard mixes work without freeze additives.",
        "foundation": "Most homes have crawlspaces; vapor barriers, drainage, and crawlspace encapsulation are common upgrades.",
        "garage-door": "Insulation matters less here; corrosion-resistant hardware matters more given the salt air on coastal homes.",
        "kitchen-remodel": "Standard mid-range finishes; ventilation matters for moisture control.",
    },
    "subarctic": {
        "roof": "Metal roofing is the only sane choice; asphalt shingles fail within 10-12 years in this climate.",
        "hvac": "Hydronic radiant heat with high-efficiency boilers is standard; heat pumps don't work reliably below -20°F.",
        "plumbing": "Heat tape, deep frost-protected lines, and freeze sensors throughout; budget 30-50% more than national average for any plumbing work.",
        "electrical": "Generators are essential; multi-day winter outages can be life-threatening.",
        "gutter": "Many homes skip gutters entirely; ice loads tear them off the eaves anyway.",
        "window": "Triple-pane minimum; quad-pane in the most extreme cold pockets.",
        "solar": "3.0-4.0 sun-hours/day with extreme seasonal variation; rarely cost-effective without strong incentives.",
        "siding": "Pre-finished metal or fiber cement; standard materials fail under extreme freeze-thaw.",
        "fence": "Set posts 60+ inches deep; freeze heave destroys shallow installations within one winter.",
        "landscaping": "Limited to extremely cold-hardy natives; growing season is short.",
        "painting": "Brief paint season (June-August); plan multi-year projects accordingly.",
        "insulation": "R-60+ everywhere is the standard; spray foam is dominant.",
        "concrete": "Air-entrained mix, curing blankets, and frost-protected foundations are mandatory.",
        "foundation": "Permafrost considerations matter in some areas; consult local engineers.",
        "garage-door": "Heavily insulated doors (R-20+) with deep weather seals.",
        "kitchen-remodel": "Standard finishes work; ventilation routing requires careful planning around exterior wall insulation.",
    },
}

# Fallback for any climate zone not in CLIMATE_TIPS
FALLBACK_TIP = {
    v: f"Get at least three quotes from licensed local contractors before signing any {label} contract."
    for v, (label, _) in VERTICALS.items()
}

INJECTED_MARKER = "<!-- TP-LOCAL-INJECTED-V2 -->"
LEGACY_MARKER = "<!-- TP-LOCAL-INJECTED -->"

def slug(name):
    return name.lower().replace(" ", "-").replace(".", "").replace("'", "").replace(",", "")

def labor_phrase(mult):
    if mult is None: return ""
    pct = round((mult - 1.0) * 100)
    if pct >= 8:
        return f"Labor rates here run roughly {pct}% above the national average per BLS metro data, which is the single biggest driver of how this city's pricing differs from the national midpoint."
    if pct <= -8:
        return f"Labor rates here run roughly {abs(pct)}% below the national average per BLS metro data, which is the main reason this city's pricing sits below the national midpoint."
    return "Labor rates here track within a few points of the national average, so most of the price variation comes from material costs and local market dynamics rather than wage differentials."

def population_phrase(pop):
    if not pop: return ""
    if pop >= 500000:
        return f"As a major metro of {pop:,} residents, the local contractor market is deep — expect 10+ legitimate bidders on any standard residential job."
    if pop >= 100000:
        return f"With a population of {pop:,}, the local market has enough contractors to drive real competition on price, but you should still get three quotes."
    if pop >= 30000:
        return f"At {pop:,} residents, the local pool is moderate; expect 4-6 active contractors for most standard residential work."
    return f"With a smaller population of {pop:,}, the local contractor pool is limited and pricing is sticky; consider contractors from nearby larger cities for competitive bids."

def get_vertical_tip(climate_zone, vertical_slug, hvac_extra=None, plumb_extra=None):
    if vertical_slug == "hvac" and hvac_extra:
        # Use the rich pre-generated HVAC content
        bits = [hvac_extra.get("climateNote",""), hvac_extra.get("systemTip","")]
        return " ".join(b for b in bits if b)
    if vertical_slug == "plumbing" and plumb_extra:
        bits = [plumb_extra.get("waterNote",""), plumb_extra.get("materialTip","")]
        return " ".join(b for b in bits if b)
    return CLIMATE_TIPS.get(climate_zone, {}).get(vertical_slug) or FALLBACK_TIP.get(vertical_slug, "")

def build_local_grid_html(city, state, ctx, mult, vlabel, climate_zone, hvac_extra, plumb_extra, vslug):
    vert_tip = get_vertical_tip(climate_zone, vslug, hvac_extra, plumb_extra)
    weather = ctx.get("weatherNote") or ""
    permit = ctx.get("permitNote") or ""
    insight = ctx.get("localInsight") or ""
    home_age = ctx.get("avgHomeAge")
    age_phrase = f"The local housing stock averages around {home_age} years old, " if home_age else "Local housing varies widely in age, "
    return f'''<section class="section">
<h2>{vlabel.capitalize()} in {city}, {state}: what locals should know</h2>
<div class="local-grid">
<div class="local-card">
<div class="local-card-icon">&#9729;&#65039;</div>
<h3>Climate &amp; site factors</h3>
<p>{weather or vert_tip}</p>
</div>
<div class="local-card">
<div class="local-card-icon">&#127968;</div>
<h3>Local housing stock</h3>
<p>{age_phrase}which affects job scope on most {vlabel} projects in {city}. Older homes often need code upgrades that newer construction does not.</p>
</div>
<div class="local-card">
<div class="local-card-icon">&#128737;</div>
<h3>Permits &amp; licensing</h3>
<p>{permit or f"Confirm with the {city} building department whether your project needs a permit before signing — most {vlabel} jobs above $1,000 do."} Always verify your contractor pulls the permit themselves.</p>
</div>
<div class="local-card">
<div class="local-card-icon">&#128184;</div>
<h3>Local market</h3>
<p>{insight or f"The {city} contractor market is competitive enough to support honest pricing on standard {vlabel} jobs."}</p>
</div>
</div>
</section>'''

def build_about_section_html(city, state, ctx, mult, vlabel, climate_zone, hvac_extra, plumb_extra, vslug):
    service_mult = (mult.get("serviceMultipliers") or {}).get(VERTICALS[vslug][1])
    labor_mult = mult.get("laborMult")
    pop = mult.get("population")
    vert_tip = get_vertical_tip(climate_zone, vslug, hvac_extra, plumb_extra)
    permit = ctx.get("permitNote") or ""
    weather = ctx.get("weatherNote") or ""
    material_tip = ctx.get("materialTip") or ""
    home_age = ctx.get("avgHomeAge")
    hail = ctx.get("hailRisk")
    snow = ctx.get("snowLoad")
    hurricane = ctx.get("hurricaneZone")
    growth = ctx.get("growthRate")

    risk_bits = []
    if hail and hail in ("moderate","high"): risk_bits.append(f"{hail} hail risk")
    if snow and snow in ("moderate","high"): risk_bits.append(f"{snow} snow load")
    if hurricane: risk_bits.append("hurricane exposure")
    risk_phrase = (", ".join(risk_bits) + " — all of which contractors here have to plan for") if risk_bits else "stable weather conditions year-round"

    if service_mult is not None:
        sm_pct = round((service_mult - 1.0) * 100)
        if sm_pct >= 5:
            price_phrase = f"For {vlabel} specifically, our cost-multiplier model puts {city} at roughly {sm_pct}% above the national midpoint."
        elif sm_pct <= -5:
            price_phrase = f"For {vlabel} specifically, our cost-multiplier model puts {city} at roughly {abs(sm_pct)}% below the national midpoint."
        else:
            price_phrase = f"For {vlabel} specifically, {city} sits within a few points of the national midpoint on our cost model."
    else:
        price_phrase = ""

    growth_phrase = ""
    if growth == "high":
        growth_phrase = f"{city}'s rapid recent growth has tightened the contractor market — expect longer lead times and less negotiating room than smaller markets."
    elif growth == "moderate":
        growth_phrase = f"{city} has seen steady growth, which means a healthy supply of established contractors with multi-year track records."
    elif growth == "low":
        growth_phrase = f"{city}'s stable population means contractor capacity rarely tightens, so off-season pricing (typically Nov-Feb) can save 10-15% on non-emergency work."

    return f'''{INJECTED_MARKER}
<section class="section" style="background:#fafbff;padding:24px;border-radius:14px;border:1px solid #e2e8f0;margin:32px 0;">
<h2>About {vlabel} in {city}, {state}</h2>
<p><strong>Why pricing varies in {city}.</strong> {labor_phrase(labor_mult)} {price_phrase}</p>

<p><strong>Local conditions.</strong> {weather or "Local weather is moderate enough that climate is not the dominant pricing factor here, but contractors still adjust scope for"} {city} sees {risk_phrase}. {vert_tip}</p>

<p><strong>Permits, codes, and licensing.</strong> {permit or f"Most {vlabel} projects in {city} require a permit; confirm with the local building department before signing."} {material_tip}</p>

<p><strong>Contractor market.</strong> {population_phrase(pop)} {growth_phrase}</p>
</section>
'''

def normalize_marker_block(content):
    """Strip any prior injected v1 OR v2 about-section so re-runs are idempotent."""
    for marker in (INJECTED_MARKER, LEGACY_MARKER):
        if marker in content:
            pattern = re.compile(re.escape(marker) + r'.*?</section>\s*', re.DOTALL)
            content = pattern.sub("", content, count=1)
    return content

def process_file(filepath, city, state, ctx, mult, vslug, vlabel, climate_zone, hvac_extra, plumb_extra):
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except FileNotFoundError:
        return False

    new_grid = build_local_grid_html(city, state, ctx, mult, vlabel, climate_zone, hvac_extra, plumb_extra, vslug)
    pattern_grid = re.compile(
        r'<section class="section">\s*<h2>[^<]*</h2>\s*<div class="local-grid">.*?</div>\s*</section>',
        re.DOTALL
    )
    new_content, _ = pattern_grid.subn(new_grid, content, count=1)

    new_content = normalize_marker_block(new_content)
    about = build_about_section_html(city, state, ctx, mult, vlabel, climate_zone, hvac_extra, plumb_extra, vslug)
    if "<!-- TP-INTERNAL-TOOLS-BLOCK -->" in new_content:
        new_content = new_content.replace(
            "<!-- TP-INTERNAL-TOOLS-BLOCK -->",
            about + "\n<!-- TP-INTERNAL-TOOLS-BLOCK -->",
            1
        )
    elif "</main>" in new_content:
        new_content = new_content.replace("</main>", about + "\n</main>", 1)
    else:
        new_content = new_content.replace("</body>", about + "\n</body>", 1)

    if new_content != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    return False

def main():
    cities = list(CTX.keys())
    print(f"loaded {len(cities)} cities from city-context.json")

    total_processed = 0
    total_changed = 0
    no_match = 0

    for ck in cities:
        if "|" not in ck: continue
        city, state = ck.split("|", 1)
        ctx = CTX[ck]
        mult = MULT.get(ck, {})
        climate_zone = ctx.get("climateZone", "mixed_humid")
        hvac_extra = HVAC_CTX.get(ck)
        plumb_extra = PLUMB_CTX.get(ck)
        slug_city = slug(city)
        slug_state = state.lower()

        for vslug, (vlabel, _) in VERTICALS.items():
            fn = f"{slug_city}-{slug_state}-{vslug}-cost.html"
            if not os.path.exists(fn):
                no_match += 1
                continue
            total_processed += 1
            if process_file(fn, city, state, ctx, mult, vslug, vlabel, climate_zone, hvac_extra, plumb_extra):
                total_changed += 1

    print(f"\n=== DONE ===")
    print(f"  files processed: {total_processed}")
    print(f"  files changed:   {total_changed}")
    print(f"  city-vertical combos with no file: {no_match}")

if __name__ == "__main__":
    main()
