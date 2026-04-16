"""
Strip every reference to the obsolete "Photo Estimate" feature from the site.

Removes:
  - <a href="/roofing-quote-analyzer.html?mode=estimator">Photo Estimate</a>  (nav link in ~18k generated pages + templates)
  - <a href="/photo-estimate.html">...anything...</a>                           (any direct links to the deleted page)
  - <a href="/photo-estimate.html">Roof photo estimate</a>                      (footer variant)

Does NOT touch:
  - "Get an estimate" / "estimate" copy not specifically about photo-of-house
  - "Upload a quote" / "Compare quotes" features (different feature, kept)
  - The ?mode=estimator URL parameter itself (other verticals still use it)

Run: python scripts/strip-photo-estimate.py
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Patterns to remove. Each matches the FULL <a>...</a> element, optionally
# wrapped in surrounding whitespace/newlines so we don't leave a blank line.
PATTERNS = [
    # Nav link with mode=estimator wording "Photo Estimate"
    re.compile(r'\s*<a\s+href="/roofing-quote-analyzer\.html\?mode=estimator"[^>]*>\s*Photo Estimate\s*</a>\s*\n?', re.IGNORECASE),
    # Direct links to /photo-estimate.html (any link text)
    re.compile(r'\s*<a\s+href="/photo-estimate\.html[^"]*"[^>]*>.*?</a>\s*\n?', re.IGNORECASE | re.DOTALL),
]

def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    if any(p in parts for p in ("node_modules", ".git", "test-results")):
        return True
    return False

def process_file(path: Path) -> bool:
    try:
        original = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return False

    new = original
    for pat in PATTERNS:
        new = pat.sub("\n", new)

    if new != original:
        path.write_text(new, encoding="utf-8")
        return True
    return False

def main():
    changed = 0
    scanned = 0
    for path in ROOT.rglob("*.html"):
        if should_skip(path):
            continue
        scanned += 1
        if process_file(path):
            changed += 1

    print(f"Scanned {scanned} HTML files; modified {changed}.")

if __name__ == "__main__":
    main()
