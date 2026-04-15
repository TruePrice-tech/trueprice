"""Add FAQPage JSON-LD schema to city cost pages that have FAQ content but no schema.

Audit showed 3,757 city pages have <details class="faq-item"> FAQ content
but no FAQPage JSON-LD schema. Adding the schema boosts SERP appearance
(rich results, more vertical space, higher CTR) and makes the content
more unique per-city (schema text embedded in page).

Pages affected:
  - All HVAC city pages (739)
  - All insulation city pages (739)
  - All siding city pages (739)
  - All window city pages (739)
  - All electrical city pages (739)
  - ~62 roof city pages
  Total: ~3,757 pages

Idempotent: skips pages that already have FAQPage schema.
"""

import os
import re
import json
import glob
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def extract_faq_items(html):
    """Pull all Q/A pairs from <details class="faq-item"> blocks."""
    items = []
    # Match <details class="faq-item">...<summary>Q</summary>...<div class="faq-answer">A</div>...</details>
    pattern = re.compile(
        r'<details[^>]*class="[^"]*faq-item[^"]*"[^>]*>\s*'
        r'<summary[^>]*>(.*?)</summary>\s*'
        r'(?:<div[^>]*class="[^"]*faq-answer[^"]*"[^>]*>)?\s*(.*?)\s*(?:</div>)?\s*</details>',
        re.DOTALL | re.IGNORECASE
    )
    for m in pattern.finditer(html):
        question_html = m.group(1).strip()
        answer_html = m.group(2).strip()
        # Strip HTML tags from Q
        question = re.sub(r'<[^>]+>', ' ', question_html)
        question = re.sub(r'\s+', ' ', question).strip()
        # Strip HTML tags from A (preserve line breaks as periods)
        answer = re.sub(r'<br\s*/?>', '. ', answer_html, flags=re.IGNORECASE)
        answer = re.sub(r'</(p|li|div)>', '. ', answer, flags=re.IGNORECASE)
        answer = re.sub(r'<[^>]+>', ' ', answer)
        answer = re.sub(r'\s+', ' ', answer).strip().rstrip('.')
        if question and answer:
            items.append({"q": question, "a": answer})
    return items


def build_faqpage_schema(items):
    """Build the FAQPage JSON-LD script block."""
    if not items:
        return None
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": it["q"],
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": it["a"]
                }
            }
            for it in items
        ]
    }
    # Compact JSON (saves bytes, still valid)
    return '<script type="application/ld+json">\n' + json.dumps(schema, ensure_ascii=False) + '\n</script>'


def process_file(path):
    text = path.read_text(encoding="utf-8", errors="replace")

    # Skip if already has FAQPage schema
    if '"FAQPage"' in text or "'FAQPage'" in text:
        return "skip_existing"

    items = extract_faq_items(text)
    if not items:
        return "skip_no_faq"

    schema_block = build_faqpage_schema(items)
    if not schema_block:
        return "skip_no_schema"

    # Insert just before </head>
    new_text, n = re.subn(
        r'(\s*</head>)',
        '\n' + schema_block + r'\1',
        text, count=1
    )
    if n == 0:
        return "fail_no_head"

    path.write_text(new_text, encoding="utf-8")
    return f"ok_{len(items)}faqs"


def main():
    stats = {"skip_existing": 0, "skip_no_faq": 0, "skip_no_schema": 0, "fail_no_head": 0, "added": 0}
    total_faqs = 0

    # Target verticals that were missing
    files = []
    for v in ["hvac", "insulation", "siding", "window", "electrical", "roof"]:
        files.extend(sorted(glob.glob(str(ROOT / f"*-{v}-cost.html"))))

    print(f"Processing {len(files)} potential files...")

    for i, p in enumerate(files):
        result = process_file(Path(p))
        if result.startswith("ok_"):
            stats["added"] += 1
            total_faqs += int(result.split("_")[1].replace("faqs", ""))
        else:
            stats[result] = stats.get(result, 0) + 1

        if (i + 1) % 500 == 0:
            print(f"  progress: {i+1}/{len(files)}")

    print()
    print(f"Done. Stats:")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    print(f"  total FAQ items embedded: {total_faqs}")


if __name__ == "__main__":
    main()
