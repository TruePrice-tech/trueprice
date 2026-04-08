"""
One-shot cleanup: remove address-form leakage and tp-dual-opts wrappers
from siding/painting/concrete/foundation quote-analyzer pages so each is
a pure upload-only journey.
"""
import re

targets = {
  'siding-quote-analyzer.html': 'side',
  'painting-quote-analyzer.html': 'paint',
  'concrete-quote-analyzer.html': 'conc',
  'foundation-quote-analyzer.html': 'found',
}

for f, prefix in targets.items():
  s = open(f, encoding='utf-8').read()
  before = len(s)

  # 1. Remove the divider + address-form block (each line ends with backslash because the JS template uses line continuation)
  pat = re.compile(
    r'\s*<div class="' + prefix + r'-divider">or enter your address[^<]*</div>\\\s*'
    r'<div class="' + prefix + r'-address-form">\\.*?</div>\\(?=\s*</div>\';)',
    re.DOTALL
  )
  s = pat.sub('\n        ', s)

  # 2. Remove the tp-dual-opts wrapper (siding + painting only)
  pat2 = re.compile(
    r'<style>\.tp-dual-opts\{[^<]*</style>\\\s*<div class="tp-dual-opts">\\\s*'
    r'(<div class="' + prefix + r'-upload-zone"[^>]*>\\.*?</div>\\)\s*'
    r'<a href="/photo-estimate\.html[^"]*"[^>]*>\\.*?</a>\\\s*</div>\\',
    re.DOTALL
  )
  s = pat2.sub(lambda m: m.group(1).replace('style="margin:0;"', ''), s)

  # 3. Remove "Have multiple quotes" inline box (any vertical)
  pat3 = re.compile(
    r'\s*<div style="text-align:center; margin-top:16px[^"]*">\\\s*'
    r'<span[^>]*>Have multiple quotes\?\s*</span>\\\s*'
    r'<a href="/compare-[^"]*"[^>]*>Compare [^<]*</a>\\\s*</div>\\',
    re.DOTALL
  )
  s = pat3.sub('', s)

  open(f, 'w', encoding='utf-8').write(s)
  print(f'{f}: {before} -> {len(s)} ({before-len(s)} bytes removed)')
