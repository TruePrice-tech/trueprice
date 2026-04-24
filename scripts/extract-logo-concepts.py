"""
Extract the 10 numbered logo concepts from `images/Logo Ideas/Logo ideas.png`
contact sheet into individual transparent-background PNGs so each can be
previewed on its own at real render sizes.

Grid layout (read from the contact sheet — 1254x1254):
  - Row 1 (y=0..418):   concepts 1, 2, 3    (3 columns of ~418 wide)
  - Row 2 (y=418..836): concepts 4, 5, 6    (3 columns of ~418 wide)
  - Row 3 (y=836..1254):concepts 7, 8, 9, 10 (4 columns of ~313 wide)

Then: white -> alpha (keeps black silhouettes with transparent BG) so the
favicon / header mockups can layer over any color.
"""
from PIL import Image
from pathlib import Path

SRC = Path("images/Logo Ideas/Logo ideas.png")
OUT_DIR = Path("images/Logo Ideas/concepts")
OUT_DIR.mkdir(parents=True, exist_ok=True)

im = Image.open(SRC).convert("RGBA")
W, H = im.size  # 1254 x 1254

ROW_H = H // 3  # 418
row_three_top = ROW_H * 2

# Chop off bottom strip of each cell to exclude the printed number label (1..10).
# Rows 1–2 numbers sit lower in a tall cell; row 3 numbers sit closer to the art.
ROW12_STRIP = 0.14
ROW3_STRIP = 0.20

cells = []
# Rows 1 and 2 — 3 columns each
for row_idx, y0 in enumerate([0, ROW_H]):
    col_w = W // 3
    cell_bottom = y0 + ROW_H - int(ROW_H * ROW12_STRIP)
    for col_idx in range(3):
        n = row_idx * 3 + col_idx + 1
        cells.append((n, col_idx * col_w, y0, (col_idx + 1) * col_w, cell_bottom))
# Row 3 — 4 columns
col_w = W // 4
row3_h = H - row_three_top
cell_bottom = H - int(row3_h * ROW3_STRIP)
for col_idx in range(4):
    n = 7 + col_idx
    cells.append((n, col_idx * col_w, row_three_top, (col_idx + 1) * col_w, cell_bottom))


def white_to_alpha(img: Image.Image) -> Image.Image:
    """Convert near-white background to transparent, keep dark silhouette."""
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # pure/near-white -> transparent
            if r > 240 and g > 240 and b > 240:
                px[x, y] = (255, 255, 255, 0)
    return img


def trim_transparent(img: Image.Image, pad: int = 8) -> Image.Image:
    """Trim to non-transparent bbox + padding."""
    bbox = img.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(img.size[0], x1 + pad)
    y1 = min(img.size[1], y1 + pad)
    return img.crop((x0, y0, x1, y1))


for n, x0, y0, x1, y1 in cells:
    crop = im.crop((x0, y0, x1, y1))
    crop = white_to_alpha(crop)
    crop = trim_transparent(crop, pad=12)
    out = OUT_DIR / f"concept-{n:02d}.png"
    crop.save(out)
    print(f"wrote {out} ({crop.size[0]}x{crop.size[1]})")

print(f"\n10 concepts extracted to {OUT_DIR}/")
