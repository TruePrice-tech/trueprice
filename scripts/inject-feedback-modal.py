"""
Inject /js/feedback-modal.min.js script tag into every HTML file that contains
a mailto:hello@truepricehq.com link, so the modal hijacks the link.

Idempotent: skips files that already have the tag.

Run from repo root:
    python scripts/inject-feedback-modal.py
"""

import os, glob, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

SCRIPT_TAG = '<script src="/js/feedback-modal.min.js" defer></script>'
MARKER = "feedback-modal.min.js"

added = 0
skipped_already = 0
no_mailto = 0

for f in glob.glob("*.html"):
    with open(f, "r", encoding="utf-8", errors="replace") as fh:
        content = fh.read()
    if "mailto:hello@truepricehq.com" not in content:
        no_mailto += 1
        continue
    if MARKER in content:
        skipped_already += 1
        continue
    # Insert before </body> (or </html> as fallback)
    if "</body>" in content:
        new_content = content.replace("</body>", SCRIPT_TAG + "\n</body>", 1)
    elif "</html>" in content:
        new_content = content.replace("</html>", SCRIPT_TAG + "\n</html>", 1)
    else:
        continue
    with open(f, "w", encoding="utf-8") as fh:
        fh.write(new_content)
    added += 1

print(f"added script tag to {added} files")
print(f"already had script: {skipped_already}")
print(f"no mailto link: {no_mailto}")
