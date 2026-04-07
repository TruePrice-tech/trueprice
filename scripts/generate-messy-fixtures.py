"""
Generate "messy" versions of every clean comparison fixture: rotated 4
degrees, JPEG-compressed at quality 55, brightness shifted to mimic a
phone-camera photo of a paper printout. These exercise the OCR layer of
each analyzer, not just the structured parser, so the comparison test
catches OCR regressions before users do.

For each test-quotes/{vertical}-test-images/comparison-*.png we emit a
sibling messy-{name}.jpg in the same folder.

Run: python scripts/generate-messy-fixtures.py
"""
import os, sys, io, glob

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

try:
    from PIL import Image, ImageEnhance
except ImportError:
    print("PIL/Pillow required: pip install Pillow")
    sys.exit(1)


def make_messy(src, dst):
    img = Image.open(src).convert("RGB")
    # Slight rotation, white fill so corners don't go black (which kills OCR)
    img = img.rotate(-4, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))
    # Brightness shift (slightly underexposed like a phone snap)
    img = ImageEnhance.Brightness(img).enhance(0.92)
    # Mild contrast bump
    img = ImageEnhance.Contrast(img).enhance(1.10)
    # Save as compressed JPEG (the lossy compression is the OCR test)
    img.save(dst, "JPEG", quality=55, optimize=True)


def main():
    folders = sorted(glob.glob("test-quotes/*-test-images"))
    total = 0
    for folder in folders:
        sources = sorted(glob.glob(os.path.join(folder, "comparison-*.png")))
        if not sources:
            continue
        for src in sources:
            base = os.path.basename(src)
            if base.startswith("messy-"):
                continue
            dst = os.path.join(folder, "messy-" + base.replace(".png", ".jpg"))
            try:
                make_messy(src, dst)
                size = os.path.getsize(dst)
                print(f"  {dst} ({size} bytes)")
                total += 1
            except Exception as e:
                print(f"  FAIL {src}: {e}")
    print(f"\n{total} messy fixtures generated")


if __name__ == "__main__":
    main()
