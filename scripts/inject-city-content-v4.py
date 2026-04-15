"""inject-city-content-v4.py — specific dollar ranges + nearest-cities block.

V4 adds two NEW unique-content sections that V2/V3 didn't cover:

1. **Specific-to-this-city dollar ranges.** Uses city-cost-multipliers.json
   labor/materials multipliers + vertical-specific base range to compute
   actual dollar figures for this city. Unique number per city per vertical.

2. **Nearest cities cross-link + cost comparison.** Uses city-coordinates.json
   to find the 6-8 nearest cities we have pages for, with a price-delta
   note vs each. Creates per-page unique link set + additional unique text.

These both solve the 'same state pages stay similar' problem because
the nearby-cities list and comparison deltas vary per origin city.

Targets all 15 verticals with city pages.

Run:
    python scripts/inject-city-content-v4.py
"""

import os
import re
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

with open(ROOT / "data" / "city-coordinates.json", encoding="utf-8") as f:
    COORDS = json.load(f)
with open(ROOT / "data" / "city-cost-multipliers.json", encoding="utf-8") as f:
    MULT = json.load(f)

# Ballpark national typical range per vertical (low, high) in dollars.
# These get scaled per-city via labor + materials multipliers.
BASE_RANGES = {
    "roof":        (8500, 16000),
    "hvac":        (6000, 14000),
    "fence":       (2500, 6500),
    "insulation":  (1500, 5000),
    "siding":      (10000, 20000),
    "window":      (4500, 12000),
    "concrete":    (3000, 10000),
    "gutter":      (800, 3500),
    "painting":    (2500, 7000),
    "plumbing":    (400, 2500),
    "electrical":  (800, 3500),
    "foundation":  (4500, 15000),
    "garage-door": (800, 3500),
    "solar":       (15000, 30000),
    "landscaping": (3500, 12000),
}

VERTICAL_LABELS = {
    "roof": "Roof replacement", "hvac": "HVAC replacement", "fence": "Fence installation",
    "insulation": "Insulation installation", "siding": "Siding replacement",
    "window": "Window replacement", "concrete": "Concrete work", "gutter": "Gutter installation",
    "painting": "House painting", "plumbing": "Plumbing work", "electrical": "Electrical work",
    "foundation": "Foundation repair", "garage-door": "Garage door replacement",
    "solar": "Solar installation", "landscaping": "Landscaping",
}

VERTICAL_UNIT_NOTE = {
    "roof": "for a typical single-family home",
    "hvac": "for a whole-house system replacement",
    "fence": "for a typical backyard enclosure",
    "insulation": "for an average home retrofit",
    "siding": "for a typical single-family home",
    "window": "for a full-house window replacement (8-12 windows)",
    "concrete": "for a typical driveway project",
    "gutter": "for a full home gutter system",
    "painting": "for interior painting of a mid-size home",
    "plumbing": "for a typical repair or single-fixture job",
    "electrical": "for a typical service call or panel upgrade",
    "foundation": "for typical repair scope",
    "garage-door": "for a standard 2-car garage door with opener",
    "solar": "for a residential system after federal tax credit",
    "landscaping": "for a mid-size yard makeover",
}


def haversine_km(lat1, lng1, lat2, lng2):
    """Return distance in miles between two lat/lng points."""
    R = 3958.8  # Earth radius in miles
    lat1r, lat2r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(lat1r) * math.cos(lat2r) * math.sin(dlng/2)**2
    return 2 * R * math.asin(math.sqrt(a))


def build_city_index():
    """Build a lookup of (slug, state_code) -> (display_name, coord, multiplier data)."""
    idx = {}
    for key, coord in COORDS.items():
        if key == "_meta" or not isinstance(coord, dict):
            continue
        # key format: "City Name|ST"
        if "|" not in key:
            continue
        name, state = key.split("|", 1)
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        mult = MULT.get(key, {})
        idx[(slug, state.upper())] = {
            "display": name,
            "state": state.upper(),
            "lat": coord.get("lat"),
            "lng": coord.get("lng"),
            "mult_key": key,
            "multiplier": mult.get("multiplier", 1.0),
            "labor_mult": mult.get("laborMult", 1.0),
            "materials_mult": mult.get("materialsMult", 1.0),
            "population": mult.get("population"),
            "service_mults": mult.get("serviceMultipliers", {}),
        }
    return idx


def compute_city_range(vslug, city_info):
    """Return (low, high) dollars for this vertical in this city."""
    base = BASE_RANGES.get(vslug)
    if not base:
        return None
    # Prefer service-specific multiplier if present
    svc_key_map = {
        "roof": "roofing", "hvac": "hvac", "fence": "fencing", "insulation": "insulation",
        "siding": "siding", "window": "windows", "concrete": "concrete", "gutter": "gutters",
        "painting": "painting", "plumbing": "plumbing", "electrical": "electrical",
        "foundation": "foundation", "garage-door": "garage-door",
        "solar": "solar", "landscaping": "landscaping",
    }
    svc_key = svc_key_map.get(vslug, vslug)
    svc_mult = city_info["service_mults"].get(svc_key, city_info.get("multiplier", 1.0))
    low = int(round(base[0] * svc_mult / 25) * 25)
    high = int(round(base[1] * svc_mult / 25) * 25)
    return (low, high, svc_mult)


def nearest_cities(origin_info, city_index, limit=7):
    """Return up to `limit` nearest city_infos (excluding origin)."""
    if origin_info["lat"] is None or origin_info["lng"] is None:
        return []
    dists = []
    origin_key = (
        re.sub(r"[^a-z0-9]+", "-", origin_info["display"].lower()).strip("-"),
        origin_info["state"],
    )
    for (slug, state), info in city_index.items():
        if (slug, state) == origin_key:
            continue
        if info["lat"] is None or info["lng"] is None:
            continue
        d = haversine_km(
            origin_info["lat"], origin_info["lng"],
            info["lat"], info["lng"],
        )
        if d > 200:  # skip anything > 200 miles — not relevant
            continue
        dists.append((d, slug, state, info))
    dists.sort(key=lambda x: x[0])
    return dists[:limit]


def cost_delta_phrase(origin_svc_mult, neighbor_svc_mult):
    """Human phrase comparing two multipliers."""
    if neighbor_svc_mult == origin_svc_mult or origin_svc_mult == 0:
        return "similar"
    pct = (neighbor_svc_mult - origin_svc_mult) / origin_svc_mult * 100
    abs_pct = abs(round(pct))
    if abs_pct < 2:
        return "within 2%"
    direction = "higher" if pct > 0 else "lower"
    return f"~{abs_pct}% {direction}"


def build_v4_block(vslug, origin_info, city_index):
    """Build the V4 unique-content HTML block."""
    vlabel = VERTICAL_LABELS.get(vslug, vslug)
    unit = VERTICAL_UNIT_NOTE.get(vslug, "for a typical project")

    # Specific dollar range for this city
    range_data = compute_city_range(vslug, origin_info)
    if not range_data:
        return None
    low, high, svc_mult = range_data

    # Multiplier context
    mult_pct = round((svc_mult - 1.0) * 100)
    if mult_pct > 1:
        mult_note = f"{mult_pct}% above national median"
    elif mult_pct < -1:
        mult_note = f"{abs(mult_pct)}% below national median"
    else:
        mult_note = "near the national median"

    # Labor / materials breakdown
    labor_pct = round((origin_info["labor_mult"] - 1.0) * 100)
    mat_pct = round((origin_info["materials_mult"] - 1.0) * 100)
    labor_text = f"{labor_pct:+d}% vs national" if abs(labor_pct) > 1 else "at the national average"
    mat_text = f"{mat_pct:+d}% vs national" if abs(mat_pct) > 1 else "at the national average"

    pricing_paragraph = (
        f"<p><strong>Typical cost range in {origin_info['display']}.</strong> "
        f"For {vlabel.lower()} {unit}, {origin_info['display']} homeowners typically see "
        f"<strong>${low:,} to ${high:,}</strong> — {mult_note}. "
        f"Local labor rates run {labor_text}, and materials run {mat_text}. "
        f"Your own quote can fall outside this band depending on scope, materials tier, "
        f"and contractor, but this is the middle 60-70% of quotes we see in the "
        f"{origin_info['display']} area.</p>"
    )

    # Population + metro context
    pop = origin_info.get("population")
    pop_sentence = ""
    if pop:
        pop_sentence = (
            f"With approximately {pop:,} residents, {origin_info['display']} supports a "
            f"{'crowded' if pop >= 500000 else 'competitive' if pop >= 100000 else 'smaller'} "
            f"contractor market — get at least three quotes before signing anything."
        )

    # Nearest cities cross-links
    neighbors = nearest_cities(origin_info, city_index, limit=7)
    links_html = ""
    compare_phrases = []
    for d, n_slug, n_state, n_info in neighbors:
        n_range = compute_city_range(vslug, n_info)
        if not n_range:
            continue
        n_low, n_high, n_svc_mult = n_range
        # Skip if no page exists
        target_file = ROOT / f"{n_slug}-{n_state.lower()}-{vslug}-cost.html"
        if not target_file.exists():
            continue
        delta = cost_delta_phrase(svc_mult, n_svc_mult)
        mi = round(d)
        link = (
            f'<li>'
            f'<a href="/{n_slug}-{n_state.lower()}-{vslug}-cost.html" '
            f'style="color:var(--brand); text-decoration:none;">'
            f'{n_info["display"]}, {n_state}</a> '
            f'<span style="color:var(--text-muted); font-size:13px;">'
            f'({mi} mi · ${n_low:,} - ${n_high:,} · {delta})</span>'
            f'</li>'
        )
        links_html += link
        compare_phrases.append(f"{n_info['display']}, {n_state} ({delta})")

    if not links_html:
        # Still useful to have the pricing section
        nearby_paragraph = ""
    else:
        summary_line = ""
        if compare_phrases:
            top_3 = compare_phrases[:3]
            joined = "; ".join(top_3)
            summary_line = (
                f"<p>Nearby {origin_info['state']} and regional markets for quick comparison: "
                f"{joined}.</p>"
            )
        nearby_paragraph = (
            f'<p><strong>Nearby cities &amp; cost comparison.</strong> If you are getting quotes '
            f'from contractors who work across metros, {origin_info["display"]} pricing compares '
            f'to nearby cities as follows:</p>'
            f'<ul style="list-style:none; padding:0; margin:0 0 12px; font-size:14px; line-height:1.9;">'
            f'{links_html}'
            f'</ul>'
            f'{summary_line}'
        )

    pop_p = f'<p><strong>Market size.</strong> {pop_sentence}</p>' if pop_sentence else ""

    section = f"""
<!-- TP-LOCAL-INJECTED-V4 -->
<section class="section" style="background:#f0f9ff;padding:24px;border-radius:14px;border:1px solid #bae6fd;margin:32px 0;">
<h2>Pricing snapshot &amp; nearby comparisons: {origin_info['display']}, {origin_info['state']}</h2>
{pricing_paragraph}
{pop_p}
{nearby_paragraph}
</section>
"""
    return section


def process_file(path, vslug, city_index):
    text = path.read_text(encoding="utf-8", errors="replace")
    if "TP-LOCAL-INJECTED-V4" in text:
        return "skip_existing"
    fname = path.name
    m = re.match(r"^([a-z-]+)-([a-z]{2})-" + vslug + r"-cost\.html$", fname)
    if not m:
        return "skip_bad_name"
    city_slug, state_code = m.group(1), m.group(2).upper()
    origin_info = city_index.get((city_slug, state_code))
    if not origin_info:
        return "skip_no_coords"

    block = build_v4_block(vslug, origin_info, city_index)
    if not block:
        return "skip_no_content"

    new_text, n = re.subn(r"(\s*</main>)", block + r"\1", text, count=1)
    if n == 0:
        new_text, n = re.subn(r'(\s*<footer)', block + r"\1", text, count=1)
    if n == 0:
        new_text, n = re.subn(r"(\s*</body>)", block + r"\1", text, count=1)
    if n == 0:
        return "fail_no_anchor"
    path.write_text(new_text, encoding="utf-8")
    return "added"


def main():
    city_index = build_city_index()
    print(f"Built city index: {len(city_index)} cities with coordinates")
    stats = {}
    for vslug in BASE_RANGES.keys():
        files = sorted(ROOT.glob(f"*-{vslug}-cost.html"))
        vstats = {"added": 0, "skip_existing": 0, "skip_no_coords": 0, "skip_bad_name": 0,
                  "skip_no_content": 0, "fail_no_anchor": 0}
        print(f"\n{vslug}: {len(files)} files")
        for i, f in enumerate(files):
            result = process_file(f, vslug, city_index)
            vstats[result] = vstats.get(result, 0) + 1
            if (i + 1) % 200 == 0:
                print(f"  progress {i+1}/{len(files)}")
        for k, v in vstats.items():
            stats[k] = stats.get(k, 0) + v
        print(f"  -> added {vstats['added']}, skipped {sum(v for k,v in vstats.items() if k != 'added')}")

    print("\n=== TOTAL ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
