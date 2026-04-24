"""
Stage 1 Trudy-to-Iris migration.

Replaces on every HTML file:
  1. Vertical-Trudy image paths (trudy-plumbing.png, etc.) -> Worker Woogoro paths
     and updates the accompanying alt text to name the Woogoro
  2. Homepage hero image paths -> Iris hero art
  3. Apple-touch-icon trudy.png -> Iris/Iris happy.png
  4. "Trudy" standalone word -> "Iris" in remaining copy/alt text

Out of scope (Stage 2, pending art):
  - trudy-catches.png, trudy-knows-prices.png, trudy-no-strings.png (trust cards)
  - favicon-trudy.svg (favicon)
  - trudy-peeking*.png, trudy-clipboard.png, other contextual poses

Usage:
  python scripts/migrate-trudy-to-iris.py --dry-run
  python scripts/migrate-trudy-to-iris.py
  python scripts/migrate-trudy-to-iris.py --file X.html
"""
import argparse
import re
from pathlib import Path

# --- mappings ---------------------------------------------------------------

# old filename stem -> (new worker filename, alt text for the Woogoro)
VERTICAL_IMAGES = {
    'trudy-auto.png':        ('Auto worker.png',        'Rex the Auto Repair Woogoro'),
    'trudy-concrete.png':    ('Concrete worker.png',    'Slate the Concrete Woogoro'),
    'trudy-electrical.png':  ('Electrical worker.png',  'Nova the Electrical Woogoro'),
    'trudy-fencing.png':     ('Fencing worker.png',     'Posie the Fencing Woogoro'),
    'trudy-foundation.png':  ('Foundation worker.png',  'Atlas the Foundation Woogoro'),
    'trudy-garage.png':      ('Garage worker.png',      'Gus the Garage Door Woogoro'),
    'trudy-gutters.png':     ('Gutter worker.png',      'River the Gutter Woogoro'),
    'trudy-hvac.png':        ('HVAC worker.png',        'Breeze the HVAC Woogoro'),
    'trudy-insulation.png':  ('Insulation worker.png',  'Hazel the Insulation Woogoro'),
    'trudy-kitchen.png':     ('Kitchen worker.png',     'Maple the Kitchen Woogoro'),
    'trudy-landscaping.png': ('Landscape worker.png',   'Moss the Landscaping Woogoro'),
    'trudy-legal.png':       ('Legal worker.png',       'Perry the Legal Woogoro'),
    'trudy-medical.png':     ('Medical worker.png',     'Scout the Medical Woogoro'),
    'trudy-moving.png':      ('Mover worker.png',       'Dash the Moving Woogoro'),
    'trudy-painting.png':    ('Painter worker.png',     'Clem the Painting Woogoro'),
    'trudy-plumbing.png':    ('Plumber worker.png',     'Pip the Plumbing Woogoro'),
    'trudy-roofing.png':     ('Roofer worker.png',      'Juniper the Roofing Woogoro'),
    'trudy-siding.png':      ('Siding worker.png',      'Cedar the Siding Woogoro'),
    'trudy-solar.png':       ('Solar worker.png',       'Sunny the Solar Woogoro'),
    'trudy-windows.png':     ('Windows worker.png',     'Willow the Windows Woogoro'),
}

# direct path swaps
PATH_SWAPS = {
    # Stage 1 (already shipped — kept here so script is re-runnable)
    '/images/trudy-estimate-hero.webp':                '/images/Iris/Iris%20estimate.png',
    '/images/trudy-analyze-hero.webp':                 '/images/Iris/Iris%20analyze.png',
    '/images/trudy-compare-hero.webp':                 '/images/Iris/Iris%20compare.png',
    '/images/trudy-compare-hero.png':                  '/images/Iris/Iris%20compare.png',
    '/images/Trudy_comparing1-removebg-preview.png':   '/images/Iris/Iris%20compare.png',
    '/images/trudy.png':                               '/images/Iris/Iris%20happy.png',
    # Stage 2 (trust cards + peeking + favicon)
    '/images/trudy-catches.png':                       '/images/Iris/Iris%20magnifying%20glass.png',
    '/images/trudy-catch.png':                         '/images/Iris/Iris%20magnifying%20glass.png',
    '/images/trudy-catch.webp':                        '/images/Iris/Iris%20magnifying%20glass.png',
    '/images/trudy-knows-prices.png':                  '/images/Iris/Iris%20map.png',
    '/images/trudy-no-strings.png':                    '/images/Iris/Iris%20cutting%20strings.png',
    '/images/trudy-zero-strings.png':                  '/images/Iris/Iris%20cutting%20strings.png',
    '/images/trudy-zero-strings.webp':                 '/images/Iris/Iris%20cutting%20strings.png',
    '/images/trudy-peeking.png':                       '/images/Iris/Iris%20peeking.png',
    '/images/trudy-peeking-hero.png':                  '/images/Iris/Iris%20peeking.png',
    '/favicon-trudy.svg':                              '/favicon.png',
    # Stage 2.5 (contextual one-off poses on special pages)
    '/images/trudy-worried.png':                       '/images/Iris/Iris%20concerned.png',
    '/images/trudy-thinking.png':                      '/images/Iris/Iris%20concerned.png',
    '/images/trudy-clipboard.png':                     '/images/Iris/Iris%20analyze.png',
    '/images/trudy-hero-investigator.png':             '/images/Iris/Iris%20magnifying%20glass.png',
    '/images/trudy-shopping.png':                      '/images/Iris/Iris%20happy.png',
    '/images/trudy-thumbsup.png':                      '/images/Iris/Iris%20happy.png',
    '/images/trudy-thumbs-up.png':                     '/images/Iris/Iris%20happy.png',
    '/images/trudy-working.png':                       '/images/Iris/Iris%20analyze.png',
    '/images/trudy-curious.png':                       '/images/Iris/Iris%20peeking.png',
    '/images/trudy-typing.png':                        '/images/Iris/Iris%20analyze.png',
    '/images/trudy-takes-photo.png':                   '/images/Iris/Iris%20catching.png',
    '/images/trudy-estimate.png':                      '/images/Iris/Iris%20estimate.png',
    '/images/trudy-clipboard2.png':                    '/images/Iris/Iris%20analyze.png',
}

HERO_ALT_REWRITES = {
    '/images/Iris/Iris%20estimate.png':             'Iris with her paws up, ready to help you estimate',
    '/images/Iris/Iris%20analyze.png':              'Iris holding up a quote, ready to analyze',
    '/images/Iris/Iris%20compare.png':              'Iris holding two quotes for comparison',
    '/images/Iris/Iris%20happy.png':                'Iris the Woogoro shire keeper',
    '/images/Iris/Iris%20magnifying%20glass.png':   'Iris holding a magnifying glass over a contractor quote',
    '/images/Iris/Iris%20map.png':                  'Iris in front of a US map of city prices',
    '/images/Iris/Iris%20cutting%20strings.png':    'Iris cutting strings to symbolize no lead-selling',
    '/images/Iris/Iris%20peeking.png':              'Iris peeking out from behind',
}


def worker_path(old_stem: str) -> str:
    """'trudy-plumbing.png' -> '/images/Worker%20Woogoro/Plumber%20worker.png'"""
    new_filename = VERTICAL_IMAGES[old_stem][0]
    return '/images/Worker%20Woogoro/' + new_filename.replace(' ', '%20')


def rewrite_img_tag(tag: str, old_marker: str, new_src: str, new_alt: str | None) -> str:
    """Surgical img-tag rewrite: replace src value in place, set/replace alt, drop width/height."""
    # Replace src value, preserving surrounding attribute order
    tag = re.sub(
        r'src=(["\'])' + re.escape(old_marker) + r'\1',
        lambda m: 'src=' + m.group(1) + new_src + m.group(1),
        tag, flags=re.IGNORECASE
    )
    # Replace or insert alt
    if new_alt is not None:
        if re.search(r'\balt=["\'][^"\']*["\']', tag):
            tag = re.sub(
                r'\balt=(["\'])[^"\']*\1',
                lambda m: 'alt=' + m.group(1) + new_alt + m.group(1),
                tag
            )
        else:
            tag = re.sub(r'<img\b', '<img alt="' + new_alt + '"', tag, count=1)
    # Drop fixed width/height (new image aspect ratios differ)
    tag = re.sub(r'\s+width=(["\'])\d+\1', '', tag)
    tag = re.sub(r'\s+height=(["\'])\d+\1', '', tag)
    return tag


IMG_TAG_RE = re.compile(r'<img\b[^>]*?/?>', re.IGNORECASE)


def transform_content(content: str) -> tuple[str, list[str]]:
    """Apply all migrations. Returns (new_content, changes_list)."""
    changes = []
    new = content

    # --- 1. Vertical Trudy img tags + raw path refs (JS object literals etc.) ---
    for old_stem, (new_file, alt_text) in VERTICAL_IMAGES.items():
        old_marker = '/images/' + old_stem
        new_src = worker_path(old_stem)
        count = 0

        def process(match, _old=old_marker, _src=new_src, _alt=alt_text):
            nonlocal count
            tag = match.group(0)
            if _old not in tag:
                return tag
            count += 1
            return rewrite_img_tag(tag, _old, _src, _alt)

        new = IMG_TAG_RE.sub(process, new)
        if count > 0:
            changes.append('  ' + old_stem + ' -> Worker/' + new_file + ' (' + str(count) + 'x)')

        # Catch raw path references (JS strings, etc.) that weren't inside <img> tags
        if old_marker in new:
            remaining = new.count(old_marker)
            new = new.replace(old_marker, new_src)
            changes.append('  raw path ' + old_marker + ' -> ' + new_src + ' (' + str(remaining) + 'x)')

    # --- 2. Direct path swaps (hero images, apple-touch-icon) ---
    for old_path, new_path in PATH_SWAPS.items():
        count = 0
        new_alt = HERO_ALT_REWRITES.get(new_path)

        def process(match, _old=old_path, _src=new_path, _alt=new_alt):
            nonlocal count
            tag = match.group(0)
            if _old not in tag:
                return tag
            count += 1
            return rewrite_img_tag(tag, _old, _src, _alt)

        new = IMG_TAG_RE.sub(process, new)
        if count > 0:
            changes.append('  img ' + old_path + ' -> ' + new_path + ' (' + str(count) + 'x)')

        # <link href="..."> (preload, apple-touch-icon)
        link_re = re.compile(
            r'(<link\b[^>]*?\bhref=(["\']))' + re.escape(old_path) + r'(\2[^>]*?>)',
            re.IGNORECASE
        )
        nc, ccount = link_re.subn(lambda m: m.group(1) + new_path + m.group(3), new)
        if ccount > 0:
            changes.append('  link href ' + old_path + ' -> ' + new_path + ' (' + str(ccount) + 'x)')
            new = nc

        # <meta content="..."> (og:image, twitter:image — may have host prefix)
        meta_re = re.compile(
            r'(<meta\b[^>]*?\bcontent=(["\']))(https?://[^"\'?]+)?' + re.escape(old_path) + r'(\2[^>]*?>)',
            re.IGNORECASE
        )
        def meta_repl(m):
            return m.group(1) + (m.group(3) or '') + new_path + m.group(4)
        nc, ccount = meta_re.subn(meta_repl, new)
        if ccount > 0:
            changes.append('  meta content ' + old_path + ' -> ' + new_path + ' (' + str(ccount) + 'x)')
            new = nc

        # Plain path references (e.g., JS strings: 'img: "/images/trudy-X.png"')
        if old_path in new:
            remaining = new.count(old_path)
            new = new.replace(old_path, new_path)
            changes.append('  raw path ' + old_path + ' -> ' + new_path + ' (' + str(remaining) + 'x)')

    # --- 3. Text "Trudy" (word-boundary, case-sensitive) -> "Iris" ---
    nc, tcount = re.subn(r'\bTrudy\b', 'Iris', new)
    if tcount > 0:
        changes.append('  "Trudy" -> "Iris" in copy (' + str(tcount) + 'x)')
        new = nc

    # --- 4. Favicon link type attribute: SVG -> PNG ---
    fav_type_re = re.compile(
        r'(<link\b[^>]*?\bhref=(["\'])/favicon\.png\2[^>]*?)type=(["\'])image/svg\+xml\3',
        re.IGNORECASE
    )
    nc, fcount = fav_type_re.subn(lambda m: m.group(1) + 'type=' + m.group(3) + 'image/png' + m.group(3), new)
    if fcount > 0:
        changes.append('  favicon type image/svg+xml -> image/png (' + str(fcount) + 'x)')
        new = nc

    # --- 5. Rename CSS class "trudy-bounce" -> "iris-bounce" ---
    nc, ccount = re.subn(r'\btrudy-bounce\b', 'iris-bounce', new)
    if ccount > 0:
        changes.append('  class trudy-bounce -> iris-bounce (' + str(ccount) + 'x)')
        new = nc

    return new, changes


def process_file(path: Path, dry_run: bool) -> list[str]:
    try:
        content = path.read_text(encoding='utf-8')
    except (UnicodeDecodeError, PermissionError):
        return []
    new_content, changes = transform_content(content)
    if new_content != content and not dry_run:
        path.write_text(new_content, encoding='utf-8', newline='\n')
    return changes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--file', help='single file only')
    args = parser.parse_args()

    if args.file:
        files = [Path(args.file)]
    else:
        # Repo-root HTML + key subtrees that contain Trudy references
        # (templates/ feeds future rebuilds; js/ + css/ are client-side;
        # authors/ is live pages; output/qa-human/ is audit log)
        patterns = [
            '*.html',
            'templates/*.html',
            'authors/*.html',
            'js/*.js',
            'css/*.css',
            'scripts/build-*.js',
            'scripts/vary-baked-in-boilerplate.js',
            'scripts/compress-images.js',
            'scripts/_seo-favicon-standardize.js',
            'scripts/keyword-research/page-templates.js',
            'output/qa-human/*.json',
        ]
        files = []
        for pat in patterns:
            files.extend(Path('.').glob(pat))
        files = sorted(set(files))
        files = [f for f in files if '_originals_pre_bg_clean' not in str(f)]

    total_changed = 0
    summary = {}
    for path in files:
        changes = process_file(path, args.dry_run)
        if changes:
            total_changed += 1
            print(str(path) + ':')
            for c in changes:
                print(c)
                key = c.split('(')[0].strip()
                summary[key] = summary.get(key, 0) + 1

    print()
    print(('DRY RUN: ' if args.dry_run else '') + str(total_changed) + ' files changed')
    print()
    print('Change type summary:')
    for k, v in sorted(summary.items(), key=lambda x: -x[1]):
        print('  [' + str(v).rjust(4) + ' files] ' + k)


if __name__ == '__main__':
    main()
