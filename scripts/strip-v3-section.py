"""strip-v3-section.py

Removes the TP-LOCAL-INJECTED-V3 section from each page listed in
scripts/city-page-contamination.txt so the (now-fixed) inject-city-content-v3.py
can re-inject a clean version on the next run. Pages not in the contamination
list are left alone.

Run:
    python scripts/strip-v3-section.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIST_FILE = ROOT / "scripts" / "city-page-contamination.txt"

# V3 section starts with the comment marker and ends at the first </section>
# after it. Use a non-greedy match across newlines.
V3_BLOCK = re.compile(
    r"\s*<!--\s*TP-LOCAL-INJECTED-V3\s*-->.*?</section>\s*",
    re.DOTALL,
)


def main():
    if not LIST_FILE.exists():
        print(f"Missing {LIST_FILE}. Run audit-city-page-contamination.py first.")
        sys.exit(1)

    files = [line.strip() for line in LIST_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]
    print(f"Stripping V3 section from {len(files)} contaminated pages...")

    stripped = 0
    no_marker = 0
    for fname in files:
        path = ROOT / fname
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if "TP-LOCAL-INJECTED-V3" not in text:
            no_marker += 1
            continue
        new_text, n = V3_BLOCK.subn("\n", text)
        if n:
            path.write_text(new_text, encoding="utf-8")
            stripped += 1

    print(f"  stripped: {stripped}")
    print(f"  no marker (skipped): {no_marker}")


if __name__ == "__main__":
    main()
