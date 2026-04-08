#!/usr/bin/env python3
"""Insert tp-footer-links block into every top-level *.html file's site-footer."""
import os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

BLOCK = '''<div class="tp-footer-links">
  <div class="tp-footer-col">
    <h4>Get a Price</h4>
    <a href="/get-an-estimate.html">Get an estimate</a>
    <a href="/analyze-my-quote.html">Analyze a quote</a>
    <a href="/compare-quotes-picker.html">Compare quotes</a>
    <a href="/photo-estimate.html">Roof photo estimate</a>
  </div>
  <div class="tp-footer-col">
    <h4>Browse</h4>
    <a href="/all-cities.html">All cities</a>
    <a href="/guides.html">Cost guides</a>
    <a href="/find-contractors.html">Find contractors</a>
    <a href="/medical-cost-lookup.html">Medical cost lookup</a>
  </div>
  <div class="tp-footer-col">
    <h4>Top Trades</h4>
    <a href="/roofing-quote-analyzer.html">Roofing</a>
    <a href="/hvac-quote-analyzer.html">HVAC</a>
    <a href="/plumbing-quote-analyzer.html">Plumbing</a>
    <a href="/electrical-quote-analyzer.html">Electrical</a>
    <a href="/solar-quote-analyzer.html">Solar</a>
    <a href="/auto-repair.html">Auto repair</a>
  </div>
  <div class="tp-footer-col">
    <h4>About</h4>
    <a href="/about.html">About TruePrice</a>
    <a href="/methodology.html">Methodology</a>
    <a href="/privacy.html">Privacy</a>
    <a href="/terms.html">Terms</a>
  </div>
</div>
'''

SKIP_FILES = {'analyze-quote.html'}

# Match: <footer class="site-footer"> ... <div class="container"> (any whitespace/newlines)
PATTERN = re.compile(r'(<footer class="site-footer">\s*<div class="container">)')

def process(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'tp-footer-links' in content:
        return 'already'
    if not PATTERN.search(content):
        return 'no-footer'
    new_content, n = PATTERN.subn(r'\1\n' + BLOCK, content, count=1)
    if n == 0:
        return 'no-footer'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return 'updated'

def main():
    updated = 0
    already = 0
    no_footer = []
    files = [f for f in os.listdir(ROOT) if f.endswith('.html') and os.path.isfile(os.path.join(ROOT, f))]
    for fname in files:
        if fname in SKIP_FILES:
            continue
        result = process(os.path.join(ROOT, fname))
        if result == 'updated':
            updated += 1
        elif result == 'already':
            already += 1
        else:
            no_footer.append(fname)

    # Also process templates/
    tdir = os.path.join(ROOT, 'templates')
    tpl_updated = 0
    tpl_no = []
    if os.path.isdir(tdir):
        for fname in os.listdir(tdir):
            if not fname.endswith('.html'):
                continue
            result = process(os.path.join(tdir, fname))
            if result == 'updated':
                tpl_updated += 1
            elif result != 'already':
                tpl_no.append(fname)

    print(f'Updated: {updated}')
    print(f'Already had block: {already}')
    print(f'Skipped (no matching footer): {len(no_footer)}')
    for f in no_footer[:30]:
        print(f'  - {f}')
    if len(no_footer) > 30:
        print(f'  ... and {len(no_footer)-30} more')
    print(f'Templates updated: {tpl_updated}')
    if tpl_no:
        print(f'Templates skipped: {tpl_no}')

if __name__ == '__main__':
    main()
