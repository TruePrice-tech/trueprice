"""
Concept-03 (the chosen logo) layout: circle + Iris silhouette in the top
~72%, with laurel flourishes flanking a "Woogoro" wordmark in the bottom
~28%. Laurels + wordmark are horizontally interleaved, so they can't be
cleanly separated — concept-03 is monolithic.

Strategy:
  * header logo lockup → full concept-03 (replace the old Iris+<span> pair
    with a single image; the wordmark is baked in)
  * favicon / apple-touch-icon → circle-only seal (at 32px the baked
    wordmark would turn into pixel mud, so we crop it out)

Outputs:
  images/Iris/Iris laurel lockup.png      (full concept-03, for header + og)
  images/Iris/Iris laurel seal.png        (seal only, circle + Iris, transparent)
  images/Iris/Iris laurel seal 512.png    (512x512 padded, for social uses)
  images/Iris/Iris laurel seal 180.png    (180x180 apple-touch-icon)
  favicon.png                              (regenerated from seal, 512x512)
"""
from PIL import Image
from pathlib import Path
import shutil

SRC = Path("images/Logo Ideas/concepts/concept-03.png")
IRIS_DIR = Path("images/Iris")

im = Image.open(SRC).convert("RGBA")
W, H = im.size
print(f"source {W}x{H}")

lockup_path = IRIS_DIR / "Iris laurel lockup.png"
shutil.copyfile(SRC, lockup_path)
print(f"wrote {lockup_path} (full lockup, copy of concept-03)")

# Seal-only: crop bottom 28% (wordmark + laurel flourishes) and trim.
seal = im.crop((0, 0, W, int(H * 0.72)))


def trim_transparent(img: Image.Image, pad: int = 4) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(img.size[0], x1 + pad)
    y1 = min(img.size[1], y1 + pad)
    return img.crop((x0, y0, x1, y1))


seal = trim_transparent(seal, pad=8)
print(f"seal  {seal.size[0]}x{seal.size[1]}")

seal_path = IRIS_DIR / "Iris laurel seal.png"
seal.save(seal_path)
print(f"wrote {seal_path}")


def pad_square(img: Image.Image, side: int, pad_ratio: float = 0.08) -> Image.Image:
    """Center the seal inside a transparent square of `side` px,
    leaving `pad_ratio` of each edge as breathing room."""
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    inner = int(side * (1 - 2 * pad_ratio))
    iw, ih = img.size
    scale = min(inner / iw, inner / ih)
    new_w = max(1, int(iw * scale))
    new_h = max(1, int(ih * scale))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    x = (side - new_w) // 2
    y = (side - new_h) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas


for side, out in [(512, IRIS_DIR / "Iris laurel seal 512.png"),
                  (180, IRIS_DIR / "Iris laurel seal 180.png")]:
    pad_square(seal, side).save(out)
    print(f"wrote {out} ({side}x{side})")

# Regenerate favicon.png at site root (512x512 — modern browsers downscale).
fav = pad_square(seal, 512)
fav.save("favicon.png")
print("wrote favicon.png (512x512)")
