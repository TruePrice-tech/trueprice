"""
Add OCR-first parsing to every vertical analyzer endpoint that handles
uploaded images. After this patch, every endpoint:

  1. Imports runOcr + ocrTextLooksGood from ./_ocr.js
  2. When the caller sends an image without OCR text, runs server-side
     OCR.space first
  3. If the OCR text passes ocrTextLooksGood(), drops the image from
     the Claude API call (text-only is ~10x cheaper)
  4. Falls back to Claude vision when OCR fails or text is poor

Idempotent: skips files that already have the OCR import.
"""

import os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# Already done manually
SKIP = {"_ocr.js", "_abuse-guard.js", "legal-fee-estimate.js", "parse-quote.js"}

# Endpoints we'll wire — only the *-estimate.js analyzer endpoints
TARGETS = sorted(glob.glob("api/*-estimate.js"))

OCR_BLOCK = '''
    // OCR-FIRST PIPELINE: when caller sends image without OCR text,
    // run server-side OCR.space first. If text is good, drop the image
    // from the Claude call (~10x cheaper). Falls back to Claude vision.
    if ((!text || text.length < 100) && images && images.length > 0) {
      const _firstImg = images[0];
      const _m = _firstImg && _firstImg.match(/^data:(image\\/[^;]+);base64,(.+)$/);
      if (_m) {
        const _ocrResult = await runOcr(_m[2], _m[1]);
        if (_ocrResult && _ocrResult.text) {
          text = _ocrResult.text;
          console.log(`[ocr-first] extracted ${_ocrResult.text.length} chars via ${_ocrResult.source}`);
        }
      }
    }
    const _useTextOnly = text && ocrTextLooksGood(text);

'''

def patch(file_path):
    name = os.path.basename(file_path)
    if name in SKIP:
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if "_ocr.js" in content:
        return f"ALREADY: {name}"

    # 1. Add import after the first set of imports
    import_match = re.search(r'^(import [^\n]+\n)+', content, re.MULTILINE)
    if not import_match:
        return f"NO_IMPORTS: {name}"
    insert_at = import_match.end()
    content = content[:insert_at] + 'import { runOcr, ocrTextLooksGood } from "./_ocr.js";\n' + content[insert_at:]

    # 2. Convert `const { text, images } = req.body;` to let so we can reassign text
    content = content.replace(
        "const { text, images } = req.body;",
        "let { text, images } = req.body;",
        1
    )

    # 3. Insert the OCR block after the empty-input check (which may follow
    #    the body destructure with a blank line in between).
    pattern = re.compile(
        r'(if \(!text && \(!images \|\| images\.length === 0\)\) \{\s*\n\s*return res\.status\(400\)\.json\([^)]+\);\s*\n\s*\}\n)',
        re.MULTILINE
    )
    new_content, n = pattern.subn(
        lambda m: m.group(1) + OCR_BLOCK,
        content,
        count=1
    )
    if n == 0:
        return f"NO_BODY_PARSE: {name}"

    # 4. Wrap the existing image-push loop with `!_useTextOnly &&` so it only fires
    #    when OCR didn't yield good text. Pattern matches `if (images && images.length > 0) {`
    new_content = re.sub(
        r'if \(images && images\.length > 0\) \{',
        r'if (!_useTextOnly && images && images.length > 0) {',
        new_content,
        count=1
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    return f"PATCHED: {name}"

def main():
    results = []
    for f in TARGETS:
        r = patch(f)
        if r:
            results.append(r)
    for r in results:
        print(r)
    n = sum(1 for r in results if r.startswith("PATCHED"))
    print(f"\n{n} patched")

if __name__ == "__main__":
    main()
