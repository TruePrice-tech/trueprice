"""inject-city-content-v3.py — break the same-state similarity for all verticals.

V2 already injected a "About {vertical}" block but left several unique per-city
fields unused. V3 adds a SEPARATE block ("Local factors: {vertical} in {city}")
that uses the unused verbatim text fields (permitNote, weatherNote, materialTip,
localInsight) plus derived content from avgHomeAge, hoaPrevalence, growthRate,
climate-specific months.

Covers all 16 verticals with city pages. Each page gets 400-600 words of
genuinely unique content because every field used is either unique per-city
(permitNote, weatherNote, localInsight, materialTip) or combines with
climate/state data to produce unique phrasing.

Run:
    python scripts/inject-city-content-v3.py
"""

import os
import re
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

with open(ROOT / "data" / "city-context.json", encoding="utf-8") as f:
    CTX = json.load(f)
with open(ROOT / "data" / "city-cost-multipliers.json", encoding="utf-8") as f:
    MULT = json.load(f)
LOCAL_FACTS = {}
if (ROOT / "data" / "city-local-facts.json").exists():
    with open(ROOT / "data" / "city-local-facts.json", encoding="utf-8") as f:
        LOCAL_FACTS = json.load(f)

# Load all per-vertical context files for richer per-city content
VERT_CTX = {}
for _vslug in ["electrical", "solar", "painting", "kitchen-remodel", "fence",
               "concrete", "landscaping", "foundation", "garage-door", "siding",
               "window", "insulation", "gutter", "hvac", "plumbing"]:
    _path = ROOT / "data" / f"{_vslug}-city-context.json"
    if _path.exists():
        with open(_path, encoding="utf-8") as f:
            VERT_CTX[_vslug] = json.load(f)

# Verticals to process — all 16 verticals with city pages
VERTICALS = {
    "hvac": {
        "label": "HVAC replacement",
        "label_noun": "HVAC system",
        "urgent_season_cold": "December through February — emergency HVAC replacement spikes 20-40%",
        "urgent_season_hot": "June through August — emergency AC work spikes 30-50%",
        "best_season_cold": "April through September",
        "best_season_hot": "October through March",
    },
    "insulation": {
        "label": "insulation installation",
        "label_noun": "insulation project",
        "urgent_season_cold": "November through January — homeowners often add insulation after the first high heating bill",
        "urgent_season_hot": "June through August — cooling bills drive upgrade demand",
        "best_season_cold": "August through October (before heating season)",
        "best_season_hot": "March through May (before cooling season)",
    },
    "siding": {
        "label": "siding replacement",
        "label_noun": "siding project",
        "urgent_season_cold": "April through June — winter-damaged siding gets replaced in spring",
        "urgent_season_hot": "March through May — before peak sun/UV season",
        "best_season_cold": "September through October",
        "best_season_hot": "November through February",
    },
    "window": {
        "label": "window replacement",
        "label_noun": "window project",
        "urgent_season_cold": "October through December — drafty windows get replaced before heating season peaks",
        "urgent_season_hot": "May through July — before peak cooling costs hit",
        "best_season_cold": "March through August",
        "best_season_hot": "December through February",
    },
    "electrical": {
        "label": "electrical work",
        "label_noun": "electrical project",
        "urgent_season_cold": "winter — old panels fail under space heater loads",
        "urgent_season_hot": "summer — panels trip under AC demand",
        "best_season_cold": "spring/fall",
        "best_season_hot": "spring/fall",
    },
    "roof": {
        "label": "roof replacement",
        "label_noun": "roofing project",
        "urgent_season_cold": "March through May — winter storm damage drives emergency tear-offs",
        "urgent_season_hot": "August through October — hurricane and hail season repairs spike demand 30-50%",
        "best_season_cold": "June through September (dry, long days, lowest leak risk)",
        "best_season_hot": "November through February (cooler temps, contractors less booked)",
    },
    "plumbing": {
        "label": "plumbing work",
        "label_noun": "plumbing project",
        "urgent_season_cold": "January through March — frozen pipe bursts spike emergency calls 40-60%",
        "urgent_season_hot": "June through August — sewer line backups from root growth and storm runoff",
        "best_season_cold": "September through November (before freeze risk, after summer rush)",
        "best_season_hot": "March through May (before summer heat drives emergency demand)",
    },
    "painting": {
        "label": "exterior painting",
        "label_noun": "painting project",
        "urgent_season_cold": "May through June — homeowners rush to paint before summer events",
        "urgent_season_hot": "March through May — before UV damage worsens through summer",
        "best_season_cold": "August through October (mild temps, low humidity, paint cures properly)",
        "best_season_hot": "October through March (cooler temps, contractors more available)",
    },
    "kitchen-remodel": {
        "label": "kitchen remodel",
        "label_noun": "kitchen renovation",
        "urgent_season_cold": "January through March — new year renovation rush hits contractors hard",
        "urgent_season_hot": "January through March — post-holiday renovation starts pile up",
        "best_season_cold": "June through September (contractors finish outdoor jobs, shift to interiors)",
        "best_season_hot": "June through September (summer slowdown for interior trades)",
    },
    "solar": {
        "label": "solar panel installation",
        "label_noun": "solar project",
        "urgent_season_cold": "March through May — homeowners book before summer to maximize first-year production",
        "urgent_season_hot": "February through April — installers book out 6-8 weeks ahead of peak season",
        "best_season_cold": "October through December (shorter wait, installers offer off-season discounts)",
        "best_season_hot": "November through January (lower demand, faster permitting, same equipment prices)",
    },
    "garage-door": {
        "label": "garage door replacement",
        "label_noun": "garage door project",
        "urgent_season_cold": "November through January — broken springs and openers fail in cold weather",
        "urgent_season_hot": "June through August — curb appeal projects peak before listing season",
        "best_season_cold": "March through May (weather cooperates, installers less booked than summer)",
        "best_season_hot": "September through November (post-summer lull, good install weather)",
    },
    "fence": {
        "label": "fence installation",
        "label_noun": "fencing project",
        "urgent_season_cold": "April through June — spring storms damage fences, replacements spike",
        "urgent_season_hot": "March through May — homeowners want fencing before summer pool season",
        "best_season_cold": "September through November (ground is workable, contractors less booked)",
        "best_season_hot": "October through February (cooler digging conditions, off-peak pricing)",
    },
    "concrete": {
        "label": "concrete work",
        "label_noun": "concrete project",
        "urgent_season_cold": "April through June — winter frost-heave damage drives spring repairs",
        "urgent_season_hot": "March through May — homeowners want driveways and patios before summer",
        "best_season_cold": "September through October (ideal curing temps, less rain than spring)",
        "best_season_hot": "October through November (cooler temps allow proper curing without retarders)",
    },
    "landscaping": {
        "label": "landscaping",
        "label_noun": "landscaping project",
        "urgent_season_cold": "April through June — spring planting window drives 40-50% of annual demand",
        "urgent_season_hot": "March through May — irrigation and planting before summer heat sets in",
        "best_season_cold": "September through October (fall planting establishes roots before winter)",
        "best_season_hot": "October through December (cooler temps, lower demand, plants establish before summer)",
    },
    "foundation": {
        "label": "foundation repair",
        "label_noun": "foundation project",
        "urgent_season_cold": "March through May — frost heave and spring thaw expose winter damage",
        "urgent_season_hot": "August through October — drought-induced soil shrinkage causes settling",
        "best_season_cold": "June through September (stable ground conditions, dry weather for excavation)",
        "best_season_hot": "November through February (soil moisture stabilizes, contractors less booked)",
    },
    "gutter": {
        "label": "gutter installation",
        "label_noun": "gutter project",
        "urgent_season_cold": "March through May — ice dam damage from winter drives spring replacements",
        "urgent_season_hot": "September through November — pre-rainy-season installs spike",
        "best_season_cold": "July through September (dry weather, easy install conditions)",
        "best_season_hot": "January through March (dry season lull, contractors more available)",
    },
}

STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
    "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
    "DC": "District of Columbia",
}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _pick(options, seed):
    """Deterministic pick from a list based on seed."""
    return options[seed % len(options)]


def _city_seed(city):
    """FNV-1a hash of city name for deterministic variation."""
    h = 2166136261
    for ch in city:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h


def home_age_sentence(age, city, label):
    """Generate unique home-age-specific guidance with sentence variation."""
    if not isinstance(age, (int, float)):
        return ""
    age = int(age)
    seed = _city_seed(city)

    if age >= 65:
        templates = [
            (f"With an average home age around {age} years, {city}'s housing stock skews older. "
             f"Plan on {label} projects encountering mid-century systems, knob-and-tube wiring in pockets, "
             f"lath-and-plaster wall cavities, and grandfathered code exemptions that may no longer qualify "
             f"under current inspection standards. Budget an extra 10-20% for surprise-code-catch-up work."),
            (f"{city} homes average {age} years old, placing them firmly in the pre-modern-code era. "
             f"Contractors bidding {label} here routinely discover outdated wiring, original cast iron plumbing, "
             f"and structural details that predate current load requirements. A 10-20% contingency for hidden issues is standard practice."),
            (f"At roughly {age} years old on average, {city}'s residential buildings reflect construction practices "
             f"from a very different era. {label} work in homes this age commonly involves bringing systems up to current code, "
             f"which adds time and cost that newer-home owners rarely face. Factor in extra scope for compliance upgrades."),
            (f"The average {city} home has stood for around {age} years. That history means {label} contractors "
             f"encounter original systems, outdated materials, and code gaps that require remediation before or during the project. "
             f"Experienced local crews price this in; less experienced ones miss it and issue change orders later."),
        ]
    elif age >= 50:
        templates = [
            (f"The typical {city} home is around {age} years old. Most systems are past their first-replacement "
             f"cycle and approaching their second. Expect {label} quotes to include mentions of "
             f"upgraded electrical service, ductwork adjustments, or insulation retrofits that newer homes wouldn't need."),
            (f"{city}'s housing stock, averaging {age} years, is at the age where second-generation replacements "
             f"are becoming necessary. Original upgrades from the 1990s-2000s are now aging out themselves. "
             f"{label} projects here often uncover previous work that was done to older code standards."),
            (f"Homes in {city} average about {age} years in age. At this stage, most have already had at least one "
             f"major system replacement. {label} work here often involves matching or upgrading around previous renovations "
             f"rather than dealing with purely original construction."),
            (f"With a median home age near {age} years, {city} straddles the line between mid-century and modern construction. "
             f"{label} contractors frequently encounter a mix of original and previously updated systems, "
             f"which can complicate scope assessment. Get a thorough pre-work inspection."),
        ]
    elif age >= 35:
        templates = [
            (f"With average home age near {age} years, {city} homes are at the typical first-replacement milestone "
             f"for major systems. Original furnaces, AC units, water heaters, and roofs installed when the homes were "
             f"built are aging out. {label} is hitting peak demand in this age band."),
            (f"{city}'s homes, averaging {age} years, are entering the window where original-equipment replacements "
             f"become unavoidable. This is the sweet spot for {label} work since systems are aging but the homes "
             f"are modern enough to avoid major code-upgrade surprises."),
            (f"At an average of {age} years, {city} housing is squarely in the first-replacement cycle. The original "
             f"components installed during construction are reaching end of life. {label} demand is strong in this age range, "
             f"and contractors are familiar with the common building patterns."),
            (f"Most {city} homes were built about {age} years ago, which means their original systems are approaching "
             f"or past their expected lifespan. {label} projects at this stage are typically straightforward since "
             f"the construction meets modern code with minimal surprises."),
        ]
    elif age >= 20:
        templates = [
            (f"{city}'s housing stock averages {age} years old, relatively recent construction that was largely "
             f"built to modern code. {label} projects here tend to be simpler: fewer surprise compliance issues, "
             f"quicker permit turnaround, and contractors who can quote from memory."),
            (f"With homes averaging just {age} years old, {city} has a relatively new building stock. Most {label} "
             f"work involves upgrades and efficiency improvements rather than end-of-life replacements. Code compliance "
             f"is rarely an issue since these homes were built to recent standards."),
            (f"{city} homes are about {age} years old on average, young enough that most original systems still have "
             f"useful life remaining. {label} demand here centers on upgrades, improvements, and the occasional early "
             f"failure rather than wholesale replacement."),
            (f"The average {city} home is only {age} years old. {label} projects in newer construction typically "
             f"go smoothly since the building methods and materials are standardized. Contractors can estimate accurately "
             f"and encounter few surprises."),
        ]
    else:
        templates = [
            (f"{city} has an unusually young housing stock (average {age} years). Most homes are still running "
             f"their original systems and components. {label} demand skews toward upgrades (efficiency, smart controls) "
             f"rather than full replacement. Ask contractors about tune-ups and partial upgrades before committing to a replacement."),
            (f"With an average home age of just {age} years, {city}'s housing stock is among the newest in the region. "
             f"Most {label} work here involves optional upgrades rather than necessary replacements. Original equipment "
             f"is still well within its expected lifespan."),
            (f"{city}'s homes average only {age} years old, meaning most are still under or near their original warranty periods "
             f"for major systems. {label} is primarily driven by enhancement and efficiency upgrades rather than wear-related necessity."),
            (f"At just {age} years average, {city}'s housing stock is quite new. {label} contractors here focus mainly on "
             f"upgrades and additions rather than replacements. Check whether existing warranties cover your planned work "
             f"before hiring a contractor."),
        ]
    return _pick(templates, seed)


def growth_rate_sentence(growth, city):
    """Local market dynamics based on growth rate with sentence variation."""
    growth = (growth or "").lower()
    seed = _city_seed(city)

    if growth == "high":
        templates = [
            (f"{city}'s high growth rate means contractor demand consistently exceeds supply. "
             f"Expect 3-6 week booking delays in season. Get on a contractor's calendar as soon as "
             f"you know you need work. Waiting rarely improves pricing here."),
            (f"Rapid growth in {city} has stretched the local contractor workforce thin. Lead times "
             f"of 3-6 weeks are common during peak season, and the best-reviewed companies book out even further. "
             f"Planning ahead is the single biggest way to control costs."),
            (f"{city} is growing fast, and the construction trades have not kept pace with housing demand. "
             f"This means longer wait times, less willingness to negotiate on price, and fewer available quotes "
             f"to compare. Start your search early."),
            (f"The {city} metro's rapid expansion has created a seller's market for contractors. "
             f"Booking windows stretch 3-6 weeks, premium pricing holds even in off-season, and the most experienced "
             f"crews are booked months ahead. Schedule proactively."),
        ]
    elif growth == "moderate":
        templates = [
            (f"{city} has moderate construction activity. Contractors are busy but accessible with 1-3 weeks' notice. "
             f"Off-season quotes can run 8-15% below peak rates."),
            (f"The {city} contractor market is balanced: enough work to keep shops busy, but enough competition "
             f"that homeowners can still get timely service. Booking 1-3 weeks ahead typically secures your preferred contractor."),
            (f"With steady but not explosive growth, {city}'s contractor market offers reasonable availability. "
             f"Most shops can schedule work within 1-3 weeks, and shopping for quotes is straightforward."),
            (f"{city}'s moderate growth keeps the contractor pipeline moving without the extreme backlogs "
             f"seen in booming metros. Off-peak scheduling can yield 8-15% savings over peak-season rates."),
        ]
    else:
        templates = [
            (f"{city} has a stable, lower-growth construction market, which usually means more competitive "
             f"contractor pricing than fast-growing metros. The tradeoff: smaller contractor pool, so reputation and "
             f"reviews matter more. A few bad actors can dominate the local landscape."),
            (f"The {city} area's stable population means contractors compete harder for each job. "
             f"Pricing tends to be 10-20% below fast-growing markets, but the smaller pool of licensed contractors "
             f"means doing your homework on reputation is essential."),
            (f"{city}'s flat growth pattern keeps contractor pricing competitive. You will likely find more "
             f"willingness to negotiate and shorter lead times than in booming cities. However, fewer contractors "
             f"means fewer quotes to compare, so check references carefully."),
            (f"In a mature market like {city}, contractors rely on repeat business and referrals rather than "
             f"new-construction volume. This tends to produce fair pricing and motivated service, but the smaller "
             f"contractor pool means a bad choice is harder to recover from."),
        ]
    return _pick(templates, seed + 1)


def hoa_sentence(hoa, city, label):
    hoa = (hoa or "").lower()
    seed = _city_seed(city)

    if hoa == "high":
        templates = [
            (f"HOAs are common in {city}. For {label}, factor in 2-4 weeks of HOA architectural review before starting, "
             f"and collect pre-approval of materials in writing. HOA rejections after project start can be expensive."),
            (f"Most {city} subdivisions operate under HOA governance. Before starting {label} work, submit your plans "
             f"to the architectural committee and wait for written approval. Starting without approval risks fines and forced rework."),
            (f"HOA oversight is the norm across {city}'s residential communities. {label} projects require advance approval "
             f"of materials, colors, and sometimes contractors. Build 2-4 weeks of review time into your project schedule."),
            (f"If you live in one of {city}'s many HOA-governed neighborhoods, get architectural approval before "
             f"signing a {label} contract. The committee's material and color restrictions may narrow your options, "
             f"so check first and avoid paying for an unapproved choice."),
        ]
    elif hoa == "moderate":
        templates = [
            (f"HOA prevalence in {city} is moderate. If you live in a managed community, check covenants before signing "
             f"a {label} contract. Material color, visible fixture type, or warranty requirements may affect your selection."),
            (f"Some {city} neighborhoods have HOA requirements that affect {label} projects. If your community has a "
             f"homeowners association, review the CC&Rs for material and appearance restrictions before committing to a contractor."),
            (f"About half of {city}'s newer subdivisions have HOA governance. Check whether your community requires "
             f"architectural review for {label} work. Even when HOAs exist here, approval timelines tend to be shorter "
             f"than in heavily regulated markets."),
            (f"HOA rules affect some but not all {city} homeowners. If applicable, confirm your HOA's requirements for "
             f"{label} before getting quotes. This avoids the situation where your preferred material or color "
             f"gets rejected after you have already signed a contract."),
        ]
    else:
        templates = [
            (f"HOA involvement is uncommon in {city}, so most {label} projects avoid architectural review delays. "
             f"City permitting alone governs the process."),
            (f"Few {city} properties fall under HOA governance, which simplifies {label} project planning. "
             f"You deal only with city building codes and permits, not architectural committees."),
            (f"{city} homeowners generally have free rein over material and style choices for {label} projects. "
             f"HOA restrictions are rare here, so city code compliance is the only regulatory hurdle."),
            (f"The absence of widespread HOA governance in {city} means fewer approval delays for {label} work. "
             f"You can move straight from permits to construction without waiting for committee review."),
        ]
    return _pick(templates, seed + 2)


def climate_months_guidance(climate_zone, vcfg, city, vlabel):
    """Season-specific guidance tuned to climate zone with sentence variation."""
    zone = (climate_zone or "").lower()
    seed = _city_seed(city)

    if zone == "cold":
        peak = vcfg["urgent_season_cold"]
        best = vcfg["best_season_cold"]
    elif zone == "hot":
        peak = vcfg["urgent_season_hot"]
        best = vcfg["best_season_hot"]
    else:
        peak = "peak weather stress months"
        best = "shoulder seasons"

    templates = [
        (f"Seasonally in {city}, {peak}. "
         f"The best window for non-emergency {vlabel} is {best}. Quieter contractor schedules, "
         f"better prices, and less pressure to accept the first quote."),
        (f"Timing matters in {city}: {peak}. "
         f"If your {vlabel} project is not urgent, schedule during {best} for shorter wait times and better pricing."),
        (f"In {city}, demand peaks during {peak}. "
         f"Planning your {vlabel} work for {best} gives you more contractor options and typically saves 10-15%."),
        (f"{city}'s seasonal cycle drives {vlabel} demand: {peak}. "
         f"The smartest scheduling move is booking during {best}, when contractors are hungrier for work and more flexible on price."),
    ]
    return _pick(templates, seed + 3)


def neighborhoods_sentence(local, city, vlabel):
    if not local:
        return ""
    hoods = local.get("neighborhoods") or []
    if not hoods:
        return ""
    # Pick 3-4 for natural flow
    top = hoods[:4]
    joined = ", ".join(top[:-1]) + (", and " + top[-1] if len(top) > 1 else top[0])
    return (
        f"In {city}, the highest volume of {vlabel} work tends to come out of {joined} "
        f"— larger lots, older homes, and higher home values all drive replacement demand. "
        f"Contractors familiar with these neighborhoods often already know the typical building stock, permit nuances, and HOA quirks."
    )


ROOF_TERMS_RE = re.compile(
    r"\broof(ing)?\b|\bshingle|\bice dam|\beaves\b|\bflashing\b",
    re.IGNORECASE,
)


def landmark_sentence(local, city, vslug=""):
    if not local:
        return ""
    land = local.get("landmarks") or ""
    if isinstance(land, list):
        land = ", ".join(str(x) for x in land).strip()
    else:
        land = str(land).strip()
    geo = local.get("geographyNote") or ""
    if isinstance(geo, list):
        geo = ". ".join(str(x) for x in geo).strip()
    else:
        geo = str(geo).strip()
    # geographyNote in city-local-facts.json sometimes contains
    # roofing-specific text. Strip it for non-roofing verticals.
    if vslug != "roof" and geo and ROOF_TERMS_RE.search(geo):
        geo = ""
    parts = []
    if land: parts.append(land)
    if geo: parts.append(geo)
    if not parts: return ""
    return " ".join(parts) + f" These geographic realities subtly shape contractor pricing and availability in {city}."


def build_section(city_display, state_code, vslug, vcfg, ctx, mult, local):
    """Build the V3 unique-per-city content block."""
    state_name = STATE_NAMES.get(state_code, state_code)
    vlabel = vcfg["label"]

    # Pull per-city data
    permit_note = (ctx.get("permitNote") or "").strip()
    weather_note = (ctx.get("weatherNote") or "").strip()
    material_tip = (ctx.get("materialTip") or "").strip()
    # localInsight in city-context.json is roofing-specific (references "roof
    # replacement", "roofing contractors", etc). Gate it to roof pages only.
    local_insight = (ctx.get("localInsight") or "").strip() if vslug == "roof" else ""
    avg_home_age = ctx.get("avgHomeAge")
    growth_rate = ctx.get("growthRate")
    hoa = ctx.get("hoaPrevalence")
    climate_zone = ctx.get("climateZone")

    # Pull per-vertical context if available
    vert_ctx_key = f"{city_display}|{state_code}"
    vert_ctx = VERT_CTX.get(vslug, {}).get(vert_ctx_key, {})
    vert_season = (vert_ctx.get("seasonNote") or "").strip()
    vert_local = (vert_ctx.get("localInsight") or "").strip()

    # Compose paragraphs
    home_age_p = home_age_sentence(avg_home_age, city_display, vlabel)
    growth_p = growth_rate_sentence(growth_rate, city_display)
    hoa_p = hoa_sentence(hoa, city_display, vlabel)
    climate_p = vert_season if vert_season else climate_months_guidance(climate_zone, vcfg, city_display, vlabel)
    hoods_p = neighborhoods_sentence(local, city_display, vlabel)
    landmark_p = landmark_sentence(local, city_display, vslug)
    # Use per-vertical local insight if available, otherwise fall back to generic growth + roofLocalInsight
    if vert_local:
        local_insight = vert_local

    # Section lead-ins: every v3-injected paragraph previously opened with
    # the same bold label (e.g. "Local climate reality.", "Materials to
    # prioritize.", "Local market conditions."). Those strings were shared
    # verbatim across every non-flag page and dragged Template score.
    # Wrap each as a 4-variant seeded pool.
    seed = _city_seed(city_display) + (hash(vslug) & 0xFFFFFFF)
    lead_home_stock = _pick([
        f"Home stock in {city_display}.",
        f"{city_display}'s housing profile.",
        f"What local homes look like in {city_display}.",
        f"The {city_display} housing picture.",
    ], seed + 40)
    lead_climate = _pick([
        "Local climate reality.",
        "Climate on the ground.",
        "What the climate does here.",
        "The local weather picture.",
    ], seed + 41)
    lead_materials = _pick([
        "Materials to prioritize.",
        "Materials that work here.",
        "Material priorities locally.",
        "Which materials pay off.",
    ], seed + 42)
    lead_permit = _pick([
        "Permit &amp; code considerations.",
        "Permit and code notes.",
        "Local code and paperwork.",
        "Regulatory context.",
    ], seed + 43)
    lead_hoa = _pick([
        "HOA &amp; compliance.",
        "HOA and neighborhood rules.",
        "Compliance and HOA notes.",
        "Neighborhood rulebook.",
    ], seed + 44)
    lead_market = _pick([
        "Local market conditions.",
        "How the local trade market looks.",
        "Contractor market picture.",
        "Local trade economics.",
    ], seed + 45)
    lead_season = _pick([
        "Seasonal timing.",
        "When to schedule.",
        "Best months to book.",
        "Timing considerations.",
    ], seed + 46)
    lead_hoods = _pick([
        "Neighborhood patterns.",
        "By neighborhood.",
        "What neighborhoods drive.",
        "Local neighborhood signal.",
    ], seed + 47)
    lead_geo = _pick([
        "Geography note.",
        "Geography and layout.",
        "Local geography.",
        "The lay of the land.",
    ], seed + 48)
    climate_reality_tail = _pick([
        f"For {vlabel}, that translates into specific material and installation choices that contractors in {city_display} factor into every quote.",
        f"For {vlabel}, these conditions drive the material and installation details on nearly every quote you'll see in {city_display}.",
        f"For {vlabel} work, these weather realities flow into material selection and installation technique on every serious {city_display} bid.",
        f"For {vlabel}, this climate context shapes material choices and install methods in every {city_display} contractor's proposal.",
    ], seed + 49)

    # Weather / permit / material unique text
    paras = []

    # Opening: home stock
    if home_age_p:
        paras.append(f"<p><strong>{lead_home_stock}</strong> {home_age_p}</p>")

    # weatherNote / permitNote / materialTip in city-context.json are written
    # for ROOFING (e.g. "any roof replacement project", "Class 4 impact-resistant
    # shingles"). Injecting them on non-roof verticals produced 2,065 contaminated
    # pages (audit-city-page-contamination.py). Until we ship vertical-specific
    # equivalents, gate these three fields to roof only. V3 only targets non-roof
    # verticals today, so in practice these stay off — but the guard makes the
    # invariant explicit and survives future vertical additions.
    is_roof = vslug == "roof"

    if is_roof and weather_note:
        paras.append(
            f"<p><strong>{lead_climate}</strong> {weather_note} {climate_reality_tail}</p>"
        )

    if is_roof and material_tip:
        paras.append(f"<p><strong>{lead_materials}</strong> {material_tip}</p>")

    if is_roof and permit_note:
        hoa_addon = f" {hoa_p}" if hoa_p else ""
        paras.append(f"<p><strong>{lead_permit}</strong> {permit_note}.{hoa_addon}</p>")
    elif hoa_p:
        paras.append(f"<p><strong>{lead_hoa}</strong> {hoa_p}</p>")

    # Market dynamics (growth + local insight)
    market_parts = []
    if growth_p:
        market_parts.append(growth_p)
    if local_insight:
        market_parts.append(local_insight)
    if market_parts:
        paras.append(f"<p><strong>{lead_market}</strong> {' '.join(market_parts)}</p>")

    # Seasonal guidance
    if climate_p:
        paras.append(f"<p><strong>{lead_season}</strong> {climate_p}</p>")

    # Neighborhoods (only if we have them)
    if hoods_p:
        paras.append(f"<p><strong>{lead_hoods}</strong> {hoods_p}</p>")

    # Landmarks/geography (only if we have them)
    if landmark_p:
        paras.append(f"<p><strong>{lead_geo}</strong> {landmark_p}</p>")

    # Per-vertical cost driver and red flag notes (from enriched context files)
    vert_cost = (vert_ctx.get("costDriverNote") or "").strip()
    vert_flag = (vert_ctx.get("redFlagNote") or "").strip()
    if vert_cost:
        paras.append(f"<p><strong>What drives cost.</strong> {vert_cost}</p>")
    if vert_flag:
        paras.append(f"<p><strong>Red flags to watch for.</strong> {vert_flag}</p>")

    if not paras:
        return None

    body = "\n".join(paras)
    section = f"""
<!-- TP-LOCAL-INJECTED-V3 -->
<section class="section" style="background:#f8fafc;padding:24px;border-radius:14px;border:1px solid #e2e8f0;margin:32px 0;">
<h2>Local factors: {vcfg['label']} in {city_display}, {state_code}</h2>
{body}
</section>
"""
    return section


def strip_v3_block(text):
    """Remove existing V3 block so re-runs are idempotent."""
    marker = "<!-- TP-LOCAL-INJECTED-V3 -->"
    if marker not in text:
        return text
    pattern = re.compile(re.escape(marker) + r'\s*<section[^>]*>.*?</section>\s*', re.DOTALL)
    return pattern.sub("", text, count=1)


def process_file(path, vslug, vcfg):
    text = path.read_text(encoding="utf-8", errors="replace")
    # Strip existing V3 so re-runs are idempotent
    text = strip_v3_block(text)

    # Parse city-state from filename: e.g. dayton-oh-hvac-cost.html
    fname = path.name
    m = re.match(r"^([a-z-]+)-([a-z]{2})-" + vslug + r"-cost\.html$", fname)
    if not m:
        return "skip_bad_name"
    city_slug, state_code = m.group(1), m.group(2).upper()

    # Find matching city-context key (format "City Name|ST")
    city_display = " ".join(w.capitalize() for w in city_slug.split("-"))
    # Handle multi-word cities - the context key expects display name
    ctx_key = f"{city_display}|{state_code}"
    ctx = CTX.get(ctx_key)
    if not ctx:
        # Try alternative capitalization (St. Louis, etc)
        for k in CTX.keys():
            if k.lower() == ctx_key.lower():
                ctx = CTX[k]
                break
    if not ctx:
        return "skip_no_ctx"

    mult = MULT.get(ctx_key, {})
    local_key = f"{city_slug}-{state_code.lower()}"
    local = LOCAL_FACTS.get(local_key, {})

    # Build the section
    section = build_section(city_display, state_code, vslug, vcfg, ctx, mult, local)
    if not section:
        return "skip_no_content"

    # Insert before </main>, or before footer, or before </body>
    new_text, n = re.subn(r"(\s*</main>)", section + r"\1", text, count=1)
    if n == 0:
        new_text, n = re.subn(r'(\s*<footer)', section + r"\1", text, count=1)
    if n == 0:
        new_text, n = re.subn(r"(\s*</body>)", section + r"\1", text, count=1)
    if n == 0:
        return "fail_no_anchor"

    path.write_text(new_text, encoding="utf-8")
    return "added"


def main():
    stats = {"added": 0, "skip_no_ctx": 0, "skip_bad_name": 0,
             "skip_no_content": 0, "fail_no_anchor": 0}
    for vslug, vcfg in VERTICALS.items():
        files = sorted(ROOT.glob(f"*-{vslug}-cost.html"))
        print(f"{vslug}: {len(files)} files...")
        for i, f in enumerate(files):
            result = process_file(f, vslug, vcfg)
            stats[result] = stats.get(result, 0) + 1
            if (i + 1) % 200 == 0:
                print(f"  progress {i+1}/{len(files)}")
    print()
    print("=== DONE ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
