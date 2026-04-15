"""Inject a compact city-cost link hub before </main> on high-traffic pages.

Boosts crawl discovery: each hub adds 36+ links to city-vertical cost pages.
Slight variation across pages so Google sees different link patterns.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (cities, verticals) per page - varying so each hub shows different URLs
HUB_CONFIGS = {
    "analyze-my-quote.html": {
        "cities": [
            ("new-york-ny", "New York, NY"),
            ("los-angeles-ca", "Los Angeles, CA"),
            ("chicago-il", "Chicago, IL"),
            ("houston-tx", "Houston, TX"),
            ("phoenix-az", "Phoenix, AZ"),
            ("dallas-tx", "Dallas, TX"),
        ],
        "verticals": ["roof", "hvac", "fence", "insulation", "concrete", "gutter"],
    },
    "get-an-estimate.html": {
        "cities": [
            ("atlanta-ga", "Atlanta, GA"),
            ("miami-fl", "Miami, FL"),
            ("denver-co", "Denver, CO"),
            ("seattle-wa", "Seattle, WA"),
            ("charlotte-nc", "Charlotte, NC"),
            ("nashville-tn", "Nashville, TN"),
        ],
        "verticals": ["roof", "hvac", "fence", "insulation", "concrete", "gutter"],
    },
    "find-contractors.html": {
        "cities": [
            ("austin-tx", "Austin, TX"),
            ("tampa-fl", "Tampa, FL"),
            ("jacksonville-fl", "Jacksonville, FL"),
            ("san-antonio-tx", "San Antonio, TX"),
            ("columbus-oh", "Columbus, OH"),
            ("indianapolis-in", "Indianapolis, IN"),
        ],
        "verticals": ["roof", "hvac", "fence", "insulation", "concrete", "gutter"],
    },
}

VERTICAL_LABELS = {
    "roof": "Roofing",
    "hvac": "HVAC",
    "fence": "Fencing",
    "insulation": "Insulation",
    "concrete": "Concrete",
    "gutter": "Gutters",
}


def build_hub(cities, verticals):
    """Build the hub HTML block."""
    cols = []
    for v in verticals:
        label = VERTICAL_LABELS.get(v, v.title())
        links = []
        for slug, display in cities:
            url = f"/{slug}-{v}-cost.html"
            file_check = (ROOT / f"{slug}-{v}-cost.html").exists()
            if file_check:
                links.append(
                    f'<li><a href="{url}" style="color:var(--brand); text-decoration:none;">{display}</a></li>'
                )
        if not links:
            continue
        col = f'''
        <div>
          <div style="font-weight:700; font-size:14px; margin-bottom:6px; color:var(--text);">{label} cost by city</div>
          <ul style="list-style:none; padding:0; margin:0; font-size:13px; line-height:1.85;">
            {"".join(links)}
          </ul>
        </div>'''
        cols.append(col)

    return f'''
    <section class="hp-section" style="padding:48px 0; border-top:1px solid var(--border);">
      <div class="container">
        <h2 style="font-size:22px; margin:0 0 8px; text-align:center;">Popular cost guides by city</h2>
        <p style="color:var(--text-secondary); font-size:14px; text-align:center; margin:0 0 24px;">Local pricing benchmarks in major U.S. metros.</p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:24px;">
          {"".join(cols)}
        </div>
        <div style="text-align:center; margin-top:24px;">
          <a href="/guides.html" style="font-size:14px; color:var(--brand); font-weight:600; text-decoration:none;">See cost guides in 12,000+ cities &rarr;</a>
        </div>
      </div>
    </section>
'''


HUB_MARKER = "<!-- city-cost-hub -->"


def inject(file_name, cities, verticals):
    path = ROOT / file_name
    if not path.exists():
        return f"MISSING: {file_name}"
    text = path.read_text(encoding="utf-8")

    if HUB_MARKER in text:
        return f"SKIP (already has hub): {file_name}"

    hub_html = HUB_MARKER + build_hub(cities, verticals)

    # Insert before </main>
    new_text, n = re.subn(
        r'(\s*</main>)',
        hub_html + r'\1',
        text, count=1
    )
    if n == 0:
        # Fall back to before </body> if no </main>
        new_text, n = re.subn(
            r'(\s*</body>)',
            hub_html + r'\1',
            text, count=1
        )
    if n == 0:
        return f"FAIL (no insertion anchor found): {file_name}"

    path.write_text(new_text, encoding="utf-8")
    link_count = sum(
        1 for v in verticals for c, _ in cities
        if (ROOT / f"{c}-{v}-cost.html").exists()
    )
    return f"OK: {file_name} ({link_count} links added)"


if __name__ == "__main__":
    for f, cfg in HUB_CONFIGS.items():
        print(inject(f, cfg["cities"], cfg["verticals"]))
