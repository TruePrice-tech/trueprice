"""
Fix backslash issue more carefully: only add/remove backslashes inside
<script> blocks, and remove any incorrectly added to HTML sections.
"""
import glob, re

count = 0
for f in glob.glob("*-estimate.html") + glob.glob("*-quote-analyzer.html"):
    with open(f, "r", encoding="utf-8", errors="replace") as fh:
        content = fh.read()

    lines = content.split("\n")
    changed = False
    in_script = False

    for i, line in enumerate(lines):
        stripped = line.rstrip()

        # Track script blocks
        if "<script>" in line or "<script " in line:
            in_script = True
        if "</script>" in line:
            in_script = False

        # Remove incorrectly added backslashes OUTSIDE script blocks
        if not in_script:
            if stripped.endswith("\\") and ("Analyze a" in line or "Get an estimate" in line or "Compare" in line) and "href=" in line:
                lines[i] = stripped[:-1]
                changed = True

        # Ensure backslashes ARE present INSIDE script blocks for our CTA lines
        if in_script:
            if ("Analyze a" in line and "quote</a>" in line and "href=" in line):
                if not stripped.endswith("\\"):
                    lines[i] = stripped + "\\"
                    changed = True
            if ("Get a" in line and "estimate</a>" in line and "href=" in line):
                if not stripped.endswith("\\"):
                    lines[i] = stripped + "\\"
                    changed = True
            if ("Compare 2-3" in line and "side by side</a>" in line and "href=" in line):
                if not stripped.endswith("\\"):
                    lines[i] = stripped + "\\"
                    changed = True

    if changed:
        with open(f, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines))
        count += 1
        print(f"FIXED {f}")

print(f"\nFixed {count} files")
