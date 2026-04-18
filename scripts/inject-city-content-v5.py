"""inject-city-content-v5.py -- BLS trade wage section per city per vertical.

Adds a data-backed "What tradespeople earn in {city}" paragraph using
trade-wages-by-metro.json (393 BLS metro areas, 10+ trades). Each city
gets genuinely unique $/hr figures for the relevant trade, compared to
the national median.

Idempotent: strips existing V5 blocks before re-injecting.

Run:
    python scripts/inject-city-content-v5.py
"""

import os
import re
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

with open(ROOT / "data" / "trade-wages-by-metro.json", encoding="utf-8") as f:
    WAGES = json.load(f)
with open(ROOT / "data" / "city-cost-multipliers.json", encoding="utf-8") as f:
    MULT = json.load(f)

NATIONAL = WAGES["nationalMedians"]
METROS = WAGES["metros"]

# Map vertical slug -> primary BLS trade + secondary trade
VERTICAL_TRADES = {
    "roof":            ("roofers", "construction_laborers"),
    "hvac":            ("hvac_mechanics", "sheet_metal_workers"),
    "plumbing":        ("plumbers", None),
    "electrical":      ("electricians", None),
    "painting":        ("painters", None),
    "concrete":        ("cement_masons", "construction_laborers"),
    "siding":          ("carpenters", "construction_laborers"),
    "insulation":      ("construction_laborers", "carpenters"),
    "window":          ("carpenters", None),
    "fence":           ("construction_laborers", "carpenters"),
    "landscaping":     ("construction_laborers", None),
    "foundation":      ("cement_masons", "construction_laborers"),
    "garage-door":     ("carpenters", None),
    "solar":           ("electricians", "construction_laborers"),
    "kitchen-remodel": ("carpenters", "plumbers"),
    "gutter":          ("sheet_metal_workers", "construction_laborers"),
}

TRADE_DISPLAY = {
    "roofers": "roofers",
    "hvac_mechanics": "HVAC mechanics",
    "plumbers": "plumbers and pipefitters",
    "electricians": "electricians",
    "carpenters": "carpenters",
    "construction_laborers": "construction laborers",
    "cement_masons": "cement masons and concrete finishers",
    "painters": "painters",
    "sheet_metal_workers": "sheet metal workers",
    "drywall_installers": "drywall installers",
    "maintenance_workers": "maintenance workers",
}

VERTICAL_LABELS = {
    "roof": "roof replacement", "hvac": "HVAC replacement", "fence": "fence installation",
    "insulation": "insulation", "siding": "siding replacement",
    "window": "window replacement", "concrete": "concrete work", "gutter": "gutter installation",
    "painting": "exterior painting", "plumbing": "plumbing work", "electrical": "electrical work",
    "foundation": "foundation repair", "garage-door": "garage door replacement",
    "solar": "solar installation", "landscaping": "landscaping",
    "kitchen-remodel": "kitchen remodel",
}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


try:
    with open(ROOT / "data" / "city-coordinates.json", encoding="utf-8") as f:
        COORDS = json.load(f)
except FileNotFoundError:
    COORDS = {}

# Pre-parse BLS metro locations from their area names (approximate centroid
# from the first named city). We use city-coordinates.json for precision.
_METRO_COORDS = {}
for _mname, _mdata in METROS.items():
    # Try to find coordinates for the first city in the metro name
    _first_city = re.split(r"[-,]", _mname)[0].strip()
    _state_match = re.search(r"\b([A-Z]{2})\b", _mname)
    if _state_match:
        _st = _state_match.group(1)
        _key = f"{_first_city}|{_st}"
        if _key in COORDS and isinstance(COORDS[_key], dict):
            _METRO_COORDS[_mname] = (COORDS[_key].get("lat"), COORDS[_key].get("lng"))


def _haversine_mi(lat1, lng1, lat2, lng2):
    """Distance in miles between two points."""
    R = 3958.8
    lat1r, lat2r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(lat1r)*math.cos(lat2r)*math.sin(dlng/2)**2
    return 2 * R * math.asin(math.sqrt(a))


def find_metro_for_city(city_display, state_code):
    """Find the BLS metro area that contains this city.

    Strategy:
    1. Direct name match (city name appears in metro area name for state)
    2. Geographic proximity (find nearest BLS metro within 100 miles)
    """
    city_lower = city_display.lower()
    state_lower = state_code.lower()

    # Direct match: "City, ST" or "City-..., ST..."
    for metro_name, data in METROS.items():
        metro_lower = metro_name.lower()
        if city_lower in metro_lower and state_lower in metro_lower:
            return metro_name, data

    # Broader match: just check if city appears in any metro for this state
    for metro_name, data in METROS.items():
        metro_lower = metro_name.lower()
        if state_lower in metro_lower:
            metro_cities = re.split(r"[-,]", metro_lower)
            for mc in metro_cities:
                mc = mc.strip()
                if mc and mc in city_lower:
                    return metro_name, data

    # Geographic proximity fallback
    city_key = f"{city_display}|{state_code}"
    city_coord = COORDS.get(city_key)
    if city_coord and isinstance(city_coord, dict) and city_coord.get("lat") and city_coord.get("lng"):
        city_lat, city_lng = city_coord["lat"], city_coord["lng"]
        best_dist = 100  # max 100 miles
        best_metro = None
        best_data = None
        for metro_name, (mlat, mlng) in _METRO_COORDS.items():
            if mlat is None or mlng is None:
                continue
            d = _haversine_mi(city_lat, city_lng, mlat, mlng)
            if d < best_dist:
                best_dist = d
                best_metro = metro_name
                best_data = METROS[metro_name]
        if best_metro:
            return best_metro, best_data

    return None, None


def build_v5_block(city_display, state_code, vslug, metro_name, metro_data):
    """Build the V5 BLS wage section."""
    primary_trade, secondary_trade = VERTICAL_TRADES.get(vslug, (None, None))
    if not primary_trade:
        return None

    trades = metro_data.get("trades", {})
    primary_wage = trades.get(primary_trade)
    if primary_wage is None:
        return None

    national_wage = NATIONAL.get(primary_trade)
    if not national_wage:
        return None

    primary_display = TRADE_DISPLAY.get(primary_trade, primary_trade)
    vlabel = VERTICAL_LABELS.get(vslug, vslug)

    # Primary trade comparison
    pct_diff = round((primary_wage - national_wage) / national_wage * 100)
    if pct_diff > 2:
        direction = f"{pct_diff}% above"
    elif pct_diff < -2:
        direction = f"{abs(pct_diff)}% below"
    else:
        direction = "right at"

    # Build primary sentence
    primary_sentence = (
        f"According to BLS data, {primary_display} in the "
        f"{metro_name} metro earn a median of <strong>${primary_wage:.2f}/hr</strong> "
        f"({direction} the national median of ${national_wage:.2f}/hr)."
    )

    # Secondary trade if available
    secondary_sentence = ""
    if secondary_trade:
        sec_wage = trades.get(secondary_trade)
        sec_national = NATIONAL.get(secondary_trade)
        sec_display = TRADE_DISPLAY.get(secondary_trade, secondary_trade)
        if sec_wage and sec_national:
            sec_pct = round((sec_wage - sec_national) / sec_national * 100)
            if sec_pct > 2:
                sec_dir = f"{sec_pct}% above"
            elif sec_pct < -2:
                sec_dir = f"{abs(sec_pct)}% below"
            else:
                sec_dir = "near"
            secondary_sentence = (
                f" {sec_display.capitalize()} earn ${sec_wage:.2f}/hr "
                f"({sec_dir} the ${sec_national:.2f}/hr national median)."
            )

    # Cost impact sentence
    if pct_diff > 10:
        impact = (
            f"These higher labor costs are the primary reason {vlabel} "
            f"quotes in {city_display} run above the national average."
        )
    elif pct_diff < -10:
        impact = (
            f"Lower labor costs are the main reason {vlabel} "
            f"quotes in {city_display} come in below the national average."
        )
    else:
        impact = (
            f"With labor costs near the national average, material costs and "
            f"project scope are the bigger pricing levers for {vlabel} in {city_display}."
        )

    section = f"""<!-- TP-LOCAL-INJECTED-V5 -->
<section class="section" style="background:#fefce8;padding:24px;border-radius:14px;border:1px solid #fde68a;margin:32px 0;">
<h2>What tradespeople earn in {city_display}, {state_code}</h2>
<p>{primary_sentence}{secondary_sentence}</p>
<p>{impact} Labor typically represents 40-60% of a {vlabel} quote, so even a few percentage points above or below the national median shows up in your bottom line.</p>
<p style="font-size:12px; color:var(--text-secondary); margin-top:12px;">Source: Bureau of Labor Statistics Occupational Employment and Wage Statistics (OEWS), most recent annual release.</p>
</section>
"""
    return section


def strip_v5_block(text):
    """Remove existing V5 block for idempotent re-runs."""
    marker = "<!-- TP-LOCAL-INJECTED-V5 -->"
    if marker not in text:
        return text
    pattern = re.compile(re.escape(marker) + r'\s*<section[^>]*>.*?</section>\s*', re.DOTALL)
    return pattern.sub("", text, count=1)


def process_file(fpath, vslug):
    text = fpath.read_text(encoding="utf-8", errors="replace")
    text = strip_v5_block(text)

    fname = fpath.name
    m = re.match(r"^([a-z][a-z0-9-]*?)-([a-z]{2})-" + re.escape(vslug) + r"-cost\.html$", fname)
    if not m:
        return "skip_bad_name"
    city_slug, state_code = m.group(1), m.group(2).upper()
    city_display = " ".join(w.capitalize() for w in city_slug.split("-"))

    metro_name, metro_data = find_metro_for_city(city_display, state_code)
    if not metro_data:
        return "skip_no_metro"

    block = build_v5_block(city_display, state_code, vslug, metro_name, metro_data)
    if not block:
        return "skip_no_trade"

    # Insert before </main>
    new_text, n = re.subn(r"(\s*</main>)", block + r"\1", text, count=1)
    if n == 0:
        new_text, n = re.subn(r'(\s*<footer)', block + r"\1", text, count=1)
    if n == 0:
        return "fail_no_anchor"

    fpath.write_text(new_text, encoding="utf-8")
    return "added"


def main():
    stats = {}
    for vslug in VERTICAL_TRADES.keys():
        files = sorted(ROOT.glob(f"*-{vslug}-cost.html"))
        vstats = {"added": 0, "skip_no_metro": 0, "skip_bad_name": 0,
                  "skip_no_trade": 0, "fail_no_anchor": 0}
        print(f"{vslug}: {len(files)} files")
        for i, f in enumerate(files):
            result = process_file(f, vslug)
            vstats[result] = vstats.get(result, 0) + 1
            if (i + 1) % 200 == 0:
                print(f"  progress {i+1}/{len(files)}")
        for k, v in vstats.items():
            stats[k] = stats.get(k, 0) + v
        print(f"  -> added {vstats['added']}, no_metro {vstats['skip_no_metro']}, "
              f"no_trade {vstats['skip_no_trade']}")

    print("\n=== TOTAL ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
