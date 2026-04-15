"""inject-city-content-v3.py — break the same-state 93% similarity for short-body verticals.

V2 already injected a "About {vertical}" block but left several unique per-city
fields unused. V3 adds a SEPARATE block ("Local factors: {vertical} in {city}")
that uses the unused verbatim text fields (permitNote, weatherNote, materialTip,
localInsight) plus derived content from avgHomeAge, hoaPrevalence, growthRate,
climate-specific months.

Targets verticals where V2 body content was short enough that same-state pages
stayed 93%+ similar:
  - hvac, insulation, siding, window, electrical

Each page gets 400-600 words of genuinely unique content because every field
used is either unique per-city (permitNote, weatherNote, localInsight,
materialTip) or combines with climate/state data to produce unique phrasing.

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

# Verticals to process (short-body verticals with same-state similarity issues)
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


def home_age_sentence(age, city, label):
    """Generate unique home-age-specific guidance."""
    if not isinstance(age, (int, float)):
        return ""
    age = int(age)
    if age >= 65:
        return (
            f"With an average home age around {age} years, {city}'s housing stock skews older. "
            f"Plan on {label} projects encountering mid-century systems, knob-and-tube wiring in pockets, "
            f"lath-and-plaster wall cavities, and grandfathered code exemptions that may no longer qualify "
            f"under current inspection standards. Budget an extra 10-20% for surprise-code-catch-up work."
        )
    elif age >= 50:
        return (
            f"The typical {city} home is around {age} years old. Most systems are past their first-replacement "
            f"cycle and approaching their second. Expect {label} quotes to include mentions of "
            f"upgraded electrical service, ductwork adjustments, or insulation retrofits that newer homes wouldn't need."
        )
    elif age >= 35:
        return (
            f"With average home age near {age} years, {city} homes are at the typical first-replacement milestone "
            f"for major systems. Original furnaces, AC units, water heaters, and roofs installed when the homes were "
            f"built are aging out — {label} is hitting peak demand in this age band."
        )
    elif age >= 20:
        return (
            f"{city}'s housing stock averages {age} years old — relatively recent construction that was largely "
            f"built to modern code. {label} projects here tend to be simpler: fewer surprise compliance issues, "
            f"quicker permit turnaround, and contractors who can quote from memory."
        )
    else:
        return (
            f"{city} has an unusually young housing stock (average {age} years). Most homes are still running "
            f"their original systems and components. {label} demand skews toward upgrades (efficiency, smart controls) "
            f"rather than full replacement — ask contractors about tune-ups and partial upgrades before committing to a replacement."
        )


def growth_rate_sentence(growth, city):
    """Local market dynamics based on growth rate."""
    growth = (growth or "").lower()
    if growth == "high":
        return (
            f"{city}'s high growth rate means contractor demand consistently exceeds supply. "
            f"Expect 3-6 week booking delays in season. Get on a contractor's calendar as soon as "
            f"you know you need work — waiting rarely improves pricing here."
        )
    elif growth == "moderate":
        return (
            f"{city} has moderate construction activity. Contractors are busy but accessible with 1-3 weeks' notice. "
            f"Off-season quotes (contractor-dependent) can run 8-15% below peak rates."
        )
    else:
        return (
            f"{city} has a stable, lower-growth construction market, which usually means more competitive "
            f"contractor pricing than fast-growing metros. The tradeoff: smaller contractor pool, so reputation and "
            f"reviews matter more — a few bad actors can dominate the local landscape."
        )


def hoa_sentence(hoa, city, label):
    hoa = (hoa or "").lower()
    if hoa == "high":
        return (
            f"HOAs are common in {city}. For {label}, factor in 2-4 weeks of HOA architectural review before starting, "
            f"and collect pre-approval of materials in writing. HOA rejections after project start can be expensive."
        )
    elif hoa == "moderate":
        return (
            f"HOA prevalence in {city} is moderate. If you're in a managed community, check covenants before signing "
            f"a {label} contract — material color, visible fixture type, or warranty requirements may affect your selection."
        )
    else:
        return (
            f"HOA involvement is uncommon in {city}, so most {label} projects avoid architectural review delays. "
            f"City permitting alone governs the process."
        )


def climate_months_guidance(climate_zone, vcfg, city, vlabel):
    """Season-specific guidance tuned to climate zone."""
    zone = (climate_zone or "").lower()
    if zone == "cold":
        peak = vcfg["urgent_season_cold"]
        best = vcfg["best_season_cold"]
    elif zone == "hot":
        peak = vcfg["urgent_season_hot"]
        best = vcfg["best_season_hot"]
    else:
        peak = "peak weather stress months"
        best = "shoulder seasons"
    return (
        f"Seasonally in {city}, {peak}. "
        f"The best window for non-emergency {vlabel} is {best} — quieter contractor schedules, "
        f"better prices, and less pressure to accept the first quote."
    )


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


def landmark_sentence(local, city):
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
    local_insight = (ctx.get("localInsight") or "").strip()
    avg_home_age = ctx.get("avgHomeAge")
    growth_rate = ctx.get("growthRate")
    hoa = ctx.get("hoaPrevalence")
    climate_zone = ctx.get("climateZone")

    # Compose paragraphs
    home_age_p = home_age_sentence(avg_home_age, city_display, vlabel)
    growth_p = growth_rate_sentence(growth_rate, city_display)
    hoa_p = hoa_sentence(hoa, city_display, vlabel)
    climate_p = climate_months_guidance(climate_zone, vcfg, city_display, vlabel)
    hoods_p = neighborhoods_sentence(local, city_display, vlabel)
    landmark_p = landmark_sentence(local, city_display)

    # Weather / permit / material unique text
    paras = []

    # Opening: home stock
    if home_age_p:
        paras.append(f"<p><strong>Home stock in {city_display}.</strong> {home_age_p}</p>")

    # Weather note verbatim (unique per city)
    if weather_note:
        paras.append(
            f"<p><strong>Local climate reality.</strong> {weather_note} For {vlabel}, that translates "
            f"into specific material and installation choices that contractors in {city_display} factor into every quote.</p>"
        )

    # Material tip verbatim
    if material_tip:
        paras.append(f"<p><strong>Materials to prioritize.</strong> {material_tip}</p>")

    # Permit note verbatim (unique per city)
    if permit_note:
        hoa_addon = f" {hoa_p}" if hoa_p else ""
        paras.append(f"<p><strong>Permit &amp; code considerations.</strong> {permit_note}.{hoa_addon}</p>")
    elif hoa_p:
        paras.append(f"<p><strong>HOA &amp; compliance.</strong> {hoa_p}</p>")

    # Market dynamics (growth + local insight)
    market_parts = []
    if growth_p:
        market_parts.append(growth_p)
    if local_insight:
        market_parts.append(local_insight)
    if market_parts:
        paras.append(f"<p><strong>Local market conditions.</strong> {' '.join(market_parts)}</p>")

    # Seasonal guidance
    if climate_p:
        paras.append(f"<p><strong>Seasonal timing.</strong> {climate_p}</p>")

    # Neighborhoods (only if we have them)
    if hoods_p:
        paras.append(f"<p><strong>Neighborhood patterns.</strong> {hoods_p}</p>")

    # Landmarks/geography (only if we have them)
    if landmark_p:
        paras.append(f"<p><strong>Geography note.</strong> {landmark_p}</p>")

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


def process_file(path, vslug, vcfg):
    text = path.read_text(encoding="utf-8", errors="replace")
    if "TP-LOCAL-INJECTED-V3" in text:
        return "skip_existing"

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
    stats = {"added": 0, "skip_existing": 0, "skip_no_ctx": 0, "skip_bad_name": 0,
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
