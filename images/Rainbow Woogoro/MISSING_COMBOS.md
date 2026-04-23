# Rainbow Woogoro — Missing POC combinations

6 of 16 accessory combinations haven't been rendered yet. When you generate them, drop the PNGs into this folder using the exact filenames below — the outfit preview lab auto-wires them in.

## Filenames to produce

| Combination | Expected filename |
|---|---|
| Hat + Sunglasses | `rainbow poc hat sunglasses.png` |
| Hat + Toe Ring | `rainbow poc hat toering.png` |
| Hat + Sunglasses + Toe Ring | `rainbow poc hat sunglasses toering.png` |
| Bandana + Sunglasses | `rainbow poc bandana sunglasses.png` |
| Bandana + Sunglasses + Toe Ring | `rainbow poc bandana sunglasses toering.png` |
| Sunglasses + Toe Ring | `rainbow poc sunglasses toering.png` |

## Output spec (match existing clean files)

- **Resolution:** 1024×1024 PNG (matches the 5 already-transparent POCs; the 1254×1254 ones will be normalized via bg-removal script)
- **Background:** Full alpha transparency (RGBA, corner alpha = 0)
- **Subject:** Same Rainbow Woogoro pose as `rainbow poc 1.png` (naked base) — centered, facing camera, paws visible
- **Lighting:** Match existing POCs (soft diffuse, same direction, same saturation)
- **Style consistency:** Use the same generator + seed family (or same reference image) that produced `rainbow poc 1.png` / `rainbow poc hat bandana sunglasses.png`

## Accessory reference images (for generator)

Use these as style/design refs so accessories match across combos:

- Hat: `/images/Accessories/Hat.png` (rainbow bucket hat with purple pompoms)
- Bandana: `/images/Accessories/Bandana.png` (red paisley with heart motif)
- Sunglasses: `/images/Accessories/Sunglasses.png` (black frames, galaxy-print lenses)
- Toe Ring: `/images/Accessories/Toe_ring.png` (silver, small flower detail)

## After you drop the files

1. They'll appear in the lab immediately on page reload (the wiring in `experiments/outfit-preview-rainbow.html` is already set up to recognize these exact filenames).
2. The disabled pills will become enabled automatically.
3. The "10 of 16 rendered" counter will bump up to 16 of 16.

## Once Rainbow is complete = reusable recipe

Once all 16 combos exist for the Rainbow Woogoro, we have a validated baseline prompt/reference set that can be reused for the other 19 Woogoros. At that point decide between:

- **Set unlock** (5–6 curated outfits × 20 Woogoros = 100–120 renders total)
- **Full piece-stacking** (16 combos × 20 = 320 renders total)

Total cost at ~$0.10/image (AI) is $10–32. At Fiverr hand-render rates it's $500–1600+. The Rainbow POC quality bar is the gate — only commit to scaling when that's locked.
