"""
seo-tier1-sweep.py — three-in-one SEO enhancement pass over all city cost pages.

For every {city}-{state}-{vertical}-cost.html page:
  1. Rewrite the <meta name="description"> + og:description + twitter:description
     with a UNIQUE per-page sentence that includes the actual hero price range
     and the city name. Differentiates the snippet Google shows in SERPs.
  2. Add a "Nearby cities" internal-link section linking to 4-6 same-state
     same-vertical city pages, plus the parent vertical cost guide. Solves
     the SEO-island problem where city pages don't pass authority to siblings.
  3. (Hero paragraph already leads with the price answer — verified.)

Run: python scripts/seo-tier1-sweep.py
"""

import os, re, glob, json, random
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

VERTICALS = {
    "roof": ("roofing replacement", "Roofing"),
    "hvac": ("HVAC replacement", "HVAC"),
    "plumbing": ("plumbing", "Plumbing"),
    "electrical": ("electrical work", "Electrical"),
    "gutter": ("gutter installation", "Gutters"),
    "window": ("window replacement", "Windows"),
    "solar": ("solar panel installation", "Solar"),
    "siding": ("siding replacement", "Siding"),
    "fence": ("fence installation", "Fencing"),
    "landscaping": ("landscaping", "Landscaping"),
    "painting": ("exterior painting", "Painting"),
    "insulation": ("insulation", "Insulation"),
    "concrete": ("concrete work", "Concrete"),
    "foundation": ("foundation repair", "Foundation"),
    "garage-door": ("garage door replacement", "Garage Doors"),
    "kitchen-remodel": ("kitchen remodel", "Kitchen"),
}
GUIDE_FOR_VERTICAL = {
    "roof": "roof-replacement-cost-guide.html",
    "hvac": "hvac-replacement-cost-guide.html",
    "plumbing": "plumbing-cost-guide.html",
    "electrical": "electrical-cost-guide.html",
    "gutter": "gutter-installation-cost-guide.html",
    "window": "window-replacement-cost-guide.html",
    "solar": "solar-cost-guide.html",
    "siding": "siding-replacement-cost-guide.html",
    "fence": "fencing-cost-guide.html",
    "landscaping": "landscaping-cost-guide.html",
    "painting": "painting-cost-guide.html",
    "insulation": "insulation-cost-guide.html",
    "concrete": "concrete-cost-guide.html",
    "foundation": "foundation-repair-cost-guide.html",
    "garage-door": "garage-door-cost-guide.html",
    "kitchen-remodel": "kitchen-remodel-cost-guide.html",
}

INJECTED_NEARBY = "<!-- TP-NEARBY-CITIES -->"
INJECTED_META = "<!-- TP-META-V2 -->"

PRICE_RE = re.compile(r'class="hero-price">\$([\d,]+)</span>\s*and\s*<span class="hero-price">\$([\d,]+)', re.S)
META_RE = re.compile(r'<meta name="description" content="[^"]*"\s*/?>', re.I)
OG_DESC_RE = re.compile(r'<meta property="og:description" content="[^"]*"\s*/?>', re.I)
TW_DESC_RE = re.compile(r'<meta name="twitter:description" content="[^"]*"\s*/?>', re.I)

# Build state -> vertical -> [filenames] index
state_vert_files = defaultdict(lambda: defaultdict(list))
all_files = sorted(glob.glob("*-cost.html"))
city_files = []
for f in all_files:
    base = f[:-len("-cost.html")]
    # filename pattern: {city-tokens}-{2-letter-state}-{vertical-tokens}
    # vertical can be 'kitchen-remodel' or 'garage-door'
    matched_vert = None
    for vk in sorted(VERTICALS.keys(), key=len, reverse=True):
        suffix = "-" + vk
        if base.endswith(suffix):
            rest = base[:-len(suffix)]
            # rest = {city-tokens}-{state}
            m = re.match(r"^(.+)-([a-z]{2})$", rest)
            if m:
                city_slug, state = m.group(1), m.group(2).upper()
                state_vert_files[state][vk].append(f)
                city_files.append((f, city_slug, state, vk))
                matched_vert = vk
                break

print(f"indexed {len(city_files)} city pages across {len(state_vert_files)} states")

def title_case_city(slug):
    return " ".join(w.capitalize() for w in slug.replace("-", " ").split())

def build_meta(city, state, vlabel, low, high):
    return (f"How much does {vlabel} cost in {city}, {state}? Real 2026 price range: "
            f"${low:,} to ${high:,}, plus city-specific labor rates, permits, rebates, "
            f"and red flags to watch for. Free analysis, no email required.")

def build_nearby_html(current_file, city, state, vslug, vlabel):
    siblings = [f for f in state_vert_files[state][vslug] if f != current_file]
    random.seed(state + vslug)
    siblings_sample = random.sample(siblings, min(6, len(siblings))) if siblings else []
    guide = GUIDE_FOR_VERTICAL.get(vslug, "")
    parts = [INJECTED_NEARBY,
             '<section class="section" style="margin:32px 0;">',
             f'<h2>{vlabel} cost in nearby {state} cities</h2>',
             '<p style="color:var(--text-secondary); margin-bottom:14px;">'
             f'Compare {vlabel.lower()} pricing across {state} to see how {city} stacks up. Each city page has local labor rates, permits, and rebates.</p>',
             '<div style="display:flex; flex-wrap:wrap; gap:8px;">']
    for sf in siblings_sample:
        # extract city slug
        base = sf[:-len("-cost.html")]
        for vk in sorted(VERTICALS.keys(), key=len, reverse=True):
            suffix = "-" + vk
            if base.endswith(suffix):
                rest = base[:-len(suffix)]
                m = re.match(r"^(.+)-([a-z]{2})$", rest)
                if m:
                    other_city = title_case_city(m.group(1))
                    parts.append(f'<a href="/{sf}" style="padding:8px 14px; border:1px solid var(--border); border-radius:999px; font-size:13px; color:var(--brand); text-decoration:none;">{other_city}, {state}</a>')
                break
    parts.append('</div>')
    if guide and os.path.exists(guide):
        parts.append(f'<p style="margin-top:14px; font-size:14px;">See the full <a href="/{guide}" style="color:var(--brand);">{vlabel} cost guide</a> for national averages, brand tier comparisons, and red flags.</p>')
    parts.append('</section>\n')
    return "\n".join(parts)

processed = 0
meta_updated = 0
nearby_added = 0
skipped = 0

for f, city_slug, state, vslug in city_files:
    try:
        with open(f, "r", encoding="utf-8") as fp: c = fp.read()
    except Exception:
        skipped += 1; continue
    orig = c
    city = title_case_city(city_slug)
    vlabel_long, vlabel_short = VERTICALS[vslug]

    # Extract hero price from rendered HTML
    pm = PRICE_RE.search(c)
    if pm:
        try:
            low = int(pm.group(1).replace(",", ""))
            high = int(pm.group(2).replace(",", ""))
        except ValueError:
            low, high = None, None
    else:
        low, high = None, None

    # 1. Unique meta description
    if low and high and INJECTED_META not in c:
        new_desc = build_meta(city, state, vlabel_long, low, high)
        new_meta_tag = f'<meta name="description" content="{new_desc}">'
        new_og_tag = f'<meta property="og:description" content="{new_desc}">'
        new_tw_tag = f'<meta name="twitter:description" content="{new_desc}">'
        c2 = META_RE.sub(new_meta_tag, c, count=1)
        c2 = OG_DESC_RE.sub(new_og_tag, c2, count=1)
        c2 = TW_DESC_RE.sub(new_tw_tag, c2, count=1)
        # Mark as v2 so we don't double-process
        c2 = c2.replace('<link rel="canonical"', INJECTED_META + '\n<link rel="canonical"', 1)
        if c2 != c:
            c = c2
            meta_updated += 1

    # 2. Nearby cities section (idempotent)
    if INJECTED_NEARBY not in c:
        nearby_html = build_nearby_html(f, city, state, vslug, vlabel_short)
        # Insert before the standard "Other Services in {city}" footer or before the result-footer JS
        if "<!-- TP-INTERNAL-TOOLS-BLOCK -->" in c:
            c = c.replace("<!-- TP-INTERNAL-TOOLS-BLOCK -->", nearby_html + "<!-- TP-INTERNAL-TOOLS-BLOCK -->", 1)
        elif "</main>" in c:
            c = c.replace("</main>", nearby_html + "</main>", 1)
        nearby_added += 1

    if c != orig:
        with open(f, "w", encoding="utf-8") as fp: fp.write(c)
        processed += 1

print(f"\n=== DONE ===")
print(f"  files modified:   {processed}")
print(f"  meta descriptions: {meta_updated}")
print(f"  nearby sections:   {nearby_added}")
print(f"  files skipped:     {skipped}")
