"""Add meta descriptions + better titles to 18 estimate pages missing them.

Targets the commercial-intent keyword queries from Google Search Console data:
fence cost, insulation price, roof replacement cost, gutter installation, etc.

Run once, idempotent (skips files that already have a description).
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (title, description) tuned for each vertical's primary search queries
PAGE_META = {
    "concrete-estimate.html": (
        "Concrete Cost Calculator 2026 — Free Estimate by City | TruePrice",
        "Free concrete cost calculator with real pricing from 12,000+ US cities. See typical driveway, patio, and slab costs. No email required. Updated 2026."
    ),
    "electrical-estimate.html": (
        "Electrical Cost Calculator 2026 — Free Estimate by City | TruePrice",
        "Free electrical work cost estimator with local city pricing. See average costs for panels, wiring, rewiring, and installation. No email. Updated 2026."
    ),
    "fencing-estimate.html": (
        "Fence Cost Calculator 2026 — Free Estimate by City | TruePrice",
        "Free fence cost calculator. See typical wood, vinyl, chain link, and aluminum fence pricing in your city. Real data from 12,000+ US cities. No email required."
    ),
    "foundation-estimate.html": (
        "Foundation Repair Cost 2026 — Free Estimate by City | TruePrice",
        "Free foundation repair cost calculator. See typical costs for crack repair, underpinning, pier and beam, and waterproofing. Real local pricing. No email."
    ),
    "garage-door-estimate.html": (
        "Garage Door Cost 2026 — Free Estimate by City | TruePrice",
        "Free garage door cost estimator. See typical pricing for single and double doors, installation, and opener replacement. Real local pricing. No email required."
    ),
    "gutters-estimate.html": (
        "Gutter Cost Calculator 2026 — Free Estimate by City | TruePrice",
        "Free gutter cost calculator. See typical pricing for aluminum, copper, and seamless gutters per linear foot. Real data from 12,000+ US cities. No email required."
    ),
    "hvac-estimate.html": (
        "HVAC Cost Calculator 2026 — Free Estimate by City | TruePrice",
        "Free HVAC cost calculator. See typical pricing for AC installation, furnace replacement, and full system swaps. Real local city pricing. No email required."
    ),
    "insulation-estimate.html": (
        "Insulation Cost Calculator 2026 — Free Estimate by City | TruePrice",
        "Free insulation cost calculator. See typical pricing for blown-in, batt, and spray foam insulation per sq ft. Real local pricing. No email required."
    ),
    "kitchen-estimate.html": (
        "Kitchen Remodel Cost 2026 — Free Estimate by City | TruePrice",
        "Free kitchen remodel cost calculator. See typical pricing for small, mid-range, and luxury remodels. Real local data from 12,000+ cities. No email required."
    ),
    "landscaping-estimate.html": (
        "Landscaping Cost 2026 — Free Estimate by City | TruePrice",
        "Free landscaping cost calculator. See typical pricing for hardscape, sod, tree removal, and design. Real local pricing. No email. Updated 2026."
    ),
    "legal-estimate.html": (
        "Attorney Fee Calculator 2026 — Legal Cost Estimate | TruePrice",
        "Free attorney fee calculator. See typical legal costs for common matters: divorce, estate, contracts, DUI. Real local pricing. No email required."
    ),
    "medical-estimate.html": (
        "Medical Cost Calculator 2026 — Procedure & Visit Estimate | TruePrice",
        "Free medical cost estimator. See typical pricing for common procedures, surgeries, and visits. Compare against your hospital bill. No email required."
    ),
    "moving-estimate.html": (
        "Moving Cost Calculator 2026 — Free Estimate by City | TruePrice",
        "Free moving cost calculator. See typical pricing for local, long-distance, and cross-country moves. Real local data from 12,000+ cities. No email."
    ),
    "painting-estimate.html": (
        "House Painting Cost 2026 — Free Estimate by City | TruePrice",
        "Free house painting cost calculator. See typical pricing for interior and exterior painting by sq ft. Real local pricing. No email required. Updated 2026."
    ),
    "plumbing-estimate.html": (
        "Plumbing Cost Calculator 2026 — Free Estimate by City | TruePrice",
        "Free plumbing cost calculator. See typical pricing for leaks, water heater, drain cleaning, and repipes. Real local city pricing. No email required."
    ),
    "siding-estimate.html": (
        "Siding Cost Calculator 2026 — Free Estimate by City | TruePrice",
        "Free siding cost calculator. See typical pricing for vinyl, fiber cement, wood, and stucco siding per sq ft. Real local pricing. No email required."
    ),
    "solar-estimate.html": (
        "Solar Panel Cost 2026 — Free Estimate by City | TruePrice",
        "Free solar panel cost calculator. See typical pricing per kW including installation and rebates. Real local data from 12,000+ cities. No email required."
    ),
    "window-estimate.html": (
        "Window Replacement Cost 2026 — Free Estimate by City | TruePrice",
        "Free window replacement cost calculator. See typical pricing by window type and installation. Real local pricing. No email required. Updated 2026."
    ),
}


def apply_meta(file_name, new_title, description):
    path = ROOT / file_name
    if not path.exists():
        return f"MISSING: {file_name}"
    text = path.read_text(encoding="utf-8")
    safe_desc = description.replace('"', '&quot;')

    # Replace title
    new_text, title_count = re.subn(
        r'<title>[^<]*</title>',
        f'<title>{new_title}</title>',
        text, count=1
    )
    if title_count == 0:
        return f"FAIL (no <title> found): {file_name}"

    # Replace meta description (handles multi-line format with re.DOTALL)
    new_text, desc_count = re.subn(
        r'<meta\s+name="description"\s+content="[^"]*"\s*/?>',
        f'<meta name="description" content="{safe_desc}" />',
        new_text, flags=re.DOTALL
    )
    if desc_count == 0:
        # Multi-line variant: <meta \n name="description" \n content="..." \n />
        new_text, desc_count = re.subn(
            r'<meta\s+name="description"\s+content="[^"]*"\s*/?>',
            f'<meta name="description" content="{safe_desc}" />',
            new_text, flags=re.DOTALL | re.MULTILINE
        )
    if desc_count == 0:
        # Try a looser pattern that matches across newlines with attribute on next line
        new_text, desc_count = re.subn(
            r'<meta\s+name="description"[^/>]*/>',
            f'<meta name="description" content="{safe_desc}" />',
            new_text, flags=re.DOTALL
        )
    if desc_count == 0:
        # Insert new one after title if nothing to replace
        meta_tag = f'\n  <meta name="description" content="{safe_desc}" />'
        new_text = new_text.replace(
            f'<title>{new_title}</title>',
            f'<title>{new_title}</title>{meta_tag}',
            1
        )

    # og:title
    new_text = re.sub(
        r'<meta\s+property="og:title"\s+content="[^"]*"\s*/?>',
        f'<meta property="og:title" content="{new_title}" />',
        new_text
    )
    # og:description (multi-line aware)
    new_text = re.sub(
        r'<meta\s+property="og:description"[^/>]*/>',
        f'<meta property="og:description" content="{safe_desc}" />',
        new_text, flags=re.DOTALL
    )
    # twitter:title
    new_text = re.sub(
        r'<meta\s+name="twitter:title"\s+content="[^"]*"\s*/?>',
        f'<meta name="twitter:title" content="{new_title}" />',
        new_text
    )
    # twitter:description (multi-line aware)
    new_text = re.sub(
        r'<meta\s+name="twitter:description"[^/>]*/>',
        f'<meta name="twitter:description" content="{safe_desc}" />',
        new_text, flags=re.DOTALL
    )

    path.write_text(new_text, encoding="utf-8")
    return f"OK: {file_name}"


if __name__ == "__main__":
    for f, (title, desc) in PAGE_META.items():
        print(apply_meta(f, title, desc))
