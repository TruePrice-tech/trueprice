"""Fix missing backslash continuations in JS template strings after CTA replacement."""
import glob

count = 0
for f in glob.glob("*-estimate.html") + glob.glob("*-quote-analyzer.html"):
    with open(f, "r", encoding="utf-8", errors="replace") as fh:
        content = fh.read()

    lines = content.split("\n")
    changed = False
    for i, line in enumerate(lines):
        stripped = line.rstrip()
        # Find our replacement lines that need backslash continuation
        if ("Analyze a" in line and "quote</a>" in line and 'href="/' in line):
            if not stripped.endswith("\\"):
                lines[i] = stripped + "\\"
                changed = True
        if ("Get a" in line and "estimate</a>" in line and 'href="/' in line):
            if not stripped.endswith("\\"):
                lines[i] = stripped + "\\"
                changed = True
        if ("Compare 2-3" in line and "side by side</a>" in line and 'href="/' in line):
            if not stripped.endswith("\\"):
                lines[i] = stripped + "\\"
                changed = True

    if changed:
        with open(f, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines))
        count += 1
        print(f"FIXED {f}")

print(f"\nFixed {count} files")
