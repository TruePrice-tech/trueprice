"""
Fix story multipliers for living area calculation across estimate pages.

The old multipliers (1.25x for 2-story, 1.5x for 3+) were meant for
roof area, not living area. A 2-story house has ~2x the living area
of its footprint, not 1.25x.

This script targets only the story-to-sqft patterns, not other
multipliers that happen to use 1.25 (like glass package, removal, etc.)
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

FILES = [
    "hvac-estimate.html",
    "painting-estimate.html",
    "insulation-estimate.html",
    "electrical-estimate.html",
    "siding-estimate.html",
]

# Patterns that are specifically story-to-living-area multipliers
# They all look like: stories === "2" ? 1.25 : stories === "3" ? 1.5 : 1.0
PATTERN = re.compile(
    r'(stories\s*===\s*"2"\s*\?\s*)1\.25(\s*:\s*stories\s*===\s*"3"\s*\?\s*)1\.5(\s*:\s*1\.0)'
)
REPLACEMENT = r'\g<1>2.0\g<2>2.5\g<3>'

# Also fix: est.stories === "2" ? 1.25 : est.stories === "3" ? 1.5 : 1.0
PATTERN2 = re.compile(
    r'(est\.stories\s*===\s*"2"\s*\?\s*)1\.25(\s*:\s*est\.stories\s*===\s*"3"\s*\?\s*)1\.5(\s*:\s*1\.0)'
)

count = 0
for f in FILES:
    if not os.path.exists(f):
        print(f"SKIP {f}: not found")
        continue
    with open(f, "r", encoding="utf-8", errors="replace") as fh:
        content = fh.read()

    new_content, n1 = PATTERN.subn(REPLACEMENT, content)
    new_content, n2 = PATTERN2.subn(REPLACEMENT, new_content)
    total = n1 + n2

    if total > 0:
        with open(f, "w", encoding="utf-8") as fh:
            fh.write(new_content)
        count += 1
        print(f"OK  {f}: {total} replacements (1.25->2.0, 1.5->2.5)")
    else:
        print(f"SKIP {f}: no story multiplier patterns found")

print(f"\nFixed {count} files")
