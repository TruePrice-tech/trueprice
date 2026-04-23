# Woogoro Accessories — drop zone

Two ways to add accessory art:

## (A) Fast / ephemeral — drag-drop in the lab
Open `/experiments/woogoro-accessories.html`, pick a slot tab (Hat / Bandana / Glasses / Background), then drop a PNG onto the drop zone. Saved to your browser's localStorage only. Hover the item card to reveal the × delete button.

Use when: trying a single Fiverr draft, quick color experiments, anything you don't want in git.

## (B) Committed / shared — drop into a folder, register in manifest
1. Drop the PNG into the matching slot folder:
   - `experiments/accessories/hat/`
   - `experiments/accessories/bandana/`
   - `experiments/accessories/glasses/`
   - `experiments/accessories/background/`
2. Add an entry to `manifest.json`:
   ```json
   {
     "hat": [
       { "id": "pirate-hat", "name": "Pirate Hat", "file": "pirate-hat.png" }
     ]
   }
   ```
3. Commit + push. Lab picks it up on next reload, shows a `repo` badge on the card.

Use when: final art from Fiverr, anything that should persist across devices / show up for anyone else opening the lab.

## Art guidelines

- **Transparent background** (PNG with alpha or SVG).
- **Square-ish canvas** for hats (about 1:1), wide for bandanas (2:1), very wide for glasses (3:1). The lab scales the image to fit the slot's default width; aspect ratio is preserved from the source file.
- **Centered content** — the lab positions the item by its center. Bleed transparent space evenly so the center of the PNG = the center of the accessory.
- **Resolution** 400-800px wide is plenty; larger just inflates git size without visual gain.

## Naming

Keep filenames lowercase, hyphen-separated: `pirate-hat.png`, `round-sunglasses.png`, `red-bandana-polkadot.png`. The lab slugifies the filename if you don't supply an `id`.
