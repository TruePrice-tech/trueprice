"""
Logo rollout: replace text-only "Woogoro" header link with an
Iris side-silhouette mark + wordmark lockup.

Before:  <a class="logo" href="/">Woogoro</a>
         <a class="logo" href="/" style="color:#fff;">Woogoro</a>

After:   <a class="logo" href="/"><img class="logo-mark" ... /><span>Woogoro</span></a>

The CSS to flex-align image + text is added to css/trueprice.css separately
(it's shared across all pages via a <link rel="stylesheet">).

Usage:
  python scripts/migrate-logo-lockup.py --dry-run
  python scripts/migrate-logo-lockup.py
"""
import argparse
import re
from pathlib import Path

LOGO_MARK_SRC = '/images/Iris/Iris%20color%20side%20silhouette.png'
LOGO_MARK_HTML = f'<img class="logo-mark" src="{LOGO_MARK_SRC}" alt="" width="32" height="32" /><span class="logo-text">Woogoro</span>'

# Match: <a class="logo" href="/" [optional attrs]>Woogoro</a>
# Also handles single/double quote variants and attribute order.
LOGO_LINK_RE = re.compile(
    r'(<a\b[^>]*?\bclass=(["\'])[^"\']*\blogo\b[^"\']*\2[^>]*?>)Woogoro(</a>)',
    re.IGNORECASE
)


def transform_content(content: str) -> tuple[str, int]:
    """Returns (new_content, count_of_replacements)."""
    count = 0

    def process(match):
        nonlocal count
        # Skip if already migrated (already contains an img)
        inner_start = match.end(1)
        inner_end = match.start(3)
        # If the full tag already has logo-mark, don't touch it
        if 'logo-mark' in match.group(0):
            return match.group(0)
        count += 1
        return match.group(1) + LOGO_MARK_HTML + match.group(3)

    new = LOGO_LINK_RE.sub(process, content)
    return new, count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--file', help='single file only')
    args = parser.parse_args()

    if args.file:
        files = [Path(args.file)]
    else:
        patterns = ['*.html', 'templates/*.html', 'authors/*.html']
        files = []
        for pat in patterns:
            files.extend(Path('.').glob(pat))
        files = sorted(set(files))
        files = [f for f in files if '_originals_pre_bg_clean' not in str(f)]

    total = 0
    for path in files:
        try:
            content = path.read_text(encoding='utf-8')
        except (UnicodeDecodeError, PermissionError):
            continue
        new_content, count = transform_content(content)
        if count > 0:
            total += 1
            if not args.dry_run:
                path.write_text(new_content, encoding='utf-8', newline='\n')

    print(('DRY RUN: ' if args.dry_run else '') + str(total) + ' files changed')


if __name__ == '__main__':
    main()
