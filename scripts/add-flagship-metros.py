"""add-flagship-metros.py

Adds 10 new flagship metro entries to each build-flagship-*.js builder's
METROS array (insertion is idempotent — script bails if the new metros are
already present). After this script runs, run all 16 flagship builders to
generate the new pages.

The new metros (next-largest US metros after the current top 10) are:
  San Francisco, Washington DC, Philadelphia, Miami, Boston, San Diego,
  Tampa, Detroit, Minneapolis, Charlotte
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"

# (slug, ctxKey, region, displayCity, displayState)
NEW_METROS = [
    ("san-francisco-ca", "San Francisco|CA", "west"),
    ("washington-dc",    "Washington|DC",    "northeast"),
    ("philadelphia-pa",  "Philadelphia|PA",  "northeast"),
    ("miami-fl",         "Miami|FL",         "southeast"),
    ("boston-ma",        "Boston|MA",        "northeast"),
    ("san-diego-ca",     "San Diego|CA",     "west"),
    ("tampa-fl",         "Tampa|FL",         "southeast"),
    ("detroit-mi",       "Detroit|MI",       "midwest"),
    ("minneapolis-mn",   "Minneapolis|MN",   "midwest"),
    ("charlotte-nc",     "Charlotte|NC",     "southeast"),
]

# Per-vertical file suffix (the part before -cost.html)
VERTICAL_FILE_SUFFIX = {
    "concrete":    "concrete",
    "electrical":  "electrical",
    "fencing":     "fence",
    "foundation":  "foundation",
    "garage-door": "garage-door",
    "gutters":     "gutter",
    "hvac":        "hvac",
    "insulation":  "insulation",
    "kitchen":     "kitchen-remodel",
    "landscaping": "landscaping",
    "painting":    "painting",
    "plumbing":    "plumbing",
    "roofing":     "roof",
    "siding":      "siding",
    "solar":       "solar",
    "windows":     "window",
}

# Per-metro IECC climate zone data for the insulation builder
INSULATION_EXTRAS = {
    "san-francisco-ca": dict(ieccZone="3C", doeAttic="R-30 to R-60", doeWall="R-13 to R-15", codeAttic="R-30", codeWall="R-13",      heatingDom=False, coolingDom=False, humidity="moderate"),
    "washington-dc":    dict(ieccZone="4A", doeAttic="R-49 to R-60", doeWall="R-13 to R-21", codeAttic="R-49", codeWall="R-13+5ci",  heatingDom=True,  coolingDom=False, humidity="moderate"),
    "philadelphia-pa":  dict(ieccZone="4A", doeAttic="R-49 to R-60", doeWall="R-13 to R-21", codeAttic="R-49", codeWall="R-13+5ci",  heatingDom=True,  coolingDom=False, humidity="moderate"),
    "miami-fl":         dict(ieccZone="1A", doeAttic="R-30 to R-49", doeWall="R-13",         codeAttic="R-30", codeWall="R-13",      heatingDom=False, coolingDom=True,  humidity="high"),
    "boston-ma":        dict(ieccZone="5A", doeAttic="R-49 to R-60", doeWall="R-13 to R-21", codeAttic="R-49", codeWall="R-13+5ci",  heatingDom=True,  coolingDom=False, humidity="moderate"),
    "san-diego-ca":     dict(ieccZone="3B", doeAttic="R-30 to R-60", doeWall="R-13 to R-15", codeAttic="R-30", codeWall="R-13",      heatingDom=False, coolingDom=False, humidity="low"),
    "tampa-fl":         dict(ieccZone="2A", doeAttic="R-30 to R-60", doeWall="R-13",         codeAttic="R-38", codeWall="R-13",      heatingDom=False, coolingDom=True,  humidity="high"),
    "detroit-mi":       dict(ieccZone="5A", doeAttic="R-49 to R-60", doeWall="R-13 to R-21", codeAttic="R-49", codeWall="R-13+5ci",  heatingDom=True,  coolingDom=False, humidity="moderate"),
    "minneapolis-mn":   dict(ieccZone="6A", doeAttic="R-49 to R-60", doeWall="R-13 to R-21", codeAttic="R-49", codeWall="R-13+5ci",  heatingDom=True,  coolingDom=False, humidity="moderate"),
    "charlotte-nc":     dict(ieccZone="3A", doeAttic="R-30 to R-60", doeWall="R-13 to R-15", codeAttic="R-38", codeWall="R-13",      heatingDom=False, coolingDom=False, humidity="moderate"),
}


def js_bool(b): return "true" if b else "false"


def build_entry(builder_key, slug, ctx_key, region):
    suffix = VERTICAL_FILE_SUFFIX[builder_key]
    file = f"{slug}-{suffix}-cost.html"
    if builder_key == "insulation":
        e = INSULATION_EXTRAS[slug]
        return (
            f'  {{ slug: "{slug}", ctxKey: "{ctx_key}", file: "{file}", region: "{region}", '
            f'ieccZone: "{e["ieccZone"]}", doeAttic: "{e["doeAttic"]}", doeWall: "{e["doeWall"]}", '
            f'codeAttic: "{e["codeAttic"]}", codeWall: "{e["codeWall"]}", '
            f'heatingDom: {js_bool(e["heatingDom"])}, coolingDom: {js_bool(e["coolingDom"])}, '
            f'humidity: "{e["humidity"]}" }},'
        )
    if builder_key == "siding":
        # siding has region BEFORE file
        return f'  {{ slug: "{slug}", ctxKey: "{ctx_key}", region: "{region}", file: "{file}" }},'
    # Builders that take region (concrete, electrical, fencing, painting)
    if builder_key in ("concrete", "electrical", "fencing", "painting"):
        return f'  {{ slug: "{slug}", ctxKey: "{ctx_key}", file: "{file}", region: "{region}" }},'
    # Builders without region in METROS
    return f'  {{ slug: "{slug}", ctxKey: "{ctx_key}", file: "{file}" }},'


def patch_builder(builder_key):
    fname = f"build-flagship-{builder_key}.js"
    path = SCRIPTS / fname
    if not path.exists():
        print(f"  SKIP {fname} (not found)")
        return False
    text = path.read_text(encoding="utf-8")

    # Bail if any new metro slug already present
    if any(slug in text for slug, _, _ in NEW_METROS):
        print(f"  SKIP {fname} (already patched)")
        return False

    # Insert before the closing `];` of the METROS array. METROS array is
    # "const METROS = [" through the matching "];".
    new_lines = "\n".join(build_entry(builder_key, slug, ctx_key, region)
                          for slug, ctx_key, region in NEW_METROS)

    # Find METROS array. We anchor on `const METROS = [` and the next `];`.
    m = re.search(r"const METROS\s*=\s*\[", text)
    if not m:
        print(f"  FAIL {fname} (no METROS array)")
        return False
    # Find matching `];` after the METROS opener
    depth = 0
    i = m.end() - 1  # at the `[`
    end_idx = None
    while i < len(text):
        ch = text[i]
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                # text[i] == ']'; closing line is either '];' or ']' on its own
                end_idx = i
                break
        i += 1
    if end_idx is None:
        print(f"  FAIL {fname} (unbalanced METROS array)")
        return False
    new_text = text[:end_idx] + new_lines + "\n" + text[end_idx:]
    path.write_text(new_text, encoding="utf-8", newline="\n")
    print(f"  OK   {fname} (+{len(NEW_METROS)} metros)")
    return True


def main():
    print("Adding 10 new flagship metros to all 16 builders...")
    for key in VERTICAL_FILE_SUFFIX:
        patch_builder(key)
    print("\nNow run: for f in scripts/build-flagship-*.js; do node \"$f\"; done")


if __name__ == "__main__":
    main()
