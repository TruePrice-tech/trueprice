"""audit-flagship-uniqueness.py

Measures shingle overlap between flagship metro pages within each vertical.
Target: <20% average pairwise 8-word shingle overlap = pages are mostly unique.
>50% overlap = heavy boilerplate that needs rewriting.

Run:
    python scripts/audit-flagship-uniqueness.py
"""

import re
import sys
import itertools
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

METROS_PER_VERTICAL = {
    "auto-repair": ("auto-repair",     "FLAGSHIP-AUTO-REPAIR-CONTENT"),
    "concrete":    ("concrete",        "FLAGSHIP-CONCRETE-CONTENT"),
    "electrical":  ("electrical",      "FLAGSHIP-ELECTRICAL-CONTENT"),
    "fence":       ("fence",           "FLAGSHIP-FENCING-CONTENT"),
    "foundation":  ("foundation",      "FLAGSHIP-FOUNDATION-CONTENT"),
    "garage-door": ("garage-door",     "FLAGSHIP-GARAGE-CONTENT"),
    "gutter":      ("gutter",          "FLAGSHIP-GUTTERS-CONTENT"),
    "hvac":        ("hvac",            "FLAGSHIP-HVAC-CONTENT"),
    "insulation":  ("insulation",      "FLAGSHIP-INSULATION-CONTENT"),
    "kitchen":     ("kitchen-remodel", "FLAGSHIP-KITCHEN-CONTENT"),
    "landscaping": ("landscaping",     "FLAGSHIP-LANDSCAPING-CONTENT"),
    "moving":      ("moving",          "FLAGSHIP-MOVING-CONTENT"),
    "painting":    ("painting",        "FLAGSHIP-PAINTING-CONTENT"),
    "plumbing":    ("plumbing",        "FLAGSHIP-PLUMBING-CONTENT"),
    "roof":        ("roof",            "FLAGSHIP-CONTENT"),
    "siding":      ("siding",          "FLAGSHIP-SIDING-CONTENT"),
    "solar":       ("solar",           "FLAGSHIP-SOLAR-CONTENT"),
    "window":      ("window",          "FLAGSHIP-WINDOWS-CONTENT"),
}

METROS = [
    "new-york-ny", "los-angeles-ca", "chicago-il", "houston-tx", "phoenix-az",
    "dallas-tx", "atlanta-ga", "denver-co", "seattle-wa", "austin-tx",
    "san-francisco-ca", "philadelphia-pa", "miami-fl", "boston-ma",
    "san-diego-ca", "tampa-fl", "detroit-mi", "minneapolis-mn",
    "charlotte-nc", "las-vegas-nv",
    "san-antonio-tx", "jacksonville-fl", "fort-worth-tx", "columbus-oh",
    "indianapolis-in", "nashville-tn", "portland-or", "memphis-tn",
    "louisville-ky", "baltimore-md", "milwaukee-wi", "albuquerque-nm",
    "tucson-az", "sacramento-ca", "raleigh-nc", "kansas-city-mo",
    "orlando-fl", "pittsburgh-pa", "cincinnati-oh", "colorado-springs-co",
]


def extract(path: Path, marker_name: str) -> str:
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    # Accept both FLAGSHIP-X-CONTENT and FLAGSHIP-X with or without the trailing
    # CONTENT suffix, to be tolerant across builders.
    candidates = [
        f"<!-- {marker_name} -->",
        f"<!-- /{marker_name} -->",
    ]
    start = text.find(candidates[0])
    end = text.find(candidates[1])
    if start < 0 or end < 0 or end <= start:
        return ""
    html = text[start + len(candidates[0]) : end]
    stripped = re.sub(r"<[^>]+>", " ", html)
    stripped = re.sub(r"\s+", " ", stripped).strip()
    return stripped


def shingles(text: str, n: int = 8) -> set:
    ws = text.split()
    return set(" ".join(ws[i:i + n]) for i in range(len(ws) - n + 1))


def main():
    print("=" * 64)
    print("FLAGSHIP PAGE UNIQUENESS AUDIT (8-word shingle overlap)")
    print("=" * 64)
    print(f"{'vertical':14s} {'pages':>5s} {'avg_words':>9s} {'avg_overlap%':>12s} {'max_overlap%':>12s}  worst_pair")
    print("-" * 100)

    summary = []
    for v, (suffix, marker) in METROS_PER_VERTICAL.items():
        texts = {}
        for m in METROS:
            path = ROOT / f"{m}-{suffix}-cost.html"
            t = extract(path, marker)
            if t:
                texts[m] = t
        if len(texts) < 2:
            print(f"{v:14s} {len(texts):>5d} (insufficient)")
            continue
        sh = {m: shingles(t) for m, t in texts.items()}
        overlaps = []
        pairs = []
        for a, b in itertools.combinations(texts.keys(), 2):
            o = len(sh[a] & sh[b])
            avg = (len(sh[a]) + len(sh[b])) / 2
            pct = o / avg * 100 if avg else 0
            overlaps.append(pct)
            pairs.append((pct, a, b))
        avg_words = sum(len(t.split()) for t in texts.values()) / len(texts)
        avg_overlap = sum(overlaps) / len(overlaps)
        max_overlap = max(overlaps)
        pairs.sort(reverse=True)
        worst = pairs[0] if pairs else (0, "", "")
        summary.append((v, len(texts), avg_words, avg_overlap, max_overlap))
        print(f"{v:14s} {len(texts):>5d} {avg_words:>9.0f} {avg_overlap:>11.1f}% {max_overlap:>11.1f}%  {worst[1]} / {worst[2]} ({worst[0]:.1f}%)")

    print()
    print("Target: avg_overlap < 20% = pages mostly unique")
    print("Current: any vertical > 30% needs rewrite of shared sections")

    # Exit non-zero if any vertical > 30% average overlap (for CI gating later)
    bad = [s for s in summary if s[3] > 30]
    if bad:
        print(f"\n{len(bad)}/{len(summary)} verticals exceed 30% overlap target")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
