"""
Inject unique per-city local content into city-service-cost pages.

Reads data/city-local-facts.json (top 50 US cities with hand-curated facts)
and for each city, finds all matching HTML files (city-state-{service}-cost.html)
and:
  1. Replaces the templated local-grid section with city-specific cards
  2. Inserts a new "About roofing/hvac/etc in {city}" section with 4-5
     paragraphs of unique local content right before the tools block

Goal: take templated city pages with ~500 unique words to ~900-1100 unique
words so Google indexes more of them.

Run from repo root:
    python scripts/inject-city-content.py
"""

import os, re, json, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

with open("data/city-local-facts.json") as f:
    FACTS = json.load(f)

SERVICES = {
    "roof": "roofing",
    "hvac": "HVAC",
    "plumbing": "plumbing",
    "electrical": "electrical work",
    "gutter": "gutter installation",
    "window": "window replacement",
    "solar": "solar panel installation",
    "siding": "siding replacement",
    "fence": "fencing",
    "landscaping": "landscaping",
    "painting": "exterior painting",
    "insulation": "insulation",
    "concrete": "concrete work",
    "foundation": "foundation repair",
    "garage-door": "garage door replacement",
    "kitchen-remodel": "kitchen remodels",
}

# Sentinel comment so we can re-run without duplicating
INJECTED_MARKER = "<!-- TP-LOCAL-INJECTED -->"

def cap_first(s):
    """Capitalize ONLY the first character — preserves rest (proper nouns)."""
    if not s: return s
    return s[0].upper() + s[1:]

def build_local_grid_html(facts, service_label):
    """Replacement for the templated 4-card local-grid section."""
    nb = facts.get("neighborhoods", [])
    nb_text = ", ".join(nb[:4]) + (f", and {nb[4]}" if len(nb) > 4 else "")
    return f'''<section class="section">
<h2>{service_label.capitalize()} in {facts["displayName"]}: what locals should know</h2>
<div class="local-grid">
<div class="local-card">
<div class="local-card-icon">&#9729;&#65039;</div>
<h3>Climate factors</h3>
<p>{facts["displayName"]} has a {facts["climate"]}. Plan {service_label} work around these conditions and discuss them with any contractor before signing.</p>
</div>
<div class="local-card">
<div class="local-card-icon">&#127968;</div>
<h3>Local housing stock</h3>
<p>{facts["homeAge"]} Older neighborhoods including {nb_text} often have unique conditions that affect job scope and pricing.</p>
</div>
<div class="local-card">
<div class="local-card-icon">&#128737;</div>
<h3>Permits &amp; licensing</h3>
<p>{facts["permits"]} {facts["codeNote"]}.</p>
</div>
<div class="local-card">
<div class="local-card-icon">&#128184;</div>
<h3>Contractor market</h3>
<p>{facts["contractorMarket"]} Get at least three quotes before committing.</p>
</div>
</div>
</section>'''

def build_about_section_html(facts, service_label):
    """New unique content section with 4-5 paragraphs of city-specific facts."""
    nb = facts.get("neighborhoods", [])
    landmarks = facts.get("landmarks", [])
    nb_text = ", ".join(nb[:5])
    landmark_text = ", ".join(landmarks[:3])
    return f'''{INJECTED_MARKER}
<section class="section" style="background:#fafbff;padding:24px;border-radius:14px;border:1px solid #e2e8f0;margin:32px 0;">
<h2>About {service_label} in {facts["displayName"]}</h2>
<p>{facts["displayName"]}, {facts["state"]} sits in a region with distinctive geographic and climate factors that meaningfully affect {service_label} pricing. {cap_first(facts["geographyNote"])}.</p>

<p><strong>Neighborhoods and housing stock.</strong> {facts["displayName"]} contains a wide range of housing types, from the established blocks of {nb_text} to newer suburban developments on the metro fringe. {cap_first(facts["homeAge"])}, which is one of the most important factors a {service_label} contractor will assess on a walkthrough.</p>

<p><strong>Soil, geology, and site conditions.</strong> The local ground conditions matter more than most homeowners realize. {facts["displayName"]} sits on {facts["soil"]}. This affects access for equipment, drainage planning, and any work that touches the building envelope.</p>

<p><strong>Permits and contractor licensing.</strong> {cap_first(facts["permits"])}. {facts["codeNote"]}. Always verify your contractor&apos;s current license status and confirm they will pull the permit themselves rather than asking you to do it.</p>

<p><strong>Local market dynamics.</strong> {cap_first(facts["contractorMarket"])}. Notable area landmarks like {landmark_text} are useful reference points when describing job locations to contractors who may not know your specific street.</p>
</section>
'''

def process_file(filepath, facts, service_key):
    service_label = SERVICES.get(service_key, service_key)
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    # 1. Replace local-grid section (templated cards) with city-specific cards.
    # Looser regex: just match any <section> containing a <div class="local-grid">.
    new_grid = build_local_grid_html(facts, service_label)
    pattern_grid = re.compile(
        r'<section class="section">\s*<h2>[^<]*</h2>\s*<div class="local-grid">.*?</div>\s*</section>',
        re.DOTALL
    )
    new_content, n_grid = pattern_grid.subn(new_grid, content, count=1)

    # 2. Replace existing injected about-section if present (re-run friendly)
    about = build_about_section_html(facts, service_label)
    pattern_existing = re.compile(
        re.escape(INJECTED_MARKER) + r'.*?</section>\s*',
        re.DOTALL
    )
    if INJECTED_MARKER in new_content:
        new_content = pattern_existing.sub(about, new_content, count=1)
        added_section = False
    else:
        # Insert before tools block
        if "<!-- TP-INTERNAL-TOOLS-BLOCK -->" in new_content:
            new_content = new_content.replace(
                "<!-- TP-INTERNAL-TOOLS-BLOCK -->",
                about + "\n<!-- TP-INTERNAL-TOOLS-BLOCK -->",
                1
            )
        elif "</main>" in new_content:
            new_content = new_content.replace("</main>", about + "\n</main>", 1)
        added_section = True

    if new_content != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True, n_grid > 0, added_section
    return False, False, False

def main():
    cities = [k for k in FACTS.keys() if not k.startswith("_")]
    print(f"loaded {len(cities)} cities from facts JSON")

    total_files = 0
    grid_replaced = 0
    sections_added = 0
    no_match = 0

    for city_key in cities:
        facts = FACTS[city_key]
        for service_key in SERVICES.keys():
            # Pattern: {city}-{state}-{service}-cost.html
            pattern = f"{city_key}-{service_key}-cost.html"
            if not os.path.exists(pattern):
                no_match += 1
                continue
            total_files += 1
            modified, did_grid, did_section = process_file(pattern, facts, service_key)
            if did_grid:
                grid_replaced += 1
            if did_section:
                sections_added += 1

    print(f"\n=== DONE ===")
    print(f"  files matched: {total_files}")
    print(f"  local-grids replaced with city-specific: {grid_replaced}")
    print(f"  about sections newly added: {sections_added}")
    print(f"  city-service combos with no file: {no_match}")

if __name__ == "__main__":
    main()
