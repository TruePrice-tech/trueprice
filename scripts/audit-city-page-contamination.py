"""audit-city-page-contamination.py

Scans every {city}-{state}-{vertical}-cost.html page in repo root and reports
roofing-specific phrases that appear on non-roofing pages. Surfaces the
content-mismatch bug that makes electrical/HVAC/plumbing/etc. city pages
contain "impact-resistant shingles" or "roof replacement project" copy.

Exit code 0 if zero contamination found, 1 otherwise (so this can guard CI).

Run:
    python scripts/audit-city-page-contamination.py
"""

import os
import re
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent

ROOFING_VERTICALS = {"roof"}

NON_ROOF_VERTICAL_SLUGS = {
    "hvac", "plumbing", "electrical", "gutter", "window", "solar",
    "siding", "fence", "landscaping", "painting", "insulation",
    "concrete", "foundation", "garage-door", "kitchen-remodel",
}

VERTICAL_RE = re.compile(
    r"^([a-z][a-z-]*?)-([a-z]{2})-(" +
    "|".join(sorted(ROOFING_VERTICALS | NON_ROOF_VERTICAL_SLUGS, key=len, reverse=True)) +
    r")-cost\.html$"
)

ROOF_TERMS = [
    re.compile(r"\bimpact-resistant shingles?\b", re.I),
    re.compile(r"\bClass 4 .{0,30}shingles?\b", re.I),
    re.compile(r"\b3-tab shingles?\b", re.I),
    re.compile(r"\basphalt shingles?\b", re.I),
    re.compile(r"\bmetal roof(ing)?\b", re.I),
    re.compile(r"\broof pitch\b", re.I),
    re.compile(r"\broof(ing)? contractor\b", re.I),
    re.compile(r"\bany roof replacement\b", re.I),
    re.compile(r"\broof replacement project\b", re.I),
    re.compile(r"\broof replacement\b", re.I),
    re.compile(r"\broof replacements\b", re.I),
    re.compile(r"\broofing market\b", re.I),
    re.compile(r"\broofing prices?\b", re.I),
    re.compile(r"\bre-?roof(ing)?\b", re.I),
    re.compile(r"\bshingle .{0,30}granules?\b", re.I),
    re.compile(r"\bunderlayment\b", re.I),
    re.compile(r"\bdrip edge\b", re.I),
    re.compile(r"\bridge vent\b", re.I),
]


def scan_file(path: Path) -> list[tuple[str, str]]:
    """Return list of (term, snippet) tuples for matches found."""
    text = path.read_text(encoding="utf-8", errors="replace")
    hits = []
    for pat in ROOF_TERMS:
        for m in pat.finditer(text):
            start = max(0, m.start() - 40)
            end = min(len(text), m.end() + 40)
            snippet = re.sub(r"\s+", " ", text[start:end]).strip()
            hits.append((m.group(0), snippet))
    return hits


def main():
    by_vertical = defaultdict(int)
    total_pages = 0
    contaminated_pages = 0
    sample_per_vertical = {}
    contaminated_files = []

    for entry in sorted(os.listdir(ROOT)):
        m = VERTICAL_RE.match(entry)
        if not m:
            continue
        vslug = m.group(3)
        if vslug in ROOFING_VERTICALS:
            continue
        total_pages += 1
        path = ROOT / entry
        hits = scan_file(path)
        if hits:
            contaminated_pages += 1
            by_vertical[vslug] += 1
            contaminated_files.append(entry)
            if vslug not in sample_per_vertical:
                sample_per_vertical[vslug] = (entry, hits[:3])

    print("=" * 60)
    print("CITY PAGE CROSS-VERTICAL CONTAMINATION AUDIT")
    print("=" * 60)
    print(f"Total non-roofing city pages scanned: {total_pages}")
    print(f"Pages with roofing-content contamination: {contaminated_pages}")
    pct = (contaminated_pages * 100.0 / total_pages) if total_pages else 0
    print(f"Contamination rate: {pct:.1f}%")
    print()
    print("By vertical:")
    for v in sorted(by_vertical, key=lambda k: -by_vertical[k]):
        print(f"  {v:18s} {by_vertical[v]:5d} contaminated")
    print()
    if sample_per_vertical:
        print("Sample contamination (first per vertical):")
        for v, (fname, hits) in sorted(sample_per_vertical.items()):
            print(f"\n  [{v}] {fname}")
            for term, snippet in hits:
                print(f"      term: {term!r}")
                print(f"      ...{snippet}...")

    if contaminated_pages > 0:
        out = ROOT / "scripts" / "city-page-contamination.txt"
        out.write_text("\n".join(contaminated_files), encoding="utf-8")
        print(f"\nFull list written to: {out.relative_to(ROOT)}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
